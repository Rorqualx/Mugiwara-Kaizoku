-- AlterTable
ALTER TABLE "NativeDownload" ADD COLUMN IF NOT EXISTS "sourceChapterId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NativeDownload_sourceChapterId_idx" ON "NativeDownload"("sourceChapterId");
