/**
 * Search Helpers Module
 *
 * Shared utility functions for search operations to reduce code duplication
 * and improve maintainability.
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { logger } from '@/utils/logger';

// ===================================
// TYPES & INTERFACES
// ===================================

/**
 * Interface for search result items returned by providers
 */
export interface MangaSearchResult {
  id?: string;
  title?: string;
  cover?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  score?: number;
  popularity?: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  genres?: string[];
}

/**
 * Standardized search result with all required fields
 */
export interface StandardizedMangaResult {
  id: string;
  title: string;
  cover: string;
  coverImage: string;
  description: string;
  status: string;
  alternativeTitles: string[];
  score: number;
  popularity: number;
  startDate: string | Date | null;
  endDate: string | Date | null;
  genres: string[];
  [key: string]: unknown; // Allow provider-specific fields
}

/**
 * Search provider interface
 */
export interface SearchProvider {
  search: (query: string) => Promise<unknown[]>;
}

// ===================================
// TYPE GUARDS
// ===================================

/**
 * Type guard to check if an unknown object is MangaSearchResult-like
 */
export function isMangaLike(item: unknown): item is Partial<MangaSearchResult> {
  return item !== null && typeof item === 'object';
}

/**
 * Type guard for objects
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ===================================
// HELPER FUNCTIONS
// ===================================

/**
 * Clean search title for better provider matching
 * Removes parenthetical content and volume year patterns
 *
 * @param title - Original title string
 * @returns Cleaned title string
 */
export function cleanSearchTitle(title: string): string {
  // Remove parentheses with publisher/volume info and "Volume YEAR" patterns
  const cleanTitle = title
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove all parenthetical content
    .replace(/\s+Volume\s+\d{4}\s*/gi, '') // Remove "Volume YEAR" patterns
    .trim();

  // Only use cleaned title if it's different and meaningful (>3 chars)
  if (cleanTitle && cleanTitle !== title && cleanTitle.length > 3) {
    return cleanTitle;
  }

  return title;
}

/**
 * Standardize manga search result into consistent format
 * Handles missing fields and provides defaults
 *
 * @param item - Raw search result from provider
 * @returns Standardized manga result
 */
export function standardizeMangaResult(item: unknown): StandardizedMangaResult {
  if (isMangaLike(item)) {
    return {
      id: item["id"] ?? `unknown-${Date.now()}`,
      title: item["title"] ?? 'Untitled',
      cover: item.cover ?? item.coverImage ?? '/cover-not-found.jpg',
      coverImage: item.coverImage ?? item.cover ?? '/cover-not-found.jpg',
      description: item["description"] ?? 'No description available',
      status: item["status"] ?? 'Unknown',
      alternativeTitles: item["alternativeTitles"] ?? [],
      score: item.score ?? 0,
      popularity: item.popularity ?? 0,
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      genres: item["genres"] ?? []
    };
  }

  // Return default result for non-manga-like items
  return {
    id: `unknown-${Date.now()}`,
    title: 'Untitled',
    cover: '/cover-not-found.jpg',
    coverImage: '/cover-not-found.jpg',
    description: 'No description available',
    status: 'Unknown',
    alternativeTitles: [],
    score: 0,
    popularity: 0,
    startDate: null,
    endDate: null,
    genres: []
  };
}

/**
 * Include provider-specific fields in the result
 * Handles fields like wikiUrl, url, sourceId, pageId
 *
 * @param result - Standardized result object
 * @param item - Original item with provider-specific fields
 * @param providerName - Name of the provider (for logging)
 * @returns New result object with provider-specific fields added
 */
// eslint-disable-next-line complexity -- Field mapping from multiple providers (ComicVine, Fandom, AniList) requires explicit presence checks for 20+ optional fields; splitting by provider would duplicate iteration logic
export function includeProviderSpecificFields(
  result: Record<string, unknown>,
  item: Record<string, unknown>,
  providerName: string
): Record<string, unknown> {
  // Create new object with provider-specific fields
  const enrichedResult = { ...result };

  // Include wikiUrl for providers that support it (especially Fandom)
  if ('wikiUrl' in item && item['wikiUrl']) {
    enrichedResult['wikiUrl'] = item['wikiUrl'];
  }

  // Include general URL field
  if ('url' in item && item['url']) {
    enrichedResult['url'] = item['url'];
  }

  // Debug logging for Fandom provider
  if (providerName === 'fandom') {
    const safeGetString = (obj: Record<string, unknown>, key: string): string => {
      const value = obj[key];
      return typeof value === 'string' ? value : '';
    };

    logger.info(`[FANDOM DEBUG] Raw item: ${JSON.stringify({
      id: item["id"],
      title: item["title"],
      wikiUrl: safeGetString(item, 'wikiUrl'),
      url: safeGetString(item, 'url'),
      hasWikiUrl: 'wikiUrl' in item,
      hasUrl: 'url' in item
    })}`);
    logger.info(`[FANDOM DEBUG] Final result will have: wikiUrl=${enrichedResult['wikiUrl']}, url=${enrichedResult['url']}`);
    logger.info(`[FANDOM DEBUG] Full final result: ${JSON.stringify(enrichedResult)}`);
  }

  // Include other provider-specific fields
  if ('sourceId' in item && item['sourceId']) {
    enrichedResult['sourceId'] = item['sourceId'];
  }
  if ('pageId' in item && item['pageId']) {
    enrichedResult['pageId'] = item['pageId'];
  }

  // Include _provider marker if present (from enrichment)
  if ('_provider' in item) {
    enrichedResult['_provider'] = item['_provider'];
  }

  // ============================================================================
  // ComicVine-specific fields
  // These fields are returned by comicvineProvider but were being dropped
  // ============================================================================
  if ('chapters' in item && item['chapters'] !== undefined) {
    enrichedResult['chapters'] = item['chapters'];
  }
  if ('volumes' in item && item['volumes'] !== undefined) {
    enrichedResult['volumes'] = item['volumes'];
  }
  if ('publisher' in item && item['publisher']) {
    enrichedResult['publisher'] = item['publisher'];
  }
  if ('siteDetailUrl' in item && item['siteDetailUrl']) {
    enrichedResult['siteDetailUrl'] = item['siteDetailUrl'];
  }
  if ('staff' in item && item['staff']) {
    enrichedResult['staff'] = item['staff'];
  }
  if ('characters' in item && item['characters']) {
    enrichedResult['characters'] = item['characters'];
  }
  if ('aliases' in item && item['aliases']) {
    enrichedResult['aliases'] = item['aliases'];
  }
  // ComicVine concepts (themes/tags)
  if ('concepts' in item && item['concepts']) {
    enrichedResult['concepts'] = item['concepts'];
  }
  // ComicVine first/last issue info
  if ('firstIssue' in item && item['firstIssue']) {
    enrichedResult['firstIssue'] = item['firstIssue'];
  }
  if ('lastIssue' in item && item['lastIssue']) {
    enrichedResult['lastIssue'] = item['lastIssue'];
  }
  // ComicVine story arcs
  if ('storyArcs' in item && item['storyArcs']) {
    enrichedResult['storyArcs'] = item['storyArcs'];
  }

  return enrichedResult;
}

/**
 * Search provider with timeout and cache support
 * Prevents hanging searches and reuses recent results
 *
 * @param provider - Provider instance to search with
 * @param searchTitle - Title to search for (should be cleaned first)
 * @param providerName - Name of provider (for logging and cache key)
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Array of search results
 */
export async function searchProviderWithTimeout(
  provider: SearchProvider,
  searchTitle: string,
  providerName: string,
  timeoutMs: number = 5000
): Promise<unknown[]> {
  // Check cache first
  const cacheKey = `provider:search:${providerName}:${searchTitle}`;
  const cachedResults = await cacheProvider.get<unknown[]>(cacheKey);

  if (cachedResults) {
    logger.info(`Using cached results for ${providerName} search of "${searchTitle}"`);
    return cachedResults;
  }

  // Search with timeout protection
  const searchPromise = provider.search(searchTitle);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Provider ${providerName} search timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    const searchResults = (await Promise.race([searchPromise, timeoutPromise])) as unknown[];
    logger.info(`${providerName} search found ${searchResults.length} results for "${searchTitle}"`);

    // Cache results for 5 minutes
    await cacheProvider.set(cacheKey, searchResults, { ttl: 300, namespace: 'provider-search' });

    return searchResults;
  } catch (error) {
    logger.warn(`Provider ${providerName} search failed or timed out: ${error}`);
    throw error;
  }
}

/**
 * Transform and standardize search results with provider-specific field inclusion
 *
 * @param items - Array of raw search results
 * @param providerName - Name of the provider
 * @returns Array of standardized results with provider-specific fields
 */
export function transformSearchResults(
  items: unknown[],
  providerName: string
): StandardizedMangaResult[] {
  return items.map((item: unknown) => {
    const result = standardizeMangaResult(item);

    // Include provider-specific fields if item is a record
    if (isRecord(result) && isRecord(item)) {
      const enrichedResult = includeProviderSpecificFields(result, item, providerName);
      return enrichedResult as StandardizedMangaResult;
    }

    return result;
  });
}
