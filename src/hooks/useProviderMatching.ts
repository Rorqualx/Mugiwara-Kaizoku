import { useState, useCallback } from 'react';

import { notify } from '@/utils/notify';

import { toStringId } from "../utils/id-converters";
import { trpc } from '../utils/trpc-client/index';

/**
 * Provider Matching Hook
 *
 * This hook provides easy access to the provider matching functionality
 * from React components. It wraps the tRPC calls with proper error handling
 * and state management.
 */

import type { CrossProviderMatchResult, ProviderMatchResult } from '../server/services/metadata/providerMatchingService';
import type { MangaMetadata } from '../types/search.types';

export interface UseProviderMatchingOptions {
  /**
   * Show notifications on errors
   */
  showNotifications?: boolean;
  /**
   * Automatically fetch metadata for matches
   */
  fetchMetadata?: boolean;
  /**
   * Automatically merge metadata from multiple sources
   */
  mergeMetadata?: boolean;
}

export interface UseProviderMatchingReturn {
  isLoading: boolean;
  error: Error | null;
  availableProviders: string[];
  findCrossProviderMatches: (title: string, queryOptions?: { providers?: string[]; limit?: number }) => Promise<CrossProviderMatchResult | null>;
  findProviderToProviderMatch: (title: string, sourceProvider: string, targetProvider: string) => Promise<ProviderMatchResult | null>;
  getEnrichedMetadata: (mangaId: string, currentProvider: string, title: string) => Promise<MangaMetadata | null>;
  matchDatabaseManga: (mangaId: number, targetProviders?: string[]) => Promise<unknown>;
  updateMatchingConfig: (config: unknown) => void;
  isLoadingProviders: boolean;
  providersError: Error | null;
}

/**
 * Hook for provider matching functionality
 * 
 * @param options Configuration options
 * @returns Provider matching methods and state
 */
export function useProviderMatching(options: UseProviderMatchingOptions = {}): UseProviderMatchingReturn {
  const {
    showNotifications = true,
    fetchMetadata = true,
    mergeMetadata = true
  } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get tRPC utils for manual fetching
  const utils = trpc.useUtils();

  // Get available providers query
  const availableProvidersQuery = trpc.providerMatching.getAvailableProviders.useQuery();

  // Note: These are queries, not mutations, but we'll use them with manual fetching
  // to maintain the async behavior expected by the hook

  /**
   * Find matches across all providers
   */
  const findCrossProviderMatches = useCallback(async (title: string, queryOptions?: {
    providers?: string[];
    limit?: number;
  }): Promise<CrossProviderMatchResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // Use trpc utils for manual fetching
      const result = await utils.providerMatching.findCrossProviderMatches.fetch({
        title,
        options: {
          ...queryOptions,
          fetchMetadata,
          mergeMetadata
        }
      });
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to find matches');
      setError(error);
      if (showNotifications) {
        notify({ severity: 'ERROR', title: 'Error', message: `Failed to find matches: ${(error instanceof Error ? error.message : String(error))}` });
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [utils, fetchMetadata, mergeMetadata, showNotifications]);

  /**
   * Find match between two specific providers
   */
  const findProviderToProviderMatch = useCallback(async (title: string, sourceProvider: string, targetProvider: string): Promise<ProviderMatchResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await utils.providerMatching.findProviderToProviderMatch.fetch({
        title,
        sourceProvider,
        targetProvider,
        fetchMetadata
      });
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to find provider match');
      setError(error);
      if (showNotifications) {
        notify({ severity: 'ERROR', title: 'Error', message: `Failed to find match: ${(error instanceof Error ? error.message : String(error))}` });
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [utils, fetchMetadata, showNotifications]);

  /**
   * Get enriched metadata by combining data from multiple providers
   */
  const getEnrichedMetadata = useCallback(async (mangaId: string, currentProvider: string, title: string): Promise<MangaMetadata | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await utils.providerMatching.getEnrichedMetadata.fetch({
        mangaId,
        currentProvider,
        title
      });
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to get enriched metadata');
      setError(error);
      if (showNotifications) {
        notify({ severity: 'ERROR', title: 'Error', message: `Failed to get metadata: ${(error instanceof Error ? error.message : String(error))}` });
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [utils, showNotifications]);

  /**
   * Match a manga from the database with external providers
   */
  const matchDatabaseManga = useCallback(async (mangaId: number, targetProviders?: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await utils.providerMatching.matchDatabaseManga.fetch({
        mangaId,
        targetProviders
      });
      if (showNotifications && result.matches.length > 0) {
        notify({ severity: 'SUCCESS', title: 'Matches Found', message: `Found ${result.matches.length} matches for "${result.mangaTitle}"` });
      }
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Failed to match database manga');
      setError(error);
      if (showNotifications) {
        notify({ severity: 'ERROR', title: 'Error', message: `Failed to match manga: ${(error instanceof Error ? error.message : String(error))}` });
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [utils, showNotifications]);

  /**
   * Update matching configuration
   */
  const updateMatchingConfig = trpc.providerMatching.updateMatchingConfig.useMutation({
    onSuccess: () => {
      if (showNotifications) {
        notify({ severity: 'SUCCESS', title: 'Success', message: 'Matching configuration updated' });
      }
    },
    onError: error => {
      if (showNotifications) {
        notify({ severity: 'ERROR', title: 'Error', message: `Failed to update config: ${(error instanceof Error ? error.message : String(error))}` });
      }
    }
  });
  return {
    // State
    isLoading,
    error,
    // Data
    availableProviders: availableProvidersQuery.data ?? [],
    // Methods
    findCrossProviderMatches,
    findProviderToProviderMatch,
    getEnrichedMetadata,
    matchDatabaseManga,
    updateMatchingConfig: (config: unknown) => {
      updateMatchingConfig.mutate(config as never);
    },
    // Query states
    isLoadingProviders: availableProvidersQuery.isLoading,
    providersError: availableProvidersQuery.error !== null ? (availableProvidersQuery.error as unknown as Error) : null
  };
}

/**
 * Hook for matching a specific manga
 * 
 * @param mangaId Manga ID to match
 * @param mangaTitle Manga title
 * @param currentProvider Current provider
 * @returns Matching methods and state for the specific manga
 */
export interface UseMangaProviderMatchingReturn extends UseProviderMatchingReturn {
  matchWithAllProviders: () => Promise<unknown>;
  getEnrichedMetadata: () => Promise<MangaMetadata | null>;
  findOnProvider: (targetProvider: string) => Promise<ProviderMatchResult | null>;
}

export function useMangaProviderMatching(mangaId: number, mangaTitle: string, currentProvider: string): UseMangaProviderMatchingReturn {
  const providerMatching = useProviderMatching();
  const matchWithAllProviders = useCallback(async () => {
    return providerMatching.matchDatabaseManga(mangaId);
  }, [mangaId, providerMatching]);
  const getEnrichedMetadata = useCallback(async () => {
    return providerMatching.getEnrichedMetadata(toStringId(mangaId), currentProvider, mangaTitle);
  }, [mangaId, currentProvider, mangaTitle, providerMatching]);
  const findOnProvider = useCallback(async (targetProvider: string) => {
    return providerMatching.findProviderToProviderMatch(mangaTitle, currentProvider, targetProvider);
  }, [mangaTitle, currentProvider, providerMatching]);
  return {
    ...providerMatching,
    matchWithAllProviders,
    getEnrichedMetadata,
    findOnProvider
  };
}