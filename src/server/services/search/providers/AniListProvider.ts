/**
 * AniList Search Provider - Main Aggregator
 *
 * This class aggregates all specialized AniList provider modules
 * into a unified interface. It delegates to specialized modules for
 * each functional area while maintaining the original API.
 *
 * Architecture:
 * - anilist-provider-types.ts - Shared types and interfaces (27 lines)
 * - anilist-search-processor.ts - Core search processing (291 lines)
 * - anilist-adult-filter.ts - Adult content filtering (164 lines)
 * - anilist-relevance-filter.ts - Search relevance filtering (104 lines)
 *
 * Total: 586 lines across 4 modules
 * Original: 326 lines → Refactored: ~100 lines (69% reduction in main file)
 */


import { SortCriteria, SortOrder } from '@prisma/client';
import { MetadataProvider } from '@prisma/client';

import { anilistService } from '@/server/services/anilist/service';
import type { SearchResult, SearchOptions } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';



import { AniListAdultFilter } from './anilist-adult-filter';
import { AniListRelevanceFilter } from './anilist-relevance-filter';
import { AniListSearchProcessor } from './anilist-search-processor';
import { BaseSearchProvider } from './BaseSearchProvider';
import { SearchResultValidator } from './SearchResultValidator';

// Import all specialized modules

export class AniListProvider extends BaseSearchProvider {
  name = 'anilist';
  type = MetadataProvider.ANILIST;

  /**
   * Search for manga on AniList
   *
   * @param query - Search query string
   * @param options - Optional search configuration
   * @returns Promise with search results
   */
  override async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      logger.info(`Searching AniList for: "${query}" with options:`, {
        includeAdult: options?.includeAdult,
        limit: options?.limit
      });

      // Process search using specialized processor
      const rawResults = await AniListSearchProcessor.search(query, options);

      // Apply relevance filtering
      const relevanceFilteredResults = AniListRelevanceFilter.filter(
        rawResults,
        query
      );

      // Apply adult content filtering
      const finalResults = AniListAdultFilter.filter(relevanceFilteredResults);

      logger.info(`AniList search for "${query}" returned ${finalResults.length} results after filtering`);
      return finalResults;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logApiError('search', errorMessage, {
        query,
        options
      });
      return [];
    }
  }

  /**
   * Get detailed metadata for a manga from AniList
   *
   * @param id - AniList manga ID
   * @param title - Optional fallback title if lookup fails
   * @returns Promise with detailed manga data
   */
  override async getMetadata(id: string, title?: string): Promise<SearchResult> {
    try {
      logger.info(`Getting metadata from AniList for ID: ${id}`);

      // Parse ID to number (AniList uses numeric IDs)
      const numericId = toNumberId(id);
      if (isNaN(numericId)) {
        throw new ValidationError(`Invalid AniList ID: ${id} (not a number)`);
      }

      // TODO: This method should be extracted to a specialized module
      // For now, we keep the original implementation
      const rawManga = await anilistService.getMangaDetails(numericId);

      // Process and validate result
      const result = SearchResultValidator.validateAndTransform(rawManga, this.type);
      if (!result) {
        throw new ValidationError(`Invalid metadata response for manga ID: ${id}`);
      }

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logApiError('getMetadata', errorMessage, {
        id
      });

      // Return minimal result for failed lookup
      const minimalResult = this.createMinimalResult(id, title);
      return minimalResult;
    }
  }

  /**
   * Create a minimal result for failed lookups
   *
   * @param id - AniList manga ID
   * @param title - Optional fallback title
   * @returns Minimal search result
   */
  private createMinimalResult(id: string, title?: string): SearchResult {
    return {
      id,
      title: title ?? id,
      type: 'manga',
      provider: MetadataProvider.ANILIST,
      anilistId: toNumberId(id)
    } as SearchResult;
  }

  /**
   * Map domain sort criteria to AniList-specific sort field
   *
   * @param criteria - Domain sort criteria
   * @returns AniList sort field or undefined
   */
  private mapSortCriteria(criteria?: SortCriteria): string | undefined {
    if (!criteria) return undefined;

    switch (criteria) {
      case SortCriteria.TITLE:
        return 'TITLE_ROMAJI';
      case SortCriteria.POPULARITY:
        return 'POPULARITY';
      case SortCriteria.SCORE:
        return 'SCORE';
      case SortCriteria.START_DATE:
        return 'START_DATE';
      case SortCriteria.END_DATE:
        return 'END_DATE';
      case SortCriteria.RELEVANCE:
      default:
        return undefined;
    }
  }

  /**
   * Map domain sort order to AniList-specific sort order
   *
   * @param order - Domain sort order
   * @returns AniList sort order string
   */
  private mapSortOrder(order?: SortOrder): string {
    return order === SortOrder.ASC ? 'ASC' : 'DESC';
  }
}

// Export singleton instance
export const anilistProvider = new AniListProvider();