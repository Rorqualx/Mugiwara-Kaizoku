/**
 * useSearchStepState Hook - ORCHESTRATOR
 *
 * Custom hook that orchestrates all search step functionality by composing
 * specialized sub-hooks. Coordinates search execution, provider selection,
 * result management, and error handling.
 *
 * REFACTORED: Original 528 lines decomposed into 7 specialized sub-hooks
 * Each sub-hook handles a specific concern with clear boundaries.
 *
 * Architecture:
 * - useSearchProviderState: Provider configuration and enabled sources
 * - useAllProviderResults: Multi-provider result fetching
 * - useSearchQuery: Query parsing and form synchronization
 * - useSearchExecution: Search orchestration (AniList vs provider routing)
 * - useMangaSelection: Selection handling and ComicVine enrichment
 * - useSearchErrors: Error aggregation and display
 * - useProviderSelection: Provider selection and coordination
 */

import { useState, useEffect, useCallback } from 'react';

import { useMetadataProviders } from '@/hooks/useMetadataProviders';
import { useProviderSearch } from '@/hooks/useProviderSearch';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import {
  useSearchProviderState,
  useAllProviderResults,
  useSearchQuery,
  useSearchExecution,
  useMangaSelection,
  useSearchErrors,
  useProviderSelection
} from './hooks';

import type {
  UseSearchStepStateProps,
  UseSearchStepStateReturn
} from './hooks/types';

/**
 * Orchestrator hook for search step state management
 *
 * Composes all sub-hooks and coordinates their interactions.
 * Provides a unified interface for the SearchStep component.
 *
 * @param props - Hook configuration (form, onSelect callback)
 * @returns Complete search step state and handlers
 *
 * @example
 * ```tsx
 * const searchState = useSearchStepState({ form, onSelect });
 * ```
 */
export function useSearchStepState({
  form,
  onSelect,
  onQuickAdd
}: UseSearchStepStateProps): UseSearchStepStateReturn {
  const utils = trpc.useUtils();

  // UI state
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [allProvidersSearched, setAllProvidersSearched] = useState<boolean>(false);

  // 1. Provider State Hook
  const {
    enabledSources,
    defaultSource,
    allProviderIds,
    shouldUseProviderSearch: shouldUseProviderSearchFn
  } = useSearchProviderState();

  // 2. Provider Selection Hook
  const {
    selectedProvider,
    handleProviderChange: handleProviderChangeBase,
    setSelectedProvider
  } = useProviderSelection({
    query: ''
  });

  // 3. Query Management Hook
  const {
    query,
    parsedQuery,
    handleQueryChange: handleQueryChangeBase,
    setFormQuery
  } = useSearchQuery({
    form,
    onProviderSuggested: (provider) => {
      if (provider !== selectedProvider) {
        setSelectedProvider(provider);
      }
    }
  });

  // 4. All Provider Results Hook
  const {
    allProviderResults,
    fetchingAllProviders,
    fetchAllProviderResults
  } = useAllProviderResults();

  // 5. Standardized Search Hook (AniList, All Providers)
  const { searchManga } = useMetadataProviders();

  const {
    searchState,
    standardizedSearchCompleted,
    executeStandardizedSearch,
    clearSearchState,
    lastSearchedRef
  } = useSearchExecution({
    query,
    parsedQuery,
    selectedProvider,
    searchManga
  }) as ReturnType<typeof useSearchExecution> & { lastSearchedRef: React.MutableRefObject<{ query: string; provider: string }> };

  // 6. Provider Search Hook (ComicVine, Fandom, etc.)
  const shouldUseProviderSearch = shouldUseProviderSearchFn(selectedProvider);
  const {
    results: providerSearchResults,
    isLoading: hookIsLoading,
    errors: searchErrors,
    clearErrors,
    clearResults,
    triggerSearch,
    searchCompleted
  } = useProviderSearch(
    shouldUseProviderSearch ? query : '',
    enabledSources,
    selectedProvider ? [selectedProvider] : allProviderIds
  );

  // Cast to ExtendedMangaSearchResult for type compatibility
  const filteredResults = providerSearchResults as import('@/types/search.types').ExtendedMangaSearchResult[];

  // 7. Error Management Hook
  const {
    errors,
    handleErrorClose,
    setErrors
  } = useSearchErrors({
    searchErrors,
    clearSearchErrors: clearErrors,
    searchState,
    setSearchState: clearSearchState as (state: import('@/utils/async-result').AsyncResult<unknown, Error>) => void
  });

  // 8. Manga Selection Hook
  const {
    selectingMangaId,
    handleMangaSelect: handleMangaSelectBase
  } = useMangaSelection({
    query,
    defaultSource,
    allProviderResults,
    fetchingAllProviders,
    fetchAllProviderResults,
    filteredResults,
    searchState,
    onSelect
  });

  // ============================================================================
  // Cross-Hook Coordination Effects
  // ============================================================================

  /**
   * Update allProvidersSearched when searches complete
   */
  useEffect(() => {
    const isSearchComplete = (searchCompleted || standardizedSearchCompleted) &&
      query === lastSearchedRef.current.query &&
      selectedProvider === lastSearchedRef.current.provider;
    if (isSearchComplete) {
      setAllProvidersSearched(true);
    } else {
      setAllProvidersSearched(false);
    }
    // lastSearchedRef is a mutable ref - intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchCompleted, standardizedSearchCompleted, query, selectedProvider]);

  /**
   * Auto-search when query changes (debounced)
   */
  useEffect(() => {
    if (query.length >= 3) {
      const timer = setTimeout(() => {
        const hasSearched = lastSearchedRef.current.query === query && lastSearchedRef.current.provider === selectedProvider;
        if (!hasSearched) {
          logger.debug(`Triggering search for "${query}" with provider "${selectedProvider}"`);
          lastSearchedRef.current = { query, provider: selectedProvider };

          if (selectedProvider === 'anilist' || selectedProvider === '') {
            void executeStandardizedSearch();
          } else {
            void triggerSearch();
          }
        }
      }, 400);
      return () => clearTimeout(timer);
    }
    return () => {};
    // lastSearchedRef is a mutable ref - intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedProvider, executeStandardizedSearch, triggerSearch]);

  // ============================================================================
  // Coordinated Handlers
  // ============================================================================

  /**
   * Handle provider change with search coordination
   */
  const handleProviderChange = useCallback((value: string | null): void => {
    const newProvider = value ?? '';
    if (query.length >= 3) {
      lastSearchedRef.current = { query, provider: newProvider };
    }

    handleProviderChangeBase(newProvider);
    setAllProvidersSearched(false);
    clearSearchState();
    clearResults();

    if (query.length >= 3) {
      logger.info(`Provider changed to "${newProvider}", triggering new search for "${query}"`);
      if (newProvider === 'anilist' || newProvider === '') {
        void executeStandardizedSearch();
      } else {
        void triggerSearch();
      }
    }
    // lastSearchedRef is a mutable ref - intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, handleProviderChangeBase, clearSearchState, clearResults, executeStandardizedSearch, triggerSearch]);

  /**
   * Handle query change with error state management
   */
  const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    handleQueryChangeBase(event);
  }, [handleQueryChangeBase]);

  /**
   * Handle manga selection with error handling
   */
  const handleMangaSelect = useCallback(async (selected: import('@/types/search.types').ExtendedMangaSearchResult): Promise<void> => {
    try {
      await handleMangaSelectBase(selected);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const updatedErrors = {
        ...errors,
        selection: `Failed to select manga: ${errorMessage}`
      };
      setErrors(updatedErrors);
    }
  }, [handleMangaSelectBase, setErrors, errors]);

  /**
   * Handle quick add with provider results aggregation
   * Builds resultsByProvider similar to handleMangaSelect but for quick add flow
   */
  const handleQuickAdd = useCallback(async (selected: import('@/types/search.types').ExtendedMangaSearchResult): Promise<void> => {
    if (!onQuickAdd) return;

    try {
      // Determine the provider from the selected result
      let provider = defaultSource;
      if ('provider' in selected && typeof selected.provider === 'string') {
        provider = selected.provider.toLowerCase();
      } else if ('source' in selected && typeof selected.source === 'string') {
        provider = selected.source.toLowerCase();
      }

      // Fetch all provider results if not already fetched
      let fetchedResults: import('@/types/search.types').ExtendedMangaSearchResult[] = [];
      if (allProviderResults.length === 0 && !fetchingAllProviders) {
        fetchedResults = await fetchAllProviderResults(query);
      } else {
        fetchedResults = allProviderResults;
      }

      // Build results grouped by provider (same logic as useMangaSelection)
      const resultsByProvider: Record<string, import('@/types/search.types').ExtendedMangaSearchResult[]> = {};
      resultsByProvider[provider] = [selected];

      const grouped = new Map<string, import('@/types/search.types').ExtendedMangaSearchResult[]>();
      const seenIds = new Map<string, Set<string>>();

      const allResults = [
        ...filteredResults,
        ...(isSuccess(searchState) ? searchState.data : []),
        ...fetchedResults
      ];

      allResults.forEach(result => {
        const providerField = 'provider' in result ? result.provider : undefined;
        const source = 'source' in result ? result.source : undefined;
        const resultProvider = (providerField ?? source ?? 'unknown').toLowerCase();

        const resultId = String(result.id);
        const sourceId = 'sourceId' in result ? String(result.sourceId) : '';
        const uniqueKey = `${resultId}-${sourceId}-${result.title}`;

        if (!grouped.has(resultProvider)) {
          grouped.set(resultProvider, []);
          seenIds.set(resultProvider, new Set<string>());
        }

        const providerSeenIds = seenIds.get(resultProvider);
        if (providerSeenIds && !providerSeenIds.has(uniqueKey)) {
          providerSeenIds.add(uniqueKey);
          grouped.get(resultProvider)?.push(result as import('@/types/search.types').ExtendedMangaSearchResult);
        }
      });

      grouped.forEach((results, key) => {
        resultsByProvider[key] = results;
      });

      // Call onQuickAdd with the selected result and all provider results
      onQuickAdd(selected, resultsByProvider);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error in quick add: ${errorMessage}`);
      const updatedErrors = {
        ...errors,
        quickAdd: `Failed to quick add manga: ${errorMessage}`
      };
      setErrors(updatedErrors);
    }
  }, [onQuickAdd, defaultSource, allProviderResults, fetchingAllProviders, fetchAllProviderResults, query, filteredResults, searchState, errors, setErrors]);

  /**
   * Handle force refresh
   */
  const handleForceRefresh = useCallback((): void => {
    logger.debug(`Forcing complete refresh for "${query}"`);
    setAllProvidersSearched(false);
    clearSearchState();
    clearResults();
    void utils.manga.searchProviderConfirmation.invalidate().catch((error) => {
      logger.error('Failed to invalidate tRPC cache:', error);
    });

    if (selectedProvider === 'anilist' || selectedProvider === '') {
      void executeStandardizedSearch(true);
    } else {
      if (query.length >= 3) {
        lastSearchedRef.current = { query, provider: selectedProvider };
        void triggerSearch();
      }
    }
    // lastSearchedRef is a mutable ref - intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedProvider, clearSearchState, clearResults, executeStandardizedSearch, triggerSearch, utils]);

  /**
   * Handle search button click
   */
  const handleSearchClick = useCallback((): void => {
    if (query.length >= 3) {
      handleForceRefresh();
    }
  }, [query, handleForceRefresh]);

  // Suppress unused variable warning
  void allProvidersSearched;

  // ============================================================================
  // Return Unified Interface
  // ============================================================================

  return {
    // State
    query,
    errors,
    searchState,
    selectedProvider,
    showSearchHelp,
    parsedQuery,
    selectingMangaId,
    enabledSources,
    filteredResults,
    hookIsLoading,
    lastSearchedQuery: lastSearchedRef.current.query,

    // Handlers
    handleQueryChange,
    handleProviderChange,
    handleSearchClick,
    handleForceRefresh,
    handleErrorClose,
    handleMangaSelect,
    handleQuickAdd,
    setShowSearchHelp,
    setFormQuery
  };
}

export default useSearchStepState;
