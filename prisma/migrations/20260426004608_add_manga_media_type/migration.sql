-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('MANGA', 'COMICBOOK');

-- AlterTable
ALTER TABLE "Manga" ADD COLUMN "mediaType" "MediaType" NOT NULL DEFAULT 'MANGA';

-- CreateIndex
CREATE INDEX "Manga_mediaType_createdAt_idx" ON "Manga"("mediaType", "createdAt");
