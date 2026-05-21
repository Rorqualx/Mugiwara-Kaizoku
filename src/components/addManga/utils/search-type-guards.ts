/**
 * Type guards for search results
 * Consolidated from multiple type guard files
 */

import type { 
  MangaSearchResult, 
  ExtendedMangaSearchResult,
  ProviderSearchResult 
} from '@/types/search.types';

/**
 * Check if value is a MangaSearchResult
 */
export function isMangaSearchResult(value: unknown): value is MangaSearchResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'id' in value &&
    'title' in value
  );
}

/**
 * Check if value is an ExtendedMangaSearchResult
 */
export function isExtendedMangaSearchResult(value: unknown): value is ExtendedMangaSearchResult {
  return isMangaSearchResult(value);
}

/**
 * Check if value is a ProviderSearchResult
 */
export function isProviderSearchResult(value: unknown): value is ProviderSearchResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'provider' in value &&
    'results' in value &&
    Array.isArray((value as Record<string, unknown>)['results'])
  );
}

/**
 * Safely get property value from nested locations
 */
export function getPropertyValue<T = unknown>(
  obj: unknown,
  propertyName: string,
  defaultValue?: T
): T | undefined {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  const record = obj as Record<string, unknown>;

  // Direct property
  if (propertyName in record && record[propertyName] !== undefined) {
    return record[propertyName] as T;
  }

  // Check metadata
  const metadata = record['metadata'];
  if (metadata && typeof metadata === 'object') {
    const metadataRecord = metadata as Record<string, unknown>;
    if (propertyName in metadataRecord) {
      return metadataRecord[propertyName] as T;
    }
  }

  // Check data
  const data = record['data'];
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    if (propertyName in dataRecord) {
      return dataRecord[propertyName] as T;
    }
  }

  return defaultValue;
}

/**
 * Get year from various possible locations
 */
export function getYear(result: unknown): string | number | undefined {
  return getPropertyValue(result, 'year') ?? 
         getPropertyValue(result, 'releaseYear') ??
         getPropertyValue(result, 'start_year');
}

/**
 * Get status from various possible locations
 */
export function getStatus(result: unknown): string | undefined {
  return getPropertyValue(result, 'status') ??
         getPropertyValue(result, 'publicationStatus') ??
         getPropertyValue(result, 'mangaStatus');
}

/**
 * Get alternative titles from various possible locations
 */
export function getAlternativeTitles(result: unknown): string[] {
  const titles = getPropertyValue<string[]>(result, 'alternativeTitles', []) ?? [];
  const altNames = getPropertyValue<string[]>(result, 'alternativeNames', []) ?? [];
  const synonyms = getPropertyValue<string[]>(result, 'synonyms', []) ?? [];
  
  // Combine and deduplicate
  const combined = [...titles, ...altNames, ...synonyms];
  return Array.from(new Set(combined));
}

/**
 * Get cover image URL from various possible locations
 */
export function getCoverUrl(result: unknown): string | undefined {
  return getPropertyValue(result, 'coverUrl') ??
         getPropertyValue(result, 'coverImage') ??
         getPropertyValue(result, 'cover');
}

/**
 * Get authors from various possible locations
 */
export function getAuthors(result: unknown): string[] {
  const authors = getPropertyValue<string[] | string>(result, 'authors');
  const author = getPropertyValue<string>(result, 'author');
  
  if (Array.isArray(authors)) {
    return authors;
  }
  if (typeof authors === 'string') {
    return [authors];
  }
  if (author) {
    return [author];
  }
  return [];
}

/**
 * Check if value has a specific property
 */
export function hasProperty<T>(
  obj: unknown,
  propertyName: string
): obj is { [K in typeof propertyName]: T } {
  if (!obj || typeof obj !== 'object') return false;
  const value = getPropertyValue(obj, propertyName);
  return value !== null;
}

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null;
}

/**
 * Check if value is a valid non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Safe string conversion
 */
export function safeString(value: unknown, defaultValue: string = ''): string {
  if (typeof value === 'string') return value;
  if (value === null) return defaultValue;
  return String(value);
}

/**
 * Safe number conversion
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}