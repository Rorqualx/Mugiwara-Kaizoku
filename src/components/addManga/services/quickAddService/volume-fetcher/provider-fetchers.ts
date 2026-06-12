/**
 * Volume Fetcher - Provider-Specific Fetching
 *
 * Individual fetch functions for each provider (Fandom, ComicVine, Wikipedia, MangaDex).
 *
 * @module components/addManga/services/quickAddService/volume-fetcher/provider-fetchers
 */

import type { AppRouter } from '@/server/trpc/root';
import { logger } from '@/utils/logger';

import type { FetchedVolumeData } from '../types';
import type { TRPCClient } from '@trpc/client';

// ============================================================================
// Fandom Fetching
// ============================================================================

/**
 * Try to fetch volume data from Fandom
 */
export async function tryFetchFromFandom(
  fandomUrl: string | null,
  trpcClient: TRPCClient<AppRouter>
): Promise<FetchedVolumeData | null> {
  if (!fandomUrl) {
    logger.debug('[volume-fetcher] No Fandom URL available - returning null');
    return null;
  }

  logger.info('[volume-fetcher] Fetching volumes from Fandom', { url: fandomUrl });
  try {
    const fandomResult = await trpcClient.metadata.parseFandomUrl.mutate({
      url: fandomUrl,
      forceRefresh: false,
      fetchChapterCovers: true,
      maxChaptersToFetch: 0
    });

    const data = fandomResult as { volumes?: number; chapters?: number; volumeDetails?: unknown[] };
    const totalVolumes = data.volumes ?? 0;
    const totalChapters = data.chapters ?? 0;
    const volumeDetails = data.volumeDetails ?? [];

    if (totalVolumes > 0 || volumeDetails.length > 0) {
      logFandomVolumeDetails(volumeDetails);
      return {
        provider: 'fandom',
        volumes: volumeDetails,
        totalVolumes: totalVolumes > 0 ? totalVolumes : volumeDetails.length,
        totalChapters,
        volumeDetails
      };
    }
  } catch (fandomError) {
    logger.info('[volume-fetcher] Failed to fetch from Fandom', {
      error: fandomError instanceof Error ? fandomError.message : String(fandomError)
    });
  }
  return null;
}

/**
 * Log details about fetched Fandom volumes for debugging
 */
function logFandomVolumeDetails(volumeDetails: unknown[]): void {
  const firstVolume = volumeDetails[0] as Record<string, unknown> | undefined;
  const firstVolumeChapters = firstVolume?.['chapters'] as unknown[] | undefined;
  const firstChapter = firstVolumeChapters?.[0] as Record<string, unknown> | undefined;

  logger.info('[volume-fetcher] Got volume data from Fandom', {
    volumeDetailsCount: volumeDetails.length,
    firstVolumeHasChapters: !!firstVolumeChapters,
    firstVolumeChapterCount: firstVolumeChapters?.length ?? 0,
    firstChapterHasUrl: firstChapter?.['url'] ? 'yes' : 'no'
  });
}

// ============================================================================
// ComicVine Fetching
// ============================================================================

/**
 * ComicVine issue from API response
 */
interface ComicVineIssue {
  id: number;
  name?: string;
  issueNumber?: string;
  coverDate?: string;
  description?: string;
  deck?: string;
  coverImages?: { small?: string; medium?: string; large?: string; original?: string };
  siteDetailUrl?: string;
}

/**
 * Try to fetch volume data from ComicVine
 */
export async function tryFetchFromComicVine(
  comicvineUrl: string | null,
  trpcClient: TRPCClient<AppRouter>
): Promise<FetchedVolumeData | null> {
  if (!comicvineUrl) {
    logger.debug('[volume-fetcher] No ComicVine URL could be extracted');
    return null;
  }

  logger.info('[volume-fetcher] Fetching volumes from ComicVine', { url: comicvineUrl });
  try {
    const comicvineResult = await trpcClient.metadata.fetchComicvineVolumeDetails.mutate({
      url: comicvineUrl,
      type: 'volume'
    });

    return transformComicVineResponse(comicvineResult as unknown as Record<string, unknown>);
  } catch (comicvineError) {
    logger.info('[volume-fetcher] Failed to fetch from ComicVine', {
      error: comicvineError instanceof Error ? comicvineError.message : String(comicvineError)
    });
  }
  return null;
}

/**
 * Transform ComicVine API response to FetchedVolumeData
 */
function transformComicVineResponse(apiData: Record<string, unknown>): FetchedVolumeData | null {
  const rawSeriesName = apiData['name'];
  const seriesName = typeof rawSeriesName === 'string' ? rawSeriesName : 'Unknown';
  const coverImages = apiData['coverImages'] as { small?: string; medium?: string; large?: string; original?: string } | undefined;
  const seriesCoverUrl = coverImages?.large ?? coverImages?.medium ?? coverImages?.original ?? '';
  const issues = (apiData['issues'] ?? []) as ComicVineIssue[];
  const issueCount = issues.length > 0 ? issues.length : ((apiData['issueCount'] ?? 0) as number);

  if (issueCount === 0 && issues.length === 0) {
    return null;
  }

  const volumeDataArray = issues.map((issue, index) => transformComicVineIssue(issue, index, seriesName, seriesCoverUrl));

  logger.info('[volume-fetcher] Transformed ComicVine issues to Volume objects', {
    seriesName,
    volumeCount: volumeDataArray.length,
    firstVolumeTitle: volumeDataArray[0]?.['title'],
    firstVolumeHasDescription: !!volumeDataArray[0]?.['description']
  });

  return {
    provider: 'comicvine',
    volumes: volumeDataArray,
    totalVolumes: volumeDataArray.length,
    totalChapters: 0,
    volumeDetails: volumeDataArray
  };
}

/**
 * Transform a single ComicVine issue to a Volume object
 */
function transformComicVineIssue(
  issue: ComicVineIssue,
  index: number,
  seriesName: string,
  seriesCoverUrl: string
): Record<string, unknown> {
  const volumeNumber = parseFloat(issue.issueNumber ?? String(index + 1));
  const issueCover = issue.coverImages?.large ?? issue.coverImages?.medium ?? issue.coverImages?.original ?? seriesCoverUrl;
  const issueDescription = issue.description ?? issue.deck ?? '';

  return {
    volumeNumber,
    number: volumeNumber,
    title: issue.name ?? `${seriesName} Vol. ${volumeNumber}`,
    coverImageUrl: issueCover,
    coverImage: issueCover,
    description: issueDescription,
    deck: issue.deck ?? '',
    volumeSummary: issueDescription,
    chapterCount: 0,
    chapters: [],
    needsChapterScraping: true,
    _comicVineId: issue.id,
    _siteDetailUrl: issue.siteDetailUrl,
    _coverDate: issue.coverDate
  };
}

// ============================================================================
// Wikipedia Fetching
// ============================================================================

/**
 * Try to extract volume data from Wikipedia metadata
 */
export function tryFetchFromWikipedia(
  wikipediaMetadata: Record<string, unknown> | undefined
): FetchedVolumeData | null {
  if (!wikipediaMetadata) {
    logger.debug('[volume-fetcher] No Wikipedia metadata available');
    return null;
  }

  logger.info('[volume-fetcher] Extracting volume data from Wikipedia metadata');
  const volumes = extractNumericField(wikipediaMetadata, 'volumes');
  const chapters = extractNumericField(wikipediaMetadata, 'chapters');

  if (volumes > 0 || chapters > 0) {
    logger.info('[volume-fetcher] Got basic counts from Wikipedia', { volumes, chapters });
    return {
      provider: 'wikipedia',
      volumes: [],
      totalVolumes: volumes,
      totalChapters: chapters
    };
  }
  return null;
}

/**
 * Extract a numeric field from metadata object
 */
function extractNumericField(metadata: Record<string, unknown>, field: string): number {
  const value = metadata[field];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ============================================================================
// MangaDex Fetching
// ============================================================================

/**
 * Extract MangaDex ID from metadata
 */
export function extractMangaDexId(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null;

  const directId = metadata['mangadexId'] ?? metadata['id'] ?? metadata['sourceId'];
  if (typeof directId === 'string' && directId.length > 0) return directId;

  const nestedMeta = metadata['metadata'];
  if (nestedMeta && typeof nestedMeta === 'object') {
    const nested = nestedMeta as Record<string, unknown>;
    const nestedId = nested['mangadexId'] ?? nested['id'];
    if (typeof nestedId === 'string' && nestedId.length > 0) return nestedId;
  }

  const url = metadata['url'] ?? metadata['siteDetailUrl'];
  if (typeof url === 'string' && url.includes('mangadex.org')) {
    const match = url.match(/mangadex\.org\/(?:title|manga)\/([a-f0-9-]{36})/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Try to fetch volume data from MangaDex
 */
export async function tryFetchFromMangaDex(
  mangadexId: string | null,
  trpcClient: TRPCClient<AppRouter>
): Promise<FetchedVolumeData | null> {
  if (!mangadexId) {
    logger.debug('[volume-fetcher] No MangaDex ID available - returning null');
    return null;
  }

  logger.info('[volume-fetcher] Fetching volumes from MangaDex', { mangadexId });
  try {
    const mangadexResult = await trpcClient.metadata.fetchMangaDexVolumes.mutate({
      mangadexId,
      language: 'en'
    });

    const volumes = mangadexResult.volumes;
    const totalVolumes = mangadexResult.totalVolumes;
    const totalChapters = mangadexResult.totalChapters;

    if (totalVolumes > 0 || volumes.length > 0) {
      logger.info('[volume-fetcher] Got volume data from MangaDex', {
        volumeCount: volumes.length,
        totalChapters
      });
      return {
        provider: 'mangadex',
        volumes,
        totalVolumes,
        totalChapters,
        volumeDetails: volumes
      };
    }
  } catch (mangadexError) {
    logger.info('[volume-fetcher] Failed to fetch from MangaDex', {
      error: mangadexError instanceof Error ? mangadexError.message : String(mangadexError)
    });
  }
  return null;
}
