/**
 * AniList Relevance Filter Module
 *
 * Filters search results by relevance to the search query.
 * Removes results with poor title matches and unrelated content.
 *
 * Extracted from: AniListProvider.ts (lines 240-288)
 */

import { logger } from '@/utils/logger';

import { collectTitleVariants, foldDiacritics, titleMatchesQuery } from './title-match-utils';

import type { SearchResult } from './anilist-provider-types';

// ============================================================================
// Search Relevance Filter
// ============================================================================

export class AniListRelevanceFilter {
  /**
   * Filter search results by relevance to the search query
   * Removes results with poor title matches and unrelated content
   */
  static filter(results: SearchResult[], query: string): SearchResult[] {
    if (!query || results.length === 0) {
      return results;
    }

    const searchTerms = this.extractSearchTerms(query);
    if (searchTerms.length === 0) {
      return results;
    }

    logger.debug(`Applying relevance filtering for query: "${query}" with terms: [${searchTerms.join(', ')}]`);

    return results.filter(result => {
      return this.isRelevantResult(result, query, searchTerms);
    });
  }

  /**
   * Extract search terms from query
   */
  private static extractSearchTerms(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  }

  /**
   * Check if a result is relevant to the search.
   * Checks the picked title AND every alternativeTitles variant the validator
   * exposed, with diacritic folding so romaji/diacritic differences don't
   * silently drop the right manga.
   */
  private static isRelevantResult(
    result: SearchResult,
    query: string,
    searchTerms: string[]
  ): boolean {
    const queryFolded = foldDiacritics(query.toLowerCase());
    const foldedSearchTerms = searchTerms.map(foldDiacritics);
    const variants = collectTitleVariants(result);
    const matched = variants.some((c) => titleMatchesQuery(c, queryFolded, foldedSearchTerms, result.title, query));
    if (!matched) {
      logger.debug(`❌ Poor match: "${result.title}" across ${variants.length} variants for query "${query}"`);
    }
    return matched;
  }

  /**
   * Calculate match ratio between title and search terms
   */
  private static calculateMatchRatio(title: string, searchTerms: string[]): number {
    const matchedTerms = searchTerms.filter(term => title.includes(term));
    return matchedTerms.length / searchTerms.length;
  }

  /**
   * Check if query is considered short (single term <= 5 chars)
   */
  private static isShortQuery(searchTerms: string[]): boolean {
    return searchTerms.length === 1 && searchTerms[0] !== undefined && searchTerms[0].length <= 5;
  }
}