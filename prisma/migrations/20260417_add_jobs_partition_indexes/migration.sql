-- Add the queue-polling indexes that already exist on jobs_volatile to the
-- jobs_active and jobs_archived partitions. Without them, the claim-jobs
-- poller in PostgreSQLQueueWorker.claimJobs falls back to a sequential scan
-- across every partition, producing billions of tuple reads under load.
--
-- Mirrors the three indexes defined on jobs_volatile:
--   (queue_name, priority DESC, scheduled_for)  -- poll / claim
--   (status, queue_name)                        -- status filter
--   (worker_id, lease_expires_at)               -- stale lease recovery

CREATE INDEX IF NOT EXISTS "idx_jobs_active_queue"
  ON "jobs_active" ("queue_name", "priority" DESC, "scheduled_for");

CREATE INDEX IF NOT EXISTS "idx_jobs_active_status"
  ON "jobs_active" ("status", "queue_name");

CREATE INDEX IF NOT EXISTS "idx_jobs_active_worker"
  ON "jobs_active" ("worker_id", "lease_expires_at");

CREATE INDEX IF NOT EXISTS "idx_jobs_archived_queue"
  ON "jobs_archived" ("queue_name", "priority" DESC, "scheduled_for");

CREATE INDEX IF NOT EXISTS "idx_jobs_archived_status"
  ON "jobs_archived" ("status", "queue_name");

CREATE INDEX IF NOT EXISTS "idx_jobs_archived_worker"
  ON "jobs_archived" ("worker_id", "lease_expires_at");
