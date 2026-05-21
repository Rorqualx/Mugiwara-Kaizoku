-- AlterTable
ALTER TABLE "ReleaseBlocklist" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "ReleaseBlocklist_title_source_isActive_idx" ON "ReleaseBlocklist"("title", "source", "isActive");
