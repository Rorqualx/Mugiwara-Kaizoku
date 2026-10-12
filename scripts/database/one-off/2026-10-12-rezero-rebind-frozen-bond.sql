-- One-off, applied to production 2026-10-12 00:18 UTC, after the five "A Week at the Mansion" files were moved
-- to their own folder and imported as a new title. Kept for the record; do not re-run.
-- Re:ZERO (62): the files are "The Frozen Bond" (AniList 118370). Manual AniList bind, as bindProvider writes it.
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif
BEGIN;
SELECT 'before', id, title, "sourceId", "selectedSourceId", "providerMetadata"->'anilist'->>'providerId' FROM "Manga" WHERE id = 62;
SELECT 'title clash', count(*) FROM "Manga" WHERE title = 'Re:ZERO -Starting Life in Another World-, The Frozen Bond';
UPDATE "Manga" SET
  title = 'Re:ZERO -Starting Life in Another World-, The Frozen Bond',
  "providerMetadata" = jsonb_set("providerMetadata", '{anilist}',
     jsonb_build_object('providerId', '118370', 'manual', true, 'boundAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
  "selectedSourceId" = '118370',
  "sourceId" = CASE WHEN source = 'anilist' THEN '118370' ELSE "sourceId" END,
  "updatedAt" = now()
WHERE id = 62 AND "providerMetadata"->'anilist'->>'providerId' = '85737';
INSERT INTO "ProviderBinding" ("mangaId", provider, "providerId", origin, reason)
SELECT 62, 'anilist', '118370', 'manual', 'library files are The Frozen Bond; was bound to the light novel 85737'
WHERE EXISTS (SELECT 1 FROM "Manga" WHERE id = 62 AND "selectedSourceId" = '118370');
SELECT 'after', id, title, "sourceId", "selectedSourceId", "providerMetadata"->'anilist' FROM "Manga" WHERE id = 62;
\if :apply
  COMMIT;
\else
  \echo 'Dry run: rolled back.'
  ROLLBACK;
\endif
