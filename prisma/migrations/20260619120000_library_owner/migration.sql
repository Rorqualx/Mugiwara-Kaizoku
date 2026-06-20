-- Per-user libraries: every Library now belongs to an owner (User).
-- Existing rows are backfilled to the primary admin so the current admin's
-- libraries keep working; afterwards the column is made NOT NULL and FK'd.

-- 1. Add the column nullable so existing rows can be backfilled.
ALTER TABLE "Library" ADD COLUMN "ownerId" TEXT;

-- 2. Backfill: assign existing libraries to the oldest ADMIN user.
UPDATE "Library"
SET "ownerId" = (
  SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "ownerId" IS NULL;

-- 3. Fallback: if there is no admin, assign to the oldest user.
UPDATE "Library"
SET "ownerId" = (
  SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "ownerId" IS NULL;

-- 4. Drop any orphan libraries still without an owner (only possible when the
--    instance has zero users, in which case the libraries are unreachable).
DELETE FROM "Library" WHERE "ownerId" IS NULL;

-- 5. Enforce ownership going forward.
ALTER TABLE "Library" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX "Library_ownerId_idx" ON "Library"("ownerId");

ALTER TABLE "Library"
  ADD CONSTRAINT "Library_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
