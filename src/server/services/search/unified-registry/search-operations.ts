/**
 * Search Operations Module
 *
 * Handles search functionality across providers with validation and error tracking.
 * Includes validation using SearchResultValidator.
 *
 * Extracted from: UnifiedProviderRegistry.ts (lines 439-627)
 */


import { MetadataProvider } from '@prisma/client';

import type {
  ProviderErrorInfo,
  SearchResponseWithErrors,
  MangaSearchResult
} from '@/types/search.types';
import { logger } from '@/utils/logger';


import { SearchResultValidator } from '../providers/SearchResultValidator';

import { detectErrorType, isFandomProvider } from './registry-utils';

import type { SearchProvider, SearchResult, SearchOptions } from '../types';
import type { ProviderState } from './registry-types';


const log = logger.child('SearchOperations');

/**
 * Search with a specific provider
 * Applies validation based on provider type
 *
 * @param provider - The search provider instance
 * @param providerStates - Map of provider states for tracking
 * @param providerType - The provider type identifier
 * @param query - Search query string
 * @param options - Optional search options
 * @returns Array of validated search results
 */
export async function searchWithProvider(
  provider: SearchProvider,
  providerStates: Map<string, ProviderState>,
  providerType: string,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  try {
    log.info('Searching with provider', {
      provider: provider.name,
      query,
      options
    });

    // Perform search
    let results = await provider.search(query, options);

    // Apply validation for specific providers
    const providerWithType = provider as SearchProvider & { type?: string };
    const actualProviderType = providerWithType.type ?? provider.name;

    // Always validate Fandom results
    if (isFandomProvider(actualProviderType)) {
      log.debug('Applying Fandom validation', { count: results.length });
      results = SearchResultValidator.processResults(results, MetadataProvider.FANDOM) as SearchResult[];
    }
    // Validate other providers as needed
    else if (actualProviderType.toLowerCase() === 'anilist') {
      results = SearchResultValidator.processResults(results, MetadataProvider.ANILIST) as SearchResult[];
    }
    else if (actualProviderType.toLowerCase() === 'comicvine') {
      results = SearchResultValidator.processResults(results, MetadataProvider.COMICVINE) as SearchResult[];
    }
    else if (actualProviderType.toLowerCase() === 'wikipedia') {
      results = SearchResultValidator.processResults(results, MetadataProvider.WIKIPEDIA) as SearchResult[];
    }

    // Update provider state on success
    const state = providerStates.get(providerType);
    if (state) {
      state.lastSuccess = new Date();
      delete state.lastError;
    }

    log.info('Search completed', {
      provider: provider.name,
      query,
      resultCount: results.length
    });

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Search failed', { provider: providerType, query, error: errorMessage });

    // Update provider state on error
    const state = providerStates.get(providerType);
    if (state) {
      state.lastError = error as Error;
    }

    throw error;
  }
}

/**
 * Search across all enabled providers with error tracking
 * Returns results and provider error information
 *
 * @param providers - Map of available providers
 * @param providerStates - Map of provider states
 * @param searchWithProviderFn - Function to search with a specific provider
 * @param query - Search query string
 * @param options - Optional search options
 * @returns Search results with error information
 */
export async function searchAllWithErrors(
  providers: Map<string, SearchProvider>,
  providerStates: Map<string, ProviderState>,
  searchWithProviderFn: (type: string, query: string, options?: SearchOptions) => Promise<SearchResult[]>,
  query: string,
  options?: SearchOptions
): Promise<SearchResponseWithErrors> {
  // Get all enabled providers sorted by priority
  const enabledProviders = Array.from(providerStates.entries())
    .filter(([_, state]) => state.enabled)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([type]) => type);

  if (enabledProviders.length === 0) {
    log.warn('No enabled providers for search');
    return { results: [], providerErrors: [] };
  }

  const providerErrors: ProviderErrorInfo[] = [];
  const allResults: SearchResult[] = [];

  // Search with all providers in parallel
  const searchPromises = enabledProviders.map(async (providerType) => {
    try {
      const results = await searchWithProviderFn(providerType, query, options);
      return results.map(result => ({
        ...result,
        provider: providerType as MetadataProvider
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = detectErrorType(error);

      log.error('Provider search failed', {
        provider: providerType,
        error: errorMessage,
        errorType
      });

      // Track the error
      providerErrors.push({
        provider: providerType,
        error: errorMessage,
        errorType,
        timestamp: Date.now()
      } as ProviderErrorInfo);

      return [];
    }
  });

  const resultsArrays = await Promise.all(searchPromises);
  resultsArrays.forEach(results => allResults.push(...results));

  return {
    results: allResults as MangaSearchResult[],
    ...(providerErrors.length > 0 && { providerErrors })
  };
}

/**
 * Search across all enabled providers
 * Returns combined results without error tracking
 *
 * @param providerStates - Map of provider states
 * @param searchWithProviderFn - Function to search with a specific provider
 * @param query - Search query string
 * @param options - Optional search options
 * @returns Combined search results from all providers
 */
export async function searchAll(
  providerStates: Map<string, ProviderState>,
  searchWithProviderFn: (type: string, query: string, options?: SearchOptions) => Promise<SearchResult[]>,
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  // Get all enabled providers sorted by priority
  const enabledProviders = Array.from(providerStates.entries())
    .filter(([_, state]) => state.enabled)
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([type]) => type);

  if (enabledProviders.length === 0) {
    log.warn('No enabled providers for search');
    return [];
  }

  // Search with all providers in parallel
  const searchPromises = enabledProviders.map(async (providerType) => {
    try {
      const results = await searchWithProviderFn(providerType, query, options);
      return results.map(result => ({
        ...result,
        provider: providerType as MetadataProvider
      }));
    } catch (error) {
      log.error('Provider search failed', {
        provider: providerType,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  });

  const resultsArrays = await Promise.all(searchPromises);
  return resultsArrays.flat();
}

/**
 * Get metadata for a specific item
 * Uses provider's getMetadata if available, otherwise returns minimal result
 *
 * @param provider - The search provider instance
 * @param providerType - The provider type identifier
 * @param id - The item ID to retrieve
 * @param title - Optional title for fallback result
 * @returns Detailed metadata or minimal result
 */
export async function getMetadata(
  provider: SearchProvider,
  providerType: string,
  id: string,
  title?: string
): Promise<SearchResult> {
  // All providers must implement getMetadata per SearchProvider interface
  return provider.getMetadata(id, title);
}
