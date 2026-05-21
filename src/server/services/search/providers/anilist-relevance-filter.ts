/**
 * AniList Relevance Filter Module
 *
 * Filters search results by relevance to the search query.
 * Removes results with poor title matches and unrelated content.
 *
 * Extracted from: AniListProvider.ts (lines 240-288)
 */

import { logger } from '@/utils/logger';

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
   * Check if a result is relevant to the search
   */
  private static isRelevantResult(
    result: SearchResult,
    query: string,
    searchTerms: string[]
  ): boolean {
    const title = (result.title || '').toLowerCase();

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
    if (searchTerms.length === 1 && searchTerms[0] !== undefined && searchTerms[0].length <= 5 && matchRatio >= 0.5) {
      logger.debug(`✅ Short query match: "${result.title}" for short query "${query}"`);
      return true;
    }

    // Filter out poor matches
    logger.debug(`❌ Poor match: "${result.title}" only matches ${matchedTerms.length}/${searchTerms.length} terms (${Math.round(matchRatio * 100)}%)`);
    return false;
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