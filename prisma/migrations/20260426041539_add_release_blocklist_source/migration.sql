-- AlterTable
ALTER TABLE "ReleaseBlocklist" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReleaseBlocklist_title_source_isActive_idx" ON "ReleaseBlocklist"("title", "source", "isActive");
