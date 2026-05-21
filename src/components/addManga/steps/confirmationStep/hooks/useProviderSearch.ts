/**
 * Provider search functionality for confirmation step
 * Handles searching across multiple metadata providers
 */
import { useState, useCallback} from 'react';

import { logger } from '@/utils/logger';

import type { ProviderResults, MangaSearchResult } from './useConfirmationState';
/**
 * Return type for useProviderSearch hook
 */
export interface UseProviderSearchReturn {
  isSearching: boolean;
  searchResults: Record<string, ProviderResults>;
  searchErrors: Record<string, string>;
  searchProvider: (provider: string, query: string, searchFn: (query: string) => Promise<unknown[]>) => Promise<void>;
  searchAllProviders: (query: string, providers: string[], searchFunctions: Record<string, (query: string) => Promise<unknown[]>>) => Promise<void>;
  clearProviderResults: (provider: string) => void;
  clearAllResults: () => void;
  getProviderResults: (provider: string) => ProviderResults | null;
  getProviderError: (provider: string) => string | null;
  isAnyProviderSearching: () => boolean;
  successfulSearchCount: () => number;
}

/**
 * Hook for managing cross-provider searches
 */
export function useProviderSearch(): UseProviderSearchReturn {
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Record<string, ProviderResults>>({});
    const [searchErrors, setSearchErrors] = useState<Record<string, string>>({});
    /**
     * Search a single provider
     */
    const searchProvider = useCallback(async (provider: string, query: string, searchFn: (query: string) => Promise<unknown[]>): Promise<void> => {
        try {
            // Set loading state for this provider
            setSearchResults((prev) => ({
                ...prev,
                [provider]: {
                    results: [],
                    isLoading: true
                }
            }));
            // Perform search
            const results = await searchFn(query);
            // Update results
            setSearchResults((prev) => {
                const next = { ...prev };
                next[provider] = {
                    results: results as unknown as MangaSearchResult[],
                    isLoading: false
                };
                return next;
            });
            // Clear any previous errors
            setSearchErrors((prev) => {
                const next = { ...prev };
                delete next[provider];
                return next;
            });
        }
        catch (error: unknown) {
            // Handle error
            const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Search failed';
            setSearchResults((prev) => ({
                ...prev,
                [provider]: {
                    results: [],
                    isLoading: false,
                    error: errorMessage
                }
            }));
            setSearchErrors((prev) => ({
                ...prev,
                [provider]: errorMessage
            }));
        }
    }, []);
    /**
     * Search all providers in parallel
     */
    const searchAllProviders = useCallback(async (query: string, providers: string[], searchFunctions: Record<string, (query: string) => Promise<unknown[]>>) => {
        setIsSearching(true);
        // Clear previous results
        setSearchResults({});
        setSearchErrors({});
        // Search all providers in parallel
        const searchPromises = providers.map((provider) => {
            const searchFn = searchFunctions[provider];
            if (!searchFn) {
                logger.warn(`No search function for provider: ${provider}`);
                return Promise.resolve();
            }
            return searchProvider(provider, query, searchFn);
        });
        // Wait for all searches to complete
        await Promise.allSettled(searchPromises);
        setIsSearching(false);
    }, [searchProvider]);
    /**
     * Clear search results for a specific provider
     */
    const clearProviderResults = useCallback((provider: string) => {
        setSearchResults((prev) => {
            const next = { ...prev };
            delete next[provider];
            return next;
        });
        setSearchErrors((prev) => {
            const next = { ...prev };
            delete next[provider];
            return next;
        });
    }, []);
    /**
     * Clear all search results
     */
    const clearAllResults = useCallback(() => {
        setSearchResults({});
        setSearchErrors({});
    }, []);
    /**
     * Get results for a specific provider
     */
    const getProviderResults = useCallback((provider: string): ProviderResults | null => {
        return searchResults[provider] ?? null;
    }, [searchResults]);
    /**
     * Get error for a specific provider
     */
    const getProviderError = useCallback((provider: string): string | null => {
        return searchErrors[provider] ?? null;
    }, [searchErrors]);
    /**
     * Check if any provider is currently searching
     */
    const isAnyProviderSearching = useCallback(() => {
        return Object.values(searchResults).some((result) => result.isLoading);
    }, [searchResults]);
    /**
     * Get count of successful provider searches
     */
    const successfulSearchCount = useCallback(() => {
        return Object.values(searchResults).filter((result) => !result.isLoading && !result.error && result.results.length > 0).length;
    }, [searchResults]);
    return {
        // State
        isSearching,
        searchResults,
        searchErrors,
        // Actions
        searchProvider,
        searchAllProviders,
        clearProviderResults,
        clearAllResults,
        // Getters
        getProviderResults,
        getProviderError,
        isAnyProviderSearching,
        successfulSearchCount
    };
}
