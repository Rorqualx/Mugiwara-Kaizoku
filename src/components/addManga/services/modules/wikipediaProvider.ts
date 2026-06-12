import type { ProviderMetadata, Volume, Chapter } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import {
  buildEnhancedMetadata,
  calculateChapterCount,
  collectAlternativeTitles,
  formatDate,
  getCoverImage,
  getDescription,
  getMetadataId,
  getRawData,
  getSourceId,
  getVolumeData,
  getWikipediaUrl,
  logEnhancedResponse,
  logIncomingData,
  normalizeToStringArray
} from './wikipedia-provider';
import { fetchWikipediaWithHtmlFallback } from './wikipedia-provider/html-fallback';

interface WikipediaFetchParams {
  title: string;
  enrichExisting?: boolean;
}

interface Mutation {
  mutateAsync: (params: WikipediaFetchParams) => Promise<unknown>;
}

/**
 * Wikipedia-specific metadata extraction
 * Handles fetching and processing metadata from Wikipedia search results
 */

/**
 * Try HTML fallback for enhanced metadata
 */
async function tryHtmlFallback(
  searchResult: Record<string, unknown>
): Promise<ProviderMetadata | null> {
  const url = (searchResult["url"] ?? searchResult["wikipediaUrl"]) as string | undefined;
  if (!url) return null;

  logger.info('[Wikipedia] Attempting HTML fallback parsing for URL:', url);
  try {
    return await fetchWikipediaWithHtmlFallback(url, searchResult);
  } catch (fallbackError) {
    logger.warn('[Wikipedia] HTML fallback also failed:', fallbackError);
    return null;
  }
}

/**
 * Extract and transform Wikipedia search results into ProviderMetadata
 *
 * @param result - Raw Wikipedia search result
 * @returns Normalized provider metadata
 */
export function fetchWikipediaMetadata(result: Record<string, unknown>): ProviderMetadata {
  const resultVolumeData = getVolumeData(result);
  const calculatedChapterCount = calculateChapterCount(resultVolumeData);

  logIncomingData(result, resultVolumeData, calculatedChapterCount);

  const finalChapterCount = calculatedChapterCount > 0
    ? calculatedChapterCount
    : ((result["chapters"] ?? 0) as number);

  logger.info('[Wikipedia] Using chapter count:', {
    provided: result["chapters"],
    calculated: calculatedChapterCount,
    final: finalChapterCount
  });

  return {
    id: getMetadataId(result),
    sourceId: getSourceId(result),
    title: (result["title"] ?? '') as string,
    description: getDescription(result),
    url: getWikipediaUrl(result),
    coverImage: getCoverImage(result),
    alternativeTitles: collectAlternativeTitles(result),
    genres: (result["genres"] ?? []) as string[],
    authors: normalizeToStringArray(result["authors"] ?? result["author"]),
    artists: normalizeToStringArray(result["artists"] ?? result["artist"]),
    publisher: (result["publisher"] ?? '') as string,
    startDate: formatDate(result["startDate"] ?? result["releaseDate"]),
    endDate: formatDate(result["endDate"]),
    status: (result["status"] ?? '') as string,
    originalRun: (result["originalRun"] ?? '') as string,
    magazine: (result["magazine"] ?? '') as string,
    englishPublisher: (result["englishPublisher"] ?? '') as string,
    volumes: (result["volumes"] ?? 0) as number,
    chapters: finalChapterCount,
    volumeData: (resultVolumeData ?? []) as Volume[],
    chapterData: (result["chapterData"] ?? []) as Chapter[],
    rawData: getRawData(result)
  };
}

/**
 * Fetch enhanced Wikipedia metadata via tRPC mutation
 *
 * This function calls the server-side Wikipedia fetch which extracts
 * author, publisher, dates, and other metadata from the Wikipedia page.
 *
 * @param searchResult - Raw Wikipedia search result (contains title, id, url)
 * @param fetchWikipediaMutation - tRPC mutation for fetching enhanced metadata
 * @returns Normalized provider metadata with enhanced fields
 */
export async function fetchEnhancedWikipediaMetadata(
  searchResult: Record<string, unknown>,
  fetchWikipediaMutation: Mutation
): Promise<ProviderMetadata> {
  const title = (searchResult["title"] ?? '') as string;

  logger.debug('[fetchEnhancedWikipediaMetadata] Starting', { title });
  logger.info('[Wikipedia] Fetching enhanced metadata for:', { title });

  if (!title) {
    logger.debug('[fetchEnhancedWikipediaMetadata] No title, falling back');
    logger.warn('[Wikipedia] No title provided, falling back to basic extraction');
    return fetchWikipediaMetadata(searchResult);
  }

  try {
    logger.debug('[fetchEnhancedWikipediaMetadata] Calling mutation...');
    const response = await fetchWikipediaMutation.mutateAsync({ title });
    logger.debug('[fetchEnhancedWikipediaMetadata] Mutation response received');

    const data = response as Record<string, unknown>;
    logEnhancedResponse(data);

    const volumeList = (data["volumeList"] as unknown[] | undefined) ?? [];
    const calculatedChapterCount = calculateChapterCount(volumeList);
    const finalChapterCount = calculatedChapterCount > 0
      ? calculatedChapterCount
      : ((data["chapters"] ?? 0) as number);

    return buildEnhancedMetadata(data, searchResult, volumeList, finalChapterCount);
  } catch (error) {
    logger.error('[Wikipedia] Error fetching enhanced metadata:', error);

    const fallbackMetadata = await tryHtmlFallback(searchResult);
    if (fallbackMetadata) {
      return fallbackMetadata;
    }

    return fetchWikipediaMetadata(searchResult);
  }
}
