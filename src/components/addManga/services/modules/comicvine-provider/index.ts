/**
 * Main ComicVine provider orchestrator
 *
 * API-FIRST APPROACH (Non-blocking):
 * 1. Call ComicVine API to get basic metadata (title, description, cover, volume count)
 * 2. Return immediately with volume data marked as `needsChapterScraping: true`
 * 3. Chapter scraping happens asynchronously via background function
 *
 * This ensures fast metadata retrieval without blocking the UI.
 * Chapters are loaded in the background via FlareSolverr after metadata fetch.
 */

import type * as React from 'react';

import { extractComicVineAlternativeTitles } from '@/components/addManga/services/sourceManagementService/comicvine-operations';
import type { Chapter, ProviderMetadata, Volume, VolumesData } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { vanillaTrpcClient } from '@/utils/trpc-client/vanilla';

import {
  extractVolumeId,
  extractComicVineUrl,
  logIncomingResult,
  fetchAndValidateApiResponse
} from './api-search';
import {
  extractVolumeCount,
  calculateFinalChapterCount
} from './field-extractor';
// Note: scraping functions (scrapeSeriesPage, scrapeVolumePage) are NOT used here
// Chapters are loaded asynchronously in Step 3 (VolumesChaptersStep) via background scraping
import { buildReturnMetadata } from './metadata-assembler';
import {
  ensureVolumeData,
  logVolumeDataAnalysis
} from './volume-builder';

import type { ComicVineData, ComicVineMutations } from './types';

/**
 * Check if API data has sufficient information to skip scraping
 *
 * We consider data "sufficient" if it has:
 * - Title (name)
 * - Issue count (for volumes/chapters)
 * - Either description OR cover image
 */
function hasApiSufficientData(data: ComicVineData): boolean {
  const hasName = !!data.name;
  const hasIssueCount = !!(data.count_of_issues ?? data.issueCount);
  const hasDescriptionOrCover = !!(data.description ?? data.image);

  const isSufficient = hasName && hasIssueCount && hasDescriptionOrCover;

  logger.info('[ComicVine] Checking if API data is sufficient:', {
    hasName,
    hasIssueCount,
    hasDescriptionOrCover,
    isSufficient,
    count_of_issues: data.count_of_issues,
    issueCount: data.issueCount,
    hasDescription: !!data.description,
    hasImage: !!data.image,
  });

  return isSufficient;
}

/**
 * Fetch ComicVine metadata
 *
 * Uses API-first approach:
 * - Returns API data immediately if sufficient
 * - Only scrapes if API fails or returns insufficient data
 */
export async function fetchComicvineMetadata(
  result: Record<string, unknown>,
  mutations: ComicVineMutations,
  extractBasicMetadata: (result: Record<string, unknown>) => ProviderMetadata
): Promise<ProviderMetadata> {
  logIncomingResult(result);

  const searchResultVolumes = result["volumes"] ?? result["issuesCount"];
  const searchResultChapters = result["chapters"];
  const volumeId = extractVolumeId(result);

  if (!volumeId) {
    logger.error('[ComicVine] No ID found in result:', result);
    logger.error('[ComicVine] Available fields:', Object.keys(result));
    return extractBasicMetadata(result);
  }

  logger.info('[ComicVine] Starting metadata fetch for volume:', { volumeId });

  // Extract URL from result to pass to API (matches primary path behavior)
  const resultUrl = (result["url"] ?? result["site_detail_url"] ?? result["siteDetailUrl"]) as string | undefined;

  try {
    // Step 1: Fetch from API (passing URL to match primary path parameters)
    const data = await fetchAndValidateApiResponse(volumeId, mutations, resultUrl);
    const alternativeTitles = extractComicVineAlternativeTitles(data);
    const volumeCount = extractVolumeCount(searchResultVolumes, data);
    const comicVineUrl = extractComicVineUrl(data, result);

    logger.info('[ComicVine] API returned data:', {
      name: data.name,
      volumeCount,
      comicVineUrl,
      issueCount: data.count_of_issues ?? data.issueCount,
    });

    // Step 2: Log API data status and check if we have sufficient basic metadata
    const hasSufficientBasicData = hasApiSufficientData(data);
    logger.info('[ComicVine] API basic data status:', {
      hasSufficientBasicData,
      comicVineUrl,
      hasScrapingMutation: !!mutations.scrapeComicVineChaptersMutation,
    });

    // Step 3: Build volume data from API (fast) - chapters will be loaded later in Step 3 (VolumesChaptersStep)
    // DON'T scrape synchronously here - it blocks for 30+ seconds and causes timeouts
    // Volume data is marked with `needsChapterScraping: true` so Step 3 will trigger background scraping
    const volumeData = ensureVolumeData([], data, volumeCount);
    logVolumeDataAnalysis(volumeData);

    // Use API issue count as initial chapter count (will be updated after scraping in Step 3)
    const apiChapterCount = data.count_of_issues ?? data.issueCount ?? 0;
    const finalChapterCount = calculateFinalChapterCount(0, [], searchResultChapters) || apiChapterCount;

    logger.info('[ComicVine] Returning API metadata immediately (chapters will load in Step 3):', {
      volumeCount: volumeData.length,
      initialChapterCount: finalChapterCount,
      volumesNeedScraping: volumeData.filter((v: unknown) => (v as Record<string, unknown>)['needsChapterScraping']).length,
    });

    return buildReturnMetadata(
      volumeId,
      data,
      result,
      alternativeTitles,
      volumeCount,
      finalChapterCount,
      volumeData,
      [], // No scraped chapter data yet - chapters load in Step 3
      comicVineUrl
    );
  } catch (error) {
    logger.error('[ComicVine] API call failed, falling back to basic metadata:', error);
    return extractBasicMetadata(result);
  }
}

// ============================================================================
// Background Chapter Fetching (for secondary provider use)
// ============================================================================

/** Type for metadata update callback */
type MetadataUpdateCallback = React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;

/** Type for volumes data update callback */
type VolumesDataUpdateCallback = React.Dispatch<React.SetStateAction<VolumesData>>;

/**
 * Fetch ComicVine chapter data in the background (fire-and-forget).
 * Called after initial metadata fetch when ComicVine is a secondary source.
 * Uses the same scraping infrastructure as the primary source flow.
 *
 * @param seriesUrl - ComicVine series URL (e.g., https://comicvine.gamespot.com/fire-force/4050-91800/)
 * @param initialVolumes - Initial volume data from the API (with needsChapterScraping: true)
 * @param setSelectedSourcesMetadata - State setter for provider metadata
 * @param setVolumesData - State setter for volumes data
 */
export function fetchComicVineChapterCoversBackground(
  seriesUrl: string,
  initialVolumes: Volume[],
  setSelectedSourcesMetadata: MetadataUpdateCallback,
  setVolumesData: VolumesDataUpdateCallback
): void {
  if (!seriesUrl.includes('comicvine.gamespot.com')) {
    logger.warn('[ComicVine Background] Invalid URL for background scraping:', { seriesUrl });
    return;
  }

  logger.info('[ComicVine Background] Starting background chapter scraping for secondary source', {
    url: seriesUrl,
    volumeCount: initialVolumes.length
  });

  // Set initial scraping state
  setVolumesData(prev => ({
    ...prev,
    isScrapingChapters: true,
    scrapingProgress: {
      current: 0,
      total: initialVolumes.length,
      message: 'Connecting to ComicVine servers...',
      stage: 'connecting' as const
    }
  }));

  // Fire-and-forget scraping
  void vanillaTrpcClient.metadata.scrapeComicVineChapters
    .mutate({ seriesUrl })
    .then((result: unknown) => {
      const data = result as { volumes?: Array<{
        volumeNumber?: number;
        volumeTitle?: string;
        chapters?: Array<{ number?: string; title?: string }>;
        volumeSummary?: string;
        coverImage?: string;
      }> };

      if (!data.volumes || data.volumes.length === 0) {
        logger.warn('[ComicVine Background] No volumes returned from scraping');
        setVolumesData(prev => ({
          ...prev,
          isScrapingChapters: false,
          scrapingProgress: {
            current: 0,
            total: 0,
            message: 'No chapter data found',
            stage: 'error' as const
          }
        }));
        return;
      }

      logger.info('[ComicVine Background] Scraping complete, merging data', {
        scrapedVolumes: data.volumes.length
      });

      // Update progress to merging stage
      setVolumesData(prev => ({
        ...prev,
        scrapingProgress: {
          current: 0,
          total: data.volumes?.length ?? 0,
          message: `Merging ${data.volumes?.length ?? 0} volumes with chapter data...`,
          stage: 'merging' as const
        }
      }));

      // Merge scraped data with initial volumes
      let totalChapters = 0;
      const updatedVolumes: Volume[] = initialVolumes.map(volume => {
        const volumeNum = volume.volumeNumber ?? volume.number ?? 0;
        const scrapedVolume = data.volumes?.find(sv => sv.volumeNumber === volumeNum);

        if (scrapedVolume) {
          const chapters = scrapedVolume.chapters ?? [];
          totalChapters += chapters.length;

          return {
            ...volume,
            chapterCount: chapters.length,
            needsChapterScraping: false,
            chapters: chapters.map(ch => {
              const chapter: Chapter = {};
              if (ch.number) chapter.number = parseFloat(ch.number);
              if (ch.title) chapter.title = ch.title;
              return chapter;
            }),
            ...(scrapedVolume.volumeSummary && { description: scrapedVolume.volumeSummary }),
            ...(scrapedVolume.coverImage && { coverImageUrl: scrapedVolume.coverImage })
          };
        }

        return volume;
      });

      logger.info('[ComicVine Background] Merge complete', {
        totalChapters,
        updatedVolumes: updatedVolumes.length
      });

      // Update volumes data with chapters
      setVolumesData(prev => ({
        ...prev,
        volumes: updatedVolumes,
        totalChapters,
        isScrapingChapters: false,
        scrapingProgress: {
          current: updatedVolumes.length,
          total: updatedVolumes.length,
          message: `✓ Loaded ${totalChapters} chapters from ${updatedVolumes.length} volumes`,
          stage: 'complete' as const
        }
      }));

      // Update selectedSourcesMetadata with new chapter data
      setSelectedSourcesMetadata(prev => {
        const comicvineKey = prev['COMICVINE'] ? 'COMICVINE' : 'comicvine';
        const existing = prev[comicvineKey];

        if (!existing) {
          logger.warn('[ComicVine Background] No existing ComicVine metadata to update');
          return prev;
        }

        const updated: ProviderMetadata = {
          ...existing,
          chapters: totalChapters,
          volumeData: updatedVolumes
        };

        return {
          ...prev,
          [comicvineKey]: updated,
          ...(comicvineKey === 'COMICVINE' && { comicvine: updated })
        };
      });

      // Clear progress after a delay
      setTimeout(() => {
        setVolumesData(prev => {
          const updated = { ...prev };
          delete updated.scrapingProgress;
          return updated;
        });
      }, 3000);
    })
    .catch((error: unknown) => {
      logger.error('[ComicVine Background] Scraping error', {
        error: error instanceof Error ? error.message : String(error)
      });

      setVolumesData(prev => ({
        ...prev,
        isScrapingChapters: false,
        scrapingProgress: {
          current: 0,
          total: 0,
          message: error instanceof Error ? error.message : 'Failed to fetch chapters',
          stage: 'error' as const
        }
      }));

      // Clear error after a delay
      setTimeout(() => {
        setVolumesData(prev => {
          const updated = { ...prev };
          delete updated.scrapingProgress;
          return updated;
        });
      }, 5000);
    });
}
