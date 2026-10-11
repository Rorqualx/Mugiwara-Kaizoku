-- Job SQL functions: correct timings and keep the job owner when archiving.
--
-- 1. processing_time_ms was computed with EXTRACT(MILLISECOND FROM interval),
--    which returns only the seconds field of the interval (0-59999), so every
--    duration wrapped at one minute. It is now the full elapsed time
--    (EXTRACT(EPOCH) * 1000), clamped to the INTEGER column's range.
-- 2. The INSERTs into jobs_archived listed their columns explicitly and
--    predate jobs.initiated_by_user_id, so a job archived through these
--    functions lost its owner. The column is now carried over.
--
-- Function bodies are otherwise unchanged from what is installed. The hard
-- timeout step from 20260105_fix_stale_job_recovery/add_hard_timeout.sql
-- (a file Prisma never executed) is deliberately NOT added here: the worker
-- stamps hard_timeout_at = claim time + 30 minutes on every job, and torrent
-- download jobs legitimately stay active far longer.

CREATE OR REPLACE FUNCTION complete_job(p_job_id bigint, p_result jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_job RECORD;
    v_processing_time_ms INTEGER;
BEGIN
    -- First, get the job and delete it from jobs_active
    DELETE FROM jobs_active
    WHERE id = p_job_id AND status = 'active'
    RETURNING * INTO v_job;

    -- If job was not found, return false
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
CREATE OR REPLACE FUNCTION fail_job(p_job_id bigint, p_error text, p_error_details jsonb DEFAULT NULL::jsonb)
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
    SELECT * INTO v_job
    FROM jobs_active
    WHERE id = p_job_id AND status = 'active';

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
    -- Step 1: FAIL jobs that have exceeded max_attempts
    -- These should not be retried - move to archived/failed
    -- =========================================
    WITH failed_jobs AS (
        DELETE FROM jobs_active
        WHERE status = 'active'
          AND lease_expires_at < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
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
            'error', 'Max attempts exceeded - job failed during stale recovery',
            'final_attempt', attempt_count,
            'max_attempts', max_attempts,
            'failed_at', NOW(),
            'reason', 'stale_recovery_max_attempts_exceeded'
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
            -- Exponential backoff: base_delay * 2^(attempt_count - 1)
            scheduled_for = NOW() + (
                retry_delay_seconds * POWER(2, LEAST(attempt_count - 1, 6))  -- Cap at 2^6 = 64x multiplier
            )::INTEGER * INTERVAL '1 second'
        WHERE status = 'active'
          AND lease_expires_at < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
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
