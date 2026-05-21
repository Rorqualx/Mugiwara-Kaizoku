/**
 * Helper functions for Domain Search Hook
 */

import type { SearchResult } from '@/types/search.types';
import { isError, isLoading as isLoadingResult, isSuccess, unwrapOr } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import type { SearchState, ProviderSearchState } from './types';

/**
 * Check if all searches are completed for selected providers
 */
export function computeSearchCompleted(
  providerStates: Record<string, ProviderSearchState>,
  selectedProviders: string[]
): boolean {
  return selectedProviders.every((providerId) => {
    const providerState = providerStates[providerId];
    return providerState?.searchCompleted ?? false;
  });
}

/**
 * Check if any provider is loading
 */
export function computeIsLoading(
  providerStates: Record<string, ProviderSearchState>
): boolean {
  return Object.values(providerStates).some(
    (providerState) => isLoadingResult(providerState.results)
  );
}

/**
 * Extract all provider results as AsyncResult map
 */
export function computeProviderResults(
  providerStates: Record<string, ProviderSearchState>
): Record<string, AsyncResult<SearchResult[], Error>> {
  return Object.entries(providerStates).reduce((acc, [providerId, providerState]) => ({
    ...acc,
    [providerId]: providerState.results
  }), {} as Record<string, AsyncResult<SearchResult[], Error>>);
}

/**
 * Get all successful results from providers
 */
export function computeResults(
  providerStates: Record<string, ProviderSearchState>,
  selectedProviders: string[]
): SearchResult[] {
  // Filter by selected providers and combine results
  return Object.entries(providerStates)
    .filter(([providerId]) => selectedProviders.includes(providerId))
    .flatMap(([, providerState]) => {
      const results = providerState.results;
      return unwrapOr(results, []);
    });
}

/**
 * Create a backward-compatible errors object for legacy support
 */
export function computeErrors(
  state: SearchState
): Record<string, string | null> {
  // Map provider errors to string messages for compatibility
  const providerErrors = Object.entries(state.providerStates).reduce((acc, [providerId, providerState]) => ({
    ...acc,
    [providerId]: isError(providerState.results)
      ? (providerState.results.error instanceof Error
          ? providerState.results.error.message
          : String(providerState.results.error))
      : null
  }), {} as Record<string, string | null>);

  // Add general error if present
  if (state.generalError) {
    providerErrors['general'] = state.generalError.message;
  }

  return providerErrors;
}

/**
 * Transform search results with provider info
 */
export function transformSearchResults(
  results: SearchResult[],
  providerId: string
): SearchResult[] {
  return results.map(r => {
    const resultUnknown = r as unknown as Record<string, unknown>;
    return {
      ...r,
      // Use existing provider or fallback to providerId for empty strings
      provider: r.provider || providerId,
      volumes: r.volumes,
      chapters: r["chapters"],
      status: r["status"] as unknown as SearchResult['status'],
      // publisher is typed as string in SearchResult
      publisher: r.publisher,
      wikiUrl: typeof resultUnknown['wikiUrl'] === 'string' ? resultUnknown['wikiUrl'] : undefined,
      url: typeof resultUnknown['url'] === 'string' ? resultUnknown['url'] : undefined
    } as SearchResult;
  });
}

/**
 * Create user-friendly error message
 */
export function createUserFriendlyError(error: Error): Error {
  let userMessage = 'An error occurred during search. Please try again.';
  const errorMessage = error.message;

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
    userMessage = 'Could not connect to search service. Please check your connection.';
  } else if (errorMessage.includes('timeout')) {
    userMessage = 'Search timed out. The service might be experiencing high load.';
  } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    userMessage = 'Search rate limit exceeded. Please wait a moment and try again.';
  }

  const userError = new Error(userMessage);
  userError.cause = error;
  return userError;
}

/**
 * Check if provider has existing successful results
 */
export function hasExistingProviderResults(
  providerState: ProviderSearchState | undefined
): boolean {
  return providerState !== undefined &&
    isSuccess(providerState.results) &&
    providerState.results.data.length > 0;
}
