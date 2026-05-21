/**
 * Provider Registry Search Operations
 *
 * Search operations across metadata providers.
 * Provides parallel search across all enabled providers and targeted searches.
 *
 * Extracted from: registry.ts (lines 245-320)
 */

import type { SearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { ProviderStrategy } from './types';
import type { MetadataProvider } from '@prisma/client';

// ============================================================================
// Search Operations
// ============================================================================

/**
 * Search across all enabled providers
 *
 * Executes search in parallel across all enabled providers and aggregates results.
 * Tracks performance and handles errors gracefully.
 *
 * @param getEnabledProviders - Function to get enabled provider instances
 * @param performanceTracking - Whether to track and log performance metrics
 * @param query - Search query string
 * @param options - Optional search parameters
 * @returns Aggregated search results from all providers
 */
export async function searchAll(
  getEnabledProviders: () => Promise<ProviderStrategy[]>,
  performanceTracking: boolean,
  query: string,
  options?: unknown
): Promise<AsyncResult<SearchResult[], Error>> {
  const startTime = Date.now();
  const enabledProviders = await getEnabledProviders();

  if (enabledProviders.length === 0) {
    return createErrorResult(new Error('No enabled providers available'));
  }

  const results: SearchResult[] = [];
  const errors: Error[] = [];

  // Search with all providers in parallel
  const searchPromises = enabledProviders.map(async provider => {
    try {
      const result = await provider.search(query, options);
      if (isSuccess(result)) {
        return result.data;
      } else if (isError(result)) {
        errors.push(result.error);
      }
      return [];
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  });

  const providerResults = await Promise.all(searchPromises);
  providerResults.forEach(providerResult => {
    results.push(...providerResult);
  });

  // Track performance
  if (performanceTracking) {
    const duration = Date.now() - startTime;
    logger.debug(`Search completed in ${duration}ms across ${enabledProviders.length} providers`);
  }

  if (results.length > 0) {
    return createSuccessResult(results);
  } else if (errors.length > 0) {
    return createErrorResult(
      new Error(`Search failed: ${errors.map(e => e.message).join(', ')}`)
    );
  } else {
    return createSuccessResult([]);
  }
}

/**
 * Search with a specific provider
 *
 * Executes search using a single specified provider.
 * Validates that the provider exists and is enabled before searching.
 *
 * @param initialize - Function to ensure providers are initialized
 * @param getProvider - Function to get a specific provider instance
 * @param type - Provider type to use for search
 * @param query - Search query string
 * @param options - Optional search parameters
 * @returns Search results from the specified provider
 */
export async function searchWithProvider(
  initialize: () => Promise<void>,
  getProvider: (type: MetadataProvider) => ProviderStrategy | undefined,
  type: MetadataProvider,
  query: string,
  options?: unknown
): Promise<AsyncResult<SearchResult[], Error>> {
  // Ensure providers are initialized
  await initialize();

  const provider = getProvider(type);

  if (!provider) {
    return createErrorResult(new Error(`Provider ${type} not found`));
  }

  const enabled = await provider.isEnabled();
  if (!enabled) {
    return createErrorResult(new Error(`Provider ${type} is disabled`));
  }

  return provider.search(query, options);
}
