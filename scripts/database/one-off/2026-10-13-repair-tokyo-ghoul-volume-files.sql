-- NOT YET APPLIED. Reviewed one-off repair of Tokyo Ghoul (manga 38) in production.
-- Run AFTER the volume-cap fix (finished series: no volume past the agreed final
-- chapter) is deployed; a refresh on the old code rebuilds "volume 15" from the
-- rows this script removes.
--
-- Tokyo Ghoul ends at chapter 143 (plus one extra) in 14 volumes. Its rows were
-- created on 2026-05-24 by the import wizard's sequential matcher (fixed the same
-- day in e78c8f3b0) from a ComicVine chapter list the parser could not number
-- ("Chapter #128: Anticipation"; fixed 2026-10-11 in 989a7f2a0), so:
--   * 16 rows numbered 144-159 are ComicVine's chapters #128-#143 a second time
--     (titles "Chapter #128: Anticipation" ... "Chapter #143: Memorial"); real
--     rows 128-143 exist. They point at archives that hold chapters 69-121;
--   * 83 numbered rows 1-143 point at the old "Volumes/Tokyo Ghoul VNN/" archives
--     about one volume off. The archives were checked on disk on 2026-10-13 by
--     their page names ("Tokyo Ghoul - c069 (v08) - p000 ..."):
--         old V01-V04 hold volumes 1-4, old V05 is an empty folder,
--         old V06-V13 hold volumes 5-12, old V14 holds volume 14,
--         old V15/V16 hold Tokyo Ghoul:re volumes 15/16 (manga 90's, untouched),
--         "Volumes/Tokyo Ghoul Vol NN/" holds volumes 1-11 (another release).
--     No archive of volume 13 (chapters 122-132) is on disk.
--   * a "volume 15" (source 'reconciliation', 144-159) and a numberless file-less
--     row parked in it, rebuilt on every refresh from the rows above.
--
-- What it does, in one transaction:
--   1. deletes the 16 duplicate rows 144-159 (and, by cascade, their ChapterFile
--      links); none may carry reading state, history, bookmarks, download
--      history, a wanted item or a download;
--   2. relinks each numbered row on an old archive to the archive that holds its
--      chapter: volumes 1-11 -> the archive the volume's own volume-file row uses,
--      volume 12 -> old V13, volume 14 -> old V14 (Chapter.filePath/size and its
--      ChapterFile row);
--   3. rows of volume 13 (122-132) on an old archive: no file holds them, so the
--      link is removed and they go back to PENDING (downloadable again);
--   4. removes volume 15 and the numberless file-less row in it.
-- No file on disk is touched. The loose "Chapter 00NN.cbz" rows are correct and
-- untouched. Metadata.chapters is left for the refresh.
--
-- Dry run by default. Expected counts are production's as of 2026-10-13 17:40 UTC
-- (the kaizoku_exp_tg copy); the script stops without changing anything if they
-- differ.
--   psql ... -f 2026-10-13-repair-tokyo-ghoul-volume-files.sql             (dry run)
--   psql ... -v apply=1 -f 2026-10-13-repair-tokyo-ghoul-volume-files.sql  (apply)
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif
\if :{?expect_dupes}
\else
  \set expect_dupes 16
\endif
\if :{?expect_relink}
\else
  \set expect_relink 72
\endif
\if :{?expect_unlink}
\else
  \set expect_unlink 11
\endif

BEGIN;

-- Where each volume's chapters physically are (verified on disk 2026-10-13).
CREATE TEMP TABLE _home (vol int, first_ch numeric, last_ch numeric, path text, size bigint) ON COMMIT DROP;
INSERT INTO _home VALUES
  (1,   1,   9, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul V01/Tokyo Ghoul V01.cbz',     141193735),
  (2,  10,  19, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 02/Tokyo Ghoul V02.cbz', 275924076),
  (3,  20,  29, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 03/Tokyo Ghoul V03.cbz', 262071397),
  (4,  30,  39, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 04/Tokyo Ghoul V04.cbz', 278083811),
  (5,  40,  48, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 05/Tokyo Ghoul V05.cbz', 354163032),
  (6,  49,  58, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 06/Tokyo Ghoul V06.cbz', 340395031),
  (7,  59,  68, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 07/Tokyo Ghoul V07.cbz', 357762057),
  (8,  69,  79, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 08/Tokyo Ghoul V08.cbz', 382441381),
  (9,  80,  89, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 09/Tokyo Ghoul V09.cbz', 331414632),
  (10, 90, 100, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 10/Tokyo Ghoul V10.cbz', 413622144),
  (11, 101, 111, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul Vol 11/Tokyo Ghoul V11.cbz', 409306119),
  (12, 112, 121, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul V13/Tokyo Ghoul V13.cbz',    170059349),
  (13, 122, 132, NULL, NULL),
  (14, 133, 143, '/library/Manga chapters/Tokyo Ghoul/Volumes/Tokyo Ghoul V14/Tokyo Ghoul V14.cbz',    206225488);

-- 1. ComicVine's #128-#143 numbered a second time as 144-159.
CREATE TEMP TABLE _dupes ON COMMIT DROP AS
  SELECT id FROM "Chapter"
  WHERE "mangaId" = 38 AND "chapterNumber" BETWEEN 144 AND 159
    AND title LIKE 'Chapter #1__:%'
    AND "filePath" ~ '/Volumes/Tokyo Ghoul V[0-9]{2}/';

-- 2/3. Numbered rows on an old archive that does not hold them.
CREATE TEMP TABLE _moves ON COMMIT DROP AS
  SELECT c.id, c."chapterNumber" AS num, c."filePath" AS old_path, h.vol, h.path AS new_path, h.size AS new_size
  FROM "Chapter" c
  JOIN _home h ON floor(c."chapterNumber") BETWEEN h.first_ch AND h.last_ch
  WHERE c."mangaId" = 38 AND c."chapterNumber" IS NOT NULL
    AND c."filePath" ~ '/Volumes/Tokyo Ghoul V[0-9]{2}/'
    AND c."filePath" IS DISTINCT FROM h.path;

-- 4. The rebuilt volume 15 and the numberless file-less row in it.
CREATE TEMP TABLE _volumes ON COMMIT DROP AS
  SELECT id FROM "Volume" WHERE "mangaId" = 38 AND number > 14;
CREATE TEMP TABLE _parked ON COMMIT DROP AS
  SELECT id FROM "Chapter"
  WHERE "mangaId" = 38 AND "chapterNumber" IS NULL AND "filePath" IS NULL AND volume > 14;

CREATE TEMP TABLE _gone ON COMMIT DROP AS
  SELECT id FROM _dupes UNION SELECT id FROM _parked;

\echo 'Duplicate rows 144-159:'
SELECT c.id, c."chapterNumber", left(c.title, 40) AS title, regexp_replace(c."filePath", '.*/Volumes/', '') AS file
FROM _dupes d JOIN "Chapter" c ON c.id = d.id ORDER BY 2;
\echo 'Relinks (new_path NULL = no archive on disk, back to PENDING):'
SELECT id, num, vol, regexp_replace(old_path, '.*/Volumes/', '') AS old_file,
       regexp_replace(new_path, '.*/Volumes/', '') AS new_file
FROM _moves ORDER BY num;

-- Guards. Each must hold or nothing is changed.
SELECT
  (SELECT count(*) FROM _dupes) = :expect_dupes                                         AS ok_dupes,
  (SELECT count(*) FROM "Chapter" WHERE "mangaId" = 38 AND "chapterNumber" BETWEEN 128 AND 143
      AND "chapterNumber" = floor("chapterNumber") AND id NOT IN (SELECT id FROM _dupes)) = 16 AS ok_real_128_143,
  (SELECT count(*) FROM _moves WHERE new_path IS NOT NULL) = :expect_relink             AS ok_relink,
  (SELECT count(*) FROM _moves WHERE new_path IS NULL) = :expect_unlink                 AS ok_unlink,
  (SELECT count(*) FROM _moves WHERE id IN (SELECT id FROM _dupes)) = 0                 AS ok_disjoint,
  (SELECT count(*) FROM "Volume" WHERE "mangaId" = 38 AND number BETWEEN 1 AND 14) = 14 AS ok_14_volumes,
  (SELECT count(*) FROM "Volume" v JOIN _home h ON h.vol = v.number
      WHERE v."mangaId" = 38 AND v."chapterStart" = h.first_ch AND v."chapterEnd" = h.last_ch) = 14 AS ok_ranges,
  (SELECT coalesce(max(n), 0) FROM (SELECT count(*) AS n FROM "ChapterFile"
      WHERE "chapterId" IN (SELECT id FROM _moves) GROUP BY "chapterId") x) <= 1        AS ok_one_file_link,
  ( (SELECT count(*) FROM "ReadingProgress"  WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ChapterReadState" WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ReadingHistory"   WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "ReaderBookmark"   WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "DownloadHistory"  WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "WantedItem"       WHERE "chapterId" IN (SELECT id FROM _gone))
  + (SELECT count(*) FROM "NativeDownload"   WHERE "chapterId" IN (SELECT id FROM _gone)) ) = 0 AS ok_no_user_data
\gset
\echo 'guards: dupes' :ok_dupes 'real_128_143' :ok_real_128_143 'relink' :ok_relink 'unlink' :ok_unlink 'disjoint' :ok_disjoint '14_volumes' :ok_14_volumes 'ranges' :ok_ranges 'one_file_link' :ok_one_file_link 'no_user_data' :ok_no_user_data
SELECT (:'ok_dupes'::boolean AND :'ok_real_128_143'::boolean AND :'ok_relink'::boolean AND :'ok_unlink'::boolean
    AND :'ok_disjoint'::boolean AND :'ok_14_volumes'::boolean AND :'ok_ranges'::boolean
    AND :'ok_one_file_link'::boolean AND :'ok_no_user_data'::boolean) AS all_ok
\gset
\if :all_ok
\else
  \echo 'A guard failed: the rows are not what this script expects. Nothing changed.'
  ROLLBACK;
  \quit
\endif

-- 1. Duplicates (their ChapterFile rows go by cascade).
DELETE FROM "Chapter" WHERE id IN (SELECT id FROM _dupes);

-- 2. Relink to the archive that holds the chapter.
UPDATE "Chapter" c
SET "filePath" = m.new_path, size = m.new_size, "fileName" = regexp_replace(m.new_path, '.*/', ''),
    volume = m.vol, "updatedAt" = now()
FROM _moves m WHERE c.id = m.id AND m.new_path IS NOT NULL;
UPDATE "ChapterFile" f
SET "filePath" = m.new_path, "fileName" = regexp_replace(m.new_path, '.*/', ''), "fileSize" = m.new_size
FROM _moves m WHERE f."chapterId" = m.id AND m.new_path IS NOT NULL;

-- 3. Volume 13: no archive holds it.
DELETE FROM "ChapterFile" WHERE "chapterId" IN (SELECT id FROM _moves WHERE new_path IS NULL);
UPDATE "Chapter" c
SET "filePath" = NULL, size = 0, "downloadStatus" = 'PENDING', volume = 13, "updatedAt" = now()
FROM _moves m WHERE c.id = m.id AND m.new_path IS NULL;

-- 4. Volume 15 and what was parked in it.
DELETE FROM "Chapter" WHERE id IN (SELECT id FROM _parked);
UPDATE "Chapter" SET volume = NULL, "volumeId" = NULL, "updatedAt" = now()
WHERE "mangaId" = 38 AND volume > 14;
DELETE FROM "Volume" WHERE id IN (SELECT id FROM _volumes);

-- Link every numbered row to the volume whose range holds it.
UPDATE "Chapter" c
SET "volumeId" = v.id, volume = v.number, "updatedAt" = now()
FROM "Volume" v
WHERE c."mangaId" = 38 AND v."mangaId" = 38 AND c."chapterNumber" IS NOT NULL
  AND floor(c."chapterNumber") BETWEEN v."chapterStart" AND v."chapterEnd"
  AND (c."volumeId" IS DISTINCT FROM v.id OR c.volume IS DISTINCT FROM v.number);

\echo 'After:'
SELECT count(*) AS chapter_rows,
       count(*) FILTER (WHERE "filePath" IS NOT NULL) AS with_file,
       count(*) FILTER (WHERE "chapterNumber" > 144) AS numbered_past_144,
       count(*) FILTER (WHERE "downloadStatus" = 'PENDING') AS pending,
       (SELECT count(*) FROM "Volume" WHERE "mangaId" = 38) AS volumes,
       (SELECT max(number) FROM "Volume" WHERE "mangaId" = 38) AS highest_volume
FROM "Chapter" WHERE "mangaId" = 38;

-- Post-conditions: nothing past 144, no volume past 14, and every numbered row
-- with a file sits in the archive (or loose file) that holds its chapter.
SELECT (SELECT count(*) FROM "Chapter" WHERE "mangaId" = 38 AND "chapterNumber" > 144) = 0
   AND (SELECT count(*) FROM "Volume" WHERE "mangaId" = 38 AND number > 14) = 0
   AND (SELECT count(*) FROM "Chapter" c JOIN _home h ON floor(c."chapterNumber") BETWEEN h.first_ch AND h.last_ch
        WHERE c."mangaId" = 38 AND c."filePath" ~ '/Volumes/' AND c."filePath" IS DISTINCT FROM h.path
          AND c."filePath" NOT LIKE '%/Tokyo Ghoul Vol __/%') = 0 AS post_ok
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
