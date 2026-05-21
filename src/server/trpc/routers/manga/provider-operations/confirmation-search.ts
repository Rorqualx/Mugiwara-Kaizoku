/**
 * Provider Confirmation Search Operations
 *
 * Enhanced multi-provider search with metadata enrichment:
 * - searchProviderConfirmation: Search with cached results and enrichment
 *
 * Extracted from: providerOperations.ts (lines 242-424)
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { detectErrorType } from '@/server/services/search/unified-registry/registry-utils';
import { uncachedPublicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import {
  isProviderMetadataRecord,
  isRawSearchItem,
  type RawSearchItem,
  type RawDataContainer
} from '@/types/api/manga-router-types';
import type { ProviderErrorInfo } from '@/types/search-types/provider.types';
import { logger } from '@/utils/logger';

import {
  providerConfirmationSearchSchema,
  isMangaLike,
  safeGet,
  safeGetString,
  isRecord
} from './utils';

// Types
interface StandardizedSearchResult {
  id: string | number;
  title: string;
  source: string;
  sourceId: string | number;
  cover: string;
  coverImage: string;
  description: string;
  status: string;
  alternativeTitles: unknown[];
  score: number;
  popularity: number;
  startDate: unknown;
  endDate: unknown;
  genres: unknown[];
  metadata: Record<string, unknown>;
  rawData?: unknown;
}

interface SearchProvider {
  search: (title: string) => Promise<unknown[]>;
}

// Helper Functions

/** Clean title for better search results */
function cleanSearchTitle(title: string): string {
  const cleanTitle = title
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+Volume\s+\d{4}\s*/gi, '')
    .trim();
  return cleanTitle && cleanTitle !== title && cleanTitle.length > 3 ? cleanTitle : title;
}

/** Get timeout duration based on provider complexity */
function getProviderTimeout(providerName: string): number {
  // Extended timeout for providers that make multi-step API calls:
  // - WIKIPEDIA: search, parse, enrich
  // - FANDOM: MediaWiki API + v1 API + article details + page metadata
  const extendedTimeoutProviders = ['WIKIPEDIA', 'FANDOM'];
  return extendedTimeoutProviders.includes(providerName.toUpperCase()) ? 15000 : 5000;
}

/** Search provider with configurable timeout based on provider */
async function searchProviderWithTimeout(
  provider: SearchProvider,
  title: string,
  providerName: string
): Promise<unknown[]> {
  const timeoutMs = getProviderTimeout(providerName);
  const searchPromise = provider.search(title);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Provider ${providerName} search timeout after ${timeoutMs / 1000}s`)), timeoutMs);
  });
  return (await Promise.race([searchPromise, timeoutPromise])) as unknown[];
}

/** Create default/fallback search result for unknown items */
function createFallbackResult(providerName: string): StandardizedSearchResult {
  const timestamp = Date.now();
  return {
    id: `unknown-${timestamp}`,
    title: 'Untitled',
    source: providerName,
    sourceId: `unknown-${timestamp}`,
    cover: '/cover-not-found.jpg',
    coverImage: '/cover-not-found.jpg',
    description: 'No description available',
    status: 'Unknown',
    alternativeTitles: [],
    score: 0,
    popularity: 0,
    startDate: null,
    endDate: null,
    genres: [],
    metadata: {}
  };
}

/** Extract ID from raw item with fallback */
function extractId(rawItem: Record<string, unknown>): string | number {
  const timestamp = Date.now();
  const itemId = rawItem['id'];
  return (typeof itemId === 'string' || typeof itemId === 'number') ? itemId : `unknown-${timestamp}`;
}

/** Extract title from raw item with fallback */
function extractTitle(rawItem: Record<string, unknown>): string {
  const titleValue = rawItem['title'];
  return typeof titleValue === 'string' ? titleValue : 'Untitled';
}

/** Extract cover image URLs with fallbacks */
function extractCoverImages(rawItem: Record<string, unknown>): { cover: string; coverImage: string } {
  const cover = (rawItem['cover'] ?? rawItem['coverImage'] ?? '/cover-not-found.jpg') as string;
  const coverImage = (rawItem['coverImage'] ?? rawItem['cover'] ?? '/cover-not-found.jpg') as string;
  return { cover, coverImage };
}

/** Extract alternative titles with fallback */
function extractAlternativeTitles(rawItem: Record<string, unknown>): unknown[] {
  return (rawItem['alternativeTitles'] ?? rawItem['synonyms'] ?? []) as unknown[];
}

/** Extract score with fallback to averageScore */
function extractScore(rawItem: Record<string, unknown>): number {
  return (rawItem['score'] ?? rawItem['averageScore'] ?? 0) as number;
}

/** Extract volumes count from various sources */
function extractVolumesCount(
  rawItem: Record<string, unknown>,
  rawData: unknown,
  rawMetadata: Record<string, unknown> | undefined
): unknown {
  if (isRecord(rawData)) {
    return safeGet(rawData, 'volumes') ?? rawItem['volumes'] ?? rawMetadata?.['volumes'] ?? null;
  }
  return rawItem['volumes'] ?? rawMetadata?.['volumes'] ?? null;
}

/** Extract chapters count from various sources */
function extractChaptersCount(
  rawItem: Record<string, unknown>,
  rawData: unknown,
  rawMetadata: Record<string, unknown> | undefined
): unknown {
  if (isRecord(rawData)) {
    return safeGet(rawData, 'chapters') ?? rawItem['chapters'] ?? rawMetadata?.['chapters'] ?? null;
  }
  return rawItem['chapters'] ?? rawMetadata?.['chapters'] ?? null;
}

/** Build metadata object from raw item and data */
function buildMetadata(
  rawItem: Record<string, unknown>,
  rawData: unknown,
  rawMetadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  return {
    ...(rawMetadata ?? {}),
    volumes: extractVolumesCount(rawItem, rawData, rawMetadata),
    chapters: extractChaptersCount(rawItem, rawData, rawMetadata),
    enriched: rawItem['enriched'] === true,
    raw: rawData
  };
}

/** Transform a manga-like item to standardized search result format */
function transformToStandardizedResult(
  item: unknown,
  providerName: string
): StandardizedSearchResult {
  if (!isMangaLike(item)) {
    return createFallbackResult(providerName);
  }

  const rawItem = isRawSearchItem(item) ? (item as RawSearchItem) : (item as Record<string, unknown>);
  const rawData = (rawItem as RawSearchItem)['rawData'] ?? (rawItem as RawDataContainer);
  const rawMetadata = isProviderMetadataRecord((rawItem as RawSearchItem).metadata)
    ? (rawItem as RawSearchItem).metadata
    : undefined;

  const resolvedId = extractId(rawItem);
  const resolvedTitle = extractTitle(rawItem);
  const { cover, coverImage } = extractCoverImages(rawItem);

  return {
    id: resolvedId,
    title: resolvedTitle,
    source: providerName,
    sourceId: resolvedId,
    cover,
    coverImage,
    description: (rawItem['description'] ?? 'No description available') as string,
    status: (rawItem['status'] ?? 'Unknown') as string,
    alternativeTitles: extractAlternativeTitles(rawItem),
    score: extractScore(rawItem),
    popularity: (rawItem['popularity'] ?? 0) as number,
    startDate: rawItem['startDate'] ?? null,
    endDate: rawItem['endDate'] ?? null,
    genres: (rawItem['genres'] ?? []) as unknown[],
    metadata: buildMetadata(rawItem, rawData, rawMetadata),
    rawData: rawData
  };
}

/** Enrich top results with provider name and enrichment flag */
function enrichTopResults(searchResults: unknown[], providerName: string): (unknown | null)[] {
  return searchResults.slice(0, 3).map((item: unknown, index: number) => {
    try {
      if (isMangaLike(item) && item.id) {
        logger.debug(`Result ${index} from ${providerName} marked for potential enrichment`);
        return {
          ...item,
          providerName,
          enriched: true
        };
      }
    } catch (detailError: unknown) {
      logger.debug(`Could not process result ${index} from ${providerName}: ${detailError}`);
    }

    if (isMangaLike(item)) {
      return {
        ...item,
        providerName
      };
    }
    return null;
  });
}

/** Create simple fallback results when enrichment fails */
function createFallbackResults(searchResults: unknown[], providerName: string): (Record<string, unknown> | null)[] {
  return searchResults.map((item: unknown) => {
    if (isMangaLike(item)) {
      return {
        id: safeGetString(item, 'id', `unknown-${Date.now()}`),
        title: safeGetString(item, 'title', 'Untitled'),
        source: providerName,
        cover: '/cover-not-found.jpg'
      };
    }
    return null;
  });
}

/** Process search results for a single provider */
async function processProviderSearch(
  providerName: string,
  provider: SearchProvider,
  title: string
): Promise<unknown[]> {
  const searchTitle = cleanSearchTitle(title);
  if (searchTitle !== title) {
    logger.info(`Using cleaned title "${searchTitle}" instead of "${title}" for ${providerName}`);
  }

  // Special logging for Wikipedia to debug issues
  if (providerName.toUpperCase() === 'WIKIPEDIA') {
    logger.info(`[WIKIPEDIA DEBUG] Starting search for "${searchTitle}"`);
    logger.info(`[WIKIPEDIA DEBUG] Provider has search method: ${typeof provider.search === 'function'}`);
  }

  const cacheKey = `provider:search:${providerName}:${searchTitle}`;
  const cachedResults = await cacheProvider.get<unknown[]>(cacheKey);

  let searchResults: unknown[];
  if (cachedResults) {
    logger.info(`Using cached results for ${providerName} search of "${searchTitle}"`);
    searchResults = cachedResults;
  } else {
    try {
      if (providerName.toUpperCase() === 'WIKIPEDIA') {
        logger.info(`[WIKIPEDIA DEBUG] Calling search with timeout ${getProviderTimeout(providerName)}ms`);
      }
      searchResults = await searchProviderWithTimeout(provider, searchTitle, providerName);
      logger.info(`${providerName} search found ${searchResults.length} results for "${title}"`);
      if (providerName.toUpperCase() === 'WIKIPEDIA') {
        logger.info(`[WIKIPEDIA DEBUG] Search returned ${searchResults.length} results`);
        if (searchResults.length > 0) {
          logger.info(`[WIKIPEDIA DEBUG] First result: ${JSON.stringify(searchResults[0]).substring(0, 200)}`);
        }
      }
      await cacheProvider.set(cacheKey, searchResults, { ttl: 300, namespace: 'provider-search' });
    } catch (searchError) {
      logger.warn(`Provider ${providerName} search failed or timed out: ${searchError}`);
      if (providerName.toUpperCase() === 'WIKIPEDIA') {
        logger.error(`[WIKIPEDIA DEBUG] Search error details: ${searchError instanceof Error ? searchError.stack : String(searchError)}`);
      }
      throw searchError;
    }
  }

  // Enrich top 3 results and combine with remaining
  const enrichedResults = enrichTopResults(searchResults, providerName);
  const remainingResults = searchResults.slice(3);
  const allResults = [...enrichedResults.filter((r) => r !== null), ...remainingResults];

  // Transform all results to standardized format
  return allResults.map((item: unknown) => transformToStandardizedResult(item, providerName));
}

// Router Helpers

interface ConfirmationSearchOutcome {
  results: unknown[];
  error?: ProviderErrorInfo;
}

interface ProviderRegistry {
  get: (name: string) => SearchProvider | undefined;
  getAll: () => Record<string, unknown>;
}

async function searchConfirmationProvider(
  registry: ProviderRegistry,
  providerName: string,
  title: string,
): Promise<ConfirmationSearchOutcome> {
  if (!providerName) {
    logger.warn('Undefined provider name in registry');
    return { results: [] };
  }

  logger.info(`Looking up provider: ${providerName}`);
  const provider = registry.get(providerName);
  if (!provider) {
    const available = Object.keys(registry.getAll());
    logger.warn(`Provider ${providerName} not found in registry. Available: ${available.join(', ')}`);
    return { results: [] };
  }

  if (!title || title.trim() === '') {
    logger.warn(`Empty title passed for provider ${providerName}, skipping`);
    return { results: [] };
  }

  try {
    const results = await processProviderSearch(providerName, provider, title);
    return { results };
  } catch (enrichmentError: unknown) {
    logger.warn(`Error enriching results for ${providerName}: ${enrichmentError}`);
    const fallbackResults = createFallbackResults([], providerName);
    try {
      return { results: fallbackResults.filter((r): r is Record<string, unknown> => r !== null) };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = detectErrorType(error);
      logger.error(`Error searching ${providerName}: ${errorMessage}`);
      return {
        results: [],
        error: { provider: providerName, error: errorMessage, errorType, timestamp: Date.now() },
      };
    }
  }
}

// Router

export const providerConfirmationSearchRouter = router({
  /** Enhanced provider confirmation search with metadata enrichment */
  searchProviderConfirmation: uncachedPublicProcedure
    .input(providerConfirmationSearchSchema)
    .query(async ({ input }): Promise<{ results: Record<string, unknown[]>; providerErrors: ProviderErrorInfo[] }> => {
      logger.info(
        `Provider confirmation search for title: ${input.title}, requested providers: ${input.providers.join(', ')}`
      );

      try {
        const { getInitializedProviderRegistry } = await import('@/server/services/search/ensureProviderRegistry');
        const registry = await getInitializedProviderRegistry();
        const results: Record<string, unknown[]> = {};
        const providerErrors: ProviderErrorInfo[] = [];

        if (input.providers.length === 0) {
          logger.warn('No providers requested in input');
          return { results, providerErrors };
        }

        await Promise.all(
          input.providers.map(async (providerName) => {
            const outcome = await searchConfirmationProvider(registry, providerName, input.title);
            results[providerName] = outcome.results;
            if (outcome.error) providerErrors.push(outcome.error);
          })
        );

        const summary = Object.entries(results)
          .map(([provider, items]) => `${provider}: ${items.length}`)
          .join(', ');
        logger.info(`Search complete. Results summary: ${summary}`);
        return { results, providerErrors };
      } catch (error: unknown) {
        logger.error(`Error in searchProviderConfirmation: ${error instanceof Error ? error.message : String(error)}`);
        return { results: {}, providerErrors: [] };
      }
    })
});
