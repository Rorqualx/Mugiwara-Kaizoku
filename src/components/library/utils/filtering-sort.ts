/**
 * Sorting Operations Module
 *
 * Handles various sorting operations for manga lists including alphabetical,
 * date added, last read, progress, and rating sorting.
 *
 * Extracted from: filtering.ts (lines 179-214)
 */

import { getLastReadTime, getChapterProgress } from './filtering-progress';

import type { MangaWithMetadata, SortOption } from './filtering-utils';


// ============================================================================
// Helper Functions for Sorting
// ============================================================================

/**
 * Compare by alphabetical order
 */
function compareAlphabetical(a: MangaWithMetadata, b: MangaWithMetadata): number {
  return a.title.localeCompare(b.title);
}

/**
 * Compare by alphabetical order (descending)
 */
function compareAlphabeticalDesc(a: MangaWithMetadata, b: MangaWithMetadata): number {
  return b.title.localeCompare(a.title);
}

/**
 * Compare by date added (newest first)
 */
function compareDateAdded(a: MangaWithMetadata, b: MangaWithMetadata): number {
  const aCreated = new Date(a.createdAt).getTime();
  const bCreated = new Date(b.createdAt).getTime();
  return bCreated - aCreated;
}

/**
 * Compare by date added (oldest first)
 */
function compareDateAddedDesc(a: MangaWithMetadata, b: MangaWithMetadata): number {
  const aCreated = new Date(a.createdAt).getTime();
  const bCreated = new Date(b.createdAt).getTime();
  return aCreated - bCreated;
}

/**
 * Compare by last read time
 */
function compareLastRead(a: MangaWithMetadata, b: MangaWithMetadata): number {
  return getLastReadTime(b) - getLastReadTime(a);
}

/**
 * Compare by chapter progress
 */
function compareProgress(a: MangaWithMetadata, b: MangaWithMetadata): number {
  return getChapterProgress(b) - getChapterProgress(a);
}

/**
 * Compare by chapter count (as proxy for rating)
 */
function compareRating(a: MangaWithMetadata, b: MangaWithMetadata): number {
  const aCount = a.Chapter.length;
  const bCount = b.Chapter.length;
  return bCount - aCount;
}

// ============================================================================
// Main Sort Function
// ============================================================================

/**
 * Apply sorting to manga list
 */
export function applySorting(manga: MangaWithMetadata[], sortBy: SortOption): MangaWithMetadata[] {
  return [...manga].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return compareAlphabetical(a, b);
      case 'alphabetical-desc':
        return compareAlphabeticalDesc(a, b);
      case 'date-added':
        return compareDateAdded(a, b);
      case 'date-added-desc':
        return compareDateAddedDesc(a, b);
      case 'last-read':
        return compareLastRead(a, b);
      case 'progress':
        return compareProgress(a, b);
      case 'rating':
        return compareRating(a, b);
      default:
        return 0;
    }
  });
}