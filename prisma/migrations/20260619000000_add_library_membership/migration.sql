-- Per-user library membership over the shared manga catalog.
-- Idempotent so it is safe on databases where the table already exists.

-- CreateTable
CREATE TABLE IF NOT EXISTS "LibraryMembership" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryMembership_userId_mangaId_key" ON "LibraryMembership"("userId", "mangaId");
CREATE INDEX IF NOT EXISTS "LibraryMembership_userId_idx" ON "LibraryMembership"("userId");
CREATE INDEX IF NOT EXISTS "LibraryMembership_mangaId_idx" ON "LibraryMembership"("mangaId");

-- AddForeignKey (guarded so re-runs do not fail)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LibraryMembership_userId_fkey') THEN
    ALTER TABLE "LibraryMembership" ADD CONSTRAINT "LibraryMembership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LibraryMembership_mangaId_fkey') THEN
    ALTER TABLE "LibraryMembership" ADD CONSTRAINT "LibraryMembership_mangaId_fkey"
      FOREIGN KEY ("mangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: the existing shared catalog becomes the first admin user's library.
-- The CROSS JOIN yields zero rows (and zero inserts) on a fresh install with no
-- admin yet, so this is safe to run against an empty User table.
INSERT INTO "LibraryMembership" ("userId", "mangaId", "addedAt")
SELECT admin.id, m.id, CURRENT_TIMESTAMP
FROM "Manga" m
CROSS JOIN (
  SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1
) admin
ON CONFLICT ("userId", "mangaId") DO NOTHING;
