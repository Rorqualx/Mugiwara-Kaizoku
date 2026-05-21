"use client";
/**
 * Unified Search Context for the Kaizoku application
 * 
 * This context provides state management for search functionality throughout
 * the application, supporting both main search and modal search scenarios.
 * It handles search queries, results, loading states, error handling, 
 * selected manga state, and implements optional timeout handling for search requests.
 * 
 * @module contexts/search/UnifiedSearchContext
 */
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';

import type { SearchResult } from '@/types/search.types';
import type {
  AsyncResult} from '@/utils/async-result';
import { createErrorResult,
  createLoadingResult, createSuccessResult,
  createIdleResult, isSuccess, isLoading } from
'@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logging';
import { adaptSearchResults } from '@/utils/search/searchResultAdapter';
import { trpc } from '@/utils/trpc-client';
import { isValidSearchResultArray } from '@/utils/validation/guards/metadata';

/**
 * Configuration options for the search context
 */
export interface SearchContextConfig {
  /** Whether this is being used in a modal context */
  isModal?: boolean;
  /** Whether to enable timeout handling for search requests */
  enableTimeout?: boolean;
  /** Timeout duration in milliseconds (default: 30000) */
  timeoutDuration?: number;
  /** Whether to search in library (main) or all providers (modal) */
  searchType?: 'library' | 'providers';
  /** Minimum query length to trigger search (default: 1) */
  minQueryLength?: number;
  /** Cache duration in milliseconds (default: 60000) */
  cacheStaleTime?: number;
}

/**
 * Interface defining the shape of the UnifiedSearchContext
 */
interface UnifiedSearchContextType {
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
  /** Current configuration */
  config: SearchContextConfig;
}

/**
 * Default configuration values
 */
const defaultConfig: Required<SearchContextConfig> = {
  isModal: false,
  enableTimeout: false,
  timeoutDuration: 30000,
  searchType: 'library',
  minQueryLength: 1,
  cacheStaleTime: 60000
};
/**
 * Context object for unified search functionality
 */
const UnifiedSearchContext = createContext<UnifiedSearchContextType | undefined>(undefined);
/**
 * Provider component for the UnifiedSearchContext
 * 
 * Manages the state for search functionality and provides it to child components.
 * Handles search queries through tRPC, error handling, result caching, and
 * optionally implements timeout handling for search requests.
 *
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components that will have access to this context
 * @param {SearchContextConfig} props.config - Configuration options for the search context
 * @returns {JSX.Element} Provider component with context value
 */
export function UnifiedSearchProvider({
  children,
  config = {}



}: {children: ReactNode;config?: SearchContextConfig;}): React.ReactElement {
  // Merge provided config with defaults - memoize to prevent re-renders
  const mergedConfig = useMemo(() => ({ ...defaultConfig, ...config }), [config]);

  // State management for search functionality
  const [query, setQuery] = useState<string>('');
  const [selectedManga, setSelectedManga] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Add AsyncResult state management with proper typing
  const [searchState, setSearchState] = useState<AsyncResult<SearchResult[], Error>>(
    createIdleResult<SearchResult[], Error>()
  );

  /**
   * tRPC query hook for searching based on configuration
   * Switches between library search and provider search based on searchType
   */
  const searchQuery = mergedConfig.searchType === 'library' ?
  trpc.manga.searchLibrary.useQuery(
    {
      keyword: query,
      include: {
        library: true,
        metadata: true,
        chapters: false
      }
    },
    {
      enabled: query.length >= mergedConfig.minQueryLength,
      retry: 1,
      staleTime: mergedConfig.cacheStaleTime
    }
  ) :
  trpc.manga.search.useQuery(
    {
      keyword: query,
      source: 'all'
    },
    {
      enabled: query.length >= mergedConfig.minQueryLength,
      retry: 1,
      staleTime: mergedConfig.cacheStaleTime
    }
  );
  /**
   * Effect to handle timeout for search requests when enabled
   */
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!mergedConfig.enableTimeout || !searchQuery.isPending) {
      return;
    }

    // Set a timeout for the search request
    timeoutRef.current = setTimeout(() => {
      logger.warn('Search request timeout', { query, duration: mergedConfig.timeoutDuration });
      setError(`Search timed out after ${mergedConfig.timeoutDuration / 1000} seconds`);
      setSearchState(createErrorResult(
        new Error(`Search timed out after ${mergedConfig.timeoutDuration / 1000} seconds`)
      ));
    }, mergedConfig.timeoutDuration);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchQuery.isPending, query, mergedConfig.enableTimeout, mergedConfig.timeoutDuration]);
  /**
   * Effect to update search state based on query results
   */
  useEffect(() => {
    // Handle idle/empty state first
    if (query.length === 0) {
      setSearchState(createIdleResult());
      setError(null);
      return;
    }

    // Update loading state
    if (searchQuery.isPending || searchQuery.isFetching) {
      setSearchState(createLoadingResult());
      setError(null);
    }
    // Handle error state
    else if (searchQuery.isError) {
      const errorMessage = searchQuery.error.message || 'Search failed';
      logger.error('Search query error', { error: searchQuery.error, query });
      setError(errorMessage);
      setSearchState(createErrorResult(new Error(errorMessage)));
    }
    // Handle success state
    else {
      try {
        // Adapt search results to the common format
        const adaptedResults = adaptSearchResults(searchQuery.data);
        // Validate and set results
        setSearchState(createSuccessResult(isValidSearchResultArray(adaptedResults) ? adaptedResults : []));
        setError(null);

        if (!isValidSearchResultArray(adaptedResults)) {
          logger.warn('Invalid search results format', { data: searchQuery.data });
        }
      } catch (err: unknown) {const errorMessage = err instanceof Error ? err.message : String(err);
logger.error('Error adapting search results', { error: errorMessage });
        setError('Failed to process search results');
        setSearchState(createErrorResult(
          new Error('Failed to process search results')
        ));
      }
    }
  }, [searchQuery.isPending, searchQuery.isFetching, searchQuery.isError, searchQuery.data, searchQuery.error, query]);
  /**
   * Handle manga selection from search results
   */
  const handleMangaSelect = useCallback((manga: SearchResult): void => {
    setSelectedManga(manga);
    logger.info('Manga selected from search', {
      mangaId: toNumberId(manga["id"]),
      title: manga["title"],
      context: mergedConfig.isModal ? 'modal' : 'main'
    });
  }, [mergedConfig.isModal]);

  /**
   * Extract results for backward compatibility - memoize to prevent re-renders
   */
  const results = useMemo<SearchResult[]>(
    () => isSuccess(searchState) ? searchState.data as SearchResult[] : [],
    [searchState]
  );
  const isLoadingState = isLoading(searchState);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<UnifiedSearchContextType>(() => ({
    query,
    setQuery,
    searchState,
    results,
    isLoading: isLoadingState,
    error,
    selectedManga,
    handleMangaSelect,
    config: mergedConfig
  }), [query, setQuery, searchState, results, isLoadingState, error, selectedManga, handleMangaSelect, mergedConfig]);

  return (
    <UnifiedSearchContext.Provider value={contextValue}>
      {children}
    </UnifiedSearchContext.Provider>
  );
}

/**
 * Hook for consuming the unified search context
 * 
 * @returns {UnifiedSearchContextType} Search context values and functions
 * @throws {Error} If used outside of UnifiedSearchProvider
 */
export function useUnifiedSearch(): UnifiedSearchContextType {
  const context = useContext(UnifiedSearchContext);
  if (!context) {
    throw new Error('useUnifiedSearch must be used within a UnifiedSearchProvider');
  }
  return context;
}

/**
 * Backward compatibility exports
 * These allow existing code to continue working without changes
 */

/**
 * Main search provider - uses library search configuration
 */
export function MainSearchProvider({ children }: {children: ReactNode;}): React.ReactElement {
  return (
    <UnifiedSearchProvider config={{ searchType: 'library', isModal: false }}>
      {children}
    </UnifiedSearchProvider>);

}

/**
 * Modal search provider - uses provider search with timeout
 */
export function ModalSearchProvider({ children }: {children: ReactNode;}): React.ReactElement {
  return (
    <UnifiedSearchProvider
      config={{
        searchType: 'providers',
        isModal: true,
        enableTimeout: true,
        timeoutDuration: 30000
      }}>

      {children}
    </UnifiedSearchProvider>);

}

/**
 * Hook for main search functionality (backward compatibility)
 */
export function useMainSearch(): UnifiedSearchContextType {
  return useUnifiedSearch();
}

/**
 * Hook for modal search functionality (backward compatibility)
 */
export function useModalSearch(): UnifiedSearchContextType {
  return useUnifiedSearch();
}

// Default export for convenience
export default UnifiedSearchContext;