-- Fix ComicVine publisher in providerMetadata to match rawProviderData
-- Updates German series (137211) to English series (95557) with correct publisher

UPDATE "Manga"
SET "providerMetadata" = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          "providerMetadata",
          '{comicvine,id}',
          '"95557"'
        ),
        '{comicvine,volumeId}',
        '95557'
      ),
      '{comicvine,comicvineId}',
      '"95557"'
    ),
    '{comicvine,publisher}',
    '"Kodansha Comics USA"'
  ),
  '{comicvine,siteDetailUrl}',
  '"https://comicvine.gamespot.com/fire-force/4050-95557/"'
)
WHERE id = 42;
