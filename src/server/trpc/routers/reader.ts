/**
 * Reader Router - Main Aggregator
 *
 * This router aggregates all reader-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - reader/utils.ts - Shared utilities, types, services (0 procedures)
 * - reader/file-access.ts - File access operations (1 procedure)
 * - reader/progress.ts - Progress tracking (3 procedures)
 * - reader/bookmarks.ts - Bookmark management (3 procedures)
 * - reader/settings.ts - Reader settings (2 procedures)
 * - reader/history.ts - History & analytics (3 procedures)
 * - reader/chapters.ts - Chapter operations (3 procedures)
 *
 * Total: 15 procedures across 6 routers
 *
 * Original file: 733 lines → Refactored: ~150 lines (79% reduction)
 *
 * @module server/trpc/routers/reader
 */

import { router } from '../trpc';

// Import all sub-routers
import { readerBookmarksRouter } from './reader/bookmarks';
import { readerChaptersRouter } from './reader/chapters';
import { readerFileAccessRouter } from './reader/file-access';
import { readerHistoryRouter } from './reader/history';
import { readerProgressRouter } from './reader/progress';
import { readerSettingsRouter } from './reader/settings';

/**
 * Main reader router
 *
 * Merges all sub-routers to expose all 15 procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 *
 * Procedures by Category:
 *
 * File Access (1 procedure):
 * - getChapterFile: Get chapter file with 3-tier caching
 *
 * Progress Tracking (3 procedures):
 * - updateProgress: Update reading progress and analytics
 * - getProgress: Get progress for chapter
 * - getMangaProgress: Get all progress for manga
 *
 * Bookmarks (3 procedures):
 * - addBookmark: Add bookmark to chapter page
 * - removeBookmark: Delete bookmark
 * - getBookmarks: Get all bookmarks for manga
 *
 * Settings (2 procedures):
 * - getSettings: Get reader settings
 * - updateSettings: Update reader settings
 *
 * History & Analytics (3 procedures):
 * - addHistory: Add reading history entry
 * - getHistory: Get reading history
 * - getAnalytics: Get reading analytics
 *
 * Chapter Operations (3 procedures):
 * - getReadableChapters: Get available chapters
 * - getChapterNavigation: Navigation with caching
 * - verifyChapterFiles: Verify files exist
 */
export const readerRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...readerBookmarksRouter._def.procedures,
  ...readerChaptersRouter._def.procedures,
  ...readerFileAccessRouter._def.procedures,
  ...readerHistoryRouter._def.procedures,
  ...readerProgressRouter._def.procedures,
  ...readerSettingsRouter._def.procedures,
});
