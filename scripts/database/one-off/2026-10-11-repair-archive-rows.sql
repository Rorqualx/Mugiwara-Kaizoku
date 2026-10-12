-- One-off, applied to production 2026-10-11 19:12 UTC. Kept for the record; do not re-run.
-- Put whole-volume archive rows that a refresh numbered as a chapter back to
-- numberless, with their pre-Phase-4 title and volume. Dry run unless -v apply=1.
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif
BEGIN;
CREATE TEMP TABLE _fix(id int, manga int, title text, vol float8) ON COMMIT DROP;
INSERT INTO _fix VALUES
(46418, 26, 'Volume 14', NULL),
(47012, 46, 'Volume 2', NULL),
(13025, 73, 'Chapter 675. Blood For My Bone', 74),
(47400, 83, 'Volume 4', NULL),
(47401, 83, 'Volume 3', NULL),
(47402, 83, 'Volume 2', NULL),
(47404, 83, 'Volume 5', NULL),
(47409, 83, 'Volume 1', NULL),
(47487, 83, 'Volume 16', NULL),
(47488, 83, 'Volume 17', NULL),
(47251, 86, 'Volume 3', NULL),
(46259, 93, 'Volume 9', NULL),
(47068, 103, '', 2),
(47069, 103, '', 3),
(47070, 103, '', 4),
(47071, 103, '', 5),
(47072, 103, 'Volume 2', NULL),
(47073, 103, 'Volume 1', NULL),
(47074, 103, 'Volume 4', NULL),
(47075, 103, 'Volume 3', NULL),
(47076, 103, 'Volume 6', NULL),
(47077, 103, 'Volume 5', NULL)
;
SELECT f.manga, c.id, c."chapterNumber" AS number_now, left(c.title, 28) AS title_now, left(f.title, 28) AS title_back,
       vn.number AS vol_now, f.vol AS vol_back, (vb.id IS NOT NULL) AS vol_back_exists
FROM _fix f JOIN "Chapter" c ON c.id = f.id AND c."mangaId" = f.manga
LEFT JOIN "Volume" vn ON vn.id = c."volumeId"
LEFT JOIN "Volume" vb ON vb."mangaId" = f.manga AND vb.number = f.vol
WHERE c."chapterNumber" IS NOT NULL AND c."filePath" IS NOT NULL
ORDER BY 1, 2;
UPDATE "Chapter" c
SET "chapterNumber" = NULL, title = f.title, "updatedAt" = now(),
    "volumeId" = COALESCE((SELECT vb.id FROM "Volume" vb WHERE vb."mangaId" = f.manga AND vb.number = f.vol), c."volumeId")
FROM _fix f
WHERE c.id = f.id AND c."mangaId" = f.manga AND c."chapterNumber" IS NOT NULL AND c."filePath" IS NOT NULL;
\if :apply
  COMMIT;
\else
  \echo 'Dry run: rolled back. Re-run with -v apply=1.'
  ROLLBACK;
\endif
