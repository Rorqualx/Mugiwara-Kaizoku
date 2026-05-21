/**
 * Chapter Router - Main Aggregator
 *
 * This router aggregates all chapter-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - chapter/crud.ts - CRUD operations (4 procedures)
 * - chapter/reassignment.ts - Volume reassignment (3 procedures)
 *
 * Total: 7 procedures across 2 routers
 *
 * @module server/trpc/routers/chapter
 */

import { router } from '@/server/trpc/trpc';

import { chapterCrudRouter } from './crud';
import { chapterReassignmentRouter } from './reassignment';

/**
 * Main chapter router
 *
 * Merges all sub-routers to expose all procedures at the top level.
 *
 * Procedures by Category:
 *
 * CRUD Operations (4 procedures):
 * - markAllAsRead: Mark all chapters as read
 * - markAllAsUnread: Mark all chapters as unread
 * - getByMangaId: Get chapters by manga ID
 * - fixChapterIndices: Fix chapter indices by offset
 *
 * Reassignment Operations (3 procedures):
 * - reassignToVolume: Manual reassignment of chapters to a volume
 * - previewAutoAssign: Preview what would be auto-assigned
 * - autoAssignToVolumes: Auto-assign based on volume chapter ranges
 */
export const chapterRouter = router({
  ...chapterCrudRouter._def.procedures,
  ...chapterReassignmentRouter._def.procedures,
});
