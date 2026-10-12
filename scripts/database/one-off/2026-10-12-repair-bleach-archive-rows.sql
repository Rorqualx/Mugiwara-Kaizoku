-- ALREADY APPLIED to production on 2026-10-12 ~19:05 UTC (dump kaizoku-pre-bleach-repair-*). Kept as a record; do not re-run. One-off repair of Bleach (manga 73) in production, to run AFTER the
-- code fix is deployed and BEFORE (or right after) Bleach's next metadata refresh.
--
-- Bleach ends at chapter 686 in 74 volumes. Refreshes left behind:
--   * rows of the whole-volume archive "Bleach V74.cbz" numbered as chapters past
--     the end (689, 705; on a copy that was refreshed again also 695, 696);
--   * extra numberless rows for that same archive (the archive is ONE row: 13025,
--     the row the import created and the only one with a ChapterFile);
--   * file-less stubs numbered 687-706;
--   * volumes above 74 ("Vol 75 (placeholder)", "Misc (placeholder)") and the
--     numberless file-less row parked in one of them.
--
-- What it does, in one transaction:
--   1. the archive's own row (13025) -> chapterNumber NULL, volume 74;
--   2. every other row pointing at the V74 archive: chapterNumber NULL, then
--      removed as a duplicate of 13025 (none may carry reading state, history,
--      bookmarks, download history, a ChapterFile, a wanted item or a download);
--   3. file-less PENDING stubs 687-706 removed;
--   4. volumes numbered above 74 removed; chapters left pointing at them unlinked;
--      numberless file-less rows that sat in them removed.
-- No file on disk is touched. Metadata.chapters (706) is left for the refresh to
-- correct to 686.
--
-- Dry run by default. Expected counts are production's as of 2026-10-12 08:00 UTC;
-- the script stops without changing anything if they differ.
--   psql ... -f 2026-10-12-repair-bleach-archive-rows.sql              (dry run)
--   psql ... -v apply=1 -f 2026-10-12-repair-bleach-archive-rows.sql   (apply)
-- A copy that was refreshed after the snapshot has other counts; pass them:
--   -v expect_copies=6 -v expect_numbered=4 -v expect_stubs=2 -v expect_volumes=1 -v expect_parked=0
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif
\if :{?expect_copies}
\else
  \set expect_copies 3
\endif
\if :{?expect_numbered}
\else
  \set expect_numbered 2
\endif
\if :{?expect_stubs}
\else
  \set expect_stubs 3
\endif
\if :{?expect_volumes}
\else
  \set expect_volumes 2
\endif
\if :{?expect_parked}
\else
  \set expect_parked 1
\endif

BEGIN;

-- Every row of the one archive. 13025 is kept; the rest are copies.
CREATE TEMP TABLE _archive ON COMMIT DROP AS
  SELECT id, "chapterNumber" AS num, (id = 13025) AS keep
  FROM "Chapter"
  WHERE "mangaId" = 73
    AND "filePath" = '/library/Manga chapters/Bleach/Volumes/Bleach V74/Bleach V74.cbz';

-- File-less stubs past the final chapter.
CREATE TEMP TABLE _stubs ON COMMIT DROP AS
  SELECT id FROM "Chapter"
  WHERE "mangaId" = 73 AND "chapterNumber" BETWEEN 687 AND 706
    AND "filePath" IS NULL AND "downloadStatus" = 'PENDING';

-- Volumes that cannot exist, and the numberless file-less rows parked in them.
CREATE TEMP TABLE _volumes ON COMMIT DROP AS
  SELECT id FROM "Volume" WHERE "mangaId" = 73 AND number > 74;
CREATE TEMP TABLE _parked ON COMMIT DROP AS
  SELECT id FROM "Chapter"
  WHERE "mangaId" = 73 AND "chapterNumber" IS NULL AND "filePath" IS NULL AND volume > 74;

CREATE TEMP TABLE _gone ON COMMIT DROP AS
  SELECT id FROM _archive WHERE NOT keep
  UNION SELECT id FROM _stubs
  UNION SELECT id FROM _parked;

\echo 'Rows of the V74 archive (keep = the one row that stays):'
SELECT a.id, a.keep, c."chapterNumber", c.volume, c."downloadStatus", left(c.title, 40) AS title, c."createdAt"::timestamp(0)
FROM _archive a JOIN "Chapter" c ON c.id = a.id ORDER BY a.keep DESC, a.id;
\echo 'Stubs 687-706 without a file:'
SELECT c.id, c."chapterNumber", c.title FROM _stubs s JOIN "Chapter" c ON c.id = s.id ORDER BY 2;
\echo 'Volumes above 74:'
SELECT v.id, v.number, v.title, v."chapterStart", v."chapterEnd" FROM _volumes x JOIN "Volume" v ON v.id = x.id ORDER BY 2;

-- Guards. Each must hold or nothing is changed.
SELECT
  (SELECT count(*) FROM _archive WHERE keep) = 1                                   AS ok_keep,
  (SELECT count(*) FROM "ChapterFile" WHERE "chapterId" = 13025) >= 1              AS ok_keep_has_file,
  (SELECT count(*) FROM _archive WHERE NOT keep) = :expect_copies                  AS ok_copies,
  (SELECT count(*) FROM _archive WHERE num IS NOT NULL) = :expect_numbered         AS ok_numbered,
  (SELECT count(*) FROM _stubs) = :expect_stubs                                    AS ok_stubs,
  (SELECT count(*) FROM _volumes) = :expect_volumes                                AS ok_volumes,
  (SELECT count(*) FROM _parked) = :expect_parked                                  AS ok_parked,
  (SELECT count(*) FROM "Volume" WHERE "mangaId" = 73 AND number = 74) = 1         AS ok_vol74,
  (SELECT count(*) FROM "Chapter" WHERE "mangaId" = 73 AND "filePath" IS NOT NULL
      AND "chapterNumber" BETWEEN 1 AND 686 AND "chapterNumber" = floor("chapterNumber") AND "filePath" NOT LIKE '%Bleach V74.cbz') = 681 AS ok_real_chapters,
  ( (SELECT count(*) FROM "ReadingProgress"  WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ChapterReadState" WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ReadingHistory"   WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ReaderBookmark"   WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "DownloadHistory"  WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ChapterFile"      WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "WantedItem"       WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "NativeDownload"   WHERE "chapterId" IN (SELECT id FROM _gone)) ) = 0 AS ok_no_user_data
\gset
\echo 'guards: keep' :ok_keep 'keep_has_file' :ok_keep_has_file 'copies' :ok_copies 'numbered' :ok_numbered 'stubs' :ok_stubs 'volumes' :ok_volumes 'parked' :ok_parked 'vol74' :ok_vol74 'real_chapters' :ok_real_chapters 'no_user_data' :ok_no_user_data
SELECT (:'ok_keep'::boolean AND :'ok_keep_has_file'::boolean AND :'ok_copies'::boolean AND :'ok_numbered'::boolean
    AND :'ok_stubs'::boolean AND :'ok_volumes'::boolean AND :'ok_parked'::boolean AND :'ok_vol74'::boolean
    AND :'ok_real_chapters'::boolean AND :'ok_no_user_data'::boolean) AS all_ok
\gset
\if :all_ok
\else
  \echo 'A guard failed: the rows are not what this script expects. Nothing changed.'
  ROLLBACK;
  \quit
\endif

-- 1. The archive's own row: numberless, in volume 74.
UPDATE "Chapter" c
SET "chapterNumber" = NULL, title = 'Death & Strawberry', volume = 74,
    "volumeId" = (SELECT id FROM "Volume" WHERE "mangaId" = 73 AND number = 74),
    "downloadStatus" = 'COMPLETED', "updatedAt" = now()
WHERE c.id = 13025
  AND (c."chapterNumber" IS NOT NULL OR c.volume IS DISTINCT FROM 74
       OR c."volumeId" IS DISTINCT FROM (SELECT id FROM "Volume" WHERE "mangaId" = 73 AND number = 74));

-- 2. Its copies: un-number, then remove (one archive is one row).
UPDATE "Chapter" SET "chapterNumber" = NULL, "updatedAt" = now()
WHERE id IN (SELECT id FROM _archive WHERE NOT keep) AND "chapterNumber" IS NOT NULL;
DELETE FROM "Chapter" WHERE id IN (SELECT id FROM _archive WHERE NOT keep);

-- 3. Stubs 687-706 without a file.
DELETE FROM "Chapter" WHERE id IN (SELECT id FROM _stubs);

-- 4. Volumes above 74, what was parked in them, and the stale volume number on what is left.
DELETE FROM "Chapter" WHERE id IN (SELECT id FROM _parked);
UPDATE "Chapter" SET volume = NULL, "volumeId" = NULL, "updatedAt" = now()
WHERE "mangaId" = 73 AND volume > 74;
DELETE FROM "Volume" WHERE id IN (SELECT id FROM _volumes);

\echo 'After:'
SELECT count(*) AS chapter_rows,
       count(*) FILTER (WHERE "filePath" IS NOT NULL) AS with_file,
       count(*) FILTER (WHERE "chapterNumber" > 686) AS numbered_past_686,
       count(*) FILTER (WHERE "filePath" LIKE '%Bleach V74.cbz') AS v74_rows,
       (SELECT count(*) FROM "Volume" WHERE "mangaId" = 73) AS volumes,
       (SELECT max(number) FROM "Volume" WHERE "mangaId" = 73) AS highest_volume
FROM "Chapter" WHERE "mangaId" = 73;

-- Post-conditions.
SELECT (SELECT count(*) FROM "Chapter" WHERE "mangaId" = 73 AND "chapterNumber" > 686) = 0
   AND (SELECT count(*) FROM "Chapter" WHERE "mangaId" = 73 AND "filePath" LIKE '%Bleach V74.cbz') = 1
   AND (SELECT count(*) FROM "Volume" WHERE "mangaId" = 73 AND number > 74) = 0
   AND (SELECT count(*) FROM "Chapter" WHERE "mangaId" = 73 AND "filePath" IS NOT NULL) = 683 AS post_ok
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
