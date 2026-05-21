/**
 * Add Manga State - Search Hooks
 *
 * Contains useProviderSearches hook for managing provider search operations.
 *
 * @module components/addManga/state/hooks/search-hooks
 */

import { useCallback } from 'react';

import type { MangaSearchResult } from '@/types/search.types';
import { isError } from '@/utils/async-result';

import type { useAddMangaState } from '../hooks';
import type { AddMangaState } from '../types';

// ============================================================================
// Provider Searches Hook
// ============================================================================

/**
 * Hook for managing provider searches
 */
export function useProviderSearches(
  state: AddMangaState,
  actions: ReturnType<typeof useAddMangaState>['actions']
): {
  searchProvider: (provider: string, searchFn: () => Promise<MangaSearchResult[]>) => Promise<MangaSearchResult[]>;
  searchAllProviders: (providers: string[], searchFnMap: Record<string, () => Promise<MangaSearchResult[]>>) => Promise<Array<{
    provider: string;
    status: string;
    results: MangaSearchResult[];
    error: unknown;
  }>>;
  retryFailedSearches: (searchFnMap: Record<string, () => Promise<MangaSearchResult[]>>) => Promise<Array<{
    provider: string;
    status: string;
    results: MangaSearchResult[];
    error: unknown;
  }>>;
} {
  const searchProvider = useCallback(async (provider: string, searchFn: () => Promise<MangaSearchResult[]>) => {
    actions.startProviderSearch(provider);
    try {
      const results = await searchFn();
      actions.completeProviderSearch(provider, results);
      return results;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      actions.failProviderSearch(provider, errorMessage as unknown as Error);
      throw new Error(errorMessage);
    }
  }, [actions]);

  const searchAllProviders = useCallback(async (
    providers: string[],
    searchFnMap: Record<string, () => Promise<MangaSearchResult[]>>
  ) => {
    const promises = providers.map((provider) => {
      const searchFn = searchFnMap[provider];
      if (searchFn) {
        return searchProvider(provider, searchFn);
      }
      return Promise.resolve([]);
    });

    const results = await Promise.allSettled(promises);
    return results.map((result, index) => ({
      provider: providers[index] ?? 'unknown',
      status: result.status,
      results: result.status === 'fulfilled' ? result.value : [],
      error: result.status === 'rejected' ? (result.reason as Error) : null
    }));
  }, [searchProvider]);

  const retryFailedSearches = useCallback(async (
    searchFnMap: Record<string, () => Promise<MangaSearchResult[]>>
  ) => {
    const failedProviders = Object.keys(state.providerSearches).filter((provider) => {
      const result = state.providerSearches[provider];
      return result && isError(result);
    });
    return searchAllProviders(failedProviders, searchFnMap);
  }, [state.providerSearches, searchAllProviders]);

  return { searchProvider, searchAllProviders, retryFailedSearches };
}
