-- iter-EX: Per-chapter per-source dispatch history. Drives the "next best
-- source" exhaustion path — pickBestNativeForChapter skips sources that
-- have already failed for a chapter, and the UI can surface fully-
-- exhausted chapters distinctly.

CREATE TABLE IF NOT EXISTS "ChapterDispatchAttempt" (
    "id"            BIGSERIAL                       NOT NULL,
    "chapterId"     INTEGER                         NOT NULL,
    "mangaId"       INTEGER                         NOT NULL,
    "source"        TEXT                            NOT NULL,
    "releaseTitle"  TEXT,
    "indexer"       TEXT,
    "jobId"         BIGINT,
    "outcome"       TEXT                            NOT NULL DEFAULT 'dispatched',
    "failureReason" TEXT,
    "createdAt"     TIMESTAMP(3) WITHOUT TIME ZONE  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"    TIMESTAMP(3) WITHOUT TIME ZONE,
    CONSTRAINT "ChapterDispatchAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChapterDispatchAttempt_chapterId_createdAt_idx"
    ON "ChapterDispatchAttempt" ("chapterId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChapterDispatchAttempt_mangaId_source_createdAt_idx"
    ON "ChapterDispatchAttempt" ("mangaId", "source", "createdAt");
CREATE INDEX IF NOT EXISTS "ChapterDispatchAttempt_outcome_createdAt_idx"
    ON "ChapterDispatchAttempt" ("outcome", "createdAt");
