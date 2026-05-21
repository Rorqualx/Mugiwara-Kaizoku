/**
 * Add Manga Chapter Detail Fetching Helpers
 *
 * Helper functions for fetching chapter details from Fandom during manga import.
 * Extracted from crudOperations.ts to reduce complexity and nesting depth.
 */

import { logger } from '@/utils/logger';

import { mapChapterUrlsToFetch, fetchAndUpdateChapterDetails } from '../helpers/chapterDetailHelpers';
import { extractUrlOrigin } from '../helpers/urlHelpers';
import { isRecord, safeGet } from '../shared';

import type { ChapterDetails, UrlToFetch } from '../helpers/chapterDetailHelpers';
import type { PrismaClient } from '@prisma/client';

// ===================================
// TYPES
// ===================================

export interface ChapterMetadataInput {
  chapterUrls?: unknown[];
  shouldFetchChapterDetails?: boolean;
  sourceUrl?: string;
  volumesUrl?: string;
}

// ===================================
// EXPORTED FUNCTIONS
// ===================================

/**
 * Determine if Fandom chapter details should be fetched.
 * Works for any manga where Fandom is the chapter provider.
 */
export function shouldFetchChapterDetails(
  metadata: ChapterMetadataInput | undefined,
  selectedProviders: unknown,
  mangaSource: string
): boolean {
  if (!metadata?.chapterUrls || !metadata.shouldFetchChapterDetails) {
    return false;
  }

  logger.info(
    `Chapter URLs provided: ${metadata.chapterUrls.length} URLs, selectedProviders:`,
    selectedProviders
  );

  const isFandomProvider = checkFandomProvider(selectedProviders, mangaSource);

  if (isFandomProvider) {
    logger.info('Will fetch chapter details from Fandom (provider match found)');
    return true;
  }

  logger.info('Skipping chapter detail fetch - Fandom not selected as chapter provider');
  return false;
}

/**
 * Fetch chapter details asynchronously without blocking the main import.
 * Uses setTimeout to defer the fetch operation.
 */
export function fetchChapterDetailsAsync(
  prisma: PrismaClient,
  mangaId: number,
  metadata: ChapterMetadataInput
): void {
  setTimeout(() => {
    void executeFetchChapterDetails(prisma, mangaId, metadata);
  }, 1000);
}

// ===================================
// INTERNAL FUNCTIONS
// ===================================

function checkFandomProvider(selectedProviders: unknown, mangaSource: string): boolean {
  if (mangaSource === 'fandom') {
    return true;
  }

  if (!isRecord(selectedProviders)) {
    return false;
  }

  const chaptersProvider = safeGet(selectedProviders, 'chapters');
  const defaultProvider = safeGet(selectedProviders, 'default');

  return chaptersProvider === 'fandom' || defaultProvider === 'fandom';
}

async function executeFetchChapterDetails(
  prisma: PrismaClient,
  mangaId: number,
  metadata: ChapterMetadataInput
): Promise<void> {
  try {
    const chapterUrls = metadata.chapterUrls;
    if (!chapterUrls || chapterUrls.length === 0) {
      return;
    }

    logger.info(`Triggering chapter detail fetch for ${chapterUrls.length} chapters from Fandom`);

    const { ChapterDetailService } = await import('../../../../services/fandom/chapter-detail');
    const chapterDetailService = new ChapterDetailService();

    const chapters = await prisma.chapter.findMany({
      where: { mangaId },
      orderBy: { index: 'asc' }
    });

    if (chapters.length === 0 || chapterUrls.length === 0) {
      logger.debug(`No chapters or URLs to process for manga ${mangaId}`);
      return;
    }

    logger.info(
      `Found ${chapters.length} chapters in database and ${chapterUrls.length} chapter URLs to fetch`
    );

    const baseUrl = metadata.sourceUrl ?? metadata.volumesUrl;
    const urlOrigin = extractUrlOrigin(baseUrl, chapterUrls);

    const urlsToFetch: UrlToFetch[] = mapChapterUrlsToFetch(chapters, chapterUrls, urlOrigin);

    if (urlsToFetch.length > 0) {
      // Cast to the expected interface type
      const service = chapterDetailService as {
        batchFetchChapterDetails: (urls: string[], options?: unknown) => Promise<ChapterDetails[]>;
      };
      await processFetchBatch(prisma, service, urlsToFetch);
    }
  } catch (error: unknown) {
    logger.error(
      `Error fetching chapter details: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function processFetchBatch(
  prisma: PrismaClient,
  chapterDetailService: { batchFetchChapterDetails: (urls: string[], options?: unknown) => Promise<ChapterDetails[]> },
  urlsToFetch: UrlToFetch[]
): Promise<void> {
  const maxChaptersToFetch = 50;

  logger.info(
    `Fetching details for ${Math.min(maxChaptersToFetch, urlsToFetch.length)} chapters out of ${urlsToFetch.length} total`
  );

  await fetchAndUpdateChapterDetails(prisma, chapterDetailService, urlsToFetch, maxChaptersToFetch);
}
