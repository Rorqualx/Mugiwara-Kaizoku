/**
 * API search and data fetching operations for ComicVine
 */

import { logger } from '@/utils/logger';

import type { ComicVineData, ComicVineMutations } from './types';

/**
 * Extract volume ID from various sources in the result
 */
export function extractVolumeId(result: Record<string, unknown>): string | number | undefined {
  return (result["volumeId"] ??
         result["comicvineId"] ??
         result["id"] ??
         result["sourceId"] ??
         result["resource_id"]) as string | number | undefined;
}

/**
 * Extract ComicVine URL from result and API data
 */
export function extractComicVineUrl(
  data: ComicVineData,
  result: Record<string, unknown>
): string | undefined {
  const resultMetadata = result["metadata"] as Record<string, unknown> | undefined;
  const rawData = resultMetadata?.["rawData"] as Record<string, unknown> | undefined;

  return (data["site_detail_url"] ??
          data["siteDetailUrl"] ??
          result["site_detail_url"] ??
          result["siteDetailUrl"] ??
          rawData?.["site_detail_url"] ??
          resultMetadata?.["siteDetailUrl"]) as string | undefined;
}

/**
 * Log incoming result data for debugging
 */
export function logIncomingResult(result: Record<string, unknown>): void {
  logger.debug('[ComicVine] fetchComicvineMetadata - Incoming result:', {
    id: result["id"],
    sourceId: result["sourceId"],
    volumeId: result["volumeId"],
    comicvineId: result["comicvineId"],
    resource_id: result["resource_id"],
    title: result["title"],
    site_detail_url: result["site_detail_url"],
    url: result["url"],
    api_detail_url: result["api_detail_url"],
    hasMetadata: !!result["metadata"],
    metadataKeys: result["metadata"] ? Object.keys(result["metadata"]) : [],
    issuesCount: result["issuesCount"],
    volumes: result["volumes"],
    chapters: result["chapters"],
    allKeys: Object.keys(result)
  });

  logger.info('[ComicVine] Fetching metadata for result:', result);
}

/**
 * Fetch API data and validate response
 *
 * Uses API-first approach - returns immediately if API has data.
 * Does NOT trigger scraping - that decision is made by the caller.
 *
 * Matches primary path (url-handlers.ts:parseComicVineUrl) parameters:
 * - Passes url, id, and type to get full issue data with covers
 */
export async function fetchAndValidateApiResponse(
  volumeId: string | number,
  mutations: ComicVineMutations,
  url?: string
): Promise<ComicVineData> {
  logger.info('[ComicVine API] Starting API request for volume:', { volumeId, url });

  // Match primary path parameters: url, id, type
  // This ensures we get the same response structure including individual issue covers
  // The tRPC procedure returns the bare payload and throws TRPCError on failure.
  const response = await mutations.fetchComicvineVolumeDetailsMutation.mutateAsync({
    ...(url && { url }),
    id: String(volumeId),
    type: 'volume'
  });

  const data = response as unknown as ComicVineData | undefined;

  // Log raw response structure for debugging
  logger.info('[ComicVine API] Raw response received:', {
    responseType: typeof response,
    responseKeys: data ? Object.keys(data) : [],
  });

  // Validate that we have actual data
  if (!data || Object.keys(data).length === 0) {
    logger.error('[ComicVine API] No data returned from API:', { volumeId, dataType: typeof data });
    throw new Error('API returned empty data');
  }

  logger.info('[ComicVine API] API Response data extracted successfully:', {
    hasData: !!data,
    name: data.name,
    id: data.id,
    site_detail_url: data.site_detail_url,
    siteDetailUrl: data.siteDetailUrl,
    description: data.description ? `${String(data.description).slice(0, 50)}...` : undefined,
    issueCount: data.issueCount,
    count_of_issues: data.count_of_issues,
    issues: data.issues ? data.issues.length : 0,
    hasImage: !!data.image,
    publisher: data.publisher,
    hasPublisher: !!data.publisher,
    publisherName: data.publisher?.name,
    dataKeys: Object.keys(data as Record<string, unknown>)
  });

  return data;
}
