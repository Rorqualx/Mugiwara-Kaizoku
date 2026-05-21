/**
 * Search Core Router - Single Provider Search
 *
 * Handles search operations with specific providers.
 *
 * Procedures:
 * - withProviderWithErrors: Search with provider + error tracking
 * - withProvider: Search with provider (standard)
 *
 * Extracted from: search.ts (lines 112-400)
 * Refactored: Debug logging extracted to debug-loggers.ts
 */

import { z } from 'zod';

import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logging';

import {
  sortCriteriaSchema,
  sortOrderSchema,
  generateSearchCacheKey,
  extractSearchOptions,
  executeCachedSearch,
  handleSearchError,
} from '../utils';

import { logProviderResults } from './debug-loggers';

import type {
  SearchResult,
  ProviderErrorInfo,
  SearchResponseWithErrors,
  MangaSearchResult,
} from './types';

export const searchCoreRouter = router({
  /**
   * Search with a specific provider (with error tracking)
   *
   * @param {object} input - Search parameters
   * @param {string} input.provider - Provider type or ID
   * @param {string} input.query - Search query (min 3 chars)
   * @param {number} [input.limit] - Results limit (1-100)
   * @param {number} [input.offset] - Pagination offset
   * @param {boolean} [input.includeAdult] - Include adult content
   * @param {string[]} [input.genres] - Genre filters
   * @param {string} [input.sortBy] - Sort criteria
   * @param {string} [input.sortOrder] - Sort order
   * @returns {Promise<SearchResponseWithErrors>} Results with error tracking
   */
  withProviderWithErrors: publicProcedure
    .input(z.object({
      provider: z.string(),
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
        logger.info(`Search request with provider ${input.provider} (with error tracking): "${input.query}"`);

        const options = extractSearchOptions(input);
        const cacheKey = generateSearchCacheKey(`${input.provider}-errors`, input.query, options);

        const response = await executeCachedSearch<SearchResponseWithErrors>({
          cacheKey,
          query: input.query,
          tags: ['search', 'with-errors', `provider:${input.provider}`, `query:${input.query}`],
          apiCall: async () => {
            try {
              const results = await unifiedProviderRegistry.searchWithProvider(
                input.provider,
                input.query,
                options
              );
              logger.info(`Search for "${input.query}" with provider ${input.provider} returned ${results.length} results`);
              return { results: results as MangaSearchResult[] };
            } catch (providerError) {
              const errorMessage = providerError instanceof Error ? providerError.message : String(providerError);
              const errorType = determineErrorType(errorMessage);
              logger.error(`Provider ${input.provider} search failed:`, errorMessage);
              return {
                results: [],
                providerErrors: [{
                  provider: input.provider,
                  error: errorMessage,
                  errorType,
                  timestamp: Date.now()
                } as ProviderErrorInfo]
              };
            }
          },
        });

        return response;
      } catch (error: unknown) {
        handleSearchError(error, 'withProviderWithErrors');
      }
    }),

  /**
   * Search with a specific provider
   *
   * @param {object} input - Search parameters
   * @param {string} input.provider - Provider type or ID
   * @param {string} input.query - Search query (min 3 chars)
   * @param {number} [input.limit] - Results limit (1-100)
   * @param {number} [input.offset] - Pagination offset
   * @param {boolean} [input.includeAdult] - Include adult content
   * @param {string[]} [input.genres] - Genre filters
   * @param {string} [input.sortBy] - Sort criteria
   * @param {string} [input.sortOrder] - Sort order
   * @returns {Promise<SearchResult[]>} Search results
   */
  withProvider: publicProcedure
    .input(z.object({
      provider: z.string(),
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
        logger.info(`Search request with provider ${input.provider}: "${input.query}" (includeAdult: ${input.includeAdult})`);

        const options = extractSearchOptions(input);
        logger.info(`SearchOptions being passed: includeAdult=${options.includeAdult}`);

        const cacheKey = generateSearchCacheKey(input.provider, input.query, options);

        const results = await executeCachedSearch<SearchResult[]>({
          cacheKey,
          query: input.query,
          tags: ['search', `provider:${input.provider}`, `query:${input.query}`],
          apiCall: async (): Promise<SearchResult[]> => {
            const results = await unifiedProviderRegistry.searchWithProvider(
              input.provider,
              input.query,
              options
            );
            logger.info(`Search for "${input.query}" with provider ${input.provider} returned ${results.length} results`);

            // Debug logging for provider-specific results
            logProviderResults(input.provider, results as SearchResult[]);

            return results as SearchResult[];
          },
        });

        return results;
      } catch (error: unknown) {
        handleSearchError(error, 'withProvider');
      }
    }),
});

/**
 * Determine error type from error message
 *
 * @param errorMessage - Error message string
 * @returns Error type classification
 */
function determineErrorType(errorMessage: string): string {
  const lowerMessage = errorMessage.toLowerCase();

  if (lowerMessage.includes('api has been temporarily disabled')) {
    return 'api_down';
  }
  if (lowerMessage.includes('rate limit')) {
    return 'rate_limit';
  }
  if (lowerMessage.includes('network')) {
    return 'network';
  }
  if (lowerMessage.includes('unauthorized')) {
    return 'auth';
  }
  return 'unknown';
}
