-- Seed the default queue_config row.
--
-- queueManager.enqueue() looks up a queue_config row by name and throws
-- "Queue 'default' is not active or does not exist" if it's missing.
-- The original seed migration was deleted in the public-release history
-- squash, so fresh installs (and any older install that never had the
-- row backfilled) silently fail on the first job push.
--
-- queueManager.runInitialization() also upserts this row at boot as a
-- second line of defense — between the two, the queue self-heals on
-- any install path.

INSERT INTO "queue_config" ("queue_name", "is_active", "max_concurrent_jobs", "default_priority", "default_max_attempts", "default_retry_delay_seconds")
VALUES ('default', true, 10, 50, 3, 60)
ON CONFLICT ("queue_name") DO NOTHING;
