-- Add WantedItem and DownloadHistory Models
-- Adds support for tracking wanted manga/chapters and download history
-- Required for wanted list functionality and download performance tracking

-- ============================================================================
-- WANTED ITEM TRACKING
-- ============================================================================

-- WantedItem: Track manga/chapters users want but haven't been found yet
CREATE TABLE "WantedItem" (
    id SERIAL PRIMARY KEY,
    "mangaId" INTEGER NOT NULL,
    "chapterId" INTEGER,
    priority "WantedPriority" NOT NULL DEFAULT 'NORMAL',
    status "WantedStatus" NOT NULL DEFAULT 'PENDING',
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,

    CONSTRAINT "WantedItem_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WantedItem_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for efficient wanted item queries
CREATE INDEX "WantedItem_mangaId_idx" ON "WantedItem"("mangaId");
CREATE INDEX "WantedItem_chapterId_idx" ON "WantedItem"("chapterId");
CREATE INDEX "WantedItem_status_idx" ON "WantedItem"(status);
CREATE INDEX "WantedItem_priority_idx" ON "WantedItem"(priority);
CREATE INDEX "WantedItem_dateAdded_idx" ON "WantedItem"("dateAdded");

-- Unique constraint to prevent duplicate wanted items
CREATE UNIQUE INDEX "WantedItem_mangaId_chapterId_key" ON "WantedItem"("mangaId", "chapterId");

-- ============================================================================
-- DOWNLOAD HISTORY TRACKING
-- ============================================================================

-- DownloadHistory: Track download attempts, performance, and outcomes
CREATE TABLE "DownloadHistory" (
    id SERIAL PRIMARY KEY,
    "mangaId" INTEGER NOT NULL,
    "chapterId" INTEGER,
    status "DownloadHistoryStatus" NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "downloadSize" BIGINT,
    "downloadSpeed" DOUBLE PRECISION,
    source TEXT,
    "downloadClient" TEXT,
    metadata JSONB,
    error TEXT,

    CONSTRAINT "DownloadHistory_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DownloadHistory_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for efficient download history queries
CREATE INDEX "DownloadHistory_mangaId_idx" ON "DownloadHistory"("mangaId");
CREATE INDEX "DownloadHistory_chapterId_idx" ON "DownloadHistory"("chapterId");
CREATE INDEX "DownloadHistory_status_idx" ON "DownloadHistory"(status);
CREATE INDEX "DownloadHistory_startTime_idx" ON "DownloadHistory"("startTime" DESC);
CREATE INDEX "DownloadHistory_source_idx" ON "DownloadHistory"(source);
CREATE INDEX "DownloadHistory_downloadClient_idx" ON "DownloadHistory"("downloadClient");

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. WantedItem tracks manga/chapters users want to download
-- 2. DownloadHistory logs all download attempts with performance metrics
-- 3. Both tables have cascade deletes to maintain referential integrity
-- 4. Indexes optimized for common query patterns:
--    - Status-based filtering
--    - Manga/chapter lookups
--    - Temporal queries (dateAdded, startTime)
--    - Source and client analytics
-- 5. Unique constraint on WantedItem prevents duplicate entries
-- 6. BIGINT used for downloadSize to support files over 2GB
