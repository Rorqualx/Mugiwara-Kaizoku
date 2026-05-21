-- =====================================================
-- FIX JOB PARTITION FUNCTIONS
-- =====================================================
-- PostgreSQL cannot move rows between partitions via UPDATE.
-- When job status changes from 'active' to 'completed'/'failed',
-- the row needs to move from jobs_active to jobs_archived.
-- This requires DELETE + INSERT instead of UPDATE.
-- =====================================================

-- Fix complete_job function to handle partition movement
CREATE OR REPLACE FUNCTION complete_job(
    p_job_id BIGINT,
    p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
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
    v_processing_time_ms := EXTRACT(MILLISECOND FROM (NOW() - v_job.started_at))::INTEGER;

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
        partition_key
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
        'archived'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fix fail_job function to handle partition movement for failed jobs
CREATE OR REPLACE FUNCTION fail_job(
    p_job_id BIGINT,
    p_error TEXT,
    p_error_details JSONB DEFAULT NULL
)
RETURNS TEXT AS $$
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
            partition_key
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
            EXTRACT(MILLISECOND FROM (NOW() - v_job.started_at))::INTEGER,
            v_job.wait_time_ms,
            v_job.manga_id,
            v_job.chapter_id,
            'archived'
        );

        RETURN 'failed';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Drop the partition key trigger since we're handling partitioning explicitly
-- This trigger was causing issues because it tries to change partition_key
-- but PostgreSQL can't move rows between partitions via UPDATE
DROP TRIGGER IF EXISTS set_partition_key_trigger ON jobs;

-- Create a new trigger that only sets partition_key on INSERT
-- (for new jobs being created, not for status changes)
CREATE OR REPLACE FUNCTION set_partition_key_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set partition_key on INSERT based on initial status
    IF NEW.status IN ('pending', 'active', 'retrying') THEN
        NEW.partition_key = 'active';
    ELSE
        NEW.partition_key = 'archived';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_partition_key_on_insert_trigger
    BEFORE INSERT ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_partition_key_on_insert();
