"use client";

/**
 * Main Search Context for the Kaizoku application
 * 
 * This context provides global state management for the main search functionality
 * throughout the application. It handles search queries, results, loading states,
 * error handling, and selected manga state.
 * 
 * @module contexts/search/MainSearchContext
 */
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

import type { SearchResult } from '@/types/search.types';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createErrorResult,
  createLoadingResult,
  createSuccessResult,
  createIdleResult } from '@/utils/async-result'
import { unwrapOr } from '@/utils/async-result'
import { logger } from '@/utils/logger';
import { adaptSearchResults } from '@/utils/search/searchResultAdapter';
import { trpc } from '@/utils/trpc-client/index';
import { isValidSearchResultArray } from '@/utils/validation/guards/metadata';

/**
 * Interface defining the shape of the MainSearchContext
 * 
 * @typedef {Object} MainSearchContextType
 */
interface MainSearchContextType {
  /** Current search query string */
  query: string;
  /** Function to update the search query */
  setQuery: (query: string) => void;
  /** Search results state with AsyncResult pattern for type-safe access */
  searchState: AsyncResult<SearchResult[], Error>;
  /** Array of search results from the query (for backward compatibility) */
  results: SearchResult[];
  /** Loading state indicator for the search operation (for backward compatibility) */
  isLoading: boolean;
  /** Error message if search fails, null otherwise (for backward compatibility) */
  error: string | null;
  /** Currently selected manga from search results */
  selectedManga: SearchResult | null;
  /** Function to set the selected manga */
  handleMangaSelect: (manga: SearchResult) => void;
}

/**
 * Default values for the context when used outside of provider
 */
const defaultContextValue: MainSearchContextType = {
  query: '',
  setQuery: () => {},
  searchState: createIdleResult<SearchResult[], Error>(),
  results: [],
  isLoading: false,
  error: null,
  selectedManga: null,
  handleMangaSelect: () => {}
};

/**
 * Context object for the main search functionality
 */
const MainSearchContext = createContext<MainSearchContextType>(defaultContextValue);

/**
 * Provider component for the MainSearchContext
 * 
 * Manages the state for search functionality and provides it to child components.
 * Handles search queries through tRPC, error handling, and result caching.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components that will have access to this context
 * @returns {JSX.Element} Provider component with context value
 */
export function MainSearchProvider({ children }: {children: ReactNode;}): React.ReactElement {
  // State management for search functionality
  const [query, setQuery] = useState<string>('');
  const [selectedManga, setSelectedManga] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add AsyncResult state management with proper typing
  const [searchState, setSearchState] = useState<AsyncResult<SearchResult[], Error>>(
    createIdleResult<SearchResult[], Error>()
  );

  /**
   * tRPC query hook for searching library manga
   * Only enabled when query has minimum length
   */
  const searchQuery = trpc.manga.searchLibrary.useQuery(
    {
      keyword: query,
      include: {
        library: true,
        metadata: true,
        chapters: false
      }
    },
    {
      // Only enable the query when the query string is at least 1 character
      enabled: query.length >= 1,
      retry: 1, // Limit retries to avoid infinite loading
      staleTime: 60000 // Cache results for 1 minute
    }
  );

  // Update search state based on query status with proper AsyncResult handling
  useEffect(() => {
    if (!query || query.length < 1) {
      // Reset to idle state when query is too short
      setSearchState(createIdleResult<SearchResult[], Error>());
      setError(null);
      return;
    }

    if (searchQuery.isLoading) {
      setSearchState(createLoadingResult<SearchResult[], Error>());
      setError(null);
    } else if (searchQuery.error) {
      const typedError = searchQuery.error instanceof Error ?
      searchQuery.error :
      new Error(`Search error: ${String(searchQuery.error)}`);

      logger.error(`Search error in MainSearchContext: ${typedError.message}`);

      // Provide user-friendly error messages
      let userMessage = 'Library search failed. Please try again.';

      if (typedError.message.includes('Database')) {
        userMessage = 'Database error. Please try again later.';
      } else if (typedError.message.includes('Network')) {
        userMessage = 'Network error. Please check your connection.';
      } else if (typedError.message.includes('timeout')) {
        userMessage = 'Search timed out. Please try again.';
      }

      setError(userMessage);
      setSearchState(createErrorResult<SearchResult[], Error>(typedError));
    } else if (searchQuery.data) {
      // Process the data with proper type validation
      try {
        // Validate that data is an array before processing
        if (!Array.isArray(searchQuery.data)) {
          logger.warn(`Search data is not an array: ${typeof searchQuery.data}`);
          setSearchState(createSuccessResult<SearchResult[], Error>([]));
          setError(null);
          return;
        }

        // Log the raw search results for debugging
        logger.info(`Raw search results (${searchQuery.data.length} items):`, searchQuery.data);

        // Use type guard to validate the search results
        if (isValidSearchResultArray(searchQuery.data)) {
          const processedData = adaptSearchResults(searchQuery.data);
          logger.info(`Processed search results: ${processedData.length} items`);
          setSearchState(createSuccessResult<SearchResult[], Error>(processedData));
          setError(null);
        } else {
          // Attempt to adapt even if type guard fails
          logger.warn('Search results failed type validation, attempting to adapt anyway');
          const processedData = adaptSearchResults(searchQuery.data);
          setSearchState(createSuccessResult<SearchResult[], Error>(processedData));
          setError(null);
        }
      } catch (processingError: unknown) {
        const typedError = processingError instanceof Error ?
        processingError :
        new Error(`Error processing search results: ${String(processingError)}`);

        logger.error(`Error processing search results: ${typedError.message}`);
        setError('Failed to process search results');
        setSearchState(createErrorResult<SearchResult[], Error>(typedError));
      }
    }
  }, [query, searchQuery.isLoading, searchQuery.error, searchQuery.data]);

  /**
   * Handler function for selecting a manga from search results
   */
  const handleMangaSelect = useCallback((manga: SearchResult): void => {
    setSelectedManga(manga);
    logger.info(`Selected manga: ${manga["title"]} (ID: ${manga["id"]})`);
  }, []);

  // Process search results with proper type validation using AsyncResult
  const processedResults = useMemo(() => {
    return unwrapOr(searchState, []);
  }, [searchState]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<MainSearchContextType>(() => ({
    query,
    setQuery,
    searchState,
    results: processedResults,
    isLoading: searchQuery.isLoading,
    error,
    selectedManga,
    handleMangaSelect
  }), [query, setQuery, searchState, processedResults, searchQuery.isLoading, error, selectedManga, handleMangaSelect]);

  return (
    <MainSearchContext.Provider value={contextValue}>
      {children}
    </MainSearchContext.Provider>
  );
}

/**
 * Custom hook to access the MainSearchContext
 * 
 * Provides access to search state and functions.
 *
 * @example
 * // In a component
 * const { query, setQuery, results, isLoading } = useMainSearch();
 * 
 * // Use the search functionality
 * setQuery('One Piece');
 * 
 * // Display results
 * if (isLoading) return <Loading />;
 * return <ResultsList results={results} />;
 *
 * @returns {MainSearchContextType} The search context value
 */
export function useMainSearch(): MainSearchContextType {
  const context = useContext(MainSearchContext);
  return context;
}