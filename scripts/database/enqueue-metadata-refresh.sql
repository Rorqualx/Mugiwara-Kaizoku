-- Queue a metadata refresh chain for a list of titles (Phase 4 staged
-- re-enrichment). One job is inserted; the worker refreshes the first title
-- and enqueues the next, so the titles run one after another.
--
-- Usage (dry run prints what would be queued):
--   psql -v ids='78,47,52' -f enqueue-metadata-refresh.sql
--   psql -v ids='78,47,52' -v apply=1 -f enqueue-metadata-refresh.sql
-- Optional: -v reidentify=1 clears automatic bindings first (default: keep).
--
-- Titles that do not exist, or already have a refresh waiting or running,
-- are left out. Mirrors enqueueRefreshChain in
-- src/server/services/metadata/refresh-queue.ts.
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif
\if :{?reidentify}
\else
  \set reidentify 0
\endif

BEGIN;

CREATE TEMP TABLE refresh_request ON COMMIT DROP AS
WITH requested AS (
  SELECT DISTINCT ON (id) id, ord
  FROM unnest(string_to_array(:'ids', ',')::int[]) WITH ORDINALITY AS t(id, ord)
  ORDER BY id, ord
),
open_ids AS (
  SELECT (j.payload->>'mangaId')::int AS id
  FROM jobs j
  WHERE j.job_type IN ('metadata_refresh', 'metadata_update', 'metadata_sync')
    AND j.status IN ('pending', 'active', 'retrying')
  UNION
  SELECT r.value::int
  FROM jobs j, jsonb_array_elements_text(coalesce(j.payload->'remainingMangaIds', '[]'::jsonb)) AS r(value)
  WHERE j.job_type IN ('metadata_refresh', 'metadata_update', 'metadata_sync')
    AND j.status IN ('pending', 'active', 'retrying')
)
SELECT r.id, r.ord, m.title,
       CASE
         WHEN m.id IS NULL THEN 'missing'
         WHEN r.id IN (SELECT id FROM open_ids) THEN 'already queued'
         ELSE 'queue'
       END AS action
FROM requested r
LEFT JOIN "Manga" m ON m.id = r.id;

SELECT id, title, action FROM refresh_request ORDER BY ord;

\if :apply
  INSERT INTO jobs (
    queue_name, job_type, priority, payload, metadata,
    scheduled_for, max_attempts, retry_delay_seconds, partition_key, manga_id
  )
  SELECT 'default', 'metadata_refresh', 'normal',
         jsonb_build_object(
           'mangaId', (array_agg(id ORDER BY ord))[1],
           'forceRefresh', (:reidentify)::int = 1,
           'remainingMangaIds', to_jsonb((array_agg(id ORDER BY ord))[2:])
         ),
         '{"source":"enqueue-metadata-refresh.sql"}'::jsonb,
         NOW(), 1, 60, 'active', (array_agg(id ORDER BY ord))[1]
  FROM refresh_request
  WHERE action = 'queue'
  HAVING count(*) > 0
  RETURNING id AS job_id, payload;
\else
  \echo 'Dry run: nothing queued. Re-run with -v apply=1 to queue.'
\endif

COMMIT;
