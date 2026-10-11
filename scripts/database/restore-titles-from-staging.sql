-- Put selected titles' enrichment state back to what a backup held:
-- Volume, Chapter, VolumeProgress and Metadata rows, and Manga.providerMetadata.
--
-- Input is five staging tables built from a restored backup and loaded into
-- the target database first:
--   _r_manga (id, "providerMetadata"), _r_metadata, _r_volume, _r_chapter,
--   _r_vprogress — each holding only the rows of the titles to restore.
-- Build them in the restored backup with
--   CREATE TABLE _r_volume AS SELECT * FROM "Volume" WHERE "mangaId" IN (...);
-- (same for the others), then pg_dump -t '_r_*' and load the output here.
--
-- Chapter rows keep their ids, so files, reading progress and download
-- history stay attached. Chapters created after the backup are deleted;
-- chapters deleted after the backup come back.
--
-- Dry run by default; -v apply=1 commits. The staging tables are dropped on apply.
\set ON_ERROR_STOP on
\if :{?apply}
\else
  \set apply 0
\endif

BEGIN;

SELECT m.id, m.title,
       (SELECT count(*) FROM "Volume" v WHERE v."mangaId" = m.id) AS volumes_now,
       (SELECT count(*) FROM _r_volume v WHERE v."mangaId" = m.id) AS volumes_backup,
       (SELECT count(*) FROM "Chapter" c WHERE c."mangaId" = m.id) AS chapters_now,
       (SELECT count(*) FROM _r_chapter c WHERE c."mangaId" = m.id) AS chapters_backup,
       (SELECT count(*) FROM "Chapter" c WHERE c."mangaId" = m.id AND c."filePath" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM _r_chapter o WHERE o.id = c.id)) AS new_rows_with_file
FROM "Manga" m JOIN _r_manga r ON r.id = m.id ORDER BY m.id;

-- Chapters the backup does not know were created afterwards.
DELETE FROM "Chapter" c
USING _r_manga r
WHERE c."mangaId" = r.id AND NOT EXISTS (SELECT 1 FROM _r_chapter o WHERE o.id = c.id);

-- Volumes: replace wholesale (the delete cascades to VolumeProgress).
UPDATE "Chapter" c SET "volumeId" = NULL FROM _r_manga r WHERE c."mangaId" = r.id;
DELETE FROM "Volume" v USING _r_manga r WHERE v."mangaId" = r.id;
INSERT INTO "Volume" SELECT * FROM _r_volume;

-- Park (mangaId, index) out of the way so restoring old indexes cannot collide.
UPDATE "Chapter" c SET index = -c.id FROM _r_manga r WHERE c."mangaId" = r.id;

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I = o.%I', column_name, column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Chapter' AND column_name <> 'id';
  EXECUTE format('UPDATE "Chapter" c SET %s FROM _r_chapter o WHERE c.id = o.id', cols);

  SELECT string_agg(format('%I = o.%I', column_name, column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'Metadata' AND column_name <> 'id';
  EXECUTE format('UPDATE "Metadata" m SET %s FROM _r_metadata o WHERE m.id = o.id', cols);
END $$;

INSERT INTO "Chapter"
SELECT o.* FROM _r_chapter o WHERE NOT EXISTS (SELECT 1 FROM "Chapter" c WHERE c.id = o.id);

INSERT INTO "VolumeProgress" SELECT * FROM _r_vprogress ON CONFLICT DO NOTHING;

UPDATE "Manga" m SET "providerMetadata" = r."providerMetadata" FROM _r_manga r WHERE m.id = r.id;

SELECT m.id,
       (SELECT count(*) FROM "Volume" v WHERE v."mangaId" = m.id) AS volumes_after,
       (SELECT count(*) FROM "Chapter" c WHERE c."mangaId" = m.id) AS chapters_after,
       (SELECT count(*) FROM "Chapter" c WHERE c."mangaId" = m.id AND c."volumeId" IS NULL) AS without_volume,
       (SELECT count(*) FROM "VolumeProgress" p WHERE p."mangaId" = m.id) AS progress_rows
FROM "Manga" m JOIN _r_manga r ON r.id = m.id ORDER BY m.id;

\if :apply
  DROP TABLE _r_manga, _r_metadata, _r_volume, _r_chapter, _r_vprogress;
  COMMIT;
\else
  \echo 'Dry run: rolled back. Re-run with -v apply=1 to restore.'
  ROLLBACK;
\endif
