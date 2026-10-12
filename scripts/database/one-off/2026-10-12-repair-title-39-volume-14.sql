-- OUTCOME 2026-10-12 ~21:55 UTC: NOT run as written. The deploy of ab871a43b restarted
-- the app at 21:52, and the boot reassignment sweep (now capped at exactly 14 volumes)
-- recreated "Vol 14 (placeholder)" (60-66) and linked rows 49672-49678 with volume 14
-- by itself, so this script's guard ("already has a volume 14") stopped it. Only the
-- last step was done by hand, in a guarded transaction: row 49680 (numberless,
-- file-less, volume -1, no user or download data) deleted.
-- NOT APPLIED. Written 2026-10-12; dry-run checked read-only against production.
--
-- Repair "Why Does Nobody Remember Me in this World" (manga 39; finished,
-- Metadata.volumes = 14, chapters = 66) after the refresh of 2026-10-12 ~19:32 UTC.
--
-- That refresh's stale-chapter sweep deleted the seven pending rows of
-- "Vol 14 (placeholder)" (chapters 60-66, ids 48745-48751) because MangaDex
-- lists only up to 59; chapter reconciliation re-created them right away as
-- ids 49672-49678 with no volume; the volume rebuild then had no volume 14,
-- and the overflow step tagged the new rows volume = -1 ("unassigned, past
-- the last volume"). finalize then created 49680, a numberless, file-less
-- "volume-file" row for that pseudo-volume -1. (Fixed in code: the sweep keeps
-- rows within the series count, prunes keep volumes within the stored count,
-- overflow tagging skips a finished series' own chapters, and no volume-file
-- row is made for volume -1.)
--
-- This script:
--   1. recreates Volume 14 (chapters 60-66, source 'manual-repair');
--   2. links rows 49672-49678 to it with volume = 14;
--   3. deletes 49680 (numberless, file-less, PENDING, volume -1, no user data);
--   4. leaves no row of manga 39 numbered within 1..66 with volume = -1.
-- The range 60-66 is the one the earlier step gave the placeholder. No source
-- gives the true split of chapters 49-66 over volumes 12-14 (Wikipedia
-- lists 14 volumes without chapter numbers; Japanese Wikipedia says 65 chapters
-- in all), so the range is kept as it was, not guessed.
--
-- Usage (dry run, read-only, changes nothing):
--   psql -U kaizoku -d kaizoku -f this.sql
-- Apply:
--   psql -U kaizoku -d kaizoku -v apply=1 -f this.sql
\set ON_ERROR_STOP on

\echo '== guards =='
do $$
declare
  n int;
begin
  -- The title is the one we expect, finished, 14 volumes, 66 chapters.
  select count(*) into n from "Manga" m join "Metadata" md on md.id = m."metadataId"
   where m.id = 39 and m."publicationStatus" = 'COMPLETED' and md.volumes = 14 and md.chapters = 66;
  if n <> 1 then raise exception 'manga 39 is not the finished 14-volume, 66-chapter title (%)', n; end if;

  -- No volume 14 yet; volume 13 ends at 59.
  select count(*) into n from "Volume" where "mangaId" = 39 and number = 14;
  if n <> 0 then raise exception 'manga 39 already has a volume 14'; end if;
  select count(*) into n from "Volume" where "mangaId" = 39 and number = 13 and "chapterEnd" = 59;
  if n <> 1 then raise exception 'manga 39 volume 13 does not end at chapter 59'; end if;

  -- The seven rows are exactly chapters 60-66, file-less, unlinked, volume -1.
  select count(*) into n from "Chapter"
   where id between 49672 and 49678 and "mangaId" = 39 and "chapterNumber" = id - 49612
     and "filePath" is null and "volumeId" is null and volume = -1;
  if n <> 7 then raise exception 'expected 7 rows 49672-49678 = chapters 60-66, volume -1, no file, no volumeId; found %', n; end if;

  -- They are the only rows of manga 39 numbered 60-66.
  select count(*) into n from "Chapter" where "mangaId" = 39 and "chapterNumber" between 60 and 66;
  if n <> 7 then raise exception 'expected 7 rows numbered 60-66 for manga 39; found %', n; end if;

  -- No other row of manga 39 within 1..66 carries volume -1.
  select count(*) into n from "Chapter"
   where "mangaId" = 39 and volume = -1 and "chapterNumber" between 1 and 66 and id not between 49672 and 49678;
  if n <> 0 then raise exception 'unexpected other volume -1 rows within the series: %', n; end if;

  -- 49680 is the numberless, file-less, PENDING volume -1 stub.
  select count(*) into n from "Chapter"
   where id = 49680 and "mangaId" = 39 and "chapterNumber" is null and "filePath" is null
     and "packDownloadId" is null and volume = -1 and "volumeId" is null and "downloadStatus" = 'PENDING';
  if n <> 1 then raise exception 'row 49680 is not the numberless volume -1 stub'; end if;

  -- 49680 carries no user data.
  select (select count(*) from "ReadingProgress" where "chapterId" = 49680)
       + (select count(*) from "ChapterReadState" where "chapterId" = 49680)
       + (select count(*) from "ReadingHistory" where "chapterId" = 49680)
       + (select count(*) from "ReaderBookmark" where "chapterId" = 49680)
       + (select count(*) from "ChapterFile" where "chapterId" = 49680)
       + (select count(*) from "DownloadHistory" where "chapterId" = 49680)
       + (select count(*) from "NativeDownload" where "chapterId" = 49680)
       + (select count(*) from "WantedItem" where "chapterId" = 49680)
    into n;
  if n <> 0 then raise exception 'row 49680 has % user-data row(s); not deleting it', n; end if;
  raise notice 'all guards passed';
end $$;

\echo '== user data on the seven rows (kept; they are only re-linked) =='
select c.id, c."chapterNumber",
  (select count(*) from "ReadingProgress" x where x."chapterId" = c.id) as progress,
  (select count(*) from "ChapterReadState" x where x."chapterId" = c.id) as read_state,
  (select count(*) from "ReadingHistory" x where x."chapterId" = c.id) as history,
  (select count(*) from "ReaderBookmark" x where x."chapterId" = c.id) as bookmarks,
  (select count(*) from "ChapterFile" x where x."chapterId" = c.id) as files,
  (select count(*) from "DownloadHistory" x where x."chapterId" = c.id) as dl_history,
  (select count(*) from "NativeDownload" x where x."chapterId" = c.id) as native_dl,
  (select count(*) from "WantedItem" x where x."chapterId" = c.id) as wanted
from "Chapter" c where c.id between 49672 and 49678 order by c.id;

\echo '== planned changes =='
select 'create volume 14 (chapters 60-66) for manga 39' as change
union all select 'link rows 49672-49678 to volume 14, volume = 14'
union all select 'delete row 49680 (numberless volume -1 stub)';

\if :{?apply}
\echo '== applying =='
begin;
-- Lock and re-check inside the transaction.
select id from "Chapter" where id between 49672 and 49680 for update;
do $$ begin
  if (select count(*) from "Chapter" where id between 49672 and 49678 and volume = -1 and "volumeId" is null) <> 7
  then raise exception 'rows changed since the guards ran'; end if;
end $$;

insert into "Volume" ("mangaId", number, title, "chapterStart", "chapterEnd", "totalChapters", source, "createdAt", "updatedAt")
values (39, 14, null, 60, 66, 7, 'manual-repair', now(), now());

update "Chapter" c set volume = 14, "volumeId" = v.id, "updatedAt" = now()
  from "Volume" v
 where v."mangaId" = 39 and v.number = 14 and c.id between 49672 and 49678 and c."mangaId" = 39;

delete from "Chapter" where id = 49680 and "mangaId" = 39 and "chapterNumber" is null and "filePath" is null;

do $$ begin
  if (select count(*) from "Chapter" c join "Volume" v on v.id = c."volumeId"
       where c."mangaId" = 39 and v.number = 14 and c.volume = 14 and c."chapterNumber" between 60 and 66) <> 7
  then raise exception 'volume 14 does not hold the seven chapters'; end if;
  if exists (select 1 from "Chapter" where "mangaId" = 39 and volume = -1)
  then raise exception 'manga 39 still has volume -1 rows'; end if;
  if exists (select 1 from "Chapter" where id = 49680)
  then raise exception 'row 49680 still exists'; end if;
end $$;
commit;
\echo 'applied'
\else
\echo 'dry run: nothing changed (pass -v apply=1 to apply)'
\endif
