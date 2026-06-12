-- Partial unique index: at most one (chapterNumber NULL + filePath NULL) row
-- per (mangaId, volume). Belt-and-suspenders against the phantom-row
-- regression — ComicVine bindings + reidentify passes could leave N stub rows
-- per volume with chapterNumber=NULL and no file, which rendered as "1-4" in
-- the volume browser and cluttered the UI.
--
-- Excludes `packDownloadId IS NOT NULL`: a pack download legitimately emits
-- N "wanted" rows for the same volume before chapter numbers are assigned
-- (verified 2026-05-19 against manga 4895 vol 6, 6 rows sharing
-- packDownloadId=373).
--
-- Originally applied out-of-band via psql (orphan script
-- prisma/migrations/chapter_one_null_per_volume.sql) and lost when the dev DB
-- was rebuilt during the 2026-04/05 migration-chain repair — folded into the
-- chain 2026-06-12 so fresh deploys keep the guard.
CREATE UNIQUE INDEX IF NOT EXISTS "Chapter_one_null_per_volume"
  ON "Chapter" ("mangaId", "volume")
  WHERE "chapterNumber" IS NULL AND "filePath" IS NULL AND "packDownloadId" IS NULL;
