-- One-off, applied to production 2026-10-11 20:31 UTC. Kept for the record; do not re-run.
-- Two chapter rows numbered past the end of their series had been linked to a volume archive
-- (Attack on Titan "144: Final Episode", Stone Ocean "164: Author's Comments"). The cause is
-- fixed in 3d9090c10; these rows carried no reading progress and no files of their own.
\set ON_ERROR_STOP on
BEGIN;
SELECT c.id, c."mangaId", c."chapterNumber", left(c.title, 30), c."createdAt"::timestamp(0),
       (SELECT count(*) FROM "ReadingProgress" x WHERE x."chapterId" = c.id) AS reading_progress,
       (SELECT count(*) FROM "ChapterFile" x WHERE x."chapterId" = c.id) AS chapter_files
FROM "Chapter" c WHERE c.id IN (49088, 49128);
DELETE FROM "Chapter" c
WHERE c.id IN (49088, 49128) AND c."createdAt" > '2026-10-11 19:00+00' AND c."chapterNumber" IN (144, 164)
  AND NOT EXISTS (SELECT 1 FROM "ReadingProgress" x WHERE x."chapterId" = c.id);
SELECT 'archive rows intact', count(*) FROM "Chapter" WHERE id IN (46288, 46259) AND "filePath" IS NOT NULL;
-- Review the output, then COMMIT or ROLLBACK by hand.
ROLLBACK;
