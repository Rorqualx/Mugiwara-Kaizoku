-- Binding-as-record (#2): durable record of provider-binding decisions +
-- provenance. Consulted by the enrichment loop so a wrong auto-binding can be
-- REJECTED and not re-picked on reidentify (the Attack-on-Titan sticky-id loop).
-- The live binding still lives in Manga.providerMetadata.<provider>; this table
-- is the durable memory alongside it.

CREATE TABLE IF NOT EXISTS "ProviderBinding" (
    "id"           BIGSERIAL                       NOT NULL,
    "mangaId"      INTEGER                         NOT NULL,
    "provider"     TEXT                            NOT NULL,
    "providerId"   TEXT                            NOT NULL,
    "origin"       TEXT                            NOT NULL,
    "score"        DOUBLE PRECISION,
    "reason"       TEXT,
    "createdAt"    TIMESTAMP(3) WITHOUT TIME ZONE  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3) WITHOUT TIME ZONE,
    CONSTRAINT "ProviderBinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProviderBinding_mangaId_provider_createdAt_idx"
    ON "ProviderBinding" ("mangaId", "provider", "createdAt");
CREATE INDEX IF NOT EXISTS "ProviderBinding_mangaId_provider_origin_idx"
    ON "ProviderBinding" ("mangaId", "provider", "origin");
