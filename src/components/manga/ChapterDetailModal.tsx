/**
 * Chapter Detail Modal - Re-export
 *
 * This file re-exports the ChapterDetailModal component from the
 * decomposed module structure for backward compatibility.
 *
 * The component has been refactored from a single 856-line file into
 * 8 focused modules:
 * - types.ts (83 lines) - Type definitions
 * - utils.ts (106 lines) - Formatting utilities
 * - hooks.ts (196 lines) - Data fetching hooks
 * - search-columns.tsx (235 lines) - DataTable columns
 * - DetailsTab.tsx (145 lines) - Details panel
 * - SearchTab.tsx (123 lines) - Search results panel
 * - HistoryTab.tsx (245 lines) - History timeline
 * - index.tsx (223 lines) - Main aggregator
 *
 * @see ./chapter-detail-modal/index.tsx for the main component
 */

export { ChapterDetailModal } from './chapter-detail-modal';
export type { ChapterDetailModalProps } from './chapter-detail-modal/types';
