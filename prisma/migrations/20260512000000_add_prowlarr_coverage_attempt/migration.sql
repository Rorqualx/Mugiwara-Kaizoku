-- iter-D1: ProwlarrCoverageAttempt — live-dispatch claim-vs-fulfilled telemetry.
-- Used to drive the coverage-parser improvement loop's per-iter accuracy metric.

CREATE TABLE IF NOT EXISTS "ProwlarrCoverageAttempt" (
    "id"                  BIGSERIAL                       NOT NULL,
    "mangaId"             INTEGER                         NOT NULL,
    "releaseTitle"        TEXT                            NOT NULL,
    "indexer"             TEXT,
    "claimedVolumes"      JSONB                           NOT NULL DEFAULT '[]',
    "claimedChapters"     JSONB                           NOT NULL DEFAULT '[]',
    "scopedChapterIds"    JSONB                           NOT NULL DEFAULT '[]',
    "fulfilledChapterIds" JSONB                           NOT NULL DEFAULT '[]',
    "status"              TEXT                            NOT NULL DEFAULT 'claimed',
    "claimAccuracy"       DOUBLE PRECISION,
    "createdAt"           TIMESTAMP(3) WITHOUT TIME ZONE  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt"          TIMESTAMP(3) WITHOUT TIME ZONE,
    CONSTRAINT "ProwlarrCoverageAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProwlarrCoverageAttempt_mangaId_createdAt_idx"
    ON "ProwlarrCoverageAttempt" ("mangaId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProwlarrCoverageAttempt_status_createdAt_idx"
    ON "ProwlarrCoverageAttempt" ("status", "createdAt");
