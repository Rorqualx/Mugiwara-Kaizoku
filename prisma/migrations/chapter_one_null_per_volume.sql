-- Migration: Partial unique index — at most one (chapterNumber NULL + filePath NULL) row per (mangaId, volume).
-- Belt-and-suspenders against the phantom-row regression. Before this index,
-- ComicVine bindings + reidentify passes could leave N stub rows per volume
-- with chapterNumber=NULL and no file — these rendered as "1-4" in the
-- volume browser (useVolumeTableColumns.tsx:172-179) and cluttered the UI.
--
-- Sequence matters: the existing phantom backlog must be cleared first via
--   bun run scripts/surveys/cleanup-phantom-volume-stubs.ts --apply
-- otherwise the CREATE UNIQUE INDEX will fail on conflicting rows.

-- Also exclude `packDownloadId IS NOT NULL`: a pack download legitimately
-- emits N "wanted" rows for the same volume before chapter numbers are
-- assigned (verified 2026-05-19 against manga 4895 vol 6 with 6 such rows
-- sharing packDownloadId=373).
CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_one_null_per_volume"
  ON "Chapter" ("mangaId", "volume")
  WHERE "chapterNumber" IS NULL AND "filePath" IS NULL AND "packDownloadId" IS NULL;
