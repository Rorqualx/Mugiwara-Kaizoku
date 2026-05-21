-- Add Reader Models Migration
-- Adds ReadingProgress, ReadingAnalytics, ReaderBookmark, ReaderSettings, and ReadingHistory
-- Required for native manga reader functionality

-- ============================================================================
-- READING PROGRESS TRACKING
-- ============================================================================

-- ReadingProgress: Track user reading progress per chapter
CREATE TABLE "ReadingProgress" (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "currentPage" INTEGER NOT NULL,
    "totalPages" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingProgress_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint: one progress entry per user/manga/chapter combination
CREATE UNIQUE INDEX "ReadingProgress_userId_mangaId_chapterId_key" ON "ReadingProgress"("userId", "mangaId", "chapterId");

-- Indexes for efficient queries
CREATE INDEX "ReadingProgress_userId_idx" ON "ReadingProgress"("userId");
CREATE INDEX "ReadingProgress_mangaId_idx" ON "ReadingProgress"("mangaId");
CREATE INDEX "ReadingProgress_lastReadAt_idx" ON "ReadingProgress"("lastReadAt" DESC);

-- ============================================================================
-- READING ANALYTICS
-- ============================================================================

-- ReadingAnalytics: Daily reading statistics per user
CREATE TABLE "ReadingAnalytics" (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    date DATE NOT NULL,
    "pagesRead" INTEGER NOT NULL DEFAULT 0,
    "chaptersCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique constraint: one analytics entry per user per day
CREATE UNIQUE INDEX "ReadingAnalytics_userId_date_key" ON "ReadingAnalytics"("userId", date);

-- Index for date-based queries
CREATE INDEX "ReadingAnalytics_date_idx" ON "ReadingAnalytics"(date DESC);

-- ============================================================================
-- READER BOOKMARKS
-- ============================================================================

-- ReaderBookmark: Save specific pages for later reference
CREATE TABLE "ReaderBookmark" (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    note TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaderBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReaderBookmark_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReaderBookmark_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for bookmark lookups
CREATE INDEX "ReaderBookmark_userId_idx" ON "ReaderBookmark"("userId");
CREATE INDEX "ReaderBookmark_mangaId_idx" ON "ReaderBookmark"("mangaId");
CREATE INDEX "ReaderBookmark_chapterId_idx" ON "ReaderBookmark"("chapterId");

-- ============================================================================
-- READER SETTINGS
-- ============================================================================

-- ReaderSettings: Per-user reader preferences
CREATE TABLE "ReaderSettings" (
    "userId" TEXT PRIMARY KEY,
    "readingMode" TEXT NOT NULL DEFAULT 'single',
    "readingDirection" TEXT NOT NULL DEFAULT 'rtl',
    "backgroundColor" TEXT NOT NULL DEFAULT '#000000',
    "fitMode" TEXT NOT NULL DEFAULT 'fit-width',
    "showToolbar" BOOLEAN NOT NULL DEFAULT true,
    "preloadPages" INTEGER NOT NULL DEFAULT 3,
    "doublePageOffset" BOOLEAN NOT NULL DEFAULT false,
    brightness DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    contrast DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "enableGestures" BOOLEAN NOT NULL DEFAULT true,
    "enableKeyboard" BOOLEAN NOT NULL DEFAULT true,
    "clickNavigation" BOOLEAN NOT NULL DEFAULT true,
    "smoothScrolling" BOOLEAN NOT NULL DEFAULT true,
    "panelDetection" BOOLEAN NOT NULL DEFAULT false,
    "ocrEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaderSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================================================
-- READING HISTORY
-- ============================================================================

-- ReadingHistory: Track reading sessions for analytics
CREATE TABLE "ReadingHistory" (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mangaId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "pagesRead" INTEGER NOT NULL,
    "totalTime" INTEGER NOT NULL, -- in seconds
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingHistory_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingHistory_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for history queries
CREATE INDEX "ReadingHistory_userId_idx" ON "ReadingHistory"("userId");
CREATE INDEX "ReadingHistory_mangaId_idx" ON "ReadingHistory"("mangaId");
CREATE INDEX "ReadingHistory_startedAt_idx" ON "ReadingHistory"("startedAt" DESC);

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 1. All tables use PascalCase to match Prisma conventions
-- 2. Foreign keys cascade on delete to maintain referential integrity
-- 3. Indexes optimized for common query patterns:
--    - User-centric queries (userId indexes)
--    - Manga-centric queries (mangaId indexes)
--    - Temporal queries (date/timestamp indexes)
-- 4. Unique constraints prevent duplicate progress/analytics entries
-- 5. ReaderSettings is 1:1 with User (userId as primary key)
