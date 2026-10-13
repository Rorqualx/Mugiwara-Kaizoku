-- One-off cleanup, run once after deploying the "Not yet in a volume" change.
--
-- The old daily sweep (chapter-volume-reassignment step 2) created
-- "Vol N (placeholder)" volumes over a running series' newest chapters, with a
-- range no provider published (production 2026-10-13: 6 rows, e.g. One Piece
-- "Vol 116 (placeholder)" 1180-1195). A refresh deletes the row but the chapters
-- keep the number N, and reconciliation then rebuilds "Volume N" (source
-- 'reconciliation') from them.
--
-- This marks those chapters as awaiting their volume (volume -1, no volumeId),
-- deletes the placeholders' file-less volume-file rows and the placeholders.
-- Finished series (COMPLETED/CANCELLED or an end date) and placeholders with a
-- provider-sourced volume above them are left alone. No file on disk is touched.
--
-- Dry run by default:
--   psql ... -f 2026-10-13-remove-sweep-placeholder-volumes.sql
--   psql ... -v apply=1 -f 2026-10-13-remove-sweep-placeholder-volumes.sql
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;

CREATE TEMP TABLE _ph ON COMMIT DROP AS
  SELECT v.id, v."mangaId", v.number, v."chapterStart", v."chapterEnd"
  FROM "Volume" v
  JOIN "Manga" m ON m.id = v."mangaId"
  LEFT JOIN "Metadata" md ON md.id = m."metadataId"
  WHERE v.source IS NULL AND v.title ~ '^Vol [0-9]+ \(placeholder\)$'
    AND m."publicationStatus"::text NOT IN ('COMPLETED', 'CANCELLED') AND md."endDate" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "Volume" o
                    WHERE o."mangaId" = v."mangaId" AND o.number > v.number AND o.source IS NOT NULL);

\echo 'Placeholder volumes:'
SELECT p."mangaId", m.title, p.number, p."chapterStart", p."chapterEnd",
       (SELECT count(*) FROM "Chapter" c WHERE c."volumeId" = p.id AND c."chapterNumber" IS NOT NULL) AS chapters,
       (SELECT count(*) FROM "Chapter" c WHERE c."volumeId" = p.id AND c."chapterNumber" IS NULL AND c."filePath" IS NOT NULL) AS volume_files
FROM _ph p JOIN "Manga" m ON m.id = p."mangaId" ORDER BY 1, 3;

-- A placeholder holding a downloaded whole-volume file is not a sweep artefact.
SELECT (SELECT count(*) FROM "Chapter" c JOIN _ph p ON c."volumeId" = p.id
        WHERE c."chapterNumber" IS NULL AND c."filePath" IS NOT NULL) = 0 AS ok_no_volume_files
\gset
\if :ok_no_volume_files
\else
  \echo 'A placeholder holds a downloaded volume file. Nothing changed.'
  ROLLBACK;
  \quit
\endif

UPDATE "Chapter" c SET volume = -1, "volumeId" = NULL, "updatedAt" = now()
FROM _ph p WHERE c."volumeId" = p.id AND c."chapterNumber" IS NOT NULL;

DELETE FROM "Chapter" c USING _ph p
WHERE c."volumeId" = p.id AND c."chapterNumber" IS NULL AND c."filePath" IS NULL;

DELETE FROM "Volume" v USING _ph p
WHERE v.id = p.id AND NOT EXISTS (SELECT 1 FROM "Chapter" c WHERE c."volumeId" = v.id);

SELECT count(*) AS placeholders_left FROM "Volume"
WHERE source IS NULL AND title ~ '^Vol [0-9]+ \(placeholder\)$' AND id IN (SELECT id FROM _ph);

\if :apply
  COMMIT;
  \echo 'Applied.'
\else
  \echo 'Dry run: rolled back. Re-run with -v apply=1.'
  ROLLBACK;
\endif
