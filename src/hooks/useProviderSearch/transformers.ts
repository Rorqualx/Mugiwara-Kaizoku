/**
 * Transformer functions for useProviderSearch hook
 *
 * Handles conversion of raw search results to enhanced format.
 *
 * Extracted from: useProviderSearch.ts
 */

import type { SearchResult } from '@/server/services/search/types';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import type { EnhancedSearchResult } from './types';

/**
 * Helper to extract cover URL from various fields
 *
 * Searches through common cover image field names and returns the first
 * string value found, or a default placeholder image.
 *
 * @param result - The raw result object to extract cover URL from
 * @returns The cover URL string or default placeholder
 */
export function extractCoverUrl(result: Record<string, unknown>): string {
  const coverFields = ['coverUrl', 'cover', 'coverImage', 'image'];
  for (const field of coverFields) {
    const value = result[field];
    if (typeof value === 'string') {
      return value;
    }
  }
  return '/cover-not-found.jpg';
}

/**
 * Extract ID field with fallback strategies
 *
 * @param result - The raw result object
 * @param idx - The result index for unique fallback generation
 * @returns The ID as a string
 */
function extractId(result: Record<string, unknown>, idx: number): string {
  if (typeof result['id'] === 'string') {
    return result['id'];
  }
  if (typeof result['id'] === 'number') {
    return toStringId(result['id']);
  }
  return `unknown-${Date.now()}-${idx}`;
}

/**
 * Extract title field with fallback to name field
 *
 * @param result - The raw result object
 * @returns The title string
 */
function extractTitle(result: Record<string, unknown>): string {
  if (typeof result['title'] === 'string') {
    return result['title'];
  }
  if (typeof result['name'] === 'string') {
    return result['name'];
  }
  return 'Unknown Manga';
}

/**
 * Extract description field with fallback to summary
 *
 * @param result - The raw result object
 * @returns The description string
 */
function extractDescription(result: Record<string, unknown>): string {
  if (typeof result['description'] === 'string') {
    return result['description'];
  }
  if (typeof result['summary'] === 'string') {
    return result['summary'];
  }
  return 'No description available';
}

/**
 * Extract alternative titles from various field names
 *
 * @param result - The raw result object
 * @returns Array of alternative titles
 */
function extractAlternativeTitles(result: Record<string, unknown>): unknown[] {
  if (Array.isArray(result['alternativeTitles'])) {
    return result['alternativeTitles'];
  }
  if (Array.isArray(result['aliases'])) {
    return result['aliases'];
  }
  return [];
}

/**
 * Extract genres from various field names
 *
 * @param result - The raw result object
 * @returns Array of genres
 */
function extractGenres(result: Record<string, unknown>): unknown[] {
  if (Array.isArray(result['genres'])) {
    return result['genres'];
  }
  if (Array.isArray(result['categories'])) {
    return result['categories'];
  }
  return [];
}

/**
 * Extract numeric score with fallback to rating
 *
 * @param result - The raw result object
 * @returns The score number or undefined
 */
function extractScore(result: Record<string, unknown>): number | undefined {
  if (typeof result['score'] === 'number') {
    return result['score'];
  }
  if (typeof result['rating'] === 'number') {
    return result['rating'];
  }
  return undefined;
}

/**
 * Extract URL with fallback to wikiUrl
 *
 * @param result - The raw result object
 * @returns The URL string or undefined
 */
function extractUrl(result: Record<string, unknown>): string | undefined {
  if (typeof result['url'] === 'string') {
    return result['url'];
  }
  if (typeof result['wikiUrl'] === 'string') {
    return result['wikiUrl'];
  }
  return undefined;
}

/**
 * Build provider-specific fields object
 *
 * @param result - The raw result object
 * @returns Object with provider-specific fields
 */
function buildProviderSpecificFields(result: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (result['volumeCovers']) {
    fields['volumeCovers'] = result['volumeCovers'];
  }
  if (result['gallery']) {
    fields['gallery'] = result['gallery'];
  }
  if (result['volumes'] !== undefined) {
    fields['volumes'] = result['volumes'];
  }
  if (result['chapters'] !== undefined) {
    fields['chapters'] = result['chapters'];
  }
  if (result['url']) {
    fields['url'] = result['url'];
  }
  if (result['wikiUrl']) {
    fields['wikiUrl'] = result['wikiUrl'];
  }

  return fields;
}

/**
 * Log debug information for the first result
 *
 * @param result - The raw result object
 * @param providerId - The provider ID
 * @param idx - The result index
 */
function logFirstResult(result: Record<string, unknown>, providerId: string, idx: number): void {
  if (idx === 0) {
    logger.debug(`First result from ${providerId} raw data:`, {
      id: result['id'],
      title: result['title'],
      hasWikiUrl: !!result['wikiUrl'],
      wikiUrl: result['wikiUrl'],
      hasUrl: !!result['url'],
      url: result['url'],
      hasVolumeCovers: !!result['volumeCovers'],
      volumeCoversCount: Array.isArray(result['volumeCovers'])
        ? result['volumeCovers'].length
        : 0,
    });
  }
}

/**
 * Transform raw search result to EnhancedSearchResult
 *
 * Converts a raw SearchResult from any provider into a normalized
 * EnhancedSearchResult format with consistent field names and types.
 *
 * @param result - The raw search result from a provider
 * @param providerId - The ID of the provider that returned this result
 * @param idx - The index of this result in the results array (for logging)
 * @returns The transformed EnhancedSearchResult
 */
export function transformSearchResult(
  result: SearchResult,
  providerId: string,
  idx: number
): EnhancedSearchResult {
  const anyResult = result as unknown as Record<string, unknown>;

  logFirstResult(anyResult, providerId, idx);

  const coverUrl = extractCoverUrl(anyResult);
  const providerSpecificFields = buildProviderSpecificFields(anyResult);

  // Convert unknown structure to safe result with all required fields
  const safeResult = {
    // Required fields with fallbacks
    id: extractId(anyResult, idx),
    title: extractTitle(anyResult),
    // Preserve source information if present
    source: typeof anyResult['source'] === 'string' ? anyResult['source'] : providerId,
    sourceId: anyResult['sourceId'] ?? anyResult['id'],
    // Cover images
    coverUrl,
    cover: coverUrl,
    coverImage: coverUrl,
    // URLs for provider-specific access (crucial for Fandom enhancement)
    wikiUrl: typeof anyResult['wikiUrl'] === 'string' ? anyResult['wikiUrl'] : undefined,
    url: extractUrl(anyResult),
    // Optional metadata
    description: extractDescription(anyResult),
    status: typeof anyResult['status'] === 'string' ? anyResult['status'] : 'Unknown',
    alternativeTitles: extractAlternativeTitles(anyResult),
    genres: extractGenres(anyResult),
    // Preserve authors and artists
    authors: Array.isArray(anyResult['authors']) ? anyResult['authors'] : [],
    artists: Array.isArray(anyResult['artists']) ? anyResult['artists'] : [],
    // Preserve metadata object if present
    metadata: anyResult['metadata'] ?? {},
    // Preserve raw data for further processing
    rawData: anyResult['rawData'] ?? {},
    // Preserve provider-specific data
    providerSpecific: anyResult['providerSpecific'] ?? {},
    // Numeric fields
    score: extractScore(anyResult),
    popularity: typeof anyResult['popularity'] === 'number' ? anyResult['popularity'] : undefined,
    // Preserve any provider-specific fields
    ...providerSpecificFields,
    // Always add provider ID to each result
    provider: providerId,
  };

  return safeResult as unknown as EnhancedSearchResult;
}
