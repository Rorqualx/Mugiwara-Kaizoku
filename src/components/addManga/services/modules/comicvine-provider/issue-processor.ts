/**
 * Process ComicVine issues and scrape chapter data
 */

import {
  initializeVolumeData,
  processVolumeChunk,
  addProcessingDelay,
  processScrapedVolumes,
  type VolumeData
} from '@/components/addManga/services/helpers/comicVineScrapingHelpers';
import { logger } from '@/utils/logger';

import type { ComicVineMutations, ScrapedData } from './types';

/**
 * Scrape chapters from a series page using two-step process
 */
export async function scrapeSeriesPage(
  comicVineUrl: string,
  mutations: ComicVineMutations
): Promise<ScrapedData> {
  let scrapedChapterCount = 0;
  const scrapedChapterData: unknown[] = [];
  let volumeData: unknown[] = [];

  try {
    logger.info('[ComicVine] Detected series page, starting two-step scraping process');

    if (!mutations.scrapeComicVineVolumeUrlsMutation) {
      return { scrapedChapterCount, scrapedChapterData, volumeData };
    }

    const volumeUrlsResponse = await mutations.scrapeComicVineVolumeUrlsMutation.mutateAsync({
      seriesUrl: comicVineUrl
    });

    const responseData = volumeUrlsResponse as unknown as Record<string, unknown>;
    const volumeUrls = (responseData["volumeUrls"] ?? []) as Array<Record<string, unknown>>;
    logger.info(`[ComicVine] Found ${volumeUrls.length} volume URLs to scrape`);

    if (volumeUrls.length === 0) {
      return { scrapedChapterCount, scrapedChapterData, volumeData };
    }

    // Initialize volumeData from scraped URLs
    volumeData = initializeVolumeData(
      volumeUrls.map((v) => ({
        volumeNumber: v['volumeNumber'] as number,
        url: v['url'] as string
      }))
    );

    logger.info(`[ComicVine] Initialized volumeData for ${volumeData.length} volumes`);

    // Scrape all volumes for chapters
    if (!mutations.scrapeComicVineChaptersMutation) {
      logger.warn('[ComicVine] scrapeComicVineChaptersMutation not available');
      return { scrapedChapterCount, scrapedChapterData, volumeData };
    }
    const allVolumeChapters = await scrapeVolumeChapters(
      volumeUrls,
      mutations.scrapeComicVineChaptersMutation
    );

    // Process all scraped volumes
    volumeData = processScrapedVolumes(
      volumeData as VolumeData[],
      scrapedChapterData,
      allVolumeChapters
    );

    scrapedChapterCount = scrapedChapterData.length;
    logger.info(
      `[ComicVine] Successfully scraped ${scrapedChapterCount} total chapters from ${allVolumeChapters.length} volumes`
    );
  } catch (scrapeError) {
    logger.warn('[ComicVine] Failed to scrape chapters from series page:', scrapeError);
  }

  return { scrapedChapterCount, scrapedChapterData, volumeData };
}

/**
 * Scrape chapters from multiple volumes in chunks
 */
async function scrapeVolumeChapters(
  volumeUrls: Array<Record<string, unknown>>,
  mutation: ComicVineMutations['scrapeComicVineChaptersMutation']
): Promise<unknown[]> {
  const urls = volumeUrls.map((v: Record<string, unknown>) => v["url"] as string);
  // Process one at a time - FlareSolverr launches a new browser per request
  const chunkSize = 1;
  const allVolumeChapters: unknown[] = [];

  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize);
    const totalChunks = Math.ceil(urls.length / chunkSize);

    if (!mutation) {
      logger.warn('[ComicVine] scrapeComicVineChaptersMutation not available for chunk processing');
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- Sequential processing required for rate limiting
    const chunkResults = await processVolumeChunk(
      chunk,
      Math.floor(i / chunkSize),
      totalChunks,
      mutation
    );

    allVolumeChapters.push(...chunkResults);
    // eslint-disable-next-line no-await-in-loop -- Sequential delay required for rate limiting
    await addProcessingDelay(i + chunkSize < urls.length);
  }

  return allVolumeChapters;
}

/**
 * Scrape chapters from a single volume page
 */
export async function scrapeVolumePage(
  comicVineUrl: string,
  mutations: ComicVineMutations
): Promise<Pick<ScrapedData, 'scrapedChapterCount' | 'scrapedChapterData'>> {
  let scrapedChapterCount = 0;
  let scrapedChapterData: unknown[] = [];

  try {
    logger.info('[ComicVine] Scraping single volume page:', comicVineUrl);
    if (!mutations.scrapeComicVineVolumeMutation) {
      logger.warn('[ComicVine] scrapeComicVineVolumeMutation not available');
      return { scrapedChapterCount, scrapedChapterData };
    }
    const scrapeResponse = await mutations.scrapeComicVineVolumeMutation.mutateAsync({
      volumeUrl: comicVineUrl
    });

    const responseData = scrapeResponse as unknown as Record<string, unknown>;
    const volumeDetails = responseData["volumeDetails"] as Array<Record<string, unknown>> | undefined;

    if (volumeDetails?.[0]) {
      const scrapedData = volumeDetails[0];
      const chapters = scrapedData["chapters"];
      const chaptersArray = Array.isArray(chapters) ? chapters : [];
      const totalChapters = responseData["totalChapters"];
      scrapedChapterCount = typeof totalChapters === 'number' ? totalChapters : chaptersArray.length;
      scrapedChapterData = chaptersArray;

      logger.info('[ComicVine] Successfully scraped chapter data:', {
        totalChapters: scrapedChapterCount,
        chaptersFound: scrapedChapterData.length
      });
    }
  } catch (scrapeError) {
    logger.warn('[ComicVine] Failed to scrape chapter data from volume page:', scrapeError);
  }

  return { scrapedChapterCount, scrapedChapterData };
}
