-- Add indexes to Chapter model for query performance
-- These indexes support the ORDER BY and GROUP BY operations used
-- in the manga detail page for chapter listing and volume grouping.

-- Covers the ORDER BY in createMangaRelations (chapterNumber ASC)
CREATE INDEX IF NOT EXISTS "Chapter_mangaId_chapterNumber_idx" ON "Chapter"("mangaId", "chapterNumber");

-- Covers volume grouping queries
CREATE INDEX IF NOT EXISTS "Chapter_mangaId_volume_idx" ON "Chapter"("mangaId", "volume");
