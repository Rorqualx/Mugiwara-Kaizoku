-- ALREADY APPLIED to production on 2026-10-12 04:50 UTC. Kept as a record; do not re-run.
--
-- The refresh of JoJo's Bizarre Adventure Part 4 (manga 98) at 04:31 UTC created
-- 66 file-less, monitored, PENDING chapters numbered 284-434 with volume
-- numbers 31-47: the whole-franchise numbering of Part 4, on a title whose own
-- chapters are 1-174. None had a file or reading progress.
-- Dump taken before: kaizoku-pre-deploy-20261012T042059Z.dump.
begin;
create temp table gone as
  select id from "Chapter"
  where "mangaId" = 98 and "filePath" is null and "chapterNumber" > 174
    and "createdAt" > '2026-10-12 04:00:00';
do $$ begin if (select count(*) from gone) <> 66 then raise exception 'unexpected count'; end if; end $$;
delete from "Chapter" where id in (select id from gone);
commit;
