-- AddUniqueConstraint
-- Prevents duplicate libraryPath values within the same library
-- This fixes issues where chapters from one manga would appear on another manga's page
CREATE UNIQUE INDEX IF NOT EXISTS "Manga_libraryId_libraryPath_key" ON "Manga"("libraryId", "libraryPath");
