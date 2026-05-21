-- Structured log for silent-fallback returns from top-level extractors
-- (Fandom, Wikipedia, ComicVine, MangaDex). Previously an empty/undefined
-- result was indistinguishable from "source has no data" — this table
-- makes extraction failures queryable without changing extractor behavior.
CREATE TABLE IF NOT EXISTS "ParseFailureLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "mangaId" INTEGER,
    "reason" TEXT NOT NULL,
    "contextJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParseFailureLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ParseFailureLog_source_createdAt_idx"
  ON "ParseFailureLog" ("source", "createdAt");

CREATE INDEX IF NOT EXISTS "ParseFailureLog_mangaId_idx"
  ON "ParseFailureLog" ("mangaId");

CREATE INDEX IF NOT EXISTS "ParseFailureLog_stage_createdAt_idx"
  ON "ParseFailureLog" ("stage", "createdAt");
