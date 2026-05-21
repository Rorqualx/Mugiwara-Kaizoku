/**
 * Chapter Details Fetcher Module
 *
 * Handles batch fetching of chapter details (covers, descriptions, page counts).
 */

import { logger } from '@/utils/logger';

/**
 * Fetch chapter details in batches with progress tracking
 * @param chapterUrls - Array of chapter URLs to fetch
 * @param maxChaptersToFetch - Maximum number of chapters to fetch
 * @returns Map of chapter URL to chapter details
 */
export async function fetchChapterDetailsBatch(
  chapterUrls: string[],
  maxChaptersToFetch: number
): Promise<Map<string, unknown>> {
  const chapterDetailsMap: Map<string, unknown> = new Map();

  if (chapterUrls.length === 0) {
    return chapterDetailsMap;
  }

  const { PerformanceTimer } = await import('@/server/utils/performanceTimer');
  const fetchTimer = new PerformanceTimer('Chapter Details Fetch');

  logger.info(`Automatically fetching details for ${chapterUrls.length} chapters...`);

  try {
    const { ChapterDetailService } = await import('@/server/services/fandom/chapter-detail');
    const chapterService = new ChapterDetailService();

    // Limit chapters to fetch based on input
    const chaptersToFetch = chapterUrls.slice(0, maxChaptersToFetch);
    fetchTimer.mark(`Starting fetch for ${chaptersToFetch.length} chapters`);

    // Optimized batch settings for better parallelization
    const batchSize = Math.min(chaptersToFetch.length, 20);
    const chapterDetails = await chapterService.batchFetchChapterDetails(chaptersToFetch, {
      batchSize,
      delayMs: 150,
      maxRetries: 2,
    });

    // Map details by URL for quick lookup
    chapterDetails.forEach((detail) => {
      chapterDetailsMap.set(detail.url, detail);
    });

    const { formattedDuration } = fetchTimer.end();
    logger.info(
      `Successfully fetched details for ${chapterDetails.length} chapters in ${formattedDuration}`
    );
  } catch (error) {
    logger.warn(
      `Failed to fetch chapter details: ${error instanceof Error ? error.message : String(error)}`
    );
    // Continue without chapter details
  }

  return chapterDetailsMap;
}
