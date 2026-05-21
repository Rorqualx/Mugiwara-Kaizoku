-- Adds GIN indexes that turn hot query patterns from sequential scans into
-- index lookups. Two flavors:
--
-- 1. pg_trgm GIN on text columns used with { contains, mode: 'insensitive' }
--    (Prisma) / ILIKE '%x%' (raw SQL). Verified hot sites:
--       - src/server/trpc/routers/manga/searchOperations.ts:160-161
--       - src/server/trpc/routers/volume/queries.ts:192-194
--       - src/server/trpc/routers/annotation/crud-procedures.ts:90-91
--       - src/server/trpc/routers/releaseBlocklist.ts:139,144
--
-- 2. Plain GIN on String[] array columns queried with Prisma `has` /
--    PostgreSQL `ANY(...)` / `@>`. Verified hot sites:
--       - src/server/trpc/routers/browse.ts:64, 94, 157 (authors / artists / genres)
--
-- Chapter.title is intentionally NOT indexed: the table has ~1.8M updates
-- vs few search hits, so the write cost would dwarf the read benefit.

-- Trigram indexes (searched text columns) ---------------------------------

CREATE INDEX IF NOT EXISTS "Manga_title_trgm_idx"
  ON "Manga" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Manga_mangaTitle_trgm_idx"
  ON "Manga" USING gin ("mangaTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Volume_title_trgm_idx"
  ON "Volume" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Volume_subtitle_trgm_idx"
  ON "Volume" USING gin (subtitle gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Volume_alternativeTitle_trgm_idx"
  ON "Volume" USING gin ("alternativeTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "AnnotatedPage_mangaTitle_trgm_idx"
  ON "AnnotatedPage" USING gin ("mangaTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ReleaseBlocklist_title_trgm_idx"
  ON "ReleaseBlocklist" USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ReleaseBlocklist_group_trgm_idx"
  ON "ReleaseBlocklist" USING gin ("group" gin_trgm_ops);

-- Array containment indexes (Metadata.String[] columns) -------------------

CREATE INDEX IF NOT EXISTS "Metadata_authors_gin_idx"
  ON "Metadata" USING gin (authors);

CREATE INDEX IF NOT EXISTS "Metadata_artists_gin_idx"
  ON "Metadata" USING gin (artists);

CREATE INDEX IF NOT EXISTS "Metadata_genres_gin_idx"
  ON "Metadata" USING gin (genres);
