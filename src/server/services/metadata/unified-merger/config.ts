/**
 * Unified Metadata Merger - Configuration
 *
 * Default configuration for metadata merging operations.
 * Defines provider priorities and merge behavior defaults.
 *
 * Extracted from: unified-merger.ts (lines 65-86)
 */

import type { MergeConfig } from './types';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default merge configuration
 *
 * Provider Priority Ranking:
 * 1. AniList (100) - Most comprehensive for anime/manga
 * 2. ComicVine (90) - Good for western comics
 * 3. Fandom (80) - Community-driven content
 * 4. Wikipedia (70) - Reliable general information
 *
 * Conflict Resolution Strategy:
 * - Uses 'highest_priority' to select values from highest priority provider
 * - Prefers non-null values to ensure data completeness
 * - Merges and deduplicates arrays to combine data from multiple sources
 */
export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  priorities: [
    { provider: 'anilist', priority: 100 },
    { provider: 'comicvine', priority: 90 },
    { provider: 'fandom', priority: 80 },
    { provider: 'wikipedia', priority: 70 },
  ],
  conflictResolution: 'highest_priority',
  mergeArrays: true,
  deduplicateArrays: true,
  preferNonNull: true,
};
