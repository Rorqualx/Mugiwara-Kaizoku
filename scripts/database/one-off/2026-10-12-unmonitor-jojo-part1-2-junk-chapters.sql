-- ALREADY APPLIED to production on 2026-10-12 ~19:35 UTC. Kept as a record; do not re-run.
--
-- JoJo Part 1 (manga 95) and Part 2 (manga 96) carry six monitored, file-less
-- chapter rows made from ComicVine description lines in June 2026: "Chapter 0",
-- "Release Dates", "Digital Edition - 1/20/2015" (95: 0, 51, 52) and "Release
-- Dates", "Digital - March 15, 2016", "Print - August 3, 2016" (96: 79, 80, 81).
-- The downloader has tried them 91 times (DownloadHistory) and one NativeDownload
-- exists, so they were not deleted; they are only unmonitored so the attempts stop.
\set ON_ERROR_STOP on
begin;
create temp table junk as
  select id from "Chapter"
  where "filePath" is null
    and (("mangaId" = 95 and "chapterNumber" in (0, 51, 52)) or ("mangaId" = 96 and "chapterNumber" in (79, 80, 81)));
do $$ begin
  if (select count(*) from junk) <> 6 then raise exception 'expected 6 rows, found %', (select count(*) from junk); end if;
end $$;
update "Chapter" set monitored = false, "updatedAt" = now() where id in (select id from junk);
commit;
