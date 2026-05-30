-- Phase 1: Metadata Surface Expansion
--
-- ADDS:
--   - Metadata.contentRating, publicationDemographic, publishers[]
--   - Metadata.rating widened from FLOAT to JSONB
--   - MangaRelation table + MangaRelationType + MangaRelationTargetMedium enums
-- DROPS (no-users hard cutover):
--   - Metadata.publisher (replaced by publishers[])
--   - Metadata.characters (out of app scope)
--   - Metadata.coverUrl, pageCount, qualityProfile, averageResolution, language, languages (dead)
--
-- Existing `rating` Float values are NOT preserved by this migration.
-- Backfill (scripts/surveys/backfill-phase1-fields.ts --field rating) repopulates
-- from AL/MAL/MU/Kitsu on re-enrichment.

-- CreateEnum
CREATE TYPE "MangaRelationType" AS ENUM ('PREQUEL', 'SEQUEL', 'SIDE_STORY', 'PARENT', 'SPIN_OFF', 'ALTERNATIVE', 'ADAPTATION', 'CHARACTER', 'SUMMARY', 'COMPILATION', 'CONTAINS', 'SOURCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MangaRelationTargetMedium" AS ENUM ('MANGA', 'ANIME', 'NOVEL', 'OTHER');

-- AlterTable: Metadata column drops + new columns + rating widening
ALTER TABLE "Metadata"
  DROP COLUMN "averageResolution",
  DROP COLUMN "characters",
  DROP COLUMN "coverUrl",
  DROP COLUMN "language",
  DROP COLUMN "languages",
  DROP COLUMN "pageCount",
  DROP COLUMN "publisher",
  DROP COLUMN "qualityProfile",
  ADD COLUMN "contentRating" TEXT,
  ADD COLUMN "publicationDemographic" TEXT,
  ADD COLUMN "publishers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  DROP COLUMN "rating",
  ADD COLUMN "rating" JSONB;

-- CreateTable: MangaRelation
CREATE TABLE "MangaRelation" (
    "id" SERIAL NOT NULL,
    "fromMangaId" INTEGER NOT NULL,
    "toMangaId" INTEGER,
    "externalSource" TEXT NOT NULL,
    "externalToId" TEXT NOT NULL,
    "targetTitle" TEXT NOT NULL,
    "targetMedium" "MangaRelationTargetMedium" NOT NULL,
    "relationType" "MangaRelationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MangaRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MangaRelation_fromMangaId_idx" ON "MangaRelation"("fromMangaId");

-- CreateIndex
CREATE INDEX "MangaRelation_toMangaId_idx" ON "MangaRelation"("toMangaId");

-- CreateIndex
CREATE INDEX "MangaRelation_externalSource_externalToId_idx" ON "MangaRelation"("externalSource", "externalToId");

-- CreateIndex
CREATE UNIQUE INDEX "MangaRelation_fromMangaId_externalSource_externalToId_relat_key" ON "MangaRelation"("fromMangaId", "externalSource", "externalToId", "relationType");

-- AddForeignKey
ALTER TABLE "MangaRelation" ADD CONSTRAINT "MangaRelation_fromMangaId_fkey" FOREIGN KEY ("fromMangaId") REFERENCES "Manga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaRelation" ADD CONSTRAINT "MangaRelation_toMangaId_fkey" FOREIGN KEY ("toMangaId") REFERENCES "Manga"("id") ON DELETE SET NULL ON UPDATE CASCADE;
