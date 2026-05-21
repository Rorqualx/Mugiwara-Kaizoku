/**
 * useAllProviderResults Hook
 *
 * Manages fetching and caching results from all providers simultaneously.
 * Handles provider errors and displays appropriate notifications.
 *
 * MOVED from: useSearchStepState.tsx (lines 92-156)
 */

import React, { useState, useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { trpc } from '@/utils/trpc-client/index';

import type { UseAllProviderResultsReturn } from './types';

/**
 * Hook to fetch results from all providers
 *
 * @returns All provider results state and fetching function
 *
 * @example
 * ```tsx
 * const { allProviderResults, fetchAllProviderResults } = useAllProviderResults();
 * const results = await fetchAllProviderResults(query);
 * ```
 */
export function useAllProviderResults(): UseAllProviderResultsReturn {
  const utils = trpc.useUtils();
  const [allProviderResults, setAllProviderResults] = useState<ExtendedMangaSearchResult[]>([]);
  const [fetchingAllProviders, setFetchingAllProviders] = useState(false);

  const fetchAllProviderResults = useCallback(async (query: string): Promise<ExtendedMangaSearchResult[]> => {
    if (fetchingAllProviders || !query || query.length < 3) return [];
    setFetchingAllProviders(true);
    try {
      const response = await utils.search.allWithErrors.fetch({
        query,
        limit: 20,
        includeAdult: false
      });

      if (response.providerErrors?.length) {
        response.providerErrors.forEach(error => {
          const providerName = error.provider.charAt(0).toUpperCase() + error.provider.slice(1);
          let message = `${providerName} search failed`;
          let color = 'orange';

          if (error.errorType === 'api_down') {
            message = `${providerName} API is temporarily unavailable`;
            color = 'red';
          } else if (error.errorType === 'rate_limit') {
            message = `${providerName} rate limit exceeded. Please try again later`;
            color = 'yellow';
          } else if (error.errorType === 'network') {
            message = `Network error connecting to ${providerName}`;
            color = 'red';
          } else if (error.errorType === 'auth') {
            message = `${providerName} authentication failed. Check API key`;
            color = 'red';
          }

          notifications.show({
            title: 'Provider Error',
            message,
            color,
            icon: <IconAlertCircle />,
            autoClose: 5000
          });
        });
      }

      if (response.results.length > 0) {
        setAllProviderResults(response.results as ExtendedMangaSearchResult[]);
        return response.results as ExtendedMangaSearchResult[];
      }
      return [];
    } finally {
      setFetchingAllProviders(false);
    }
  }, [fetchingAllProviders, utils]);

  return {
    allProviderResults,
    fetchingAllProviders,
    fetchAllProviderResults
  };
}
