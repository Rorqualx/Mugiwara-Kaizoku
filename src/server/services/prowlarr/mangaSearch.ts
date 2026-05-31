/**
 * ProwlarrMangaSearch - Service for searching manga via Prowlarr
 *
 * REFACTORED: Split into focused modules for better maintainability.
 *
 * Architecture:
 * - prowlarr-types.ts - Type definitions (3 exports)
 * - prowlarr-query-utils.ts - Query optimization and parsing (4 functions)
 * - prowlarr-scoring.ts - Relevance scoring and filtering (3 functions)
 * - prowlarr-client.ts - HTTP client and API operations (1 class, 5 methods)
 * - mangaSearch.ts - Main service orchestration (THIS FILE)
 *
 * IMPORTANT: Prowlarr is NOT a metadata provider - it's an indexer aggregator for torrents/NZBs.
 *
 * For metadata (descriptions, covers, etc.), use:
 * - AniList, ComicVine, Fandom, or MangaDex providers
 *
 * Fixes:
 * - ESLint no-await-in-loop (line 195) - Uses Promise.all() for parallel queries
 * - ESLint complexity (lines 239-289) - Extracted to prowlarr-scoring.ts
 * - ESLint max-depth (lines 445, 451) - Extracted to prowlarr-query-utils.ts
 *
 * Original: 572 lines → Refactored: ~280 lines (51% reduction)
 */

import { prisma } from '@/server/db';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

// Import extracted modules
import { ProwlarrClient } from './prowlarr-client';
import {
  optimizeSearchQuery,
  extractBaseMangaTitle,
  isCompletePack,
  parseChaptersFromTitle
} from './prowlarr-query-utils';
import {
  filterMangaResults,
  calculateRelevanceScore,
  enhanceResultWithMetadata
} from './prowlarr-scoring';
import { shouldRejectByForeignTokens } from './relevance-gate';

import type { SearchOptions } from './prowlarr-types';
import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Search Result Types
// ============================================================================

export interface SearchQueryFailure {
  searchQuery: string;
  errorMessage: string;
  statusCode?: number | undefined;
}

export interface SearchMangaResult {
  results: ProwlarrSearchResult[];
  queryFailures: SearchQueryFailure[];
  totalQueries: number;
}

// ============================================================================
// In-process search-result cache
// ============================================================================
//
// Within a single quick-download / auto-trigger run, the legacy
// findAlternativeReleases path issues many Prowlarr searches with similar
// inputs (one per chapter × one per synonym). After optimizeSearchQuery
// and the existing Chapter-N stripping in extractBaseMangaTitle, most
// of these collapse to identical queries — but each one was hitting
// Prowlarr separately. A short-lived TTL cache deduplicates them.
//
// 60s TTL because:
//   - Quick-download runs typically take 30–60s end-to-end
//   - Long enough to absorb the per-chapter / per-synonym fan-out
//   - Short enough that newly-added blocklist entries take effect in
//     the next user-triggered run
// Bounded to 200 entries with simple oldest-first eviction so the cache
// can't grow unbounded if titles vary widely.

const SEARCH_CACHE_TTL_MS = 60_000;
const SEARCH_CACHE_MAX_ENTRIES = 200;

interface CacheEntry {
  result: AsyncResult<SearchMangaResult, Error>;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry>();

function cacheKeyFor(query: string, options?: SearchOptions): string {
  return `${query} ${options ? JSON.stringify(options) : ''}`;
}

function getCachedSearch(key: string): AsyncResult<SearchMangaResult, Error> | null {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    searchCache.delete(key);
    return null;
  }
  // Refresh recency by re-inserting (Map preserves insertion order).
  searchCache.delete(key);
  searchCache.set(key, entry);
  return entry.result;
}

function setCachedSearch(key: string, result: AsyncResult<SearchMangaResult, Error>): void {
  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldest = searchCache.keys().next().value;
    if (oldest !== undefined) searchCache.delete(oldest);
  }
  searchCache.set(key, { result, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

/**
 * Internal: clear the search cache. Exposed for tests.
 */
export function clearProwlarrSearchCache(): void {
  searchCache.clear();
}

/**
 * Main Prowlarr manga search service
 *
 * Orchestrates search operations across Prowlarr indexers,
 * delegating to specialized modules for query optimization,
 * scoring, and HTTP operations.
 */
/**
 * Build URLSearchParams for a Prowlarr /api/v1/search call.
 *
 * Categories: caller-supplied list overrides the default; the default is the
 * expanded set discovered in iter-10 covering the primary manga slots across
 * all 18 indexers (Newznab books/ebook/comics, Nyaa literature, raw, non-EN,
 * plus TV/Anime + Other as fallbacks for sites that miscategorize manga).
 */
function buildProwlarrSearchParams(searchQuery: string, options?: SearchOptions): URLSearchParams {
  const params = new URLSearchParams({ query: searchQuery, type: 'search' });

  if (options?.categories && options.categories.length > 0) {
    options.categories.forEach(cat => params.append('categories', cat.toString()));
  } else {
    for (const cat of [7000, 7020, 7030, 5070, 8000, 100920, 156719, 117084, 111160]) {
      params.append('categories', cat.toString());
    }
  }

  if (options?.indexers && options.indexers.length > 0) {
    params.append('indexers', options.indexers.join(','));
  }

  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.maxage) params.append('maxage', options.maxage.toString());
  if (options?.minsize) params.append('minsize', options.minsize.toString());
  if (options?.maxsize) params.append('maxsize', options.maxsize.toString());

  return params;
}

export class ProwlarrMangaSearch {
  private client: ProwlarrClient;

  constructor(private prismaClient: PrismaClient = prisma) {
    this.client = new ProwlarrClient(prismaClient);
  }

  /**
   * Searches for manga via Prowlarr
   *
   * REFACTORED: Uses Promise.all() for parallel query execution (fixes no-await-in-loop).
   * Delegates complex logic to extracted modules.
   *
   * @param query - Search query string
   * @param options - Search options (categories, indexers, filters)
   * @returns AsyncResult containing array of search results
   */
  async searchManga(
    query: string,
    options?: SearchOptions
  ): Promise<AsyncResult<SearchMangaResult, Error>> {
    // In-process result cache (60s TTL) — dedupes the per-chapter /
    // per-synonym fan-out from findAlternativeReleases & friends, where
    // the same `query` is issued many times within one run.
    const cacheKey = cacheKeyFor(query, options);
    const cached = getCachedSearch(cacheKey);
    if (cached) {
      logger.info(`Prowlarr cache hit for "${query}"`);
      return cached;
    }

    const result = await this.searchMangaUncached(query, options);
    setCachedSearch(cacheKey, result);
    return result;
  }

  /**
   * Uncached search implementation. Public callers go through {@link searchManga}
   * which adds a 60s TTL cache; this method runs an actual Prowlarr query and
   * is exposed only for cases that explicitly want to bypass the cache.
   */
  async searchMangaUncached(
    query: string,
    options?: SearchOptions
  ): Promise<AsyncResult<SearchMangaResult, Error>> {
    try {
      // Get HTTP client
      const clientResult = await this.client.getClient();
      if (!isSuccess(clientResult)) {
        const error = clientResult.status === 'error' ? clientResult.error : new Error('Unknown error');
        return createErrorResult(error);
      }
      const httpClient = clientResult.data;

      // Collector for per-query failures
      const queryFailures: SearchQueryFailure[] = [];

      // Optimize query into multiple search variations
      const searchQueries = optimizeSearchQuery(query);
      logger.info(`Optimized "${query}" into ${searchQueries.length} search queries:`, searchQueries);

      // PARALLEL QUERY EXECUTION - Fixes no-await-in-loop (line 195)
      // Execute all searches in parallel using Promise.all()
      const searchPromises = searchQueries.map(async (searchQuery, index) => {
        try {
          const params = buildProwlarrSearchParams(searchQuery, options);

          logger.info(`[Query ${index + 1}/${searchQueries.length}] Searching Prowlarr: "${searchQuery}"`);

          // Execute search
          const response = await httpClient.get<Array<{
            guid: string;
            title: string;
            indexer: string;
            indexerId?: number;
            protocol?: string;
            size: number;
            seeders?: number;
            leechers?: number;
            downloadUrl: string;
            magnetUrl?: string;
            infoUrl?: string;
            publishDate?: string;
            categories?: number[];
          }>>(`/api/v1/search?${params.toString()}`);

          if (response.status === 200) {
            logger.info(`[Query ${index + 1}/${searchQueries.length}] Got ${response.data.length} results`);
            return response.data;
          }

          return [];
        } catch (searchError) {
          const errorMsg = searchError instanceof Error ? searchError.message : String(searchError);
          const statusCode = searchError instanceof Error && 'statusCode' in searchError
            ? (searchError as unknown as { statusCode: number }).statusCode
            : undefined;
          queryFailures.push({ searchQuery, errorMessage: errorMsg, statusCode });
          logger.warn(`Search query "${searchQuery}" failed:`, searchError);
          return [];
        }
      });

      // Wait for all parallel searches to complete
      const searchResults = await Promise.all(searchPromises);

      // Deduplicate results by guid
      const allResults = new Map<string, typeof searchResults[0][0]>();
      searchResults.forEach((queryResults) => {
        queryResults.forEach(result => {
          if (!allResults.has(result.guid)) {
            allResults.set(result.guid, result);
          }
        });
      });

      const apiResults = Array.from(allResults.values());
      logger.info(`Combined ${allResults.size} unique results from ${searchQueries.length} queries`);

      // Extract base manga title for matching
      const baseMangaTitle = extractBaseMangaTitle(query);

      // Filter to manga-specific content
      const mangaFilteredResults = filterMangaResults(apiResults);
      logger.info(`Filtered ${apiResults.length} -> ${mangaFilteredResults.length} manga-specific results`);

      // Calculate relevance scores
      const scoredResults = mangaFilteredResults.map(result => ({
        ...result,
        relevanceScore: calculateRelevanceScore(result, baseMangaTitle)
      }));

      // Sort by relevance score
      scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Enhance with metadata
      const enhancedResults0 = scoredResults.map(result => enhanceResultWithMetadata(result));

      // Re-sort by enhanced score
      enhancedResults0.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      // Relevance gate — drops releases whose title shares the canonical
      // leading token but adds enough unrelated tokens to be plainly a
      // different work (the Akira incident: "Akira Failing in Love"
      // matching a search for "Akira"). Only active when the caller
      // provided `acceptedTitles`; pure-discovery flows are untouched.
      const acceptedTitles = options?.acceptedTitles ?? [];
      let droppedByRelevance = 0;
      const results = acceptedTitles.length > 0
        ? enhancedResults0.filter((r) => {
          if (shouldRejectByForeignTokens(r.title, acceptedTitles)) {
            droppedByRelevance += 1;
            logger.debug(`Relevance gate dropped: ${r.title}`);
            return false;
          }
          return true;
        })
        : enhancedResults0;

      if (droppedByRelevance > 0) {
        logger.info(
          `Relevance gate filtered ${droppedByRelevance}/${enhancedResults0.length} ` +
          `results for canonical titles [${acceptedTitles.join(', ')}]`,
        );
      }

      logger.info(`Prowlarr search returned ${results.length} results`);

      // Add blocklist warning flags
      const { getReleaseBlocklistService } = await import('../releaseBlocklistService');
      const blocklistService = getReleaseBlocklistService(this.prismaClient);

      const enhancedResults = await Promise.all(
        results.map(async (result) => {
          try {
            // `mangaId` (when the caller provided one) scopes the lookup so
            // a block on a same-titled release for a different manga can't
            // leak in. Without it, the blocklist check matches globally and
            // a coincidental title collision suppresses unrelated downloads.
            const releaseIdentifier = {
              releaseTitle: result.title,
              indexerId: result.guid,
              source: result.indexerName,
              ...(options?.mangaId !== undefined ? { mangaId: options.mangaId } : {}),
            };

            const blocklistCheck = await blocklistService.checkRelease(releaseIdentifier);
            if (isSuccess(blocklistCheck) && blocklistCheck.data.isBlocked) {
              logger.debug(`Marked result as blocked: ${result.title} (${blocklistCheck.data.reason})`);
              return {
                ...result,
                isBlocked: true,
                blockReason: blocklistCheck.data.reason
              };
            }

            return {
              ...result,
              isBlocked: false
            };
          } catch (error) {
            logger.warn(`Blocklist check failed for ${result.title}:`, error);
            return result;
          }
        })
      );

      const blockedCount = enhancedResults.filter(r => r.isBlocked).length;
      logger.info(`Prowlarr search: ${enhancedResults.length} results (${blockedCount} marked as blocked)`);

      return createSuccessResult({
        results: enhancedResults,
        queryFailures,
        totalQueries: searchQueries.length,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Failed to search Prowlarr';
      logger.error(`Prowlarr search error: ${errorMessage}`);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Detects if a release title represents a complete pack/collection
   *
   * Delegates to extracted utility function.
   *
   * @param title - Release title to check
   * @returns True if title indicates a complete pack
   */
  isCompletePack(title: string): boolean {
    return isCompletePack(title);
  }

  /**
   * Parses chapter numbers from release titles
   *
   * Delegates to extracted utility function.
   *
   * @param title - Release title to parse
   * @returns Array of chapter numbers found in title
   */
  parseChaptersFromTitle(title: string): number[] {
    return parseChaptersFromTitle(title);
  }

  /**
   * Gets indexer statistics from Prowlarr
   *
   * Delegates to HTTP client.
   *
   * @returns AsyncResult containing indexer stats
   */
  async getIndexerStats(): Promise<AsyncResult<unknown[], Error>> {
    return this.client.getIndexerStats();
  }

  /**
   * Tests Prowlarr connectivity
   *
   * Delegates to HTTP client.
   *
   * @returns AsyncResult indicating if Prowlarr is accessible
   */
  async testConnection(): Promise<AsyncResult<boolean, Error>> {
    return this.client.testConnection();
  }

  /**
   * Downloads a release via Prowlarr
   *
   * Delegates to HTTP client.
   *
   * @param downloadUrl - URL of the release to download
   * @returns AsyncResult indicating success or failure
   */
  async downloadRelease(downloadUrl: string): Promise<AsyncResult<void, Error>> {
    return this.client.downloadRelease(downloadUrl);
  }
}
