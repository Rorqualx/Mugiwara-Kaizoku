/**
 * Type definitions for ComicVine test page data structures
 */

/**
 * ComicVine image object with various resolution URLs
 */
export interface ComicVineImageData {
  super_url?: string;
  screen_large_url?: string;
  medium_url?: string;
  small_url?: string;
  thumb_url?: string;
  icon_url?: string;
  original_url?: string;
  cover?: string;
}

/**
 * Type guard to check if value is a ComicVine image object
 */
export function isComicVineImage(value: unknown): value is ComicVineImageData {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['super_url'] === 'string' ||
    typeof obj['screen_large_url'] === 'string' ||
    typeof obj['medium_url'] === 'string' ||
    typeof obj['small_url'] === 'string' ||
    typeof obj['thumb_url'] === 'string' ||
    typeof obj['icon_url'] === 'string' ||
    typeof obj['original_url'] === 'string' ||
    typeof obj['cover'] === 'string'
  );
}

/**
 * Item in an array that may contain image data
 */
export interface ArrayItemWithImage {
  image?: ComicVineImageData | string;
  cover?: ComicVineImageData | string;
  thumb_url?: string;
  icon_url?: string;
  name?: string;
  issue_number?: string;
}

/**
 * Type guard for array items with images
 */
export function isArrayItemWithImage(value: unknown): value is ArrayItemWithImage {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj['image'] !== undefined ||
    obj['cover'] !== undefined ||
    typeof obj['thumb_url'] === 'string' ||
    typeof obj['icon_url'] === 'string'
  );
}

/**
 * Search result from tRPC search query
 */
export interface ComicVineSearchResult {
  id: string;
  title?: string;
  description?: string;
  image?: ComicVineImageData | string;
  coverImage?: ComicVineImageData | string;
  provider?: string;
  volumes?: number | string;
  chapters?: number | string;
  year?: number | string;
  genres?: string[];
  authors?: string[];
}

/**
 * Type guard for search results
 */
export function isSearchResult(value: unknown): value is ComicVineSearchResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['id'] === 'string';
}
