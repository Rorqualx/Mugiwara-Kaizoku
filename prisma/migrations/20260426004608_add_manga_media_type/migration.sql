-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MediaType" AS ENUM ('MANGA', 'COMICBOOK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable
ALTER TABLE "Manga" ADD COLUMN IF NOT EXISTS "mediaType" "MediaType" NOT NULL DEFAULT 'MANGA';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Manga_mediaType_createdAt_idx" ON "Manga"("mediaType", "createdAt");
