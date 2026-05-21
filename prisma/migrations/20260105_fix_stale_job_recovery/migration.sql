-- =====================================================
-- FIX STALE JOB RECOVERY
-- =====================================================
-- Problem: recover_stale_jobs() was resetting jobs to 'pending' without
-- checking attempt_count < max_attempts, causing infinite retry loops.
--
-- Fix: Check max_attempts before recovery. Jobs that have exceeded
-- max_attempts are moved to 'failed' status instead of being recycled.
-- =====================================================

-- Drop and recreate the function with proper max_attempts checking
CREATE OR REPLACE FUNCTION recover_stale_jobs(
    p_stale_threshold_seconds INTEGER DEFAULT 600
)
RETURNS INTEGER AS $$
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
        partition_key
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
            WHEN started_at IS NOT NULL THEN EXTRACT(MILLISECOND FROM (NOW() - started_at))::INTEGER
            ELSE NULL
        END,
        wait_time_ms,
        manga_id,
        chapter_id,
        'archived'
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
$$ LANGUAGE plpgsql;

-- =====================================================
-- Add helper function to get stale job stats
-- Useful for monitoring and debugging
-- =====================================================
CREATE OR REPLACE FUNCTION get_stale_job_stats()
RETURNS TABLE (
    total_stale INTEGER,
    will_retry INTEGER,
    will_fail INTEGER,
    oldest_stale_job TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_stale,
        COUNT(*) FILTER (WHERE attempt_count < max_attempts)::INTEGER AS will_retry,
        COUNT(*) FILTER (WHERE attempt_count >= max_attempts)::INTEGER AS will_fail,
        MIN(lease_expires_at) AS oldest_stale_job
    FROM jobs_active
    WHERE status = 'active'
      AND lease_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Add scheduled job cleanup function
-- Cleans up old completed/failed jobs from archived partition
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_old_archived_jobs(
    p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM jobs_archived
    WHERE completed_at < NOW() - (p_retention_days || ' days')::INTERVAL
      AND status IN ('completed', 'failed', 'cancelled');

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recover_stale_jobs IS
'Recovers stale jobs (lease expired) for retry, or moves to failed if max_attempts exceeded.
Returns count of jobs recovered for retry. Jobs exceeding max_attempts are archived as failed.';

COMMENT ON FUNCTION get_stale_job_stats IS
'Returns statistics about stale jobs: total count, how many will retry vs fail.
Useful for monitoring job queue health.';

COMMENT ON FUNCTION cleanup_old_archived_jobs IS
'Cleans up old completed/failed jobs from the archived partition.
Default retention is 30 days.';
