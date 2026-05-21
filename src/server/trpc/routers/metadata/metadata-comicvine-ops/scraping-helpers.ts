/**
 * ComicVine Scraping Helpers
 *
 * Functions for scraping ComicVine pages via FlareSolverr.
 */

import type { comicVineScraper } from '@/server/services/comicvine/scrapingService';
import { logger } from '@/utils/logger';

type VolumeResult = Awaited<ReturnType<typeof comicVineScraper.scrapeVolumeChapters>> | null;

/**
 * Scrape multiple ComicVine volume URLs with controlled concurrency
 * Processes volumes in chunks to avoid overwhelming FlareSolverr
 *
 * @param volumeUrls - Array of ComicVine volume URLs to scrape
 * @param maxConcurrent - Maximum concurrent requests (default: 5)
 * @returns Array of scraped volume data (null for failed scrapes)
 */
export async function scrapeVolumesWithConcurrency(
  volumeUrls: string[],
  maxConcurrent: number = 5
): Promise<VolumeResult[]> {
  const { comicVineScraper: scraper } = await import('@/server/services/comicvine/scrapingService');

  // Create chunks for controlled concurrency
  const chunks: Array<{ urls: string[]; startIndex: number }> = [];
  for (let i = 0; i < volumeUrls.length; i += maxConcurrent) {
    chunks.push({
      urls: volumeUrls.slice(i, i + maxConcurrent),
      startIndex: i,
    });
  }

  const results: VolumeResult[] = Array.from({ length: volumeUrls.length }, () => null);
  const totalChunks = chunks.length;

  // Process chunks sequentially using reduce to avoid await-in-loop
  await chunks.reduce(async (prevPromise, chunk, chunkIdx) => {
    await prevPromise;

    logger.info(`[ComicVine] Processing chunk ${chunkIdx + 1}/${totalChunks} (${chunk.urls.length} volumes)`);

    const chunkResults = await Promise.all(
      chunk.urls.map(async (url, idx) => {
        try {
          const volumeData = await scraper.scrapeVolumeChapters(url);
          return { index: chunk.startIndex + idx, data: volumeData };
        } catch (error: unknown) {
          logger.error(`Failed to scrape volume ${url}:`, error);
          return { index: chunk.startIndex + idx, data: null };
        }
      })
    );

    for (const result of chunkResults) {
      results[result.index] = result.data;
    }
  }, Promise.resolve());

  return results;
}

/**
 * Log scraping results for debugging
 */
export function logScrapingResults(results: VolumeResult[], volumeUrlsLength: number): void {
  const nonNullResults = results.filter((data): data is NonNullable<typeof data> => data !== null);
  logger.info(`Successfully scraped ${nonNullResults.length} of ${volumeUrlsLength} volumes`);
  if (nonNullResults.length > 0) {
    logger.info(`Total chapters across all volumes: ${nonNullResults.reduce((sum, vol) => sum + vol.chapters.length, 0)}`);
  }
}
