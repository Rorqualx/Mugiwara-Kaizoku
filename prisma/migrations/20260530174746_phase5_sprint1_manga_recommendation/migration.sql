-- Phase 5 Sprint #1: AniList recommendation graph table.
--
-- Mirrors `MangaRelation` shape but represents taste-similarity edges
-- (users who read X also like Y), not structural sequel/prequel/spinoff
-- edges. AniList is the only source today; future sprints (MAL extended,
-- Bakaupdates) can reuse the table via the externalSource column.

-- CreateTable
CREATE TABLE "MangaRecommendation" (
    "id" SERIAL NOT NULL,
    "fromMangaId" INTEGER NOT NULL,
    "externalToId" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL DEFAULT 'anilist',
    "toMangaId" INTEGER,
    "targetTitle" VARCHAR(500) NOT NULL,
    "targetMedium" TEXT,
    "targetFormat" TEXT,
    "targetCoverUrl" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MangaRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MangaRecommendation_fromMangaId_idx" ON "MangaRecommendation"("fromMangaId");

-- CreateIndex
CREATE INDEX "MangaRecommendation_toMangaId_idx" ON "MangaRecommendation"("toMangaId");

-- CreateIndex
CREATE UNIQUE INDEX "MangaRecommendation_fromMangaId_externalSource_externalToId_key" ON "MangaRecommendation"("fromMangaId", "externalSource", "externalToId");
