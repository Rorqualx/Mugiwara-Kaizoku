/**
 * Conditional Queries for AniList API - Main Aggregator
 *
 * This module provides pre-built queries with conditional field inclusion
 * using GraphQL @include/@skip directives for optimal performance.
 *
 * Architecture:
 * - fragment-constants.ts - GraphQL field constant templates (~340 lines)
 * - fragment-builders.ts - Functions that compose fragments (~160 lines)
 * - search-query.ts - Basic search query (~190 lines)
 * - details-query.ts - Single-item details query (~200 lines)
 * - advanced-search-query.ts - Full filter search query (~190 lines)
 * - discovery-queries.ts - Trending + seasonal queries (~220 lines)
 *
 * Original: conditionalQueries.ts (852 lines)
 * Refactored: 6 modules + index (all under 500 lines)
 *
 * @module conditional-queries
 */

import { ValidationError } from '@/utils/errors';

import { DetailLevel, getFieldGroupsForLevel } from '../fieldInclusion';

// Re-export all query builders
export { buildConditionalSearchQuery } from './search-query';
export { buildConditionalDetailsQuery } from './details-query';
export { buildConditionalAdvancedSearchQuery } from './advanced-search-query';
export {
  buildConditionalTrendingQuery,
  buildConditionalSeasonalQuery,
} from './discovery-queries';

// Re-export fragment builders for advanced usage
export {
  buildSearchMediaFragment,
  buildDetailsMediaFragment,
  buildAdvancedSearchMediaFragment,
} from './fragment-builders';

// Re-export base field constants
export {
  BASE_MEDIA_FIELDS,
  BASE_MEDIA_FIELDS_DETAILS,
} from './fragment-constants';

// Import query builders for the selector
import { buildConditionalAdvancedSearchQuery } from './advanced-search-query';
import { buildConditionalDetailsQuery } from './details-query';
import {
  buildConditionalTrendingQuery,
  buildConditionalSeasonalQuery,
} from './discovery-queries';
import { buildConditionalSearchQuery } from './search-query';

/**
 * Query selector for different use cases
 *
 * Provides a unified interface for selecting the appropriate query
 * based on use case and generating variables for detail levels.
 *
 * @example
 * ```typescript
 * // Get query for use case
 * const query = ConditionalQuerySelector.getQuery('search');
 *
 * // Get variables with detail level
 * const variables = ConditionalQuerySelector.getVariablesForDetailLevel(
 *   DetailLevel.STANDARD,
 *   { search: "One Piece", page: 1 }
 * );
 *
 * const result = await client.query(query, variables);
 * ```
 */
export class ConditionalQuerySelector {
  /**
   * Get appropriate query for use case
   *
   * @param useCase - The query use case
   * @returns GraphQL query string
   * @throws {ValidationError} If use case is unknown
   */
  static getQuery(useCase: 'search' | 'details' | 'trending' | 'seasonal' | 'advanced'): string {
    switch (useCase) {
      case 'search':
        return buildConditionalSearchQuery();
      case 'details':
        return buildConditionalDetailsQuery();
      case 'trending':
        return buildConditionalTrendingQuery();
      case 'seasonal':
        return buildConditionalSeasonalQuery();
      case 'advanced':
        return buildConditionalAdvancedSearchQuery();
      default:
        throw new ValidationError(`Unknown use case: ${useCase as string}`);
    }
  }

  /**
   * Get variables for a detail level
   *
   * @param level - Detail level (MINIMAL, STANDARD, FULL, etc.)
   * @param baseVariables - Base variables to include
   * @returns Variables object with all include flags set
   */
  static getVariablesForDetailLevel(
    level: DetailLevel,
    baseVariables: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const fields = getFieldGroupsForLevel(level);
    return {
      ...baseVariables,
      includeBasic: fields.basic,
      includeDates: fields.dates,
      includeScores: fields.scores,
      includeStats: fields.stats,
      includeMedia: fields.media,
      includeRelations: fields.relations,
      includeRecommendations: fields.recommendations,
      includeCharacters: fields.characters,
      includeStaff: fields.staff,
      includeStudios: fields.studios,
      includeExternal: fields.external,
      includeTrending: fields.trending,
      includeTags: fields.tags,
      includeStreaming: fields.streaming,
    };
  }

  /**
   * Get minimal variables for performance
   *
   * @param baseVariables - Base variables to include
   * @returns Variables with minimal field inclusion
   */
  static getMinimalVariables(baseVariables: Record<string, unknown> = {}): Record<string, unknown> {
    return this.getVariablesForDetailLevel(DetailLevel.MINIMAL, baseVariables);
  }

  /**
   * Get full variables for complete data
   *
   * @param baseVariables - Base variables to include
   * @returns Variables with all fields included
   */
  static getFullVariables(baseVariables: Record<string, unknown> = {}): Record<string, unknown> {
    return this.getVariablesForDetailLevel(DetailLevel.FULL, baseVariables);
  }
}
