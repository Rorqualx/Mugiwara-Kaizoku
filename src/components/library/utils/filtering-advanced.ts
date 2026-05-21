/**
 * Advanced Filtering Module
 *
 * Handles complex filtering operations including date ranges, genre/tag inclusion/exclusion,
 * and chapter count filtering.
 *
 * Extracted from: filtering.ts (lines 21-92)
 * Complexity Reduction: Extracted helper functions for each filter type
 */

import type { MangaWithMetadata, AdvancedFilter } from './filtering-utils';

// ============================================================================
// Helper Functions for Complexity Reduction
// ============================================================================

/**
 * Check if manga passes date added filter
 */
function passesDateAddedFilter(manga: MangaWithMetadata, filters: AdvancedFilter): boolean {
  if (!filters.dateAddedFrom && !filters.dateAddedTo) return true;

  const createdAt = new Date(manga.createdAt).getTime();

  if (filters.dateAddedFrom) {
    const fromTime = new Date(filters.dateAddedFrom).getTime();
    if (createdAt < fromTime) return false;
  }

  if (filters.dateAddedTo) {
    const toTime = new Date(filters.dateAddedTo).getTime();
    if (createdAt > toTime) return false;
  }

  return true;
}

/**
 * Check if manga passes last read filter
 */
function passesLastReadFilter(manga: MangaWithMetadata, filters: AdvancedFilter): boolean {
  if (!filters.lastReadFrom && !filters.lastReadTo) return true;

  // Import getLastReadTime from filtering module
  const lastReadTime = getLastReadTime(manga);
  if (lastReadTime === 0) return false; // No chapters read

  if (filters.lastReadFrom) {
    const fromTime = new Date(filters.lastReadFrom).getTime();
    if (lastReadTime < fromTime) return false;
  }

  if (filters.lastReadTo) {
    const toTime = new Date(filters.lastReadTo).getTime();
    if (lastReadTime > toTime) return false;
  }

  return true;
}

/**
 * Check if manga passes chapter count filter
 */
function passesChapterCountFilter(manga: MangaWithMetadata, filters: AdvancedFilter): boolean {
  if (filters.chaptersMin === null && filters.chaptersMax === null) return true;

  const chapterCount = manga.Chapter.length;

  if (filters.chaptersMin !== null && filters.chaptersMin !== undefined && chapterCount < filters.chaptersMin) {
    return false;
  }

  if (filters.chaptersMax !== null && filters.chaptersMax !== undefined && chapterCount > filters.chaptersMax) {
    return false;
  }

  return true;
}

/**
 * Check if manga passes genre/tag inclusion filter
 */
function passesInclusionFilter(manga: MangaWithMetadata, filters: AdvancedFilter): boolean {
  // Genre inclusion
  if (filters.genres?.length) {
    const mangaGenres = manga.Metadata?.genres ?? [];
    if (!filters.genres.some(g => mangaGenres.includes(g))) {
      return false;
    }
  }

  // Tag inclusion
  if (filters.tags?.length) {
    const mangaTags = manga.Metadata?.tags ?? [];
    if (!filters.tags.some(t => mangaTags.includes(t))) {
      return false;
    }
  }

  return true;
}

/**
 * Check if manga passes genre/tag exclusion filter
 */
function passesExclusionFilter(manga: MangaWithMetadata, filters: AdvancedFilter): boolean {
  // Genre exclusion
  if (filters.excludeGenres?.length) {
    const mangaGenres = manga.Metadata?.genres ?? [];
    if (filters.excludeGenres.some(g => mangaGenres.includes(g))) {
      return false;
    }
  }

  // Tag exclusion
  if (filters.excludeTags?.length) {
    const mangaTags = manga.Metadata?.tags ?? [];
    if (filters.excludeTags.some(t => mangaTags.includes(t))) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Main Filter Function
// ============================================================================

/**
 * Apply advanced filters to manga list
 */
export function applyAdvancedFilters(manga: MangaWithMetadata[], advancedFilters: AdvancedFilter): MangaWithMetadata[] {
  return manga.filter(m => {
    return passesDateAddedFilter(m, advancedFilters) &&
           passesLastReadFilter(m, advancedFilters) &&
           passesChapterCountFilter(m, advancedFilters) &&
           passesInclusionFilter(m, advancedFilters) &&
           passesExclusionFilter(m, advancedFilters);
  });
}

// ============================================================================
// Helper Function Imports
// ============================================================================

/**
 * Get last read time for a manga
 *
 * Note: This function is imported from the main filtering module
 * to maintain functionality without circular dependencies.
 */
function getLastReadTime(m: MangaWithMetadata): number {
  if (!m.Chapter.length) return 0;

  const readTimes = m.Chapter
    .filter(ch => ch.downloadStatus === 'COMPLETED')
    .map(ch => {
      // Use updatedAt as proxy for read time for completed chapters
      const updatedAt = ch.updatedAt;
      if (typeof updatedAt === 'string' || updatedAt instanceof Date) {
        return new Date(updatedAt).getTime();
      }
      return 0;
    })
    .filter(time => time > 0);

  return readTimes.length > 0 ? Math.max(...readTimes) : 0;
}