/**
 * Type guards for safe property access in search results
 */

import type { ExtendedMangaSearchResult, MangaSearchResult, ProviderSearchResult } from '@/types/search.types';

/**
 * Check if a value has a specific property
 */
export function hasProperty<T extends Record<string, unknown>, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj;
}
/**
 * Check if result has extended properties
 */
export function isExtendedSearchResult(
  result: unknown
): result is ExtendedMangaSearchResult {
  return (
    result !== null &&
    typeof result === 'object' &&
    'id' in result &&
    'title' in result &&
    'source' in result &&
    'provider' in result
  );
}

/**
 * Check if result has media property
 */
export function hasMediaProperty(
  result: unknown
): result is ExtendedMangaSearchResult & { media: { title?: string } } {
  if (!isExtendedSearchResult(result)) return false;
  const obj = result as Record<string, unknown>;
  return obj['media'] !== null && typeof obj['media'] === 'object';
}

/**
 * Check if result has publication data
 */
export function hasPublicationData(
  result: unknown
): result is ExtendedMangaSearchResult & {
  publicationStatus?: string;
  mangaStatus?: string;
  publication?: unknown;
} {
  return (
    result !== null &&
    typeof result === 'object' &&
    ('publicationStatus' in result ||
     'mangaStatus' in result ||
     'publication' in result)
  );
}

/**
 * Safely access nested properties
 */
export function getNestedProperty<T = unknown>(
  obj: unknown,
  path: string,
  defaultValue?: T
): T | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current as T ?? defaultValue;
}

/**
 * Get year from various possible locations
 */
export function getYear(result: ExtendedMangaSearchResult): number | string | undefined {
  const metadata = result['metadata'] as Record<string, unknown> | undefined;
  const rawData = result['rawData'] as Record<string, unknown> | undefined;
  const providerSpecific = result['providerSpecific'] as Record<string, unknown> | undefined;
  const obj = result as Record<string, unknown>;

  return result['year'] ??
    metadata?.['year'] as (number | string | undefined) ??
    rawData?.['year'] as (number | string | undefined) ??
    providerSpecific?.['year'] as (number | string | undefined) ??
    obj['start_year'] as (number | string | undefined);
}

/**
 * Get status from various possible locations
 */
export function getStatus(result: ExtendedMangaSearchResult): string | undefined {
  const metadata = result['metadata'] as Record<string, unknown> | undefined;
  const rawData = result['rawData'] as Record<string, unknown> | undefined;
  const obj = result as Record<string, unknown>;

  return result['status'] ??
    metadata?.['status'] as (string | undefined) ??
    obj['publicationStatus'] as (string | undefined) ??
    obj['mangaStatus'] as (string | undefined) ??
    rawData?.['status'] as (string | undefined);
}

/**
 * Type guard to check if value is a string array
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Get alternative titles from various formats
 */
export function getAlternativeTitles(result: ExtendedMangaSearchResult): string[] {
  const titles: string[] = [];

  // Access properties directly from typed result
  if (isStringArray(result.alternativeTitles)) {
    titles.push(...result.alternativeTitles);
  }
  if (isStringArray(result.alternativeNames)) {
    titles.push(...result.alternativeNames);
  }
  if (isStringArray(result.synonyms)) {
    titles.push(...result.synonyms);
  }

  return [...new Set(titles)]; // Remove duplicates
}

/**
 * Get cover image URL from various possible locations
 */
export function getCoverUrl(result: ExtendedMangaSearchResult): string | undefined {
  const metadata = result['metadata'] as Record<string, unknown> | undefined;
  const rawData = result['rawData'] as Record<string, unknown> | undefined;

  return result['cover'] ??
    result['coverUrl'] ??
    result['coverImage'] ??
    metadata?.['cover'] as (string | undefined) ??
    metadata?.['coverImage'] as (string | undefined) ??
    rawData?.['cover'] as (string | undefined);
}

/**
 * Check if result is a component search result
 */
export function isComponentSearchResult(
  result: unknown
): result is ExtendedMangaSearchResult {
  return isExtendedSearchResult(result) && 'type' in result;
}

/**
 * Ensure result has required type property
 */
export function ensureTypeProperty<T extends MangaSearchResult>(
  result: T
): T & { type: 'manga' } {
  return {
    ...result,
    type: 'manga'
  } as T & { type: 'manga' };
}

/**
 * Check if value is a provider search result container
 */
export function isProviderSearchResult(
  value: unknown
): value is ProviderSearchResult {
  return (
    value !== null &&
    typeof value === 'object' &&
    'provider' in value &&
    'results' in value &&
    Array.isArray((value as Record<string, unknown>)['results'])
  );
}

/**
 * Safe property accessor with type checking
 */
export function safeAccess<T extends Record<string, unknown>, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue?: T[K]
): T[K] | undefined {
  if (obj === null || obj === undefined) return defaultValue;
  return obj[key] ?? defaultValue;
}

/**
 * Check if options is an array or has options property
 */
export function getOptionsArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  const valueWithOptions = value as { options?: unknown } | null | undefined;
  if (valueWithOptions?.['options'] && Array.isArray(valueWithOptions['options'])) {
    return valueWithOptions['options'];
  }
  return [];
}

/**
 * Type guard for checking if value has volume/chapter data
 */
export function hasVolumeChapterData(
  result: unknown
): result is ExtendedMangaSearchResult & {
  volumes?: number;
  chapters?: number;
  volumeData?: unknown[];
  chapterData?: unknown[];
} {
  return (
    result !== null &&
    typeof result === 'object' &&
    ('volumes' in result ||
     'chapters' in result ||
     'volumeData' in result ||
     'chapterData' in result)
  );
}
