-- NOT YET APPLIED. One-off repair: chapter rows that hold ANOTHER chapter's file.
--
-- A file named for one chapter ("SPY x FAMILY V17 C119.cbz", "Chapter 0087.cbz",
-- "c039.cbz") holds that chapter only, yet production has rows of other chapters
-- pointing at it (2026-10-14: SPY x FAMILY 118.5/120.1/.../140.5 on V17 C119,
-- Black Lagoon 92-109 on V12 C085, Blue Exorcist 17-23.2 on V19 C088, Sakamoto
-- Days 252-255 on V26 C251, ...). Cause: a numberless volume-file row had been
-- given one chapter's file (ensureVolumeFileRows adopted a volume's only file
-- before b1e0b233c), and linkArchiveCoveredChapters then treated it as the
-- volume's archive and pointed every pending chapter of the volume at it. Fixed
-- in code alongside this script (chapter-file-name.ts): a single-chapter file is
-- never a volume archive, and finalize releases such rows on every refresh.
--
-- Scope: files shared by two or more rows, whose name carries an explicit
-- single-chapter marker (c/ch/chapter + number, not a range), and that HAVE an
-- owning row (a numbered row whose chapterNumber equals the file's number). A
-- shared file with no owner is left alone (its numbering may be offset, e.g.
-- Berserk 0.01-0.24 on C001-C024). Whole-volume archives ("V05.cbz",
-- "Vol 05") are never touched: their numbered rows are legitimate slices.
--
-- What it does, in one transaction:
--   1. numbered rows on an owned file whose chapterNumber differs from the
--      file's: filePath NULL, fileName '', fileFormat NULL, size 0, pageCount
--      NULL, downloadStatus PENDING (the shape of a file-less chapter row), and
--      their ChapterFile links to that file are removed. Reading state stays.
--   2. numberless (volume-file) rows on an owned file: they are not the volume's
--      archive. One per (manga, volume) becomes the file-less volume-file row
--      (filePath NULL, fileName '', size 0; COMPLETED when every numbered row of
--      the volume is, else PENDING). Where the volume already has a file-less one
--      (only one may exist: "Chapter_one_null_per_volume") the extra rows are
--      deleted, unless they carry user data, in which case they are left as is.
--   3. the owning row is never written.
-- No file on disk is touched. A refresh afterwards recomputes volume-file stats.
--
-- Dry run by default:
--   psql ... -f 2026-10-14-unlink-shared-chapter-files.sql             (dry run)
--   psql ... -v apply=1 -f 2026-10-14-unlink-shared-chapter-files.sql  (apply)
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;

-- Chapter number the file's own name gives (same rule as chapterNumberFromFileName).
CREATE TEMP TABLE _file ON COMMIT DROP AS
WITH shared AS (
  SELECT "filePath" AS fp, regexp_replace("filePath", '^.*/', '') AS bn
  FROM "Chapter" WHERE "filePath" IS NOT NULL AND "filePath" <> ''
  GROUP BY 1 HAVING count(*) > 1
), parsed AS (
  SELECT fp, bn,
         regexp_match(bn, '(?:^|[^a-z0-9])(?:c|ch\.?|chapter)[[:space:]._-]*0*([0-9]+(?:\.[0-9]+)?)(.*)$', 'i') AS m
  FROM shared
)
SELECT fp, bn, m[1]::float8 AS file_ch
FROM parsed
WHERE m IS NOT NULL
  AND m[2] !~* '^[[:space:]]*(-|–|~|to[[:space:]])[[:space:]]*(c|ch\.?|chapter)?[[:space:]._]*[0-9]';

-- Only files with an owning row.
DELETE FROM _file f
WHERE NOT EXISTS (SELECT 1 FROM "Chapter" c WHERE c."filePath" = f.fp AND c."chapterNumber" = f.file_ch);

CREATE TEMP TABLE _squat ON COMMIT DROP AS
SELECT c.id, c."mangaId", c."chapterNumber", c.volume, c."packDownloadId", f.fp, f.file_ch,
       (EXISTS (SELECT 1 FROM "ReadingProgress" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "ChapterReadState" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "ReaderBookmark" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "ReadingHistory" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "AudioBookmark" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "AudioPlaybackProgress" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "ListeningHistory" x WHERE x."chapterId" = c.id)
     OR EXISTS (SELECT 1 FROM "WantedItem" x WHERE x."chapterId" = c.id)
     OR c."isRead") AS has_user_data
FROM "Chapter" c JOIN _file f ON c."filePath" = f.fp
WHERE c."chapterNumber" IS DISTINCT FROM f.file_ch;

\echo 'Before (all rows sharing a file):'
SELECT count(*) AS shared_rows,
       count(DISTINCT "filePath") AS shared_files
FROM "Chapter" c
WHERE "filePath" IN (SELECT "filePath" FROM "Chapter" WHERE "filePath" IS NOT NULL GROUP BY 1 HAVING count(*) > 1);

\echo 'Chapter files with squatters, by manga:'
SELECT s."mangaId", m.title, count(DISTINCT s.fp) AS files,
       count(*) FILTER (WHERE s."chapterNumber" IS NOT NULL) AS numbered_squatters,
       count(*) FILTER (WHERE s."chapterNumber" IS NULL) AS numberless_squatters
FROM _squat s JOIN "Manga" m ON m.id = s."mangaId" GROUP BY 1, 2 ORDER BY 1;

-- Numberless squatters: which becomes the volume's file-less row, which are extra.
CREATE TEMP TABLE _nl ON COMMIT DROP AS
SELECT s.*,
       EXISTS (SELECT 1 FROM "Chapter" o
               WHERE o."mangaId" = s."mangaId" AND o.volume = s.volume AND o."chapterNumber" IS NULL
                 AND o."filePath" IS NULL AND o."packDownloadId" IS NULL) AS has_fileless_row,
       row_number() OVER (PARTITION BY s."mangaId", s.volume, (s."packDownloadId" IS NULL)
                          ORDER BY s.has_user_data DESC, s.id) AS rn
FROM _squat s WHERE s."chapterNumber" IS NULL;

CREATE TEMP TABLE _nl_plan ON COMMIT DROP AS
SELECT id, "mangaId", volume, fp, has_user_data,
       CASE
         WHEN "packDownloadId" IS NOT NULL OR volume IS NULL THEN 'clear'
         WHEN NOT has_fileless_row AND rn = 1 THEN 'clear'
         WHEN NOT has_user_data THEN 'delete'
         ELSE 'keep'
       END AS action
FROM _nl;

\echo 'Numberless rows on a chapter file:'
SELECT p.action, count(*) FROM _nl_plan p GROUP BY 1 ORDER BY 1;
SELECT p.id, p."mangaId", p.volume, regexp_replace(p.fp, '^.*/', '') AS file, p.action
FROM _nl_plan p ORDER BY 2, 3, 1;

\echo 'Numbered squatters with reading state (file is cleared, state kept):'
SELECT s.id, s."mangaId", s."chapterNumber", regexp_replace(s.fp, '^.*/', '') AS file
FROM _squat s WHERE s."chapterNumber" IS NOT NULL AND s.has_user_data;

-- 1. Numbered squatters.
DELETE FROM "ChapterFile" cf USING _squat s
WHERE cf."chapterId" = s.id AND cf."filePath" = s.fp AND s."chapterNumber" IS NOT NULL;
UPDATE "Chapter" c
SET "filePath" = NULL, "fileName" = '', "fileFormat" = NULL, size = 0, "pageCount" = NULL,
    "downloadStatus" = 'PENDING', "updatedAt" = now()
FROM _squat s WHERE c.id = s.id AND s."chapterNumber" IS NOT NULL;

-- 2. Numberless squatters.
DELETE FROM "ChapterFile" cf USING _nl_plan p
WHERE cf."chapterId" = p.id AND cf."filePath" = p.fp AND p.action IN ('clear', 'delete');
DELETE FROM "Chapter" c USING _nl_plan p WHERE c.id = p.id AND p.action = 'delete';
UPDATE "Chapter" c
SET "filePath" = NULL, "fileName" = '', "fileFormat" = NULL, size = 0,
    "downloadStatus" = CASE WHEN EXISTS (
        SELECT 1 FROM "Chapter" n
        WHERE n."mangaId" = c."mangaId" AND n.volume = c.volume AND n."chapterNumber" IS NOT NULL
          AND n."downloadStatus" <> 'COMPLETED') THEN 'PENDING'::"ChapterStatus" ELSE 'COMPLETED'::"ChapterStatus" END,
    "updatedAt" = now()
FROM _nl_plan p WHERE c.id = p.id AND p.action = 'clear';

\echo 'After (all rows sharing a file):'
SELECT count(*) AS shared_rows,
       count(DISTINCT "filePath") AS shared_files
FROM "Chapter" c
WHERE "filePath" IN (SELECT "filePath" FROM "Chapter" WHERE "filePath" IS NOT NULL GROUP BY 1 HAVING count(*) > 1);

-- Post-conditions: every owned chapter file is held by its owner, and by no
-- other numbered row; every owner still holds its file.
SELECT (SELECT count(*) FROM "Chapter" c JOIN _file f ON c."filePath" = f.fp
        WHERE c."chapterNumber" IS NOT NULL AND c."chapterNumber" <> f.file_ch) = 0
   AND (SELECT count(*) FROM _file f
        WHERE NOT EXISTS (SELECT 1 FROM "Chapter" c WHERE c."filePath" = f.fp AND c."chapterNumber" = f.file_ch)) = 0
   AND (SELECT count(*) FROM "Chapter" c JOIN _nl_plan p ON p.id = c.id
        WHERE p.action IN ('clear', 'delete') AND c."filePath" IS NOT NULL) = 0 AS post_ok
\gset
\if :post_ok
\else
  \echo 'Post-condition failed. Rolled back.'
  ROLLBACK;
  \quit
\endif

\if :apply
  COMMIT;
  \echo 'Applied.'
\else
  \echo 'Dry run: rolled back. Re-run with -v apply=1.'
  ROLLBACK;
\endif
