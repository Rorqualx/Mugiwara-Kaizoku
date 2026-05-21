'use client';

import { useReducer, useCallback, useRef, useEffect, useMemo, useState } from 'react';

import type { SearchResult } from '@/server/services/search/types';
import { logger } from '@/utils/logger';
import { ClientSearchProvider } from '@/utils/search/clientSearchProvider';

import { searchReducer } from './useProviderSearch/reducer';
import {
  getUserFriendlyErrorMessage,
  handleDisabledProviderErrors,
  processSearchResults,
  finalizeSearchResults
} from './useProviderSearch/search-helpers';

import type { EnhancedSearchResult, SearchState } from './useProviderSearch/types';

// Re-export types for consumers
export type { EnhancedSearchResult, SearchState, SearchAction } from './useProviderSearch/types';

/**
 * Hook for searching manga across multiple providers simultaneously
 * 
 * This hook manages complex search functionality across multiple manga providers,
 * handling caching, error states, and loading states for each provider. It supports
 * searching only enabled providers, caches results to prevent duplicate searches,
 * and provides detailed error messages for disabled or misconfigured providers.
 * 
 * @param {string} query - The search query string
 * @param {Array<Object>} enabledProviders - Array of provider objects that are available
 * @param {string} enabledProviders[].id - Provider identifier
 * @param {string} enabledProviders[].name - Provider display name
 * @param {string} [enabledProviders[].status] - Provider status ('active', etc.)
 * @param {string[]} selectedProviders - Array of provider IDs to search
 * @returns {Object} Search state and control functions
 * @returns {EnhancedSearchResult[]} .results - Combined search results from all providers
 * @returns {boolean} .isLoading - Whether any provider is still loading
 * @returns {Record<string, string>} .errors - Error messages by provider
 * @returns {Function} .clearErrors - Function to clear all error messages
 * @returns {Function} .triggerSearch - Function to manually trigger a new search
 * @returns {boolean} .searchCompleted - Whether all selected providers have completed searching
 * 
 * @example
 * ```tsx
 * const { 
 *   results, 
 *   isLoading, 
 *   errors, 
 *   triggerSearch 
 * } = useProviderSearch(
 *   "One Piece",
 *   [{ id: 'anilist', name: 'AniList', status: 'active' }],
 *   ['anilist']
 * );
 * ```
 */
export function useProviderSearch(query: string, enabledProviders: {
  id: string;
  name: string;
  status?: string;
}[], selectedProviders: string[]): {
  results: EnhancedSearchResult[];
  errors: Record<string, string>;
  clearErrors: () => void;
  clearResults: () => void;
  triggerSearch: () => void;
  searchCompleted: boolean;
  isLoading: boolean;
} {
  // Initialize the search state
  const initialState: SearchState = {
    results: {},
    isLoading: {},
    errors: {},
    searchCompleted: {}
  };

  // Cache for storing search results to prevent duplicate searches
  const [searchCache] = useState<Record<string, EnhancedSearchResult[]>>({});

  // Track the last query to prevent duplicate searches
  const lastQueryRef = useRef<string>('');

  // Create the reducer
  const [state, dispatch] = useReducer(searchReducer, initialState);

  // Create a search function for each provider
  // Using useRef to store the latest values without triggering re-renders
  const queryRef = useRef(query);
  const selectedProvidersRef = useRef(selectedProviders);
  const enabledProvidersRef = useRef(enabledProviders);

  // Update refs when props change
  useEffect(() => {
    // Check if selected providers changed (not just query)
    const providersChanged = JSON.stringify(selectedProvidersRef.current) !== JSON.stringify(selectedProviders);
    
    queryRef.current = query;
    selectedProvidersRef.current = selectedProviders;
    enabledProvidersRef.current = enabledProviders;
    
    // Clear results when providers change
    if (providersChanged && selectedProviders.length > 0) {
      dispatch({ type: 'CLEAR_RESULTS' });
      // Clear the cache for all providers
      Object.keys(searchCache).forEach(key => {
        delete searchCache[key];
      });
      lastQueryRef.current = ''; // Reset last query to force new search
    }
  }, [query, selectedProviders, enabledProviders, searchCache]);

  // Define searchProviders function without dependencies that change frequently
  const searchProviders = useCallback(async () => {
    const currentQuery = queryRef.current;
    const currentSelectedProviders = selectedProvidersRef.current;
    const currentEnabledProviders = enabledProvidersRef.current;
    if (currentQuery.length < 3) return;

    // Update the last query reference
    lastQueryRef.current = currentQuery;

    // Log the search
    logger.info(`Searching for "${currentQuery}" across providers: ${currentSelectedProviders.join(', ')}`);

    // Get a list of truly enabled providers by checking against the enabledProviders array
    const validProviders = currentSelectedProviders.filter((id: string) => currentEnabledProviders.some((provider: {
      id: string;
      name: string;
      status?: string;
    }) => provider["id"] === id && provider["status"] === 'active'));
    if (validProviders.length === 0) {
      // Only log a warning if there were selected providers but none are enabled
      if (currentSelectedProviders.length > 0) {
        logger.warn(`No valid providers found for search. Selected: ${currentSelectedProviders.join(', ')}`);
        handleDisabledProviderErrors(currentSelectedProviders, currentEnabledProviders, dispatch);
      }
      return;
    }

    // Search each valid provider - no need to double-check since we've already filtered
    // Use Promise.all to properly handle async operations in the forEach loop
    await Promise.all(validProviders.map(async providerId => {
      // Check if we already have cached results for this query and provider
      const cacheKey = `${providerId}:${currentQuery}`;
      const cachedResults = searchCache[cacheKey];
      if (cachedResults) {
        logger.debug(`Using cached results for "${currentQuery}" with provider "${providerId}"`);

        // Dispatch the search start action to update UI state
        dispatch({
          type: 'SEARCH_START',
          payload: {
            providerId
          }
        });

        // Use cached results
        dispatch({
          type: 'SEARCH_SUCCESS',
          payload: {
            providerId,
            results: cachedResults
          }
        });
        return; // Use return instead of continue in Promise.all mapping function
      }

      // Dispatch the search start action
      dispatch({
        type: 'SEARCH_START',
        payload: {
          providerId
        }
      });
      try {
        logger.info(`Initiating search for "${currentQuery}" with provider "${providerId}"`);

        // Use the ClientSearchProvider which follows the application's architecture
        // This provider now uses both endpoints internally with fallback behavior
        let searchResults: SearchResult[] = [];
        try {
          // Use ClientSearchProvider instead of the non-existent debug endpoint
          logger.info(`Using ClientSearchProvider for search with provider "${providerId}"`);
          searchResults = await ClientSearchProvider.search(providerId, currentQuery);
          logger.info(`ClientSearchProvider returned ${searchResults.length} results`);
        } catch (error: unknown) {
          // Log the full technical error for debugging
          logger.error(`Search error for query "${currentQuery}" with source "${providerId}":`, String(error));

          // Get user-friendly error message and dispatch
          const errorMessage = getUserFriendlyErrorMessage(error, providerId);
          dispatch({
            type: 'SEARCH_ERROR',
            payload: {
              providerId,
              error: errorMessage
            }
          });

          // Return empty array to continue processing
          searchResults = [];
        }

        // Process and transform search results
        if (searchResults.length > 0) {
          const processedResults = processSearchResults(searchResults, providerId);
          searchResults = processedResults;
        }

        // Check if we got any results
        if (searchResults.length === 0) {
          logger.debug(`No results found for "${currentQuery}" with provider "${providerId}"`);
        }

        // Finalize results (handle already-transformed data)
        const resultsWithProvider = finalizeSearchResults(searchResults, providerId);

        // Cache the results
        searchCache[cacheKey] = [...resultsWithProvider];

        // Dispatch the search success action
        dispatch({
          type: 'SEARCH_SUCCESS',
          payload: {
            providerId,
            results: resultsWithProvider
          }
        });
        logger.info(`Search successful for "${currentQuery}" with source "${providerId}". Found ${searchResults.length} results.`);
      } catch (error: unknown) {
        // This is a fallback error handler for any errors not caught by the specific error handling above
        const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
        logger.error(`Unexpected error during search with provider "${providerId}":`, errorMessage);
        dispatch({
          type: 'SEARCH_ERROR',
          payload: {
            providerId,
            error: 'An unexpected error occurred during search. Please try again.'
          }
        });
      }
    }));
  }, [dispatch, searchCache]);

  // Expose a function to manually trigger search with error handling
   
  const triggerSearch = useCallback(() => {
    const currentQuery = queryRef.current;
    const currentSelectedProviders = selectedProvidersRef.current;

    // Validate inputs before searching
    if (currentQuery.length < 3) {
      // Set a generic error if query is too short
      dispatch({
        type: 'SEARCH_ERROR',
        payload: {
          providerId: 'general',
          error: 'Search query must be at least 3 characters long'
        }
      });
      return;
    }
    if (currentSelectedProviders.length === 0) {
      // Set error if no providers are selected
      dispatch({
        type: 'SEARCH_ERROR',
        payload: {
          providerId: 'general',
          error: 'Please select at least one search provider'
        }
      });
      return;
    }

    // Clear stale results from previous query so the UI doesn't show old data
    // while new results load. Also clears searchCompleted and errors.
    dispatch({
      type: 'CLEAR_RESULTS'
    });

    // Clear the in-memory search cache so stale entries don't prevent fresh fetches
    for (const key of Object.keys(searchCache)) {
      delete searchCache[key];
    }

    // Execute the search
    searchProviders().catch(error => {
      logger.error('Unexpected error during search:', error);
      dispatch({
        type: 'SEARCH_ERROR',
        payload: {
          providerId: 'general',
          error: 'An unexpected error occurred during search. Please try again.'
        }
      });
    });
  }, [searchProviders, dispatch, searchCache]);

  // Get all results from all providers
  const allResults = Object.values(state.results).flat();

  // Filter results based on selected providers using the ref value
  // and memoize the result to prevent unnecessary recalculations
  const filteredResults = useMemo(() => {
    // Use selectedProviders directly instead of ref to ensure updates
    return allResults.filter(result => selectedProviders.includes(result.provider));
  }, [allResults, selectedProviders]); // Added selectedProviders to dependencies

  // Check if any provider is loading (unused variable - already computed in return)

  // Get all errors
  const errors = Object.entries(state.errors).filter(([_, error]) => error !== null).reduce((acc, [provider, error]) => ({
    ...acc,
    [provider]: error as string
  }), {} as Record<string, string>);

  // Clear all errors
  const clearErrors = (): void => {
    dispatch({
      type: 'CLEAR_ERRORS'
    });
  };
  
  // Clear all results
  const clearResults = useCallback(() => {
    dispatch({ type: 'CLEAR_RESULTS' });
    // Clear the cache
    Object.keys(searchCache).forEach(key => {
      delete searchCache[key];
    });
    lastQueryRef.current = '';
  }, [searchCache]);

  // Reset the search cache when the component unmounts or when providers change
  useEffect(() => {
    return () => {
      // Clear the search cache reference when component unmounts
      Object.keys(searchCache).forEach(key => {
        delete searchCache[key];
      });
    };
  }, [searchCache, enabledProviders]);
  return {
    results: filteredResults,
    errors,
    clearErrors,
    clearResults,
    triggerSearch,
    searchCompleted: Object.values(state.searchCompleted).every(completed => completed),
    isLoading: Object.values(state.isLoading).some(loading => loading)
  };
}