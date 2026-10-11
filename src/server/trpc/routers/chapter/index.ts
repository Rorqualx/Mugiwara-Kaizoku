/**
 * Chapter Router - Main Aggregator
 *
 * This router aggregates all chapter-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - chapter/crud.ts - chapter rows and files
 * - chapter/read-state.ts - per-user read / unread marks
 * - chapter/reassignment.ts - volume reassignment
 *
 * @module server/trpc/routers/chapter
 */

import { router } from '@/server/trpc/trpc';

import { chapterCrudRouter } from './crud';
import { chapterReadStateRouter } from './read-state';
import { chapterReassignmentRouter } from './reassignment';

/**
 * Main chapter router
 *
 * Merges all sub-routers to expose all procedures at the top level.
 *
 * Procedures by Category:
 *
 * CRUD Operations:
 * - getByMangaId: Get chapters by manga ID
 * - fixChapterIndices: Fix chapter indices by offset
 *
 * Read State (per calling user):
 * - markAllAsRead: Mark all chapters of a title as read
 * - markAllAsUnread: Mark all chapters of a title as unread
 * - markMangaChapters: The same for several titles at once
 *
 * Reassignment Operations:
 * - reassignToVolume: Manual reassignment of chapters to a volume
 * - previewAutoAssign: Preview what would be auto-assigned
 * - autoAssignToVolumes: Auto-assign based on volume chapter ranges
 */
export const chapterRouter = router({
  ...chapterCrudRouter._def.procedures,
  ...chapterReadStateRouter._def.procedures,
  ...chapterReassignmentRouter._def.procedures,
});
