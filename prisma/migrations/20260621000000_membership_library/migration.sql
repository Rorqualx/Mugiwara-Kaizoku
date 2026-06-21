-- Per-user library attribution for catalog memberships.
--
-- A deduplicated/linked title keeps its original owner's Manga.libraryId, so the
-- membership row is what ties it to THIS user's chosen library. Add a nullable
-- libraryId (SetNull on library delete) + index + FK. Backfill existing rows to
-- the user's first owned library so previously-added titles surface immediately.
-- Idempotent so re-runs on a partially-migrated DB are safe.

-- 1) Column (nullable, additive — no table rewrite of existing data semantics)
ALTER TABLE "LibraryMembership" ADD COLUMN IF NOT EXISTS "libraryId" INTEGER;

-- 2) Index
CREATE INDEX IF NOT EXISTS "LibraryMembership_libraryId_idx" ON "LibraryMembership"("libraryId");

-- 3) Foreign key (SetNull so deleting a library doesn't drop memberships)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LibraryMembership_libraryId_fkey') THEN
    ALTER TABLE "LibraryMembership" ADD CONSTRAINT "LibraryMembership_libraryId_fkey"
      FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Backfill: attribute existing memberships to the user's first owned library.
UPDATE "LibraryMembership" m
SET "libraryId" = (
  SELECT l."id" FROM "Library" l
  WHERE l."ownerId" = m."userId"
  ORDER BY l."id" ASC
  LIMIT 1
)
WHERE m."libraryId" IS NULL;
