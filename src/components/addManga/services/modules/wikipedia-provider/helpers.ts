import type { ProviderMetadata, Volume, Chapter } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Extract titles from redirects array
 */
export function extractRedirectTitles(result: Record<string, unknown>): string[] {
  if (result["redirects"] && Array.isArray(result["redirects"])) {
    return result["redirects"].filter((r: unknown): r is string => typeof r === 'string');
  }
  return [];
}

/**
 * Extract alternative titles from alternativeTitles array
 */
export function extractAlternativeTitles(result: Record<string, unknown>): string[] {
  if (result["alternativeTitles"] && Array.isArray(result["alternativeTitles"])) {
    return result["alternativeTitles"].filter((t: unknown): t is string => typeof t === 'string');
  }
  return [];
}

/**
 * Extract title from description/extract field using regex
 */
export function extractDescriptionTitle(result: Record<string, unknown>): string | null {
  const desc = (result["description"] ?? result["extract"]) as string | undefined;
  if (desc) {
    const altMatch = desc.match(/\(([^)]+)\)/);
    if (altMatch?.[1]) {
      return altMatch[1];
    }
  }
  return null;
}

/**
 * Collect all alternative titles from various sources
 */
export function collectAlternativeTitles(result: Record<string, unknown>): string[] {
  const titles: string[] = [];

  titles.push(...extractRedirectTitles(result));
  titles.push(...extractAlternativeTitles(result));

  const descTitle = extractDescriptionTitle(result);
  if (descTitle) {
    titles.push(descTitle);
  }

  return [...new Set(titles)]; // Remove duplicates
}

/**
 * Extract Wikipedia URL with fallback chain
 */
export function getWikipediaUrl(result: Record<string, unknown>): string {
  const rawData = result["rawData"] as Record<string, unknown> | undefined;
  return ((result["url"] ?? result["wikipediaUrl"] ?? rawData?.["wikipediaUrl"]) ?? '') as string;
}

/**
 * Extract metadata ID with fallback
 */
export function getMetadataId(result: Record<string, unknown>): string {
  return ((result["id"] ?? result["url"]) ?? '') as string;
}

/**
 * Extract source ID with fallback
 */
export function getSourceId(result: Record<string, unknown>): string {
  return ((result["sourceId"] ?? result["url"]) ?? '') as string;
}

/**
 * Extract description with fallback
 */
export function getDescription(result: Record<string, unknown>): string {
  return ((result["plot"] ?? result["description"] ?? result["extract"]) ?? '') as string;
}

/**
 * Extract cover image
 */
export function getCoverImage(result: Record<string, unknown>): string {
  return ((result["thumbnail"] ?? result["coverImage"]) ?? '') as string;
}

/**
 * Normalize string array or single string to array
 */
export function normalizeToStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value as string[];
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

/**
 * Construct rawData object from result
 */
export function getRawData(result: Record<string, unknown>): Record<string, unknown> {
  const rawData = result["rawData"] as Record<string, unknown> | undefined;

  if (result["rawData"]) {
    return result["rawData"] as Record<string, unknown>;
  }

  return {
    wikipediaUrl: result["wikipediaUrl"],
    volumeList: rawData?.["volumeList"] ?? [],
    chapterList: rawData?.["chapterList"] ?? []
  } as Record<string, unknown>;
}

/**
 * Calculate total chapters from volume list
 */
export function calculateChapterCount(volumeList: unknown[] | undefined): number {
  if (!volumeList || volumeList.length === 0) return 0;
  return volumeList.reduce((total: number, vol: unknown): number => {
    const volume = vol as Record<string, unknown>;
    const chapters = volume['chapters'] as unknown[] | undefined;
    return total + (chapters?.length ?? 0);
  }, 0);
}

/**
 * Get volume data from result or rawData
 */
export function getVolumeData(result: Record<string, unknown>): unknown[] | undefined {
  const rawData = result["rawData"] as Record<string, unknown> | undefined;
  return (result["volumeData"] as unknown[] | undefined) ??
    (rawData?.["volumeList"] as unknown[] | undefined);
}

/**
 * Format date field from Wikipedia data
 * Handles Date objects, strings, and undefined values
 */
export function formatDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    const isoString = value.toISOString();
    const datePart = isoString.split('T')[0];
    return datePart ?? '';
  }
  // Handle date object with year/month/day
  const dateObj = value as { year?: number; month?: number; day?: number };
  if (dateObj.year) {
    const parts = [dateObj.year.toString()];
    if (dateObj.month) parts.push(String(dateObj.month).padStart(2, '0'));
    if (dateObj.day) parts.push(String(dateObj.day).padStart(2, '0'));
    return parts.join('-');
  }
  return '';
}

/**
 * Log incoming result data
 */
export function logIncomingData(
  result: Record<string, unknown>,
  volumeData: unknown[] | undefined,
  calculatedChapterCount: number
): void {
  const rawData = result["rawData"] as Record<string, unknown> | undefined;
  logger.info('[Wikipedia] Incoming result data:', {
    hasDirectVolumeData: !!result["volumeData"],
    hasRawDataVolumeList: !!(rawData?.["volumeList"]),
    volumeDataLength: volumeData?.length ?? 0,
    volumeDataSource: result["volumeData"] ? 'direct' : (rawData?.["volumeList"] ? 'rawData.volumeList' : 'none'),
    hasRawData: !!result["rawData"],
    rawDataType: typeof result["rawData"],
    rawDataKeys: result["rawData"] ? Object.keys(result["rawData"]) : [],
    volumes: result["volumes"],
    chapters: result["chapters"],
    calculatedChapterCount,
    wikipediaUrl: result["wikipediaUrl"],
    firstVolume: volumeData?.[0]
  });
}

/**
 * Log enhanced metadata response
 */
export function logEnhancedResponse(data: Record<string, unknown>): void {
  const authorsData = data["authors"] as unknown[] | undefined;
  const volumeListData = data["volumeList"] as unknown[] | undefined;
  logger.info('[Wikipedia] Enhanced metadata received:', {
    title: data["title"],
    hasAuthors: !!(authorsData?.length),
    hasPublisher: !!data["publisher"],
    hasVolumeList: !!(volumeListData?.length),
    volumeCount: volumeListData?.length ?? 0,
    chapterCount: data["chapters"],
    authors: data["authors"],
    publisher: data["publisher"],
    englishPublisher: data["englishPublisher"],
    originalRun: data["originalRun"]
  });
}

/**
 * Build enhanced metadata from API response
 */
// eslint-disable-next-line complexity -- Building metadata object requires many null coalescing for optional fields
export function buildEnhancedMetadata(
  data: Record<string, unknown>,
  searchResult: Record<string, unknown>,
  volumeList: unknown[],
  finalChapterCount: number
): ProviderMetadata {
  return {
    id: (searchResult["id"] ?? data["title"] ?? '') as string,
    sourceId: (searchResult["sourceId"] ?? searchResult["url"] ?? data["wikipediaUrl"] ?? '') as string,
    title: (data["title"] ?? searchResult["title"] ?? '') as string,
    description: ((data["description"] ?? data["plot"] ?? searchResult["description"]) ?? '') as string,
    url: (data["wikipediaUrl"] ?? searchResult["url"] ?? '') as string,
    coverImage: getCoverImage(searchResult),
    alternativeTitles: normalizeToStringArray(data["alternativeTitles"]),
    genres: (data["genres"] ?? []) as string[],
    authors: normalizeToStringArray(data["authors"]),
    artists: normalizeToStringArray(data["artists"]),
    publisher: (data["publisher"] ?? '') as string,
    startDate: formatDate(data["startDate"]),
    endDate: formatDate(data["endDate"]),
    status: (data["status"] ?? '') as string,
    originalRun: (data["originalRun"] ?? '') as string,
    magazine: (data["magazine"] ?? '') as string,
    englishPublisher: (data["englishPublisher"] ?? '') as string,
    volumes: ((data["volumes"] ?? volumeList.length) as number) || 0,
    chapters: finalChapterCount,
    volumeData: volumeList as Volume[],
    chapterData: ((data["chapterList"] ?? []) as unknown[]) as Chapter[],
    rawData: {
      wikipediaUrl: data["wikipediaUrl"],
      volumeList: volumeList,
      chapterList: data["chapterList"] ?? [],
      enrichedWithWikipedia: data["enrichedWithWikipedia"]
    }
  };
}
