-- AlterTable
ALTER TABLE "NativeDownload" ADD COLUMN "sourceChapterId" TEXT;

-- CreateIndex
CREATE INDEX "NativeDownload_sourceChapterId_idx" ON "NativeDownload"("sourceChapterId");
