/**
 * Search Multi-Provider Router
 *
 * Handles search operations across all enabled providers.
 *
 * Procedures:
 * - allWithErrors: Multi-provider search + error tracking
 * - all: Multi-provider search (standard)
 *
 * Extracted from: search.ts (lines 409-579)
 */

import { z } from 'zod';

import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { SearchResult, SearchResponseWithErrors } from '@/types/search.types';
import { logger } from '@/utils/logging';


// Import from foundation utils
import {
  sortCriteriaSchema,
  sortOrderSchema,
  generateSearchCacheKey,
  extractSearchOptions,
  executeCachedSearch,
  handleSearchError,
} from './utils';

export const searchMultiProviderRouter = router({
  /**
   * Search across all enabled providers with error tracking
   *
   * @param {object} input - Search parameters
   * @param {string} input.query - Search query (min 3 chars)
   * @param {number} [input.limit] - Maximum results per provider (1-100)
   * @param {number} [input.offset] - Offset for pagination
   * @param {boolean} [input.includeAdult] - Include adult content
   * @param {string[]} [input.genres] - Filter by genres
   * @param {SortCriteria} [input.sortBy] - Sort field
   * @param {SortOrder} [input.sortOrder] - Sort direction
   * @returns {Promise<SearchResponseWithErrors>} Combined results + provider errors
   */
  allWithErrors: publicProcedure
    .input(z.object({
      query: z.string().min(3),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
      includeAdult: z.boolean().optional(),
      genres: z.array(z.string()).optional(),
      sortBy: sortCriteriaSchema.optional(),
      sortOrder: sortOrderSchema.optional()
    }))
    .query(async ({ input }): Promise<SearchResponseWithErrors> => {
      try {
        logger.info(`Search request across all providers with error tracking: "${input.query}"`);

        // Use deduplication helper (replaces 8 lines)
        // Cast input to satisfy SearchInput type (Zod already validated enums)
        const options = extractSearchOptions(input as Parameters<typeof extractSearchOptions>[0]);

        // Generate cache key
        const cacheKey = generateSearchCacheKey('all-errors', input.query, options);

        // Use cached search helper (replaces ~50 lines)
        const response = await executeCachedSearch({
          cacheKey,
          query: input.query,
          tags: ['search', 'multi-provider', 'with-errors', `query:${input.query}`],
          apiCall: async () => {
            // Search with all providers and track errors
            const response = await unifiedProviderRegistry.searchAllWithErrors(input.query, options);
            logger.info(`Search for "${input.query}" across all providers returned ${response.results.length} results, ${response.providerErrors?.length ?? 0} errors`);

            // Log provider errors for debugging
            if (response.providerErrors && response.providerErrors.length > 0) {
              response.providerErrors.forEach(err => {
                logger.warn(`Provider ${err.provider} failed:`, {
                  errorType: err.errorType,
                  message: err.error
                });
              });
            }

            return response;
          },
        });

        return response;
      } catch (error: unknown) {
        // Use deduplication helper (replaces 8 lines)
        handleSearchError(error, 'allWithErrors');
      }
    }),

  /**
   * Search across all enabled providers
   *
   * @param {object} input - Search parameters
   * @param {string} input.query - Search query (min 3 chars)
   * @param {number} [input.limit] - Maximum results per provider (1-100)
   * @param {number} [input.offset] - Offset for pagination
   * @param {boolean} [input.includeAdult] - Include adult content
   * @param {string[]} [input.genres] - Filter by genres
   * @param {SortCriteria} [input.sortBy] - Sort field
   * @param {SortOrder} [input.sortOrder] - Sort direction
   * @returns {Promise<SearchResult[]>} Combined search results
   */
  all: publicProcedure
    .input(z.object({
      query: z.string().min(3),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
      includeAdult: z.boolean().optional(),
      genres: z.array(z.string()).optional(),
      sortBy: sortCriteriaSchema.optional(),
      sortOrder: sortOrderSchema.optional()
    }))
    .query(async ({ input }): Promise<SearchResult[]> => {
      try {
        logger.info(`Search request across all providers: "${input.query}"`);

        // Use deduplication helper (replaces 8 lines)
        // Cast input to satisfy SearchInput type (Zod already validated enums)
        const options = extractSearchOptions(input as Parameters<typeof extractSearchOptions>[0]);

        // Generate cache key
        const cacheKey = generateSearchCacheKey('all', input.query, options);

        // Use cached search helper (replaces ~50 lines)
        const results = await executeCachedSearch({
          cacheKey,
          query: input.query,
          tags: ['search', 'multi-provider', `query:${input.query}`],
          apiCall: async () => {
            const results = await unifiedProviderRegistry.searchAll(input.query, options);
            logger.info(`Search for "${input.query}" across all providers returned ${results.length} results`);
            return results as SearchResult[];
          },
        });

        return results;
      } catch (error: unknown) {
        // Use deduplication helper (replaces 8 lines)
        handleSearchError(error, 'all');
      }
    }),
});
