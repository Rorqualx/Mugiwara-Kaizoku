/**
 * Progress-related Filtering Module
 *
 * Functions for handling progress calculations including last read time
 * and chapter progress percentage.
 *
 * Extracted from: filtering.ts (lines 149-175)
 */

import { ChapterStatus } from './filtering-utils';

import type { MangaWithMetadata } from './filtering-utils';

/**
 * Get last read time for a manga
 */
export function getLastReadTime(m: MangaWithMetadata): number {
  if (!m.Chapter.length)
    return 0;
  const readTimes = m.Chapter
    .filter((ch) => ch.downloadStatus === ChapterStatus.COMPLETED)
    .map((ch) => {
      // Use updatedAt as proxy for read time for completed chapters
      const updatedAt = ch.updatedAt;
      if (typeof updatedAt === 'string' || updatedAt instanceof Date) {
        return new Date(updatedAt).getTime();
      }
      return 0;
    })
    .filter((time: number) => time > 0);
  return readTimes.length > 0 ? Math.max(...readTimes) : 0;
}

/**
 * Get chapter progress percentage
 */
export function getChapterProgress(m: MangaWithMetadata): number {
  if (m.Chapter.length === 0)
    return 0;
  const readCount = m.Chapter.filter((ch) => ch.downloadStatus === ChapterStatus.COMPLETED).length;
  return readCount / m.Chapter.length;
}