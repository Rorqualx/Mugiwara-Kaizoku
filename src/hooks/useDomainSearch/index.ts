/**
 * Domain Search Hook with AsyncResult Pattern
 *
 * This hook provides a type-safe interface for searching manga across multiple providers
 * using the domain type system and AsyncResult pattern for better error handling.
 */

'use client';

import { useReducer, useCallback, useRef, useEffect, useMemo } from 'react';

import type { SearchResult, SearchOptions, ProviderType } from '@/types/search.types';
import { isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import {
  computeSearchCompleted,
  computeIsLoading,
  computeProviderResults,
  computeResults,
  computeErrors,
  hasExistingProviderResults
} from './helpers';
import { searchReducer, createInitialState } from './reducer';
import {
  processCachedResults,
  getValidProviders,
  searchSingleProvider
} from './search-operations';


/**
 * Provider information for UI
 */
export interface ProviderInfo {
  id: string;
  name: string;
  type: ProviderType;
  status: 'active' | 'disabled' | 'error';
}

/**
 * Return type for the useDomainSearch hook with AsyncResult pattern
 */
export interface UseDomainSearchResult {
  /** Combined search results across all providers */
  results: SearchResult[];
  /** Provider-specific results with AsyncResult status */
  providerResults: Record<string, AsyncResult<SearchResult[], Error>>;
  /** Whether any provider is currently loading */
  isLoading: boolean;
  /** General error that affects all providers */
  error: Error | null;
  /** Legacy errors object for backward compatibility */
  errors: Record<string, string | null>;
  /** Function to clear all errors */
  clearErrors: () => void;
  /** Function to manually trigger a search */
  triggerSearch: () => void;
  /** Whether all selected providers have completed their search */
  searchCompleted: boolean;
}

// Re-export types from types module
export type { ProviderSearchState, SearchState, SearchAction } from './types';

/**
 * Hook for searching manga across providers using AsyncResult pattern
 *
 * @param query - Search query string
 * @param availableProviders - Provider info objects
 * @param selectedProviders - IDs of providers to search
 * @param options - Search options
 * @returns {UseDomainSearchResult} Search state and control functions with AsyncResult pattern
 */
export function useDomainSearch(
  query: string,
  availableProviders: ProviderInfo[],
  selectedProviders: string[],
  options?: SearchOptions
): UseDomainSearchResult {
  // Create initial state based on available providers
  const providerIds = availableProviders.map((p) => p["id"]);
  const [state, dispatch] = useReducer(searchReducer, createInitialState(providerIds));

  // Cache for search results
  const searchCache = useRef<Record<string, SearchResult[]>>({});

  // Track the last query to prevent duplicate searches
  const lastQueryRef = useRef<string>('');

  // Use tRPC context for search operations
  const utils = trpc.useUtils();

  // Store refs for props to avoid dependency changes
  const queryRef = useRef(query);
  const selectedProvidersRef = useRef(selectedProviders);
  const availableProvidersRef = useRef(availableProviders);
  const optionsRef = useRef(options);

  // Update refs when props change
  useEffect(() => {
    queryRef.current = query;
    selectedProvidersRef.current = selectedProviders;
    availableProvidersRef.current = availableProviders;
    optionsRef.current = options;
  }, [query, selectedProviders, availableProviders, options]);

  // Search function with AsyncResult pattern
  const searchProviders = useCallback(async () => {
    const currentQuery = queryRef.current;
    const currentSelectedProviders = selectedProvidersRef.current;
    const currentAvailableProviders = availableProvidersRef.current;
    const currentOptions = optionsRef.current;

    // Validate query
    if (currentQuery.length < 3) {
      dispatch({
        type: 'SET_GENERAL_ERROR',
        payload: { error: new Error('Search query must be at least 3 characters long') }
      });
      return;
    }

    // Check if we already have results for this query
    const hasExistingResults = Object.values(state.providerStates).some(
      (providerState) => isSuccess(providerState.results) && providerState.results.data.length > 0
    ) && currentQuery === lastQueryRef.current;

    if (hasExistingResults) {
      logger.debug(`Found existing results for "${currentQuery}", but continuing search for missing providers`);
    }

    lastQueryRef.current = currentQuery;
    logger.info(`Searching for "${currentQuery}" across providers: ${currentSelectedProviders.join(', ')}`);

    // Get valid providers
    const validProviders = getValidProviders(
      dispatch,
      currentSelectedProviders,
      currentAvailableProviders as unknown as Record<string, unknown>[]
    );
    if (validProviders.length === 0) {
      return;
    }

    // Search all valid providers in parallel
    await Promise.all(
      validProviders.map(async (providerId) => {
        // Try cached results first
        if (processCachedResults(dispatch, providerId, currentQuery, searchCache.current)) {
          return;
        }

        // Check if this provider already has successful results
        const providerState = state.providerStates[providerId];
        const hasResults = hasExistingProviderResults(providerState);
        const isCompleted = providerState?.searchCompleted ?? false;

        if (isCompleted && hasResults && currentQuery === lastQueryRef.current) {
          logger.debug(`Using existing results for "${currentQuery}" with provider "${providerId}"`);
          return;
        }

        // Perform search
        await searchSingleProvider({
          dispatch,
          providerId,
          searchQuery: currentQuery,
          searchOptions: currentOptions,
          fetchFn: utils.search.withProvider.fetch,
          searchCache
        });
      })
    );
  }, [state.providerStates, utils.search.withProvider.fetch]);

  // Function to manually trigger search
  const triggerSearch = useCallback(() => {
    const currentQuery = queryRef.current;
    const currentSelectedProviders = selectedProvidersRef.current;

    // Validate inputs before searching
    if (currentQuery.length < 3) {
      dispatch({
        type: 'SET_GENERAL_ERROR',
        payload: { error: new Error('Search query must be at least 3 characters long') }
      });
      return;
    }

    if (currentSelectedProviders.length === 0) {
      dispatch({
        type: 'SET_GENERAL_ERROR',
        payload: { error: new Error('Please select at least one search provider') }
      });
      return;
    }

    // Reset search state
    dispatch({ type: 'RESET_SEARCH_COMPLETED' });

    // Clear previous errors
    dispatch({ type: 'CLEAR_ERRORS' });

    // Execute search
    searchProviders().catch((error) => {
      logger.error('Unexpected error during search:', error);
      dispatch({
        type: 'SET_GENERAL_ERROR',
        payload: {
          error: new Error('An unexpected error occurred during search. Please try again.')
        }
      });
    });
  }, [searchProviders]);

  // Clear errors function
  const clearErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ERRORS' });
  }, []);

  // Memoized computations using extracted helper functions
  const searchCompleted = useMemo(
    () => computeSearchCompleted(state.providerStates, selectedProvidersRef.current),
    [state.providerStates]
  );

  const isLoading = useMemo(
    () => computeIsLoading(state.providerStates),
    [state.providerStates]
  );

  const providerResults = useMemo(
    () => computeProviderResults(state.providerStates),
    [state.providerStates]
  );

  const results = useMemo(
    () => computeResults(state.providerStates, selectedProvidersRef.current),
    [state.providerStates]
  );

  const errors = useMemo(
    () => computeErrors(state),
    [state]
  );

  // Clean up cache on unmount or when providers change
  useEffect(() => {
    return () => {
      searchCache.current = {};
    };
  }, [availableProviders]);

  return {
    results,
    providerResults,
    isLoading,
    error: state.generalError,
    errors, // For backward compatibility
    clearErrors,
    triggerSearch,
    searchCompleted
  };
}
