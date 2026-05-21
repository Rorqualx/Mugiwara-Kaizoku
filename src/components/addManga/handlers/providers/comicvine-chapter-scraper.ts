/**
 * ComicVine Chapter Scraper
 *
 * Background chapter fetching functionality for ComicVine volumes.
 * Uses API-first approach (instant) with FlareSolverr scraping as fallback.
 *
 * @module providers/comicvine-chapter-scraper
 */

import type { MutationResults } from '@/components/addManga/wizard-utils';
import type {
  Chapter,
  ProviderMetadata,
  Volume,
  VolumesData
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { stripHtml } from '@/utils/string';

// ============================================================================
// Background Chapter Fetching (API-first approach)
// ============================================================================

/**
 * Fetch ComicVine chapters in background and update state when complete.
 * Uses API-first approach (instant, ms) with FlareSolverr scraping as fallback.
 * This is a fire-and-forget operation that updates volumesData when complete.
 */
export async function scrapeComicVineChaptersInBackground(
  seriesUrl: string,
  initialVolumes: Volume[],
  mutations: MutationResults,
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void,
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void
): Promise<void> {
  // Helper to update progress with stage info
  const updateProgress = (
    current: number,
    total: number,
    message: string,
    stage: 'connecting' | 'api_call' | 'scraping' | 'merging' | 'complete' | 'error'
  ): void => {
    setVolumesData(prev => ({
      ...prev,
      isScrapingChapters: stage !== 'complete' && stage !== 'error',
      scrapingProgress: { current, total, message, stage }
    }));
  };

  try {
    logger.info('[ComicVine Background] Starting API-first chapter fetching for series');

    // Check mutation availability
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime safety check
    if (!mutations.scrapeComicVineChaptersMutation) {
      logger.warn('[ComicVine Background] scrapeComicVineChaptersMutation not available');
      updateProgress(0, 0, 'Chapter scraping not available', 'error');
      return;
    }

    // Stage 1: Connecting
    updateProgress(0, initialVolumes.length, 'Connecting to ComicVine servers...', 'connecting');
    await new Promise<void>(resolve => { setTimeout(resolve, 300); }); // Brief pause for UI update

    // Stage 2: API Call
    updateProgress(0, initialVolumes.length, 'Calling ComicVine API for volume data...', 'api_call');

    // Call with seriesUrl to trigger API-first approach (instant, ms)
    // Falls back to FlareSolverr scraping if API fails
    const startTime = Date.now();

    // Update to show we're making the request
    updateProgress(0, initialVolumes.length, 'Fetching chapter data from ComicVine API...', 'api_call');

    const result: unknown = await mutations.scrapeComicVineChaptersMutation.mutateAsync({
      seriesUrl
    });
    const elapsed = Date.now() - startTime;

    // Check if we used FlareSolverr (longer times indicate scraping)
    const usedFlareSolverr = elapsed > 5000;
    if (usedFlareSolverr) {
      logger.info(`[ComicVine Background] Used FlareSolverr scraping (${elapsed}ms)`);
    }

    logger.info(`[ComicVine Background] Chapter fetch completed in ${elapsed}ms`);

    // Stage 3: Processing Response
    updateProgress(
      0,
      initialVolumes.length,
      usedFlareSolverr
        ? `FlareSolverr scraping completed in ${(elapsed / 1000).toFixed(1)}s. Processing response...`
        : `API response received in ${elapsed}ms. Processing data...`,
      'scraping'
    );

    // Type guard for result object
    const isObject = (val: unknown): val is Record<string, unknown> =>
      typeof val === 'object' && val !== null;

    // Extract volumes from result (handles both AsyncResult and direct structure)
    const volumes = extractVolumesFromResult(result, isObject);

    if (!volumes || volumes.length === 0) {
      logger.warn('[ComicVine Background] No volumes returned from API');
      updateProgress(0, 0, 'No chapter data found in response', 'error');
      notify({ severity: 'WARNING', title: 'No Chapter Data Found', message: 'Could not fetch chapter data from ComicVine API.' });
      return;
    }

    // Stage 4: Merging
    updateProgress(
      0,
      volumes.length,
      `Merging ${volumes.length} volumes with chapter data...`,
      'merging'
    );

    // Merge fetched data into existing volumes
    const { updatedVolumes, totalChapters } = mergeChapterDataIntoVolumes(initialVolumes, volumes);

    logger.info(`[ComicVine Background] Completed in ${elapsed}ms! Total chapters: ${totalChapters}`);

    // Stage 5: Complete
    updateProgress(
      updatedVolumes.length,
      updatedVolumes.length,
      `Successfully loaded ${totalChapters} chapters from ${updatedVolumes.length} volumes`,
      'complete'
    );

    // Update volumesData with fetched chapters (keep progress visible briefly)
    setVolumesData(prev => ({
      ...prev,
      volumes: updatedVolumes,
      totalChapters,
      isScrapingChapters: false,
      scrapingProgress: {
        current: updatedVolumes.length,
        total: updatedVolumes.length,
        message: `✓ Loaded ${totalChapters} chapters from ${updatedVolumes.length} volumes`,
        stage: 'complete'
      }
    }));

    // Update selectedSourcesMetadata with chapter counts
    updateSelectedSourcesMetadata(setSelectedSourcesMetadata, updatedVolumes, totalChapters);

    notify({ severity: 'SUCCESS', title: 'Chapter Data Loaded', message: `Successfully loaded ${totalChapters} chapters from ${updatedVolumes.length} volumes in ${(elapsed / 1000).toFixed(1)}s` });

    // Clear progress after a delay so user can see completion
    setTimeout(() => {
      setVolumesData(prev => {
        const updated: VolumesData = { ...prev };
        delete updated.scrapingProgress;
        return updated;
      });
    }, 3000);

  } catch (error) {
    logger.error('[ComicVine Background] Failed:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCloudFlareError = errorMessage.toLowerCase().includes('timeout') ||
                              errorMessage.toLowerCase().includes('cloudflare');

    // Show error in progress indicator
    updateProgress(
      0,
      0,
      isCloudFlareError
        ? 'CloudFlare protection blocked the request. Try again later.'
        : `Failed: ${errorMessage.substring(0, 100)}`,
      'error'
    );

    notify({ severity: 'ERROR', title: 'Chapter Fetch Failed', message: isCloudFlareError
        ? 'CloudFlare protection blocked the request. Try again later.'
        : 'Could not fetch chapter data. Check server logs for details.' });

    // Clear error after a delay
    setTimeout(() => {
      setVolumesData(prev => {
        const updated: VolumesData = { ...prev, isScrapingChapters: false };
        delete updated.scrapingProgress;
        return updated;
      });
    }, 5000);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface ScrapedVolume {
  volumeNumber?: number;
  volumeTitle?: string;
  coverImage?: string;
  chapters?: Array<{ number?: string; title?: string }>;
  volumeSummary?: string;
  totalChapters?: number;
}

/**
 * Extract volumes array from API result (handles AsyncResult and direct structure)
 */
function extractVolumesFromResult(
  result: unknown,
  isObject: (val: unknown) => val is Record<string, unknown>
): ScrapedVolume[] | null {
  // Check for AsyncResult with data.volumes
  if (isObject(result) && isObject(result['data']) && Array.isArray(result['data']['volumes'])) {
    const volumes = result['data']['volumes'] as ScrapedVolume[];
    logger.info(`[ComicVine Background] Found ${volumes.length} volumes in result.data.volumes`);
    return volumes;
  }

  // Fallback: Check if volumes is directly on the result
  if (isObject(result) && Array.isArray(result['volumes'])) {
    const volumes = result['volumes'] as ScrapedVolume[];
    logger.info(`[ComicVine Background] Found ${volumes.length} volumes in result.volumes`);
    return volumes;
  }

  return null;
}

/**
 * Merge fetched chapter data into existing volumes
 */
function mergeChapterDataIntoVolumes(
  initialVolumes: Volume[],
  scrapedVolumes: ScrapedVolume[]
): { updatedVolumes: Volume[]; totalChapters: number } {
  let totalChapters = 0;

  // Create a detailed mapping for debugging
  const initialVolumeNumbers = initialVolumes.map(v => ({ num: v.volumeNumber, type: typeof v.volumeNumber }));
  const scrapedVolumeNumbers = scrapedVolumes.map(sv => ({ num: sv.volumeNumber, type: typeof sv.volumeNumber }));

  logger.info('[ComicVine Background] Merging chapter data:', {
    initialVolumesCount: initialVolumes.length,
    scrapedVolumesCount: scrapedVolumes.length,
    initialVolumeNumbers,
    scrapedVolumeNumbers,
  });

  // Track unmatched volumes for debugging
  const matchedVolumeNumbers: number[] = [];
  const unmatchedInitialVolumes: number[] = [];

  const updatedVolumes: Volume[] = initialVolumes.map(volume => {
    // Normalize volumeNumber for comparison (handle potential type mismatches)
    const rawVolumeNum = typeof volume.volumeNumber === 'string'
      ? parseFloat(volume.volumeNumber)
      : volume.volumeNumber;
    const volumeNum = rawVolumeNum ?? 0;

    // Find matching scraped volume with more flexible matching
    const scrapedVolume = scrapedVolumes.find(sv => {
      const scrapedNum = typeof sv.volumeNumber === 'string'
        ? parseFloat(sv.volumeNumber as unknown as string)
        : sv.volumeNumber;
      return scrapedNum === volumeNum;
    });

    if (scrapedVolume) {
      matchedVolumeNumbers.push(volumeNum);
      const chapters = scrapedVolume.chapters ?? [];
      totalChapters += chapters.length;

      const updatedVolume: Volume = {
        ...volume,
        chapterCount: chapters.length,
        needsChapterScraping: false
      };

      // Set chapters if we have them (convert string number to number)
      if (chapters.length > 0) {
        updatedVolume.chapters = chapters.map(ch => ({
          number: ch.number ? parseFloat(ch.number) : undefined,
          title: ch.title
        })) as Chapter[];
      }

      // Set description if we have a new one
      if (scrapedVolume.volumeSummary) {
        const cleanSummary = stripHtml(scrapedVolume.volumeSummary).trim();
        updatedVolume.description = cleanSummary;
        updatedVolume.volumeSummary = cleanSummary;
      }

      // Set cover if we have a new one
      if (scrapedVolume.coverImage) {
        updatedVolume.coverImageUrl = scrapedVolume.coverImage;
      }

      return updatedVolume;
    }

    // Volume not matched
    unmatchedInitialVolumes.push(volumeNum);
    return volume;
  });

  // Log match summary
  logger.info('[ComicVine Background] Merge completed:', {
    totalChapters,
    matchedVolumes: matchedVolumeNumbers.length,
    unmatchedVolumes: unmatchedInitialVolumes.length,
    unmatchedVolumeNumbers: unmatchedInitialVolumes,
  });

  // Warn if volumes didn't match
  if (unmatchedInitialVolumes.length > 0) {
    logger.warn('[ComicVine Background] Some volumes did not have matching scraped data:', {
      unmatchedVolumeNumbers: unmatchedInitialVolumes,
      scrapedVolumeNumbers: scrapedVolumes.map(sv => sv.volumeNumber),
    });
  }

  return { updatedVolumes, totalChapters };
}

/**
 * Update selectedSourcesMetadata with chapter counts
 */
function updateSelectedSourcesMetadata(
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void,
  updatedVolumes: Volume[],
  totalChapters: number
): void {
  setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => {
    const comicvineKey = prev['COMICVINE'] ? 'COMICVINE' : 'comicvine';
    const comicvineMetadata = prev[comicvineKey];

    if (!comicvineMetadata) {
      logger.warn('[ComicVine Background] No comicvineMetadata found');
      return prev;
    }

    const updatedMetadata: ProviderMetadata = {
      ...comicvineMetadata,
      chapters: totalChapters,
      volumeData: updatedVolumes
    };

    const result: Record<string, ProviderMetadata> = {
      ...prev,
      [comicvineKey]: updatedMetadata
    };

    // Also update lowercase version if different
    if (comicvineKey === 'COMICVINE') {
      result['comicvine'] = updatedMetadata;
    }

    return result;
  });
}
