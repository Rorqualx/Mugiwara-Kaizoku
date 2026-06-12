/**
 * ComicVine URL Parser
 *
 * Handles parsing ComicVine URLs for manga metadata extraction.
 * Uses ComicVine API for volume data and FlareSolverr for chapter scraping.
 *
 * @module providers/comicvine-url-parser
 */

import type { MutationResults } from '@/components/addManga/wizard-utils';
import type {
  ProviderMetadata,
  Volume,
  VolumesData
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import { scrapeComicVineChaptersInBackground } from './comicvine-chapter-scraper';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract volume ID from ComicVine URL
 * URL pattern: https://comicvine.gamespot.com/[series-name]/4050-XXXXX/
 */
export function extractComicVineVolumeId(url: string): string | null {
  const match = url.match(/4050-(\d+)/);
  return match?.[1] ?? null;
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Handles ComicVine URL parsing and volume data extraction.
 * Uses the ComicVine API for volume data + FlareSolverr scraping for chapter data.
 *
 * Phase A: Fetches volume details via API (fast, gets covers immediately)
 * Phase B: Starts background chapter scraping (non-blocking, updates state progressively)
 *
 * @param urlToParse - ComicVine URL to parse (e.g., https://comicvine.gamespot.com/fire-force/4050-XXXXX/)
 * @param mutations - tRPC mutation handlers for API calls
 * @param setVolumesData - State setter for volume data
 * @param setSelectedSourcesMetadata - State setter for provider metadata
 * @returns Promise that resolves when initial parsing completes (background scraping continues)
 */
// eslint-disable-next-line complexity -- ComicVine URL parsing orchestrating API calls, metadata extraction, volume transformation, and background scraping
export async function parseComicVineUrl(
  urlToParse: string,
  mutations: MutationResults,
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void,
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void
): Promise<void> {
  // Extract volume ID from URL
  const volumeId = extractComicVineVolumeId(urlToParse);

  if (!volumeId) {
    logger.error('[parseComicVineUrl] Could not extract volume ID from URL:', urlToParse);
    notify({ severity: 'ERROR', title: 'Invalid ComicVine URL', message: 'Could not extract volume ID from URL' });
    return;
  }

  logger.info('[parseComicVineUrl] PHASE A: Using ComicVine API to fetch volume details for ID:', volumeId);

  // PHASE A: API-based volume fetch (fast, gets covers immediately)
  // The tRPC procedure returns the bare payload and throws TRPCError on failure.
  let apiData: Record<string, unknown>;
  try {
    apiData = await mutations.fetchComicvineVolumeDetailsMutation.mutateAsync({
      url: urlToParse,
      id: volumeId,
      type: 'volume'
    }) as unknown as Record<string, unknown>;
  } catch (error) {
    logger.error('[parseComicVineUrl] PHASE A failed:', error);
    notify({ severity: 'ERROR', title: 'ComicVine API Error', message: error instanceof Error ? error.message : 'Failed to fetch volume data' });
    return;
  }

  logger.info('[parseComicVineUrl] PHASE A complete: API returned volume data');

  // Transform API response to volume data format
  // ComicVine terminology for manga:
  // - "Volume" = The entire manga series (e.g., "Fire Force")
  // - "Issues" = Individual tankōbon volumes (e.g., Volume 1, Volume 2, etc.)
  // We map ComicVine "issues" to our "volumes" since that's how manga is structured
  const issues = apiData['issues'] as Array<{
    id: number;
    name?: string;
    issueNumber?: string;
    coverDate?: string;
    coverImages?: { small?: string; medium?: string; large?: string; original?: string };
    siteDetailUrl?: string;
    description?: string;
    deck?: string;
    storeDate?: string;
  }> | undefined;

  const coverImages = apiData['coverImages'] as { small?: string; medium?: string; large?: string; original?: string } | undefined;
  const rawSeriesName = apiData['name'];
  const seriesName = typeof rawSeriesName === 'string' ? rawSeriesName : 'Unknown';
  const rawIssueCount = apiData['issueCount'];
  const issueCount = issues?.length ?? (typeof rawIssueCount === 'number' ? rawIssueCount : 0);

  // Get series cover to use as fallback for individual volumes without their own covers
  const seriesCoverUrl = coverImages?.large ?? coverImages?.medium ?? coverImages?.original ?? '';

  // ============================================================================
  // PHASE 2: Create volumes from API data (NON-BLOCKING)
  // The API returns volumes with covers. Chapter scraping happens LATER in Step 3
  // to avoid blocking the UI. Volumes display immediately with needsChapterScraping=true.
  // ============================================================================

  // Map each ComicVine "issue" to a wizard "volume" (tankōbon)
  // Chapters will be loaded progressively in Step 3 via the existing prefetch mechanism
  const volumeDataArray: Volume[] = issues?.map((issue, index) => {
    // Debug: Log the first few issues to see actual API structure
    if (index < 3) {
      logger.debug('[parseComicVineUrl] Issue structure:', {
        index,
        id: issue.id,
        name: issue.name,
        issueNumber: issue.issueNumber,
        // Check for snake_case variant from raw API
        issue_number: (issue as Record<string, unknown>)['issue_number'],
        allKeys: Object.keys(issue),
      });
    }

    // Handle both camelCase and snake_case issue numbers from API
    const rawIssueNumber = issue.issueNumber ?? (issue as Record<string, unknown>)['issue_number'] as string | undefined;
    const volumeNumber = parseFloat(rawIssueNumber ?? String(index + 1));
    // Get the individual issue cover, or fall back to series cover
    const issueCover = issue.coverImages?.large ?? issue.coverImages?.medium ?? issue.coverImages?.original ?? seriesCoverUrl;
    // Use issue description from API (deck is short summary, description is full)
    const issueDescription = issue.description ?? issue.deck ?? '';

    return {
      volumeNumber,
      number: volumeNumber,
      title: issue.name ?? `${seriesName} Vol. ${volumeNumber}`,
      coverImageUrl: issueCover,
      coverImage: issueCover,
      description: issueDescription,
      volumeSummary: issueDescription,
      chapterCount: 0, // Will be populated by Step 3 chapter loading
      chapters: [],    // Will be populated by Step 3 chapter loading
      needsChapterScraping: true, // Step 3 will load chapters progressively
    };
  }) ?? [];

  logger.info('[parseComicVineUrl] Created volumes from API (chapters will load in Step 3)', {
    volumeCount: volumeDataArray.length
  });

  // Initially set to 0 to indicate "loading chapters" - will be updated when scraping completes
  // This avoids showing the misleading volume count (34) as chapter count
  const initialTotalChapters = 0;

  // Create a summary volume for series-level metadata
  const summaryVolume: Volume = {
    volumeNumber: 1,
    number: 1,
    title: seriesName,
    coverImageUrl: coverImages?.large ?? coverImages?.medium ?? coverImages?.original ?? '',
    coverImage: coverImages?.large ?? coverImages?.medium ?? coverImages?.original ?? '',
    description: typeof apiData['description'] === 'string' ? apiData['description'] : '',
    volumeSummary: typeof apiData['description'] === 'string' ? apiData['description'] : '',
    chapterCount: initialTotalChapters,
    chapters: [], // Chapters will be loaded in Step 3
    needsChapterScraping: true,
  };

  // Use the detailed volume array if we have issues, otherwise just the summary
  const finalVolumes = volumeDataArray.length > 0 ? volumeDataArray : [summaryVolume];

  // Create metadata object
  const rawPublisher = apiData['publisher'];
  const publisherName = (typeof rawPublisher === 'object' && rawPublisher !== null && 'name' in rawPublisher && typeof rawPublisher.name === 'string')
    ? rawPublisher.name
    : '';
  const comicvineMetadata: Record<string, unknown> = {
    id: volumeId,
    name: seriesName,
    description: apiData['description'],
    publisher: publisherName,
    startYear: apiData['startYear'],
    issueCount,
    siteDetailUrl: apiData['siteDetailUrl'] ?? urlToParse,
    coverImage: coverImages?.large ?? coverImages?.medium,
  };

  logger.info('[parseComicVineUrl] Transformed volume data:', {
    seriesName,
    volumeCount: finalVolumes.length,
    issueCount,
    initialTotalChapters,
    hasDetailedVolumes: volumeDataArray.length > 0,
    note: 'totalChapters set to 0 - will be updated when chapter scraping completes'
  });

  setVolumesData(prev => ({
    ...prev,
    volumes: [...prev.volumes, ...finalVolumes],
    totalVolumes: prev.volumes.length + finalVolumes.length,
    // Set to 0 initially - will be updated when chapter scraping completes
    totalChapters: initialTotalChapters,
    // Mark that chapter scraping is needed
    isScrapingChapters: true,
  }));

  // Update selectedSourcesMetadata with new ComicVine data
  setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => ({
    ...prev,
    COMICVINE: {
      ...(comicvineMetadata),
      volumeData: finalVolumes,
      source: 'comicvine',
      hasCoverImages: !!summaryVolume.coverImageUrl,
      hasChapterList: finalVolumes.length > 0
    } as ProviderMetadata,
    comicvine: {
      ...(comicvineMetadata),
      volumeData: finalVolumes,
      source: 'comicvine',
      hasCoverImages: !!summaryVolume.coverImageUrl,
      hasChapterList: finalVolumes.length > 0
    } as ProviderMetadata
  }));

  notify({ severity: 'SUCCESS', title: 'ComicVine Data Loaded', message: `Successfully loaded ${finalVolumes.length} volumes. Scraping chapters in background...` });

  // ============================================================================
  // PHASE B: Start chapter scraping in background (NON-BLOCKING)
  // This runs asynchronously while the user can continue viewing/interacting
  // ============================================================================

  logger.info('[parseComicVineUrl] PHASE B: Starting background chapter scraping');

  // Fire-and-forget: Scrape chapters for all volumes in the background.
  // The `void` operator explicitly marks this as intentional non-awaited async.
  // The scraper function has complete try-catch error handling internally.
  // The UI shows a loading indicator via isScrapingChapters flag.
  void scrapeComicVineChaptersInBackground(
    urlToParse,
    finalVolumes,
    mutations,
    setVolumesData,
    setSelectedSourcesMetadata
  );
}
