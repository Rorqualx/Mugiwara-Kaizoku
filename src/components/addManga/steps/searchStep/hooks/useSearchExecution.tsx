/**
 * useSearchExecution Hook
 *
 * Orchestrates search execution across different providers.
 * Manages standardized search (AniList) vs provider-specific search routing.
 */

import React, { useState, useRef, useCallback } from 'react';

import { } from '@tabler/icons-react';

import type { MangaSearchResult } from '@/types/search.types';
import { createIdleResult, createLoadingResult, createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import { safeString } from '../helpers';
import { adaptToMangaSearchResult } from '../result-adapter';
import { buildSearchQuery, determineProviders } from '../search-hooks';

import type { ParsedSearchQuery } from '../types';
import type { UseSearchExecutionReturn } from './types';

/**
 * Props for useSearchExecution hook
 */
interface UseSearchExecutionProps {
  query: string;
  parsedQuery: ParsedSearchQuery | null;
  selectedProvider: string;
  searchManga: (query: string, options?: {
    providers?: string[];
    limit?: number;
    includeAdult?: boolean;
  }) => Promise<AsyncResult<MangaSearchResult[], Error>>;
}

/**
 * Hook to manage search execution logic
 *
 * @param props - Hook configuration
 * @returns Search state and execution functions
 *
 * @example
 * ```tsx
 * const { searchState, executeStandardizedSearch } = useSearchExecution({
 *   query,
 *   parsedQuery,
 *   selectedProvider,
 *   searchManga
 * });
 * ```
 */
export function useSearchExecution({
  query,
  parsedQuery,
  selectedProvider,
  searchManga
}: UseSearchExecutionProps): UseSearchExecutionReturn {
  const [searchState, setSearchState] = useState<AsyncResult<import('@/types/search.types').ExtendedMangaSearchResult[], Error>>(createIdleResult<import('@/types/search.types').ExtendedMangaSearchResult[], Error>());
  const [standardizedSearchCompleted, setStandardizedSearchCompleted] = useState<boolean>(false);

  // Track last searched query to prevent duplicate searches
  const lastSearchedRef = useRef<{ query: string; provider: string }>({ query: '', provider: '' });

  /**
   * Execute standardized search (used for AniList and "All Providers")
   */
  const executeStandardizedSearch = useCallback(async (_forceRefresh = false): Promise<void> => {
    if (!query.trim()) return;

    const parsed = parsedQuery ?? { searchText: query };
    setSearchState(createLoadingResult<import('@/types/search.types').ExtendedMangaSearchResult[], Error>());

    try {
      const searchQuery = buildSearchQuery(query, parsed);
      const providerParams = determineProviders(selectedProvider, parsed);

      const searchOptions: { providers?: string[]; limit?: number; includeAdult?: boolean } = {
        ...(providerParams !== undefined ? { providers: providerParams } : {}),
        limit: 20
      };

      const result: AsyncResult<MangaSearchResult[], Error> = await searchManga(searchQuery, searchOptions);

      if (isSuccess(result)) {
        const mappedResults = result.data.map(item => {
          const itemSource = (item.source as string | undefined) ?? (selectedProvider || 'anilist');
          return adaptToMangaSearchResult(item, itemSource);
        });
        setSearchState(createSuccessResult<import('@/types/search.types').ExtendedMangaSearchResult[], Error>(mappedResults));
        setStandardizedSearchCompleted(true);
      } else {
        setSearchState(result as AsyncResult<import('@/types/search.types').ExtendedMangaSearchResult[], Error>);
        if (isError(result)) {
          setStandardizedSearchCompleted(true);
        }
      }
    } catch (error: unknown) {
      logger.error('Unexpected error during search:', error);
      const errorMessage = error instanceof Error ? error.message : safeString(error);
      const providerName = selectedProvider ? selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1) : 'Search';

      notify({ severity: 'ERROR', title: 'Search Error', message: `${providerName} search failed: ${errorMessage}`, toast: { autoClose: 5000 } });

      setSearchState(createErrorResult(new Error(errorMessage)));
      setStandardizedSearchCompleted(true);
    }
  }, [query, parsedQuery, selectedProvider, searchManga]);

  /**
   * Clear search state (used when provider changes or refresh)
   */
  const clearSearchState = useCallback((): void => {
    setSearchState(createIdleResult());
    setStandardizedSearchCompleted(false);
  }, []);

  return {
    searchState,
    standardizedSearchCompleted,
    executeStandardizedSearch,
    clearSearchState,
    // Export ref for orchestrator to manage
    lastSearchedRef
  } as UseSearchExecutionReturn & { lastSearchedRef: React.MutableRefObject<{ query: string; provider: string }> };
}
