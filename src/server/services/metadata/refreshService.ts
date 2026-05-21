/**
 * Metadata Refresh Service
 *
 * Handles complex metadata refresh operations including provider scraping,
 * conflict detection, and metadata updates.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { metadataMergerService } from '@/server/services/metadataMerger';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


/**
 * Parse selected providers from selectedSourceId JSON string
 */
export function parseSelectedProviders(
  selectedSourceId: string | null
): Record<string, string> | null {
  if (!selectedSourceId) {
    return null;
  }

  try {
    const parsedProviders: unknown = JSON.parse(selectedSourceId);
    if (parsedProviders && typeof parsedProviders === 'object' && !Array.isArray(parsedProviders)) {
      logger.info(`Using selected providers for refresh: ${JSON.stringify(parsedProviders)}`);
      return parsedProviders as Record<string, string>;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to parse selectedSourceId: ${errorMessage}`);
  }

  return null;
}

/**
 * Enrich manga metadata using selected providers or default
 */
export async function enrichMangaWithProviders(
  mangaId: number,
  selectedProviders: Record<string, string> | null
): Promise<AsyncResult<void, Error>> {
  try {
    if (selectedProviders) {
      await metadataMergerService.enrichMangaMetadataWithSelectedProviders(
        mangaId,
        selectedProviders,
        true // forceRefresh
      );
    } else {
      logger.warn(`No selected providers found for manga ${mangaId}, using default refresh`);
      await metadataMergerService.enrichMangaMetadata(mangaId);
    }
    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error enriching manga metadata: ${errorMessage}`);
    return createErrorResult(new Error(`Failed to enrich metadata: ${errorMessage}`));
  }
}

/**
 * Find ComicVine series URL from provider metadata or metadata URLs
 */
export function findComicVineSeriesUrl(
  providerMetadata: unknown,
  metadataUrls?: unknown[]
): string | undefined {
  const comicvineData =
    (providerMetadata as Record<string, unknown>)['comicvine'] ??
    (providerMetadata as Record<string, unknown>)['comicvine_volumes'] ??
    (providerMetadata as Record<string, unknown>)['comicvine_chapters'];

  let seriesUrl: string | undefined;

  if (comicvineData && typeof comicvineData === 'object') {
    const cvDataObj = comicvineData as Record<string, unknown>;
    seriesUrl =
      (cvDataObj['site_detail_url'] as string | undefined) ??
      (cvDataObj['url'] as string | undefined) ??
      ((cvDataObj['Metadata'] as Record<string, unknown> | undefined)?.['site_detail_url'] as
        | string
        | undefined);
  }

  if (!seriesUrl && Array.isArray(metadataUrls)) {
    seriesUrl = metadataUrls.find(
      (url) => typeof url === 'string' && url.includes('comicvine.gamespot.com')
    ) as string | undefined;
  }

  return seriesUrl;
}

/**
 * Scrape ComicVine volumes and update provider metadata
 */
export async function scrapeComicVineVolumes(
  mangaId: number,
  seriesUrl: string,
  providerMetadata: unknown
): Promise<AsyncResult<void, Error>> {
  try {
    logger.info(`[refreshMetadata] Scraping ComicVine series for fresh volume data`);

    const { comicVineScraper } = await import('../comicvine/scrapingService');
    const volumesData = await comicVineScraper.scrapeSeriesChapters(seriesUrl);

    if (volumesData.length === 0) {
      logger.warn(`No volumes data returned from ComicVine scraper`);
      return createSuccessResult(undefined);
    }

    logger.info(`Successfully scraped ${volumesData.length} volumes from ComicVine`);

    const comicvineData = (providerMetadata as Record<string, unknown>)['comicvine'];
    const providerMetadataObj = providerMetadata as Record<string, unknown>;

    const updatedProviderMetadata: Record<string, unknown> = {
      ...providerMetadataObj,
      comicvine: {
        ...(comicvineData as Record<string, unknown>),
        volumeData: volumesData,
        rawData: { issues: volumesData },
        metadata: { issues: volumesData },
        lastFetch: new Date().toISOString(),
      },
    };

    await prisma.manga.update({
      where: { id: mangaId },
      data: {
        providerMetadata: updatedProviderMetadata as Prisma.InputJsonValue,
      },
    });

    // Emit WebSocket event for real-time UI sync
    void realtimeEmitter.emitMangaUpdate({
      mangaId,
      action: 'updated',
      data: {
        comicVineVolumesSscraped: true,
        volumesCount: volumesData.length,
        source: 'comicvine-scraper'
      }
    });

    logger.info(`Updated providerMetadata with fresh ComicVine volume data`);
    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to scrape ComicVine volumes: ${errorMessage}`);
    return createErrorResult(new Error(`ComicVine scraping failed: ${errorMessage}`));
  }
}

/**
 * Find Fandom wiki subdomain from provider metadata or URLs
 */
export function findFandomWikiSubdomain(
  providerMetadata: unknown,
  metadataUrls?: unknown[]
): string | undefined {
  const fandomData =
    (providerMetadata as Record<string, unknown>)['fandom'] ??
    (providerMetadata as Record<string, unknown>)['fandom_chapters'];

  let wikiUrl: string | undefined;

  if (fandomData && typeof fandomData === 'object') {
    const fandomDataObj = fandomData as Record<string, unknown>;
    wikiUrl =
      (fandomDataObj['url'] as string | undefined) ??
      (fandomDataObj['wikiUrl'] as string | undefined);
  }

  if (!wikiUrl && Array.isArray(metadataUrls)) {
    wikiUrl = metadataUrls.find((url) => typeof url === 'string' && url.includes('.fandom.com')) as
      | string
      | undefined;
  }

  if (wikiUrl) {
    const subdomainMatch = wikiUrl.match(/https?:\/\/([^.]+)\.fandom\.com/);
    return subdomainMatch?.[1];
  }

  return undefined;
}

/**
 * Fetch chapter details with covers from Fandom
 */
export async function fetchChapterDetailsWithCovers(
  chapters: Array<{ url?: string; title?: string; number?: string | number }>
): Promise<unknown[]> {
  const { chapterDetailService } = await import('../fandom/chapter-detail');

  return Promise.all(
    chapters.map(async (chapter) => {
      if (!chapter.url) {
        return chapter;
      }

      try {
        const chapterDetails = await chapterDetailService.fetchChapterDetails(chapter.url);
        if (chapterDetails) {
          return {
            ...chapter,
            coverImage: chapterDetails.coverImageUrl,
            url: chapter.url,
          };
        }
      } catch (_error: unknown) {
        logger.warn(`Failed to fetch details for chapter: ${chapter.title ?? chapter.number ?? 'unknown'}`);
      }

      return chapter;
    })
  );
}

/**
 * Calculate total chapter count from HTML or volumes
 */
export function calculateTotalChapters(html: string, volumes: unknown[]): number {
  // Try to extract from HTML text first
  const chapterMatch: RegExpMatchArray | null =
    html.match(/(\d+)\s+chapters?/i) ?? html.match(/has\s+(\d+)\s+chapters?/i);

  if (chapterMatch?.[1]) {
    const count = parseInt(chapterMatch[1], 10);
    logger.info(`Extracted chapter count from text: ${count}`);
    return count;
  }

  // Fallback to summing chapters from volumes
  const count = volumes.reduce((sum: number, vol: unknown) => {
    if (typeof vol !== 'object' || vol === null) {
      return sum;
    }
    const chapters = (vol as Record<string, unknown>)['chapters'];
    return sum + (Array.isArray(chapters) ? chapters.length : 0);
  }, 0);

  logger.info(`Calculated chapter count from volumes: ${count}`);
  return count;
}

/**
 * Determine volume source from selected providers
 */
export function determineVolumeSource(
  selectedProviders: Record<string, string> | null,
  defaultSource: string
): string {
  if (selectedProviders?.['volumes']) {
    return selectedProviders['volumes'];
  }
  if (selectedProviders?.['chapters']) {
    return selectedProviders['chapters'];
  }
  return defaultSource.toLowerCase();
}

/**
 * Handle ComicVine volume scraping for a manga
 */
export async function handleComicVineScraping(
  mangaId: number,
  selectedProviders: Record<string, string> | null,
  defaultSource: string
): Promise<AsyncResult<void, Error>> {
  try {
    const volumeSource = selectedProviders?.['volumes'] ?? selectedProviders?.['chapters'] ?? defaultSource.toLowerCase();

    if (volumeSource !== 'comicvine') {
      return createSuccessResult(undefined);
    }

    logger.info(`[refreshMetadata] Re-fetching ComicVine volume details for manga ${mangaId}`);

    const updatedManga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        providerMetadata: true,
        Metadata: true
      }
    });

    if (!updatedManga?.providerMetadata) {
      return createSuccessResult(undefined);
    }

    const providerMetadata: unknown = typeof updatedManga.providerMetadata === 'string'
      ? JSON.parse(updatedManga.providerMetadata)
      : updatedManga.providerMetadata;

    const metadataUrls = updatedManga.Metadata
      ? (updatedManga.Metadata as Record<string, unknown>)['urls']
      : undefined;

    const seriesUrl = findComicVineSeriesUrl(
      providerMetadata,
      Array.isArray(metadataUrls) ? metadataUrls : undefined
    );

    if (!seriesUrl) {
      logger.warn(`[refreshMetadata] No ComicVine series URL found, skipping volume scraping`);
      return createSuccessResult(undefined);
    }

    return await scrapeComicVineVolumes(mangaId, seriesUrl, providerMetadata);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error during ComicVine volume scraping: ${errorMessage}`);
    return createErrorResult(new Error(`ComicVine scraping failed: ${errorMessage}`));
  }
}

/**
 * Handle Fandom chapter scraping for a manga
 */
export async function handleFandomScraping(
  mangaId: number,
  mangaTitle: string,
  selectedProviders: Record<string, string> | null,
  defaultSource: string
): Promise<AsyncResult<void, Error>> {
  try {
    const chapterSource = selectedProviders?.['chapters'] ?? defaultSource.toLowerCase();

    if (chapterSource !== 'fandom') {
      return createSuccessResult(undefined);
    }

    logger.info(`[refreshMetadata] Re-fetching Fandom chapter details for manga ${mangaId}`);

    const updatedManga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        providerMetadata: true,
        Metadata: true,
        title: true
      }
    });

    if (!updatedManga?.providerMetadata) {
      return createSuccessResult(undefined);
    }

    const providerMetadata: unknown = typeof updatedManga.providerMetadata === 'string'
      ? JSON.parse(updatedManga.providerMetadata)
      : updatedManga.providerMetadata;

    const metadataUrls = updatedManga.Metadata
      ? (updatedManga.Metadata as Record<string, unknown>)['urls']
      : undefined;

    const wikiSubdomain = findFandomWikiSubdomain(
      providerMetadata,
      Array.isArray(metadataUrls) ? metadataUrls : undefined
    );

    if (!wikiSubdomain) {
      logger.warn(`[refreshMetadata] No Fandom wiki URL found, skipping chapter scraping`);
      return createSuccessResult(undefined);
    }

    const { scrapeFandomChaptersAndVolumes } = await import('./fandomRefreshService');
    return await scrapeFandomChaptersAndVolumes(
      mangaId,
      wikiSubdomain,
      mangaTitle,
      providerMetadata
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error during Fandom chapter scraping: ${errorMessage}`);
    return createErrorResult(new Error(`Fandom scraping failed: ${errorMessage}`));
  }
}
