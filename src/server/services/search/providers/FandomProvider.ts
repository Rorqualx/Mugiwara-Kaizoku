/**
 * Fandom Search Provider for UniversalImportWizard
 */

import { FandomService } from '@/server/services/fandom/FandomService';
import { POPULAR_WIKIS, FALLBACK_WIKIS } from '@/server/services/fandom/types';
import type { SearchResult, SearchOptions } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { serverLogger } from '@/utils/serverLogger';

import { SearchError } from '../types';

import { BaseSearchProvider } from './BaseSearchProvider';
import { deduplicateByTitle, mapTypeFilter } from './FandomProvider/helpers';
import { transformResults, transformMangaData } from './FandomProvider/transformers';

import type { MetadataProvider } from '@prisma/client';

export class FandomProvider extends BaseSearchProvider {
  name = 'fandom';
  type: MetadataProvider = 'FANDOM' as MetadataProvider;

  private services: Map<string, FandomService> = new Map();
  private activeWikis: string[] = [];
  private fallbackWikis: string[] = [];
  private log = logger.child('FandomProvider');

  constructor() {
    super();
    // Initialize with popular wikis by default
    this.initializeWikis();
  }

  /**
   * Initialize Fandom services for popular wikis
   */
  private initializeWikis(): void {
    // Start with most popular wikis - use all keys from POPULAR_WIKIS
    const defaultWikis = Object.keys(POPULAR_WIKIS);

    defaultWikis.forEach(wikiKey => {
      const wikiConfig = POPULAR_WIKIS[wikiKey];
      if (wikiConfig) {
        const apiConfig = {
          cache: {
            enabled: true,
            ttl: 3600 // 1 hour cache
          },
          rateLimit: {
            requestsPerSecond: 2,
            burstLimit: 5
          }
        };

        const service = new FandomService(
          wikiConfig.subdomain,
          wikiConfig,
          apiConfig
        );

        this.services.set(wikiKey, service);
        this.activeWikis.push(wikiKey);
      }
    });

    this.log.info('Initialized Fandom provider', {
      wikis: this.activeWikis
    });

    // Initialize fallback wikis (category wikis like webtoon, yaoi, manga, etc.)
    this.initializeFallbackWikis();
  }

  /**
   * Initialize fallback wikis for general category searches
   */
  private initializeFallbackWikis(): void {
    const fallbackKeys = Object.keys(FALLBACK_WIKIS);

    fallbackKeys.forEach(wikiKey => {
      const wikiConfig = FALLBACK_WIKIS[wikiKey];
      if (wikiConfig && !this.services.has(wikiKey)) {
        const apiConfig = {
          cache: {
            enabled: true,
            ttl: 3600
          },
          rateLimit: {
            requestsPerSecond: 2,
            burstLimit: 5
          }
        };

        const service = new FandomService(
          wikiConfig.subdomain,
          wikiConfig,
          apiConfig
        );

        this.services.set(wikiKey, service);
        this.fallbackWikis.push(wikiKey);
      }
    });

    this.log.info('Initialized fallback wikis', {
      fallbackWikis: this.fallbackWikis
    });
  }

  /**
   * Add a custom wiki
   */
  addWiki(subdomain: string, name?: string): void {
    if (!this.services.has(subdomain)) {
      const service = new FandomService(subdomain, {
        name: name ?? subdomain,
        subdomain,
        categories: {
          characters: 'Characters',
          chapters: 'Chapters',
          volumes: 'Volumes',
          arcs: 'Story Arcs'
        }
      });

      this.services.set(subdomain, service);
      this.activeWikis.push(subdomain);

      this.log.info('Added custom wiki', { subdomain, name });
    }
  }

  /**
   * Convert a search query to potential Fandom subdomains
   * Returns an array of candidates to try (full title, first word, etc.)
   * E.g., "Frieren: Beyond Journey's End" → ["frieren-beyond-journeys-end", "frieren"]
   */
  private queryToSubdomains(query: string): string[] {
    const candidates: string[] = [];

    // Full title normalized
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')           // spaces to hyphens
      .replace(/['']/g, '')           // remove apostrophes
      .replace(/[^a-z0-9-]/g, '')     // remove special chars
      .replace(/-+/g, '-')            // collapse multiple hyphens
      .replace(/^-|-$/g, '');         // trim leading/trailing hyphens

    if (normalized.length >= 2 && normalized.length <= 50) {
      candidates.push(normalized);
    }

    // No-hyphen variant (many Fandom wikis use concatenated names, e.g., "tokyorevengers")
    const noHyphen = normalized.replace(/-/g, '');
    if (noHyphen !== normalized && noHyphen.length >= 2 && !candidates.includes(noHyphen)) {
      candidates.push(noHyphen);
    }

    // First word only (e.g., "Frieren: Beyond Journey's End" → "frieren")
    const firstWord = query
      .split(/[\s:!?\-–—]+/)[0]       // Split on space, colon, punctuation
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (firstWord && firstWord.length >= 2 && firstWord !== normalized && !candidates.includes(firstWord)) {
      candidates.push(firstWord);
    }

    return candidates;
  }

  /**
   * Search across all configured wikis
   *
   * @param query - Search query
   * @param options - Search options
   * @param options.wikiHint - Optional wiki key to search in (bypasses wiki discovery)
   */
  // eslint-disable-next-line complexity, max-statements -- Multi-wiki search orchestration: wiki discovery, dynamic wiki addition, searching multiple wikis, result aggregation
  override async search(
    query: string,
    options?: SearchOptions & { wikiHint?: string }
  ): Promise<SearchResult[]> {
    if (!query || query.trim().length === 0) {
      throw new SearchError('Query cannot be empty', 'INVALID_QUERY');
    }

    const results: SearchResult[] = [];
    const errors: Error[] = [];

    // Determine which wikis to search
    const queryLower = query.toLowerCase();
    const queryNormalized = query.toLowerCase().trim().replace(/\s+/g, '');

    // Dynamic wiki discovery: Try multiple subdomain candidates (full title, first word, etc.)
    const potentialSubdomains = this.queryToSubdomains(query);
    let dynamicWiki: string | null = null;

    serverLogger.warn('[FandomProvider] Wiki discovery for query', { query: query.substring(0, 50), queryNormalized: queryNormalized.substring(0, 50), candidates: potentialSubdomains });

    // Try each candidate subdomain
    for (const potentialSubdomain of potentialSubdomains) {
      // Check if this subdomain exists in our services or POPULAR_WIKIS
      const existingKey = Object.keys(POPULAR_WIKIS).find(key => {
        const config = POPULAR_WIKIS[key];
        const configNameNormalized = config?.name.toLowerCase().replace(/\s+/g, '') ?? '';
        const startsWithCheck = queryNormalized.startsWith(configNameNormalized);
        if (key === 'ascendance-of-a-bookworm') {
          serverLogger.warn('[FandomProvider] Checking ascendance wiki', { configNameNormalized, startsWithCheck, queryNormalizedStart: queryNormalized.substring(0, 30) });
        }
        const matches = config?.subdomain === potentialSubdomain ||
          key === potentialSubdomain ||
          configNameNormalized === queryNormalized ||
          // Also match if query starts with wiki name (e.g., "BanG Dream! Ave Mujica" starts with "BanG Dream")
          startsWithCheck ||
          // Or if normalized query contains the wiki key
          queryNormalized.includes(key);
        return matches;
      });

      if (existingKey) {
        dynamicWiki = existingKey;
        serverLogger.warn('[FandomProvider] Found wiki match', { query: query.substring(0, 50), wiki: existingKey, subdomain: potentialSubdomain });
        break;
      }
    }

    // If no existing wiki found, try adding the first candidate as dynamic wiki
    if (!dynamicWiki && potentialSubdomains.length > 0) {
      const firstCandidate = potentialSubdomains[0];
      if (firstCandidate && !this.services.has(firstCandidate)) {
        this.addWiki(firstCandidate, query);
        dynamicWiki = firstCandidate;
        this.log.debug('Added dynamic wiki for query', { query, subdomain: firstCandidate });
      } else if (firstCandidate) {
        dynamicWiki = firstCandidate;
      }
    }

    // If wikiHint is provided, use it directly (bypasses wiki discovery)
    // This is useful when we know the wiki from a previous match (e.g., from matchId)
    let wikisToSearch: string[];
    if (options && 'wikiHint' in options && typeof options.wikiHint === 'string') {
      const hintedWiki = options.wikiHint;
      serverLogger.warn('[FandomProvider] Using wiki hint', { wikiHint: hintedWiki, query: query.substring(0, 50) });

      // Ensure the wiki service exists
      const wikiConfig = POPULAR_WIKIS[hintedWiki];
      if (!this.services.has(hintedWiki) && wikiConfig) {
        this.addWiki(wikiConfig.subdomain, wikiConfig.name);
      }

      wikisToSearch = [hintedWiki];
    } else if (dynamicWiki) {
      // If we found a wiki specifically for this query, search ONLY that wiki
      // This prevents irrelevant results from other wikis (e.g., Naruto wiki returning results for "Dorohedoro")
      wikisToSearch = [dynamicWiki];
      this.log.debug('Searching only matched wiki', { query, wiki: dynamicWiki });
    } else {
      // No specific wiki found - search popular wikis that might have the series
      // Check if query matches a known wiki name
      const priorityWiki = this.activeWikis.find(wiki => {
        const wikiName = POPULAR_WIKIS[wiki]?.name.toLowerCase();
        return queryLower.includes(wiki) ||
          (wikiName !== undefined && queryLower.includes(wikiName));
      });

      if (priorityWiki) {
        wikisToSearch = [priorityWiki];
      } else {
        // Fallback: search top wikis but limit results
        const maxWikis = (options && typeof options === 'object' && 'maxWikis' in options && typeof options.maxWikis === 'number')
          ? options.maxWikis
          : 2;  // Reduced default to minimize irrelevant results
        wikisToSearch = this.activeWikis.slice(0, maxWikis);
      }
    }

    // Per-wiki timeout to prevent slow wikis from blocking results
    // FandomService makes sequential API calls (MediaWiki + v1), so needs 12s
    const WIKI_TIMEOUT_MS = 12000; // 12 seconds per wiki

    // Search each wiki in parallel with individual timeouts
    const searchPromises = wikisToSearch.map(async (wikiKey) => {
      let service = this.services.get(wikiKey);

      // Create service on-demand if it doesn't exist but is in POPULAR_WIKIS
      // This handles wikis added to POPULAR_WIKIS after FandomProvider was initialized
      if (!service && POPULAR_WIKIS[wikiKey]) {
        const wikiConfig = POPULAR_WIKIS[wikiKey];
        this.addWiki(wikiConfig.subdomain, wikiConfig.name);
        service = this.services.get(wikiConfig.subdomain) ?? this.services.get(wikiKey);
        this.log.debug('Created on-demand wiki service', { wikiKey, subdomain: wikiConfig.subdomain });
      }

      if (!service) return [];

      try {
        // For manga search provider, default to manga type unless explicitly set otherwise
        const searchType = (options && typeof options === 'object' && 'type' in options && typeof options.type === 'string')
          ? mapTypeFilter(options.type)
          : 'manga';

        const searchLimit = options?.limit ?? 5;

        // Search with multiple query variants to improve matching:
        // 1. Original query
        // 2. "{query} manga" for pages like "Fire Force (manga)"
        // 3. Subtitle after colon for pages like "Hannelore's Fifth Year at the Royal Academy"
        const searchQueries = [query];
        if (!query.toLowerCase().includes('manga')) {
          searchQueries.push(`${query} manga`);
        }

        // For colon-separated titles (e.g., "Ascendance of a Bookworm: Hannelore's Fifth Year"),
        // also search for just the subtitle since wiki pages often don't include the series prefix
        let subtitleQuery: string | null = null;
        if (query.includes(':')) {
          const subtitle = query.split(':').slice(1).join(':').trim();
          if (subtitle && subtitle.length > 5 && !searchQueries.includes(subtitle)) {
            searchQueries.push(subtitle);
            subtitleQuery = subtitle;
          }
        }

        serverLogger.warn('[FandomProvider] Search queries for wiki', { wikiKey, searchQueries, subtitleQuery });

        // Add per-wiki timeout
        const searchWithTimeout = Promise.race([
          Promise.all(searchQueries.map(q =>
            service.search(q, {
              // For subtitle queries, search without type filter since spin-off pages
              // may not be classified as 'manga' (e.g., "Hannelore's Fifth Year at the Royal Academy")
              type: (q === subtitleQuery) ? 'all' : searchType,
              limit: searchLimit,
              includeDetails: false  // Disable to avoid extra API calls causing timeouts
            })
          )),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Wiki ${wikiKey} search timeout`)), WIKI_TIMEOUT_MS);
          })
        ]);

        const allResults = await searchWithTimeout;
        serverLogger.warn('[FandomProvider] Raw search results', { wikiKey, totalResults: allResults.flat().length, resultsByQuery: allResults.map(r => r.length) });
        // Flatten and dedupe results by id
        const seenIds = new Set<string>();
        const dedupedResults = allResults.flat().filter(r => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return true;
        });

        serverLogger.warn('[FandomProvider] Deduped results', { wikiKey, dedupedCount: dedupedResults.length, firstTitle: dedupedResults[0]?.title });
        return transformResults(dedupedResults, wikiKey);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.log.warn('Wiki search failed or timed out', {
          wiki: wikiKey,
          query,
          errorMessage
        });
        errors.push(error as unknown as Error);
        return [] as SearchResult[];
      }
    });

    // Use allSettled to not block on slow/failed wikis
    const settledResults = await Promise.allSettled(searchPromises);
    const wikiResults = settledResults.map(result =>
      result.status === 'fulfilled' ? result.value : []
    );

    // Combine and sort results
    wikiResults.forEach((wikiResult: SearchResult[]) => {
      results.push(...wikiResult);
    });

    // Deduplicate across wikis by title — keeps the most metadata-rich result
    let finalResults = deduplicateByTitle(results);

    // If no results found and we didn't already search fallback wikis, try them
    const skipFallback = options && 'skipFallback' in options && options.skipFallback === true;
    if (finalResults.length === 0 && !skipFallback && this.fallbackWikis.length > 0) {
      this.log.info('Primary search returned no results, trying fallback wikis', {
        query,
        fallbackWikis: this.fallbackWikis
      });

      const fallbackResults = await this.searchFallbackWikis(query, options);
      if (fallbackResults.length > 0) {
        finalResults = fallbackResults;
        this.log.info('Fallback search found results', {
          query,
          resultsCount: fallbackResults.length
        });
      }
    }

    // Log search metrics
    this.log.info('Fandom search completed', {
      query,
      wikisSearched: wikisToSearch.length,
      totalResults: finalResults.length,
      errors: errors.length
    });

    return finalResults;
  }

  /**
   * Search fallback wikis (category wikis like webtoon, yaoi, manga, animanga)
   * Called when primary wiki search returns no results
   */
  private async searchFallbackWikis(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const WIKI_TIMEOUT_MS = 8000; // Shorter timeout for fallback searches

    // Search fallback wikis in parallel (limit to top 4 to avoid too many requests)
    const wikisToTry = this.fallbackWikis.slice(0, 4);

    const searchPromises = wikisToTry.map(async (wikiKey) => {
      const service = this.services.get(wikiKey);
      if (!service) return [];

      try {
        const searchLimit = options?.limit ?? 3;

        const searchWithTimeout = Promise.race([
          service.search(query, {
            type: 'all', // Search all types in fallback wikis
            limit: searchLimit,
            includeDetails: false
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Fallback wiki ${wikiKey} timeout`)), WIKI_TIMEOUT_MS);
          })
        ]);

        const wikiResults = await searchWithTimeout;
        return transformResults(wikiResults, wikiKey);
      } catch {
        // Silently ignore fallback wiki failures
        return [] as SearchResult[];
      }
    });

    const settledResults = await Promise.allSettled(searchPromises);
    settledResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        results.push(...result.value);
      }
    });

    // Deduplicate fallback results — same manga often appears across category wikis
    return deduplicateByTitle(results);
  }

  /**
   * Get detailed manga information
   */
  async getMangaDetails(
    identifier: string,
    wikiHint?: string
  ): Promise<SearchResult | null> {
    // Parse identifier (format: "wiki:title" or just "title")
    let wiki: string | undefined;
    let title: string;

    if (identifier.includes(':')) {
      const parts = identifier.split(':', 2);
      wiki = parts[0];
      title = parts[1] ?? identifier;
    } else if (this.services.has(identifier)) {
      // Identifier is a wiki key (e.g. "attackontitan") — use it as wiki, hint as title
      wiki = identifier;
      title = wikiHint ?? identifier;
    } else {
      title = identifier;
      wiki = wikiHint;
    }

    // Try to find the wiki service
    const service = wiki ? this.services.get(wiki) : null;

    if (!service && !wiki) {
      // Try searching across all wikis
      for (const [wikiKey, wikiService] of this.services) {
        // eslint-disable-next-line no-await-in-loop -- Early-return optimization: searches wikis sequentially and stops immediately when a match is found
        const mangaInfo = await wikiService.getMangaInfo(title);
        if (mangaInfo) {
          // eslint-disable-next-line no-await-in-loop -- Early-return optimization: searches wikis sequentially and stops immediately when a match is found
          return await transformMangaData(mangaInfo, wikiKey, this.services) as SearchResult;
        }
      }
      return null;
    }

    if (!service) {
      this.log.warn('Wiki not found', { wiki, title });
      return null;
    }

    const mangaInfo = await service.getMangaInfo(title);

    if (!mangaInfo) {
      return null;
    }

    // wiki is guaranteed to be defined here due to the checks above
    if (!wiki) {
      this.log.warn('Wiki not found after service lookup', { title });
      return null;
    }

    return await transformMangaData(mangaInfo, wiki, this.services) as SearchResult;
  }

  /**
   * Validate provider functionality
   */
  async validate(): Promise<boolean> {
    try {
      // Test search on one wiki
      const testWiki = this.activeWikis[0];
      if (!testWiki) {
        return false;
      }

      const service = this.services.get(testWiki);

      if (!service) {
        return false;
      }

      const results = await service.search('Naruto', { limit: 1 });
      return results.length > 0;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Validation failed', { errorMessage });
      return false;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    for (const service of this.services.values()) {
      service.destroy();
    }

    this.services.clear();
    this.activeWikis = [];
  }

  /**
   * Get available wikis
   */
  getAvailableWikis(): Array<{ key: string; name: string; subdomain: string }> {
    return this.activeWikis.map(key => {
      const config = POPULAR_WIKIS[key];
      return {
        key,
        name: config?.name ?? key,
        subdomain: config?.subdomain ?? key
      };
    });
  }

  /**
   * Get metadata for a specific manga
   */
  override async getMetadata(id: string, title?: string): Promise<SearchResult> {
    try {
      // When id is a wiki name (from binding), ensure the wiki service exists
      const wikiName = id.includes(':') ? id.split(':')[0] : id;
      if (wikiName && !this.services.has(wikiName)) {
        // Use POPULAR_WIKIS config if available for proper category configuration
        const knownConfig = POPULAR_WIKIS[wikiName];
        if (knownConfig) {
          const apiConfig = {
            cache: { enabled: true, ttl: 3600 },
            rateLimit: { requestsPerSecond: 2, burstLimit: 5 }
          };
          const service = new FandomService(knownConfig.subdomain, knownConfig, apiConfig);
          this.services.set(wikiName, service);
          this.activeWikis.push(wikiName);
          this.log.info('Initialized known wiki from binding', { wikiName });
        } else {
          this.addWiki(wikiName, title ?? wikiName);
        }
      }

      // Use getMangaDetails for rich metadata (description, author, cover, etc.)
      // instead of basic search which returns limited data (includeDetails: false)
      const detailed = await this.getMangaDetails(id, title);
      if (detailed) {
        return detailed;
      }

      // Fallback: basic search if getMangaDetails finds nothing
      const searchOptions = wikiName ? { limit: 1, wikiHint: wikiName } : { limit: 1 };
      const searchResults = await this.search(title ?? id, searchOptions);
      if (searchResults.length === 0) {
        throw new SearchError(`No metadata found for: ${title ?? id}`, 'NOT_FOUND', 'fandom');
      }
      const firstResult = searchResults[0];
      if (!firstResult) {
        throw new SearchError(`Invalid result returned for: ${title ?? id}`, 'INVALID_RESULT', 'fandom');
      }
      return firstResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Error fetching metadata:', errorMessage);
      throw new SearchError(`Failed to fetch metadata for: ${title ?? id}`, 'METADATA_ERROR', 'fandom');
    }
  }


}

// Export provider instance for convenience
export const fandomProvider = new FandomProvider();
