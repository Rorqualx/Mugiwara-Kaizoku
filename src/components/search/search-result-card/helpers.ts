/**
 * Helper functions for SearchResultCard
 *
 * Utilities for external links, image handling, and type guards.
 */

import type { SearchResult, AniListSearchResult, ComicVineSearchResult, NativeDownloadSearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { safeExecute } from '@/utils/async-result';
import { getErrorMessage } from '@/utils/errors/helpers';

/**
 * Type guard for AniList search results
 *
 * @param result - The search result to check
 * @returns True if result is an AniList result
 */
export function isAniListResult(result: SearchResult): result is AniListSearchResult {
  return 'anilistId' in result && typeof result.anilistId === 'number';
}

/**
 * Type guard for ComicVine search results
 *
 * @param result - The search result to check
 * @returns True if result is a ComicVine result
 */
export function isComicVineResult(result: SearchResult): result is ComicVineSearchResult {
  return 'volumeId' in result && typeof result.volumeId === 'number';
}

/**
 * Type guard for Kapowarr search results
 *
 * @param result - The search result to check
 * @returns True if result is a Kapowarr result
 */
export function isKapowarrResult(result: SearchResult): result is NativeDownloadSearchResult {
  return 'nativeDownloadId' in result;
}

/**
 * Get the external link for a search result based on provider type
 *
 * @param result - The search result to get a link for
 * @returns The external link URL or null if not available
 */
export function getExternalLink(result: SearchResult): string | null {
  const providerLower = result.provider.toLowerCase();

  if (providerLower.includes('anilist') && isAniListResult(result)) {
    return result.anilistId ? `https://anilist.co/manga/${result.anilistId}` : null;
  }

  if (providerLower.includes('comicvine') && isComicVineResult(result)) {
    return result.siteDetailUrl ?? null;
  }

  if (providerLower.includes('native_download') && isKapowarrResult(result)) {
    return result.url ?? null;
  }

  // Default fallback - check for url property
  if ('url' in result && typeof result.url === 'string') {
    return result.url;
  }

  return null;
}

/**
 * Get the external link for a search result safely using AsyncResult pattern
 *
 * @param result - The search result to get a link for
 * @returns AsyncResult containing the link or an error
 */
export function getExternalLinkSafe(result: SearchResult): AsyncResult<string | null, Error> {
  return safeExecute<string | null, Error>(
    () => getExternalLink(result),
    (error) => new Error(`Failed to generate external link: ${getErrorMessage(error)}`)
  );
}

/**
 * Get cover image URL with fallback
 *
 * @param result - The search result
 * @returns Cover image URL or fallback
 */
export function getCoverUrl(result: SearchResult): string {
  return result.cover ?? result.coverImage ?? '/cover-not-found.jpg';
}

/**
 * Handle image error by setting fallback image
 *
 * @param e - The error event
 */
export function handleImageError(e: React.SyntheticEvent<HTMLImageElement>): void {
  const target = e.currentTarget;
  target.src = '/cover-not-found.jpg';
}
