/**
 * Audio Player Router - Main Aggregator
 *
 * Combines all audio player sub-routers into a single router.
 *
 * Sub-routers:
 * - progress: Audio playback progress tracking
 * - bookmarks: Audio bookmark management
 * - settings: Player settings and preferences
 * - history: Listening history and analytics
 * - metadata: Audio file metadata extraction
 *
 * @module server/trpc/routers/audioPlayer
 */

import { router } from '@/server/trpc/trpc';

import { audioPlayerBookmarksRouter } from './bookmarks';
import { audioPlayerHistoryRouter } from './history';
import { audioPlayerMetadataRouter } from './metadata';
import { audioPlayerProgressRouter } from './progress';
import { audioPlayerSettingsRouter } from './settings';

/**
 * Audio Player Router
 *
 * Aggregates all audio player functionality into a single router.
 * Follows the same pattern as the reader router.
 *
 * @example
 * ```ts
 * // Get audio playback progress
 * const progress = await trpc.audioPlayer.getProgress.query({ mangaId: 1, chapterId: 1 });
 *
 * // Add a bookmark
 * await trpc.audioPlayer.addBookmark.mutate({ mangaId: 1, chapterId: 1, timestamp: 120 });
 *
 * // Get player settings
 * const settings = await trpc.audioPlayer.getSettings.query();
 *
 * // Get listening statistics
 * const stats = await trpc.audioPlayer.getStats.query();
 *
 * // Get audio metadata for a chapter
 * const metadata = await trpc.audioPlayer.getAudioMetadata.query({ chapterId: 1 });
 * ```
 */
export const audioPlayerRouter = router({
  // Progress tracking procedures
  ...audioPlayerProgressRouter._def.procedures,

  // Bookmark management procedures
  ...audioPlayerBookmarksRouter._def.procedures,

  // Settings procedures
  ...audioPlayerSettingsRouter._def.procedures,

  // History and analytics procedures
  ...audioPlayerHistoryRouter._def.procedures,

  // Metadata extraction procedures
  ...audioPlayerMetadataRouter._def.procedures,
});

// Re-export sub-routers for direct access if needed
export {
  audioPlayerProgressRouter,
  audioPlayerBookmarksRouter,
  audioPlayerSettingsRouter,
  audioPlayerHistoryRouter,
  audioPlayerMetadataRouter,
};

// Re-export utilities
export * from './utils';
