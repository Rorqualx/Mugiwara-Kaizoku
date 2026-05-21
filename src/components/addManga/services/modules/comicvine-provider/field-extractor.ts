/**
 * Extract specific fields from ComicVine data
 */

import { logger } from '@/utils/logger';

import type { ComicVineData } from './types';

/**
 * Check if Chapter 0 exists in scraped data
 */
export function hasChapterZero(scrapedChapterData: unknown[]): boolean {
  return scrapedChapterData.some((ch: unknown) => {
    const chapter = ch as Record<string, unknown>;
    const title = String(chapter["title"] ?? '');
    return chapter["number"] === '0' ||
      chapter["number"] === 0 ||
      title.toLowerCase().includes('chapter 0') ||
      title.toLowerCase().includes('chapter zero');
  });
}

/**
 * Find highest numbered chapter in scraped data
 */
export function findHighestChapterNumber(scrapedChapterData: unknown[]): number {
  return Math.max(...scrapedChapterData
    .map((ch: unknown) => parseInt((ch as Record<string, unknown>)["number"] as string))
    .filter((num: number) => !isNaN(num))
  );
}

/**
 * Adjust chapter count to include Chapter 0 if present
 */
export function adjustChapterCountForChapterZero(
  scrapedChapterCount: number,
  scrapedChapterData: unknown[]
): number {
  if (scrapedChapterData.length === 0) {
    return scrapedChapterCount;
  }

  if (!hasChapterZero(scrapedChapterData)) {
    return scrapedChapterCount;
  }

  const highestChapter = findHighestChapterNumber(scrapedChapterData);
  if (highestChapter > 0) {
    const adjustedCount = highestChapter + 1; // +1 for Chapter 0
    logger.info(
      `[ComicVine] Chapter 0 detected, adjusting count: ${scrapedChapterCount} -> ${adjustedCount} (highest chapter: ${highestChapter})`
    );
    return adjustedCount;
  }

  return scrapedChapterCount;
}

/**
 * Extract volume count from various sources
 */
export function extractVolumeCount(
  searchResultVolumes: unknown,
  data: ComicVineData
): number {
  const result = searchResultVolumes ??
                 data.issueCount ??
                 data.issues?.length ??
                 0;
  return typeof result === 'number' ? result : 0;
}

/**
 * Calculate final chapter count
 */
export function calculateFinalChapterCount(
  scrapedChapterCount: number,
  scrapedChapterData: unknown[],
  searchResultChapters: unknown
): number {
  const adjustedChapterCount = adjustChapterCountForChapterZero(
    scrapedChapterCount,
    scrapedChapterData
  );

  // Handle the case where adjustedChapterCount might be 0 (falsy)
  if (adjustedChapterCount > 0) {
    return adjustedChapterCount;
  }

  // Handle searchResultChapters which could be number or other types
  if (typeof searchResultChapters === 'number') {
    return searchResultChapters;
  }

  return 0;
}

/**
 * Determine if URL is a series page
 */
export function isSeriesPage(url: string | undefined): boolean {
  return typeof url === 'string' && url.includes('/4050-');
}
