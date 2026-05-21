-- =====================================================
-- ADD HARD TIMEOUT COLUMN
-- =====================================================
-- Adds absolute deadline for job completion.
-- Jobs exceeding hard_timeout_at are automatically failed.
-- =====================================================

-- Add column to base table (will propagate to partitions)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hard_timeout_at TIMESTAMPTZ;

COMMENT ON COLUMN jobs.hard_timeout_at IS
'Absolute deadline for job completion. Jobs exceeding this time are automatically failed regardless of attempt count.';

-- =====================================================
-- Update recover_stale_jobs to also check hard_timeout_at
-- =====================================================
CREATE OR REPLACE FUNCTION recover_stale_jobs(
    p_stale_threshold_seconds INTEGER DEFAULT 600
)
RETURNS INTEGER AS $$
DECLARE
    v_recovered_count INTEGER;
    v_failed_count INTEGER;
    v_timeout_failed_count INTEGER;
BEGIN
    -- =========================================
    -- Step 1: FAIL jobs that have exceeded hard_timeout_at
    -- These are absolutely done - no more retries
    -- =========================================
    WITH timeout_jobs AS (
        DELETE FROM jobs_active
        WHERE status = 'active'
          AND hard_timeout_at IS NOT NULL
          AND hard_timeout_at < NOW()
        RETURNING *
    )
    INSERT INTO jobs_archived (
        id, queue_name, job_type, priority, payload, result, metadata,
        status, progress, created_at, scheduled_for, started_at, completed_at,
        attempt_count, max_attempts, retry_delay_seconds,
        last_error, worker_id, lease_expires_at, hard_timeout_at,
        processing_time_ms, wait_time_ms, manga_id, chapter_id, partition_key
    )
    SELECT
        id, queue_name, job_type, priority, payload, result, metadata,
        'failed'::"JobStatus", progress, created_at, scheduled_for, started_at, NOW(),
        attempt_count, max_attempts, retry_delay_seconds,
        jsonb_build_object(
            'error', 'Hard timeout exceeded - job forcibly terminated',
            'final_attempt', attempt_count,
            'hard_timeout_at', hard_timeout_at,
            'failed_at', NOW(),
            'reason', 'hard_timeout_exceeded'
        ),
        NULL, NULL, hard_timeout_at,
        CASE WHEN started_at IS NOT NULL THEN EXTRACT(MILLISECOND FROM (NOW() - started_at))::INTEGER ELSE NULL END,
        wait_time_ms, manga_id, chapter_id, 'archived'
    FROM timeout_jobs;

    GET DIAGNOSTICS v_timeout_failed_count = ROW_COUNT;

    -- =========================================
    -- Step 2: FAIL jobs that have exceeded max_attempts
    -- =========================================
    WITH failed_jobs AS (
        DELETE FROM jobs_active
        WHERE status = 'active'
          AND lease_expires_at < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
          AND attempt_count >= max_attempts
        RETURNING *
    )
    INSERT INTO jobs_archived (
        id, queue_name, job_type, priority, payload, result, metadata,
        status, progress, created_at, scheduled_for, started_at, completed_at,
        attempt_count, max_attempts, retry_delay_seconds,
        last_error, worker_id, lease_expires_at, hard_timeout_at,
        processing_time_ms, wait_time_ms, manga_id, chapter_id, partition_key
    )
    SELECT
        id, queue_name, job_type, priority, payload, result, metadata,
        'failed'::"JobStatus", progress, created_at, scheduled_for, started_at, NOW(),
        attempt_count, max_attempts, retry_delay_seconds,
        jsonb_build_object(
            'error', 'Max attempts exceeded - job failed during stale recovery',
            'final_attempt', attempt_count,
            'max_attempts', max_attempts,
            'failed_at', NOW(),
            'reason', 'stale_recovery_max_attempts_exceeded'
        ),
        NULL, NULL, hard_timeout_at,
        CASE WHEN started_at IS NOT NULL THEN EXTRACT(MILLISECOND FROM (NOW() - started_at))::INTEGER ELSE NULL END,
        wait_time_ms, manga_id, chapter_id, 'archived'
    FROM failed_jobs;

    GET DIAGNOSTICS v_failed_count = ROW_COUNT;

    IF v_timeout_failed_count > 0 THEN
        RAISE NOTICE 'Stale job recovery: Failed % jobs that exceeded hard_timeout', v_timeout_failed_count;
    END IF;

    IF v_failed_count > 0 THEN
        RAISE NOTICE 'Stale job recovery: Failed % jobs that exceeded max_attempts', v_failed_count;
    END IF;

    -- =========================================
    -- Step 3: RECOVER jobs that still have retry attempts remaining
    -- =========================================
    WITH stale_jobs AS (
        UPDATE jobs_active SET
            status = 'retrying'::"JobStatus",
            worker_id = NULL,
            lease_expires_at = NULL,
            scheduled_for = NOW() + (
                retry_delay_seconds * POWER(2, LEAST(attempt_count - 1, 6))
            )::INTEGER * INTERVAL '1 second'
        WHERE status = 'active'
          AND lease_expires_at < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
          AND attempt_count < max_attempts
          AND (hard_timeout_at IS NULL OR hard_timeout_at > NOW())
        RETURNING id
    )
    SELECT COUNT(*) INTO v_recovered_count FROM stale_jobs;

    IF v_recovered_count > 0 THEN
        RAISE NOTICE 'Stale job recovery: Recovered % jobs for retry', v_recovered_count;
    END IF;

    RETURN v_recovered_count;
END;
$$ LANGUAGE plpgsql;
