-- iter-CDB-0.2: Per-host download telemetry. One row per file-host
-- streaming attempt; drives the comic-host improvement loop's scorecard.

CREATE TABLE IF NOT EXISTS "HostDownloadAttempt" (
    "id"           BIGSERIAL                       NOT NULL,
    "chapterId"    INTEGER,
    "jobId"        BIGINT,
    "host"         TEXT                            NOT NULL,
    "url"          TEXT                            NOT NULL,
    "outcome"      TEXT                            NOT NULL,
    "durationMs"   INTEGER,
    "fileBytes"    INTEGER,
    "retries"      INTEGER                         NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) WITHOUT TIME ZONE  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostDownloadAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HostDownloadAttempt_host_createdAt_idx"
    ON "HostDownloadAttempt" ("host", "createdAt");
CREATE INDEX IF NOT EXISTS "HostDownloadAttempt_outcome_createdAt_idx"
    ON "HostDownloadAttempt" ("outcome", "createdAt");
