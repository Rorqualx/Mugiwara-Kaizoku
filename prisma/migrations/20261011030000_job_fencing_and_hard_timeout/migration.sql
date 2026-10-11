-- Job queue: attempt fencing and an enforced per-attempt hard timeout.
--
-- 1. complete_job / fail_job take an optional p_attempt. A worker passes the
--    attempt_count it claimed; if the job was recovered and claimed again in
--    the meantime the count has moved on and the late call does nothing
--    (returns FALSE / 'not_found') instead of completing or failing the newer
--    attempt. Callers that finish a job on someone else's behalf (the download
--    monitor, admin force-fail) omit it and keep the previous behaviour.
--    The old signatures are dropped first: keeping them beside the new ones
--    would make every existing two/three-argument call ambiguous.
-- 2. recover_stale_jobs also recovers jobs past hard_timeout_at. The deadline
--    was only enforced inside the worker by aborting the handler, which does
--    nothing for handlers that ignore the abort signal. The worker now stamps
--    it per attempt and leaves it NULL where no limit applies.
-- 3. Deadlines stamped by older code (first claim + 30 minutes, kept across
--    retries, set on every job type) are cleared so they cannot fail a job
--    that is merely waiting or downloading.

DROP FUNCTION IF EXISTS complete_job(bigint, jsonb);
DROP FUNCTION IF EXISTS fail_job(bigint, text, jsonb);

UPDATE jobs_active
SET hard_timeout_at = NULL
WHERE hard_timeout_at IS NOT NULL
  AND status IN ('pending', 'retrying', 'active');

CREATE FUNCTION complete_job(p_job_id bigint, p_result jsonb DEFAULT NULL::jsonb, p_attempt integer DEFAULT NULL::integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_job RECORD;
    v_processing_time_ms INTEGER;
BEGIN
    -- First, get the job and delete it from jobs_active
    -- A caller that passes p_attempt only completes the attempt it started:
    -- if the job was recovered and claimed again meanwhile, attempt_count has
    -- moved on and this call is a no-op.
    DELETE FROM jobs_active
    WHERE id = p_job_id AND status = 'active'
      AND (p_attempt IS NULL OR attempt_count = p_attempt)
    RETURNING * INTO v_job;

    -- If job was not found (or belongs to a newer attempt), return false
    IF v_job IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Calculate processing time
    v_processing_time_ms := LEAST(EXTRACT(EPOCH FROM (NOW() - v_job.started_at)) * 1000, 2147483647)::INTEGER;

    -- Insert into jobs_archived with completed status
    INSERT INTO jobs_archived (
        id,
        queue_name,
        job_type,
        priority,
        payload,
        result,
        metadata,
        status,
        progress,
        created_at,
        scheduled_for,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        retry_delay_seconds,
        last_error,
        worker_id,
        lease_expires_at,
        processing_time_ms,
        wait_time_ms,
        manga_id,
        chapter_id,
        partition_key,
        initiated_by_user_id
    ) VALUES (
        v_job.id,
        v_job.queue_name,
        v_job.job_type,
        v_job.priority,
        v_job.payload,
        p_result,
        v_job.metadata,
        'completed',
        100,
        v_job.created_at,
        v_job.scheduled_for,
        v_job.started_at,
        NOW(),
        v_job.attempt_count,
        v_job.max_attempts,
        v_job.retry_delay_seconds,
        v_job.last_error,
        NULL,  -- Clear worker_id
        NULL,  -- Clear lease_expires_at
        v_processing_time_ms,
        v_job.wait_time_ms,
        v_job.manga_id,
        v_job.chapter_id,
        'archived',
        v_job.initiated_by_user_id
    );

    RETURN TRUE;
END;
$function$
;
CREATE FUNCTION fail_job(p_job_id bigint, p_error text, p_error_details jsonb DEFAULT NULL::jsonb, p_attempt integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_job RECORD;
    v_retry_delay INTEGER;
    v_next_attempt TIMESTAMPTZ;
    v_error_json JSONB;
BEGIN
    -- Get the job from jobs_active
    -- Lock the row so a concurrent completion or recovery cannot interleave.
    -- With p_attempt, only the attempt the caller started may be failed.
    SELECT * INTO v_job
    FROM jobs_active
    WHERE id = p_job_id AND status = 'active'
      AND (p_attempt IS NULL OR attempt_count = p_attempt)
    FOR UPDATE;

    IF v_job IS NULL THEN
        RETURN 'not_found';
    END IF;

    -- Build error JSON
    v_error_json := jsonb_build_object(
        'error', p_error,
        'details', p_error_details,
        'occurred_at', NOW(),
        'attempt', v_job.attempt_count
    );

    -- Check if we should retry
    IF v_job.attempt_count < v_job.max_attempts THEN
        -- Exponential backoff with jitter
        v_retry_delay := v_job.retry_delay_seconds * POWER(2, v_job.attempt_count - 1) +
                        (RANDOM() * 10)::INTEGER;
        v_next_attempt := NOW() + (v_retry_delay || ' seconds')::INTERVAL;

        -- Update in place (status stays in 'active' partition statuses)
        UPDATE jobs_active SET
            status = 'retrying',
            scheduled_for = v_next_attempt,
            last_error = v_error_json,
            worker_id = NULL,
            lease_expires_at = NULL
        WHERE id = p_job_id;

        RETURN 'retrying';
    ELSE
        -- Max attempts reached - need to move to archived partition
        -- First delete from jobs_active
        DELETE FROM jobs_active WHERE id = p_job_id;

        -- Update error JSON for final failure
        v_error_json := jsonb_build_object(
            'error', p_error,
            'details', p_error_details,
            'final_attempt', v_job.attempt_count,
            'failed_at', NOW()
        );

        -- Insert into jobs_archived
        INSERT INTO jobs_archived (
            id,
            queue_name,
            job_type,
            priority,
            payload,
            result,
            metadata,
            status,
            progress,
            created_at,
            scheduled_for,
            started_at,
            completed_at,
            attempt_count,
            max_attempts,
            retry_delay_seconds,
            last_error,
            worker_id,
            lease_expires_at,
            processing_time_ms,
            wait_time_ms,
            manga_id,
            chapter_id,
            partition_key,
            initiated_by_user_id
        ) VALUES (
            v_job.id,
            v_job.queue_name,
            v_job.job_type,
            v_job.priority,
            v_job.payload,
            v_job.result,
            v_job.metadata,
            'failed',
            v_job.progress,
            v_job.created_at,
            v_job.scheduled_for,
            v_job.started_at,
            NOW(),
            v_job.attempt_count,
            v_job.max_attempts,
            v_job.retry_delay_seconds,
            v_error_json,
            NULL,
            NULL,
            LEAST(EXTRACT(EPOCH FROM (NOW() - v_job.started_at)) * 1000, 2147483647)::INTEGER,
            v_job.wait_time_ms,
            v_job.manga_id,
            v_job.chapter_id,
            'archived',
            v_job.initiated_by_user_id
        );

        RETURN 'failed';
    END IF;
END;
$function$
;
CREATE OR REPLACE FUNCTION recover_stale_jobs(p_stale_threshold_seconds integer DEFAULT 600)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_recovered_count INTEGER;
    v_failed_count INTEGER;
BEGIN
    -- =========================================
    -- A job is stale when its lease lapsed (worker died or stopped
    -- heartbeating) or when it ran past hard_timeout_at (handler hung while
    -- the heartbeat kept the lease alive). hard_timeout_at is NULL for job
    -- types with no time limit and for jobs handed off to a download client.
    --
    -- Step 1: FAIL jobs that have exceeded max_attempts
    -- These should not be retried - move to archived/failed
    -- =========================================
    WITH failed_jobs AS (
        DELETE FROM jobs_active
        WHERE status = 'active'
          AND (
            lease_expires_at < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
            OR hard_timeout_at < NOW()
          )
          AND attempt_count >= max_attempts
        RETURNING *
    )
    INSERT INTO jobs_archived (
        id,
        queue_name,
        job_type,
        priority,
        payload,
        result,
        metadata,
        status,
        progress,
        created_at,
        scheduled_for,
        started_at,
        completed_at,
        attempt_count,
        max_attempts,
        retry_delay_seconds,
        last_error,
        worker_id,
        lease_expires_at,
        processing_time_ms,
        wait_time_ms,
        manga_id,
        chapter_id,
        partition_key,
        initiated_by_user_id
    )
    SELECT
        id,
        queue_name,
        job_type,
        priority,
        payload,
        result,
        metadata,
        'failed'::"JobStatus",
        progress,
        created_at,
        scheduled_for,
        started_at,
        NOW(),  -- completed_at
        attempt_count,
        max_attempts,
        retry_delay_seconds,
        jsonb_build_object(
            'error', CASE
                WHEN hard_timeout_at < NOW() THEN 'Hard timeout exceeded on final attempt'
                ELSE 'Max attempts exceeded - job failed during stale recovery'
            END,
            'final_attempt', attempt_count,
            'max_attempts', max_attempts,
            'failed_at', NOW(),
            'reason', CASE
                WHEN hard_timeout_at < NOW() THEN 'hard_timeout_max_attempts_exceeded'
                ELSE 'stale_recovery_max_attempts_exceeded'
            END
        ),
        NULL,  -- worker_id cleared
        NULL,  -- lease_expires_at cleared
        CASE
            WHEN started_at IS NOT NULL THEN LEAST(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000, 2147483647)::INTEGER
            ELSE NULL
        END,
        wait_time_ms,
        manga_id,
        chapter_id,
        'archived',
        initiated_by_user_id
    FROM failed_jobs;

    GET DIAGNOSTICS v_failed_count = ROW_COUNT;

    IF v_failed_count > 0 THEN
        RAISE NOTICE 'Stale job recovery: Failed % jobs that exceeded max_attempts', v_failed_count;
    END IF;

    -- =========================================
    -- Step 2: RECOVER jobs that still have retry attempts remaining
    -- Set status to 'retrying' with exponential backoff scheduling
    -- =========================================
    WITH stale_jobs AS (
        UPDATE jobs_active SET
            status = 'retrying'::"JobStatus",
            worker_id = NULL,
            lease_expires_at = NULL,
            hard_timeout_at = NULL,
            last_error = CASE
                WHEN hard_timeout_at < NOW() THEN jsonb_build_object(
                    'error', 'Hard timeout exceeded',
                    'attempt', attempt_count,
                    'occurred_at', NOW(),
                    'reason', 'hard_timeout'
                )
                ELSE last_error
            END,
            -- Exponential backoff: base_delay * 2^(attempt_count - 1)
            scheduled_for = NOW() + (
                retry_delay_seconds * POWER(2, LEAST(attempt_count - 1, 6))  -- Cap at 2^6 = 64x multiplier
            )::INTEGER * INTERVAL '1 second'
        WHERE status = 'active'
          AND (
            lease_expires_at < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
            OR hard_timeout_at < NOW()
          )
          AND attempt_count < max_attempts
        RETURNING id
    )
    SELECT COUNT(*) INTO v_recovered_count FROM stale_jobs;

    IF v_recovered_count > 0 THEN
        RAISE NOTICE 'Stale job recovery: Recovered % jobs for retry', v_recovered_count;
    END IF;

    -- Return total recovered (not counting failed ones)
    RETURN v_recovered_count;
END;
$function$
;
