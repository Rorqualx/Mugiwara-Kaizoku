"use client";

/**
 * Modal Search Context for the Kaizoku application
 * 
 * This context provides state management for search functionality within modals.
 * It handles search queries, results, loading states, error handling, selected manga state,
 * and implements timeout handling for search requests.
 * 
 * @module contexts/search/ModalSearchContext
 */
import type { ReactNode} from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';

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
import { trpc } from '@/utils/trpc-client';
import { isValidSearchResultArray } from '@/utils/validation/guards/metadata';

/**
 * Interface defining the shape of the ModalSearchContext
 * 
 * @typedef {Object} ModalSearchContextType
 */
interface ModalSearchContextType {
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
const defaultContextValue: ModalSearchContextType = {
  query: '',
  setQuery: () => {},
  // Add the AsyncResult state with idle status
  searchState: createIdleResult<SearchResult[], Error>(),
  results: [],
  isLoading: false,
  error: null,
  selectedManga: null,
  handleMangaSelect: () => {}
};

/**
 * Context object for the modal search functionality
 */
const ModalSearchContext = createContext<ModalSearchContextType>(defaultContextValue);

/**
 * Provider component for the ModalSearchContext
 * 
 * Manages the state for search functionality within modals and provides it to child components.
 * Handles search queries through tRPC, error handling, result caching, and implements
 * timeout handling for search requests that take too long.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components that will have access to this context
 * @returns {JSX.Element} Provider component with context value
 */
export function ModalSearchProvider({ children }: {children: ReactNode;}): React.ReactElement {
  // State management for search functionality
  const [query, setQuery] = useState<string>('');
  const [selectedManga, setSelectedManga] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Add AsyncResult state management with proper typing
  const [searchState, setSearchState] = useState<AsyncResult<SearchResult[], Error>>(
    createIdleResult<SearchResult[], Error>()
  );

  // No longer need to get the default provider since we're using 'all' by default
  // This will make the search use all enabled providers

  /**
   * Create a mock search query to use when trpc.manga.search is not available
   */
  const mockSearchQuery = {
    data: undefined,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined,
    refetch: (): Promise<unknown> => Promise.resolve({})
  };

  /**
   * tRPC query hook for searching library manga
   * Only enabled when query is not empty
   */
  const searchQuery = 'searchLibrary' in trpc.manga ?
  trpc.manga['searchLibrary'].useQuery(
    {
      keyword: query,
      include: {
        library: true,
        metadata: true,
        chapters: false
      }
    },
    {
      // Only enable the query when the query string is not empty
      enabled: query.length > 0,
      retry: 1, // Limit retries to avoid infinite loading
      staleTime: 60000 // Cache results for 1 minute
    }
  ) :
  mockSearchQuery;

  // Update search state based on query status with proper AsyncResult handling
  useEffect(() => {
    if (searchQuery.isLoading) {
      setSearchState(createLoadingResult<SearchResult[], Error>());
    } else if (searchQuery.error) {
      const typedError = searchQuery.error instanceof Error ?
      searchQuery.error :
      new Error(`Search error: ${String(searchQuery.error)}`);

      logger.error(`Search error in ModalSearchContext: ${typedError.message}`);
      setError(typedError.message);
      setSearchState(createErrorResult<SearchResult[], Error>(typedError));
    } else if (searchQuery.data) {
      // Process the data with proper type validation
      try {
        // Validate that data is an array before processing
        if (!Array.isArray(searchQuery.data)) {
          logger.warn(`Search data is not an array: ${typeof searchQuery.data}`);
          setSearchState(createSuccessResult<SearchResult[], Error>([]));
          return;
        }

        // Use type guard to validate the search results
        if (isValidSearchResultArray(searchQuery.data)) {
          const processedData = adaptSearchResults(searchQuery.data);
          setSearchState(createSuccessResult<SearchResult[], Error>(processedData));
        } else {
          // Attempt to adapt even if type guard fails
          const processedData = adaptSearchResults(searchQuery.data);
          setSearchState(createSuccessResult<SearchResult[], Error>(processedData));
        }
      } catch (processingError: unknown) {
        const typedError = processingError instanceof Error ?
        processingError :
        new Error(`Error processing search results: ${String(processingError)}`);

        logger.error(`Error processing search results: ${typedError.message}`);
        setSearchState(createErrorResult<SearchResult[], Error>(typedError));
      }
    }
  }, [searchQuery.isLoading, searchQuery.error, searchQuery.data]);

  /**
   * Effect to handle search request timeouts
   * 
   * Sets a timeout to cancel the search request and display an error message
   * if the search takes too long to complete. Different error messages are shown
   * based on the selected source.
   */
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    // Only set a timeout if we're actually loading AND there's a query
    if (searchQuery.isLoading && query.length > 0) {
      const id = setTimeout(() => {
        if (searchQuery.isLoading) {
          logger.warn(`Library search request timed out for query ${query}`);

          // Create a timeout error
          const timeoutError = new Error(
            'Library search timed out. Please try again or check your connection.'
          );

          // Update error states in both formats for compatibility
          setError(timeoutError.message);
          setSearchState(createErrorResult<SearchResult[], Error>(timeoutError));
        }
      }, 30000); // Increased timeout to 30 seconds for better handling of slower APIs

      setTimeoutId(id);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [searchQuery.isLoading, timeoutId, query]);

  /**
   * Handler function for selecting a manga from search results
   * 
   * @param {SearchResult} manga - The manga to select
   */
  const handleMangaSelect = (manga: SearchResult): void => {
    setSelectedManga(manga);
  };

  // Process search results with proper type validation using AsyncResult
  const processedResults = React.useMemo(() => {
    // If we have success state, return the data
    return unwrapOr(searchState, []);
  }, [searchState]);

  // Create the context value with all required properties
  const contextValue: ModalSearchContextType = {
    query,
    setQuery,
    // Include AsyncResult state
    searchState,
    // Also keep backward compatibility
    results: processedResults,
    isLoading: searchQuery.isLoading,
    error,
    selectedManga,
    handleMangaSelect
  };

  return (
    <ModalSearchContext.Provider value={contextValue}>
      {children}
    </ModalSearchContext.Provider>);

}

/**
 * Custom hook to access the ModalSearchContext
 * 
 * Provides access to modal search state and functions.
 *
 * @example
 * // In a modal component
 * const { query, setQuery, results, isLoading } = useModalSearch();
 * 
 * // Use the search functionality
 * setQuery('One Piece');
 * 
 * // Display results
 * if (isLoading) return <Loading />;
 * return <ResultsList results={results} />;
 *
 * @returns {ModalSearchContextType} The modal search context value
 */
export function useModalSearch(): ModalSearchContextType {
  const context = useContext(ModalSearchContext);
  return context;
}