/**
 * Basic Filtering Module
 *
 * Handles basic filtering operations including read/unread status, completion status,
 * download status, and issue detection.
 *
 * Extracted from: filtering.ts (lines 218-266)
 */

import { ChapterStatus, MangaPublicationStatus } from './filtering-utils';

import type { MangaWithMetadata, FilterOption } from './filtering-utils';
import type { Chapter } from '@prisma/client';

// ============================================================================
// Helper Functions for Complexity Reduction
// ============================================================================

/**
 * Check if manga passes read filter
 */
function passesReadFilter(manga: MangaWithMetadata): boolean {
  return manga.Chapter.length > 0 &&
         manga.Chapter.every((ch: Chapter) => ch.downloadStatus === ChapterStatus.COMPLETED);
}

/**
 * Check if manga passes unread filter
 */
function passesUnreadFilter(manga: MangaWithMetadata): boolean {
  return manga.Chapter.some((ch: Chapter) => ch.downloadStatus !== ChapterStatus.COMPLETED);
}

/**
 * Check if manga passes in-progress filter
 */
function passesInProgressFilter(manga: MangaWithMetadata): boolean {
  if (manga.Chapter.length === 0) return false;

  const readCount = manga.Chapter.filter((ch: Chapter) => ch.downloadStatus === ChapterStatus.COMPLETED).length;
  return readCount > 0 && readCount < manga.Chapter.length;
}

/**
 * Check if manga passes completed filter
 */
function passesCompletedFilter(manga: MangaWithMetadata): boolean {
  return manga.Metadata?.status === MangaPublicationStatus.COMPLETED;
}

/**
 * Check if manga passes downloaded filter
 */
function passesDownloadedFilter(manga: MangaWithMetadata): boolean {
  return manga.Chapter.some((ch: Chapter) => ch.downloadStatus === ChapterStatus.COMPLETED);
}

/**
 * Check if manga passes has-issues filter
 */
function passesHasIssuesFilter(manga: MangaWithMetadata): boolean {
  return manga.Chapter.some((ch: Chapter) =>
    ch.downloadStatus === ChapterStatus.ERROR ||
    ch.downloadStatus === ChapterStatus.DELETED
  );
}

// ============================================================================
// Main Filter Function
// ============================================================================

/**
 * Apply basic filters to manga list
 */
export function applyBasicFilters(manga: MangaWithMetadata[], filters: FilterOption[]): MangaWithMetadata[] {
  if (filters.length === 0) return manga;

  return manga.filter(m => {
    for (const filter of filters) {
      let passes = true;

      switch (filter) {
        case 'read':
          passes = passesReadFilter(m);
          break;
        case 'unread':
          passes = passesUnreadFilter(m);
          break;
        case 'in-progress':
          passes = passesInProgressFilter(m);
          break;
        case 'completed':
          passes = passesCompletedFilter(m);
          break;
        case 'downloaded':
          passes = passesDownloadedFilter(m);
          break;
        case 'has-issues':
          passes = passesHasIssuesFilter(m);
          break;
        default:
          // Unknown filter, skip it
          continue;
      }

      if (!passes) return false;
    }

    return true;
  });
}