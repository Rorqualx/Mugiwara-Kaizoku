-- Per-user operational layer: downloads, jobs, and download history become
-- owner-scoped, and AutoDownloadRule becomes per-user (one rule per user+manga).
--
-- The three operational tables keep their owner column NULLABLE: a NULL row is
-- "system/background or pre-migration" and is visible only to admins (see
-- _shared/library-access.ts ownerScopeWhere). Existing rows are backfilled to
-- the primary admin so the current admin keeps seeing today's queue/history.

-- ---------------------------------------------------------------------------
-- 1. jobs (partitioned) — add owner column, index, FK. ADD COLUMN / CREATE
--    INDEX / ADD CONSTRAINT on the partitioned parent propagate to partitions.
-- ---------------------------------------------------------------------------
ALTER TABLE "jobs" ADD COLUMN "initiated_by_user_id" TEXT;

UPDATE "jobs"
SET "initiated_by_user_id" = COALESCE(
  (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "initiated_by_user_id" IS NULL;

CREATE INDEX "jobs_initiated_by_user_id_idx" ON "jobs"("initiated_by_user_id");

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_initiated_by_user_id_fkey"
  FOREIGN KEY ("initiated_by_user_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. pack_download — add owner column, index, FK.
-- ---------------------------------------------------------------------------
ALTER TABLE "pack_download" ADD COLUMN "initiatedByUserId" TEXT;

UPDATE "pack_download"
SET "initiatedByUserId" = COALESCE(
  (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "initiatedByUserId" IS NULL;

CREATE INDEX "pack_download_initiatedByUserId_idx" ON "pack_download"("initiatedByUserId");

ALTER TABLE "pack_download"
  ADD CONSTRAINT "pack_download_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. DownloadHistory — add owner column, index, FK.
-- ---------------------------------------------------------------------------
ALTER TABLE "DownloadHistory" ADD COLUMN "initiatedByUserId" TEXT;

UPDATE "DownloadHistory"
SET "initiatedByUserId" = COALESCE(
  (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "initiatedByUserId" IS NULL;

CREATE INDEX "DownloadHistory_initiatedByUserId_idx" ON "DownloadHistory"("initiatedByUserId");

ALTER TABLE "DownloadHistory"
  ADD CONSTRAINT "DownloadHistory_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. AutoDownloadRule — was keyed by mangaId alone (one global rule per title).
--    Make it per-user: add userId, backfill existing rules to the primary
--    admin, then swap the primary key to the composite (userId, mangaId).
--    Non-admin members re-acquire their own rule when they next add/monitor
--    the title.
-- ---------------------------------------------------------------------------
ALTER TABLE "AutoDownloadRule" ADD COLUMN "userId" TEXT;

UPDATE "AutoDownloadRule"
SET "userId" = COALESCE(
  (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1),
  (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE "userId" IS NULL;

-- Drop any rule we still couldn't assign (only possible with zero users).
DELETE FROM "AutoDownloadRule" WHERE "userId" IS NULL;

ALTER TABLE "AutoDownloadRule" ALTER COLUMN "userId" SET NOT NULL;

-- Swap PK: mangaId -> composite (userId, mangaId).
ALTER TABLE "AutoDownloadRule" DROP CONSTRAINT "AutoDownloadRule_pkey";
ALTER TABLE "AutoDownloadRule"
  ADD CONSTRAINT "AutoDownloadRule_pkey" PRIMARY KEY ("userId", "mangaId");

-- mangaId lost its implicit PK index; recreate it explicitly. Add userId index.
CREATE INDEX "AutoDownloadRule_mangaId_idx" ON "AutoDownloadRule"("mangaId");
CREATE INDEX "AutoDownloadRule_userId_idx" ON "AutoDownloadRule"("userId");

ALTER TABLE "AutoDownloadRule"
  ADD CONSTRAINT "AutoDownloadRule_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
