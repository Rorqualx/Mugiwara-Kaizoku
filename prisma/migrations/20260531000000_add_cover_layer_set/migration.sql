-- Living covers: per-cover layerization state + invalidation record.
-- Idempotent (IF NOT EXISTS) so it is safe to apply via raw execute and via
-- a later `migrate deploy`.

CREATE TABLE IF NOT EXISTS "CoverLayerSet" (
    "id"           BIGSERIAL                      NOT NULL,
    "mangaId"      INTEGER                        NOT NULL,
    "sourceHash"   TEXT                           NOT NULL,
    "status"       TEXT                           NOT NULL DEFAULT 'pending',
    "version"      INTEGER                        NOT NULL DEFAULT 1,
    "mode"         TEXT,
    "fgCoverage"   DOUBLE PRECISION,
    "manifestJson" JSONB,
    "error"        TEXT,
    "createdAt"    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoverLayerSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoverLayerSet_mangaId_key" ON "CoverLayerSet" ("mangaId");
CREATE INDEX IF NOT EXISTS "CoverLayerSet_status_idx" ON "CoverLayerSet" ("status");
CREATE INDEX IF NOT EXISTS "CoverLayerSet_sourceHash_idx" ON "CoverLayerSet" ("sourceHash");
