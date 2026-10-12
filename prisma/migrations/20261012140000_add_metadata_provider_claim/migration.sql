-- Per-provider claims store: what each provider said in each enrichment run,
-- recorded before the gates and the selector. Append-only; no existing table
-- is changed. Retention (last N runs per title) is applied by the writer.

CREATE TABLE IF NOT EXISTS "MetadataProviderClaim" (
    "id"               BIGSERIAL                       NOT NULL,
    "mangaId"          INTEGER                         NOT NULL,
    "runId"            TEXT                            NOT NULL,
    "provider"         TEXT                            NOT NULL,
    "kind"             TEXT                            NOT NULL,
    "field"            TEXT                            NOT NULL,
    "providerRecordId" TEXT,
    "value"            JSONB,
    "fetchOutcome"     TEXT                            NOT NULL,
    "selectorOutcome"  TEXT,
    "inWinningGroup"   BOOLEAN,
    "matchConfidence"  DOUBLE PRECISION,
    "fieldConfidence"  DOUBLE PRECISION,
    "detail"           JSONB,
    "createdAt"        TIMESTAMP(3) WITHOUT TIME ZONE  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetadataProviderClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MetadataProviderClaim_mangaId_runId_idx"
    ON "MetadataProviderClaim" ("mangaId", "runId");
CREATE INDEX IF NOT EXISTS "MetadataProviderClaim_provider_field_idx"
    ON "MetadataProviderClaim" ("provider", "field");
