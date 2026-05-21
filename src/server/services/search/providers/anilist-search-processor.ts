/**
 * AniList Search Processor Module
 *
 * Handles core search logic for AniList provider.
 * Extracted from AniListProvider.search() method to reduce complexity.
 *
 * Extracted from: AniListProvider.ts (lines 31-183)
 */

import { anilistConfigService } from '@/server/services/anilist/configService';
import { anilistService } from '@/server/services/anilist/service';
import { logger } from '@/utils/logger';
import { isAniListMedia } from '@/utils/type-guards/adapters/anilist-guards';

import { AniListFormatFilter } from './anilist-format-filter';
import { MetadataProvider } from './anilist-provider-types';
import { SearchResultValidator } from './SearchResultValidator';

import type { FormatFilterConfig } from './anilist-format-filter';
import type { SearchResult, SearchOptions } from './anilist-provider-types';

// ============================================================================
// AniList Search Processor
// ============================================================================

export class AniListSearchProcessor {
  /**
   * Execute search with all processing steps
   */
  static async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    try {
      // Step 1: Prepare search configuration
      const config = await this.prepareSearchConfig(options);

      // Step 2: Execute API search
      const rawResults = await this.executeApiSearch(query, config);

      // Step 3: Process and validate results
      let results = this.processResults(rawResults);

      // Step 4: Apply relevance filtering
      results = this.applyRelevanceFiltering(results, query);

      // Step 5: Apply adult content filtering if needed
      if (config.shouldFilterLocally) {
        results = this.filterAdultContent(results);
      }

      // Step 6: Apply format filtering (webtoons, Korean manhwa) if enabled
      if (config.formatFilterConfig.filterWebtoons || config.formatFilterConfig.filterKoreanManhwa) {
        results = AniListFormatFilter.filter(results, config.formatFilterConfig);
      }

      logger.info(`AniList search for "${query}" returned ${results.length} results after filtering`);
      return results;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('AniList search failed', { error: errorMessage, query, options });
      return [];
    }
  }

  /**
   * Prepare search configuration from options
   */
  private static async prepareSearchConfig(options?: SearchOptions): Promise<{
    limit: number;
    shouldFilterLocally: boolean;
    formatFilterConfig: FormatFilterConfig;
  }> {
    const limit = options?.limit ?? 20;

    const config = await anilistConfigService.loadConfig();
    const filterAdultContent = config.filterAdultContent;

    // Determine if we should apply local filtering
    const shouldFilterLocally = options?.includeAdult === true ? false : filterAdultContent;

    // Prepare format filter config (experimental filters)
    const formatFilterConfig: FormatFilterConfig = {
      filterWebtoons: config.filterWebtoons,
      filterKoreanManhwa: config.filterKoreanManhwa
    };

    logger.info(`AniList provider: config.filterAdultContent=${config.filterAdultContent}, default=${filterAdultContent}, includeAdult=${options?.includeAdult}, will filter locally: ${shouldFilterLocally}`);
    logger.debug(`AniList provider: format filters - webtoons: ${formatFilterConfig.filterWebtoons}, koreanManhwa: ${formatFilterConfig.filterKoreanManhwa}`);

    return { limit, shouldFilterLocally, formatFilterConfig };
  }

  /**
   * Execute API search with AniList service
   */
  private static async executeApiSearch(
    query: string,
    config: { limit: number; shouldFilterLocally: boolean }
  ): Promise<unknown[]> {
    logger.info(`Searching AniList for: "${query}"`, {
      limit: config.limit,
      filterAdultContent: config.shouldFilterLocally
    });

    const rawResults = await anilistService.searchManga(query, {
      limit: config.limit,
      includeDescription: true,
      filterAdultContent: config.shouldFilterLocally
    });

    // Debug logging
    this.logRawResults(rawResults);

    return Array.isArray(rawResults) ? rawResults : [];
  }

  /**
   * Process and validate raw results
   */
  private static processResults(rawResults: unknown[]): SearchResult[] {
    const resultsArray = Array.isArray(rawResults) ? rawResults : [];
    const results = SearchResultValidator.processResults(resultsArray, MetadataProvider.ANILIST);

    // Debug logging
    this.logProcessedResults(results);

    return results;
  }

  /**
   * Apply relevance filtering to remove unrelated results
   */
  private static applyRelevanceFiltering(
    results: SearchResult[],
    query: string
  ): SearchResult[] {
    if (!query || results.length === 0) {
      return results;
    }

    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    if (searchTerms.length === 0) {
      return results;
    }

    logger.debug(`Applying relevance filtering for query: "${query}" with terms: [${searchTerms.join(', ')}]`);

    return results.filter(result => {
      const title = result.title.toLowerCase();

      // Check for exact or very close matches
      const exactMatch = title.includes(query.toLowerCase());
      if (exactMatch) {
        logger.debug(`✅ Exact match: "${result.title}" for query "${query}"`);
        return true;
      }

      // Check for partial matches with all search terms
      const hasAllTerms = searchTerms.every(term => title.includes(term));
      if (hasAllTerms) {
        logger.debug(`✅ Good match: "${result.title}" contains all search terms`);
        return true;
      }

      // Check for partial matches with most search terms (at least 50%)
      const matchedTerms = searchTerms.filter(term => title.includes(term));
      const matchRatio = matchedTerms.length / searchTerms.length;

      if (matchRatio >= 0.5) {
        logger.debug(`✅ Partial match: "${result.title}" matches ${matchedTerms.length}/${searchTerms.length} terms (${Math.round(matchRatio * 100)}%)`);
        return true;
      }

      // Check for very short queries where partial matches are acceptable
      if (searchTerms.length === 1 && searchTerms[0] && searchTerms[0].length <= 5 && matchRatio >= 0.5) {
        logger.debug(`✅ Short query match: "${result.title}" for short query "${query}"`);
        return true;
      }

      // Filter out poor matches
      logger.debug(`❌ Poor match: "${result.title}" only matches ${matchedTerms.length}/${searchTerms.length} terms (${Math.round(matchRatio * 100)}%)`);
      return false;
    });
  }

  /**
   * Filter adult content from results
   */
  private static filterAdultContent(results: SearchResult[]): SearchResult[] {
    logger.debug(`Should filter locally: true, results count before filtering: ${results.length}`);

    const beforeCount = results.length;
    const filteredResults = results.filter(result => {
      // Check for adult genres
      const genres = result.genres ?? [];

      // Debug logging to see what genres we're working with
      if (genres.length > 0) {
        logger.debug(`Checking genres for "${result.title}": ${genres.join(', ')}`);
      }

      const hasAdultGenre = genres.some((genre: string) => {
        const lowerGenre = genre.toLowerCase();
        const isAdult = (
          lowerGenre === 'hentai' ||
          lowerGenre === 'adult' ||
          lowerGenre.includes('hentai') ||
          lowerGenre.includes('adult') ||
          lowerGenre.includes('erotic') ||
          lowerGenre.includes('sexual')
        );

        if (isAdult) {
          logger.debug(`Found adult genre "${genre}" in "${result.title}"`);
        }

        return isAdult;
      });

      // Check for adult tags if available
      const resultWithTags = result as SearchResult & { tags?: string[]; metadata?: Record<string, unknown> };
      const tags = resultWithTags.tags ?? [];

      // Debug logging for tags
      if (tags.length > 0) {
        logger.debug(`Checking tags for "${result.title}": ${tags.join(', ')}`);
      }

      const hasAdultTag = tags.some((tag: string) => {
        const lowerTag = tag.toLowerCase();
        const isAdultTag = (
          lowerTag.includes('hentai') ||
          lowerTag.includes('adult content') ||
          lowerTag.includes('sexual content') ||
          lowerTag.includes('erotic') ||
          lowerTag.includes('explicit') ||
          lowerTag.includes('mature') ||
          lowerTag.includes('nsfw') ||
          (lowerTag.includes('adult') && !lowerTag.includes('primarily adult cast')) || // Exclude "primarily adult cast"
          lowerTag.includes('sexual')
        );

        if (isAdultTag) {
          logger.debug(`Found adult tag "${tag}" in "${result.title}"`);
        }

        return isAdultTag;
      });

      // Check if marked as adult in metadata
      const metadata = resultWithTags.metadata;
      const isAdult = metadata && typeof metadata === 'object' && 'isAdult' in metadata && metadata['isAdult'] === true;

      if (isAdult) {
        logger.debug(`Found isAdult=true in metadata for "${result.title}"`);
      }

      // Filter out if any adult indicator is found
      const shouldFilter = hasAdultGenre || hasAdultTag || isAdult;

      if (shouldFilter) {
        logger.info(`Filtering out adult content: "${result.title}" (genres: ${genres.join(', ')}, tags: ${tags.join(', ')})`);
      } else {
        logger.debug(`No adult content detected in "${result.title}" - genres: ${genres.join(', ')}, tags: ${tags.join(', ')}, isAdult: ${isAdult}`);
      }

      return !shouldFilter;
    });

    if (beforeCount !== filteredResults.length) {
      logger.info(`Filtered ${beforeCount - filteredResults.length} adult results. Remaining: ${filteredResults.length}`);
    }

    return filteredResults;
  }

  /**
   * Log raw results structure for debugging
   */
  private static logRawResults(rawResults: unknown): void {
    logger.debug(`AniList raw results count: ${Array.isArray(rawResults) ? rawResults.length : 'not array'}`);
    if (Array.isArray(rawResults) && rawResults.length > 0 && rawResults[0]) {
      const firstResult: unknown = rawResults[0];
      if (isAniListMedia(firstResult)) {
        // Now firstResult is typed as AniListMedia within this block
        logger.debug(`First raw result structure:`, {
          id: firstResult.id,
          title: firstResult.title,
          genres: firstResult.genres,
          isAdult: firstResult.isAdult,
          tags: firstResult.tags
        });
      } else {
        logger.debug(`First raw result is not a valid AniListMedia object`);
      }
    }
  }

  /**
   * Log processed results structure for debugging
   */
  private static logProcessedResults(results: SearchResult[]): void {
    logger.debug(`Processed results count: ${results.length}`);
    if (results.length > 0 && results[0]) {
      const firstResult = results[0];
      logger.debug(`First processed result structure:`, {
        id: firstResult.id,
        title: firstResult.title,
        genres: firstResult.genres,
        metadata: firstResult.metadata,
        tags: firstResult.tags
      });
    }
  }
}