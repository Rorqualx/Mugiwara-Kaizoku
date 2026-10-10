-- Repair: clear Metadata.endDate that was synthesised from the latest chapter
-- release date on a series that is not finished.
--
-- Background: phase-finalize used to fill a null endDate from
-- MAX(Chapter.releaseDate) regardless of status. A stored endDate is read by
-- the phantom prune and the trusted ceiling as "this series finished", so the
-- next enrichment would cap and prune an ongoing series at its current latest
-- chapter. The producer is now gated on a terminal status
-- (phase-finalize/chapter-date-fill.ts); this clears the rows already written.
--
-- Usage (dry run, the default — prints the rows and rolls back):
--   psql -d <db> -f scripts/database/repair-synthesised-end-dates.sql
-- Apply:
--   psql -d <db> -v apply=1 -f scripts/database/repair-synthesised-end-dates.sql
--
-- Run it BEFORE re-enriching any affected title.

\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;

CREATE TEMP TABLE _end_date_repair ON COMMIT DROP AS
SELECT md.id                            AS metadata_id,
       m.id                             AS manga_id,
       m.title,
       md.status::text                  AS status,
       md."endDate"                     AS end_date,
       (SELECT MAX(c."releaseDate") FROM "Chapter" c WHERE c."mangaId" = m.id) AS latest_release
FROM "Metadata" md
JOIN "Manga" m ON m."metadataId" = md.id
WHERE md."endDate" IS NOT NULL
  AND md.status::text NOT IN ('COMPLETED', 'CANCELLED');

\echo Rows with an end date on an unfinished series:
SELECT manga_id, left(title, 40) AS title, status, end_date, latest_release
FROM _end_date_repair
ORDER BY manga_id;

UPDATE "Metadata" md
SET "endDate" = NULL
FROM _end_date_repair r
WHERE md.id = r.metadata_id;

\if :apply
  COMMIT;
  \echo Applied.
\else
  ROLLBACK;
  \echo Dry run only — nothing changed. Re-run with -v apply=1 to apply.
\endif
