-- Read-only snapshot of what enrichment stores for one title (or all titles),
-- for before/after diffs around a re-enrichment.
--
-- Usage:
--   psql -d <db> -At -v manga=47 -f scripts/database/snapshot-enrichment-state.sql > before.txt
--   ... re-enrich ...
--   psql -d <db> -At -v manga=47 -f scripts/database/snapshot-enrichment-state.sql > after.txt
--   diff before.txt after.txt
-- Omit -v manga=... to snapshot every title.
--
-- Volume ids are printed on purpose: a healthy run rebuilds volumes, so ids
-- change; what must not change unexpectedly is the set of numbers and ranges.

\set ON_ERROR_STOP on
\if :{?manga}
\else
  \set manga 0
\endif
SET default_transaction_read_only = on;

\echo == metadata
SELECT m.id, m.title, md.status, md.volumes, md.chapters, md."startDate"::date, md."endDate"::date,
       md.source, md."sourceId", m."selectedSourceId", m."sourceId",
       length(coalesce(md.summary, '')) AS summary_len, cardinality(md.genres) AS genres,
       cardinality(md.tags) AS tags, md.authors, md.artists
FROM "Manga" m LEFT JOIN "Metadata" md ON md.id = m."metadataId"
WHERE :manga = 0 OR m.id = :manga
ORDER BY m.id;

\echo == lists and mapped columns
SELECT m.id, cardinality(md.synonyms) AS synonyms, md."idMal", md.cover, md."coverExtraLarge", md."coverLarge", md."coverMedium",
       md.tags, md.synonyms
FROM "Manga" m LEFT JOIN "Metadata" md ON md.id = m."metadataId"
WHERE :manga = 0 OR m.id = :manga
ORDER BY m.id;

\echo == provenance
SELECT m.id, f.key, f.value->>'provider'
FROM "Manga" m, jsonb_each(m."providerMetadata"::jsonb->'metadataProvenance') f
WHERE :manga = 0 OR m.id = :manga
ORDER BY m.id, f.key;

\echo == bindings
SELECT m.id, k.key, k.value->>'providerId', k.value->>'manual'
FROM "Manga" m, jsonb_each(m."providerMetadata"::jsonb) k
WHERE (:manga = 0 OR m.id = :manga) AND jsonb_typeof(k.value) = 'object' AND k.value ? 'providerId'
ORDER BY m.id, k.key;

\echo == volumes
SELECT v."mangaId", v.number, v.source, v."chapterStart", v."chapterEnd", left(coalesce(v.title, ''), 40),
       (v."coverImage" IS NOT NULL) AS has_cover,
       (SELECT count(*) FROM "Chapter" c WHERE c."volumeId" = v.id) AS linked
FROM "Volume" v
WHERE :manga = 0 OR v."mangaId" = :manga
ORDER BY v."mangaId", v.number;

\echo == chapter summary
SELECT c."mangaId", count(*) AS chapter_rows, max(c."chapterNumber") AS max_number,
       count(*) FILTER (WHERE c."filePath" IS NOT NULL) AS with_file,
       count(*) FILTER (WHERE c."volumeId" IS NULL) AS without_volume,
       count(*) FILTER (WHERE c."chapterNumber" IS NULL) AS null_number
FROM "Chapter" c
WHERE :manga = 0 OR c."mangaId" = :manga
GROUP BY 1 ORDER BY 1;

\echo == volume progress
SELECT p."mangaId", v.number, p."userId", p."chaptersRead"
FROM "VolumeProgress" p JOIN "Volume" v ON v.id = p."volumeId"
WHERE :manga = 0 OR p."mangaId" = :manga
ORDER BY 1, 2, 3;
