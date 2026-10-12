-- One-off, applied to production 2026-10-11 22:44 UTC. Kept for the record; do not re-run.
-- Binding changes, written the way the app's bindProvider / rejection code writes them.
-- Dry run unless -v apply=1.
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif
BEGIN;
SELECT 'before', m.id, m."sourceId", m."selectedSourceId", m."providerMetadata"->'anilist'->>'providerId' AS al, m."providerMetadata"->'comicvine'->>'providerId' AS cv,
       (SELECT count(*) FROM "Manga" o WHERE o."sourceId" = '85312' AND o.source = 'anilist') AS other_with_85312
FROM "Manga" m WHERE m.id IN (55, 80) ORDER BY 1, 2;

-- Attack on Titan: Before the Fall — manual AniList bind to the manga entry (85312), replacing the light novel (73999).
UPDATE "Manga" SET
  "providerMetadata" = jsonb_set("providerMetadata", '{anilist}',
     jsonb_build_object('providerId', '85312', 'manual', true, 'boundAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
  "selectedSourceId" = '85312',
  "sourceId" = CASE WHEN source = 'anilist' THEN '85312' ELSE "sourceId" END
WHERE id = 55 AND "providerMetadata"->'anilist'->>'providerId' = '73999';
INSERT INTO "ProviderBinding" ("mangaId", provider, "providerId", origin, reason)
SELECT 55, 'anilist', '85312', 'manual', 'rebind from light novel 73999 to the manga entry'
WHERE EXISTS (SELECT 1 FROM "Manga" WHERE id = 55 AND "selectedSourceId" = '85312');

-- Akira — reject ComicVine volume 136269 (40-issue Marketprint edition) and drop what that binding left behind.
INSERT INTO "ProviderBinding" ("mangaId", provider, "providerId", origin, reason)
SELECT 80, 'comicvine', '136269', 'rejected', 'wrong edition: 40-issue Marketprint volume bound during re-enrichment'
WHERE NOT EXISTS (SELECT 1 FROM "ProviderBinding" WHERE "mangaId" = 80 AND provider = 'comicvine' AND "providerId" = '136269' AND origin = 'rejected' AND "supersededAt" IS NULL);
UPDATE "Manga" SET "providerMetadata" = "providerMetadata" - 'comicvine'
WHERE id = 80 AND "providerMetadata"->'comicvine'->>'providerId' = '136269';
UPDATE "Metadata" md SET "externalLinks" = COALESCE((SELECT jsonb_agg(l) FROM jsonb_array_elements(md."externalLinks") l WHERE l->>'site' IS DISTINCT FROM 'ComicVine'), '[]'::jsonb)
FROM "Manga" m WHERE m.id = 80 AND m."metadataId" = md.id AND jsonb_typeof(md."externalLinks") = 'array'
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(md."externalLinks") l WHERE l->>'site' = 'ComicVine');
UPDATE "Chapter" c SET "volumeId" = NULL FROM "Volume" v WHERE v.id = c."volumeId" AND v."mangaId" = 80 AND v.source = 'comicvine';
DELETE FROM "Volume" WHERE "mangaId" = 80 AND source = 'comicvine';

SELECT 'after', m.id, m."sourceId", m."selectedSourceId", m."providerMetadata"->'anilist' AS al, m."providerMetadata" ? 'comicvine' AS has_cv,
       (SELECT count(*) FROM "Volume" v WHERE v."mangaId" = m.id) AS volumes
FROM "Manga" m WHERE m.id IN (55, 80) ORDER BY 1, 2;
SELECT 'pb', "mangaId", provider, "providerId", origin, reason FROM "ProviderBinding" WHERE "mangaId" IN (55, 80) ORDER BY id;
\if :apply
  COMMIT;
\else
  \echo 'Dry run: rolled back.'
  ROLLBACK;
\endif
