/**
 * useProviderSearch Hook
 *
 * Manages multi-provider search functionality for BasicInfoStep.
 * Handles search input state, loading states, and parallel provider searches.
 *
 * @module components/addManga/steps/wizard/basic-info-step/hooks/useProviderSearch
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import { processProviderSearchResults, getStringProp, logFandomSearchResults } from '../utils';

import type { Logger, ProviderSearchData } from '../types';

/**
 * Parameters for useProviderSearch hook
 */
export interface UseProviderSearchParams {
  title: string;
  cachedSearchResults?: unknown[] | undefined;
  additionalProviders: Record<string, ProviderSearchData>;
  setAdditionalProviders: (providers: Record<string, ProviderSearchData>) => void;
  setIsSearchingProviders: (searching: boolean) => void;
  logger: Logger;
}

/**
 * Return type for useProviderSearch hook
 */
export interface UseProviderSearchReturn {
  searchInput: string;
  setSearchInput: (value: string) => void;
  loadingResults: Record<string, string>;
  showAllResults: Record<string, boolean>;
  setShowAllResults: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  handleSearchAllProviders: (queryOverride?: string) => Promise<void>;
}

/**
 * Custom hook for managing provider search functionality
 *
 * @param params - Hook parameters
 * @returns Search state and handlers
 */
export function useProviderSearch(params: UseProviderSearchParams): UseProviderSearchReturn {
  const {
    title,
    cachedSearchResults,
    additionalProviders,
    setAdditionalProviders,
    setIsSearchingProviders,
    logger
  } = params;

  const [searchInput, setSearchInput] = useState('');
  const [loadingResults, _setLoadingResults] = useState<Record<string, string>>({});
  const [showAllResults, setShowAllResults] = useState<Record<string, boolean>>({});
  const hasSearched = useRef(false);

  // Get tRPC utils at hook level (not inside callback) to follow Rules of Hooks
  const utils = trpc.useUtils();

  // Initialize search input from title when component mounts or title changes
  useEffect(() => {
    if (title && !searchInput) {
      setSearchInput(title);
    }
  }, [title, searchInput]);

  // Auto-search ref to prevent duplicate searches - initialized with title to detect initial mount
  const autoSearchTriggeredRef = useRef(false);
  const initialTitleRef = useRef(title);

  // Process cached search results on mount
  useEffect(() => {
    if (cachedSearchResults && cachedSearchResults.length > 0 && Object.keys(additionalProviders).length === 0) {
      logger.info('[BasicInfoStep] Processing cached search results:', cachedSearchResults.length);

      // Debug: Log all providers found in cached results
      const allProviders = cachedSearchResults.map(r => {
        const providerValue = getStringProp(r, "provider");
        const sourceValue = getStringProp(r, "source");
        return providerValue ?? sourceValue ?? 'unknown';
      });
      logger.info('[BasicInfoStep] All providers in cached results:', [...new Set(allProviders)]);

      // Process cached results with deduplication
      const groupedResults: Record<string, { results: unknown[]; error: null }> = {};
      const seenIds: Record<string, Set<string>> = {};

      cachedSearchResults.forEach(result => {
        const providerValue = getStringProp(result, "provider");
        const sourceValue = getStringProp(result, "source");
        const providerKey = providerValue ?? sourceValue;
        const resultProvider = providerKey ? providerKey.toLowerCase() : '';

        // Include all providers with deduplication
        if (resultProvider) {
          // Create unique identifier for deduplication
          const resultId = getStringProp(result, "id") ?? '';
          const sourceId = getStringProp(result, "sourceId") ?? '';
          const titleValue = getStringProp(result, "title") ?? '';
          const uniqueKey = `${resultId}-${sourceId}-${titleValue}`;

          // Initialize provider group and seen set if they don't exist
          const providerGroup = (groupedResults[resultProvider] ??= { results: [], error: null });
          const providerSeenIds = (seenIds[resultProvider] ??= new Set<string>());

          // Only add if not already seen for this provider
          if (!providerSeenIds.has(uniqueKey)) {
            providerSeenIds.add(uniqueKey);
            providerGroup.results.push(result);
          }
        }
      });

      if (Object.keys(groupedResults).length > 0) {
        logger.info('[BasicInfoStep] Setting additional providers from cached results:', groupedResults);

        // Log each provider's result count for debugging
        Object.entries(groupedResults).forEach(([providerName, data]) => {
          logger.info(`[BasicInfoStep] Provider ${providerName}: ${data.results.length} results`);
          // Log first result details for debugging
          if (data.results.length > 0) {
            const firstResult = data.results[0];
            logger.info(`[BasicInfoStep] ${providerName} first result:`, {
              title: getStringProp(firstResult, "title"),
              hasVolumes: typeof firstResult === 'object' && firstResult !== null && 'volumes' in firstResult,
              volumes: typeof firstResult === 'object' && firstResult !== null ? (firstResult as Record<string, unknown>)["volumes"] : undefined,
              hasChapters: typeof firstResult === 'object' && firstResult !== null && 'chapters' in firstResult,
              chapters: typeof firstResult === 'object' && firstResult !== null ? (firstResult as Record<string, unknown>)["chapters"] : undefined,
              hasMetadata: typeof firstResult === 'object' && firstResult !== null && 'metadata' in firstResult
            });
          }
        });
        setAdditionalProviders(groupedResults);
      }
    }
  }, [cachedSearchResults, additionalProviders, setAdditionalProviders, logger]);

  const handleSearchAllProviders = useCallback(async (searchQuery?: string): Promise<void> => {
    setIsSearchingProviders(true);

    // Clear existing results first to ensure fresh search
    setAdditionalProviders({});

    try {
      // Use provided query or search input (searchInput always has value as string)
      const titleToSearch = searchQuery ?? (searchInput || title);
      if (!titleToSearch) {
        notify({ severity: 'ERROR', title: 'No title to search', message: 'Please enter a title to search for' });
        setIsSearchingProviders(false);
        return;
      }

      notify({ severity: 'INFO', title: 'Searching', message: `Searching for "${titleToSearch}" across all providers...` });

      // Always perform fresh search
      logger.info('Searching all providers for:', titleToSearch);

      // Define providers to search - use DEFAULT_FIELD_PRIORITIES for 'title' field
      const providersToSearch = DEFAULT_FIELD_PRIORITIES['title']
        ?? ['anilist', 'mangadex', 'comicvine', 'wikipedia', 'fandom'];

      const searchPromises = providersToSearch.map(async (providerName) => {
        try {
          logger.info(`Searching ${providerName} for: ${titleToSearch}`);
          const results = await utils.search.withProvider.fetch({
            provider: providerName,
            query: titleToSearch,
            limit: 10,
            includeAdult: false
          });

          logger.info(`${providerName} search returned:`, results);

          // Special logging for Fandom
          if (providerName === 'fandom' && Array.isArray(results)) {
            logFandomSearchResults(results, logger);
          }

          // Process results
          const processedResults = processProviderSearchResults(results);
          logger.info(`${providerName} processed results count:`, processedResults.length);

          return {
            provider: providerName,
            results: processedResults,
            error: null
          };
        } catch (error) {
          logger.error(`Error searching ${providerName}:`, error);
          return {
            provider: providerName,
            results: [],
            error: error instanceof Error ? error : new Error('Search failed')
          };
        }
      });

      // Execute all searches in parallel
      const searchResults = await Promise.all(searchPromises);

      // Group results by provider with deduplication
      const groupedResults: Record<string, { results: unknown[]; error: unknown }> = {};
      const seenIds: Record<string, Set<string>> = {};

      searchResults.forEach(({ provider: providerName, results, error }) => {
        // Initialize seen set for this provider
        const providerSeenIds = (seenIds[providerName] ??= new Set<string>());
        const dedupedResults: unknown[] = [];

        // Deduplicate results within each provider
        results.forEach((result: unknown) => {
          const resultId = getStringProp(result, "id") ?? '';
          const sourceId = getStringProp(result, "sourceId") ?? '';
          const titleValue = getStringProp(result, "title") ?? '';
          const uniqueKey = `${resultId}-${sourceId}-${titleValue}`;

          if (!providerSeenIds.has(uniqueKey)) {
            providerSeenIds.add(uniqueKey);
            dedupedResults.push(result);
          }
        });

        groupedResults[providerName] = { results: dedupedResults, error };
        if (dedupedResults.length > 0) {
          logger.info(`${providerName} returned ${dedupedResults.length} results (deduped from ${results.length})`);
        }
      });

      logger.info('[BasicInfoStep] Setting additional providers:', Object.keys(groupedResults));

      setAdditionalProviders(groupedResults);

      // Don't auto-select, let user manually pick
      hasSearched.current = true;

      notify({ severity: 'SUCCESS', title: 'Search complete', message: `Found results from ${Object.values(groupedResults).filter(r => {
          return r.results.length > 0;
        }).length} providers` });
    } catch (error) {
      logger.error('Error searching providers:', error);
      notify({ severity: 'ERROR', title: 'Search failed', message: 'Failed to search providers' });
    } finally {
      setIsSearchingProviders(false);
    }
  }, [searchInput, title, setIsSearchingProviders, setAdditionalProviders, logger, utils]);

  // Auto-search when wizard opens with title but no cached results
  // This handles the Quick Add flow from home page where only AniList data exists
  // Use a mount effect that only runs once
  useEffect(() => {
    // Only auto-search on initial mount when:
    // 1. We have an initial title (component mounted with title already set)
    // 2. No cached search results (meaning we came from Quick Add, not regular search)
    // 3. Auto-search hasn't been triggered yet
    const hasCachedResults = cachedSearchResults && cachedSearchResults.length > 0;
    const mountedWithTitle = initialTitleRef.current && initialTitleRef.current.trim().length > 0;

    logger.info('[useProviderSearch] Mount check for auto-search:', {
      mountedWithTitle,
      initialTitle: initialTitleRef.current || '(empty)',
      hasCachedResults,
      autoSearchTriggered: autoSearchTriggeredRef.current
    });

    // Only trigger once, on mount, if we have a title and no cached results
    if (mountedWithTitle && !hasCachedResults && !autoSearchTriggeredRef.current) {
      autoSearchTriggeredRef.current = true;
      const searchTitle = initialTitleRef.current;
      logger.info('[useProviderSearch] Auto-triggering search for Quick Add flow:', { title: searchTitle });

      // Use a small delay to ensure the component is fully mounted and state is settled
      const timeoutId = setTimeout(() => {
        void handleSearchAllProviders(searchTitle);
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  // Empty dependency array - only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    searchInput,
    setSearchInput,
    loadingResults,
    showAllResults,
    setShowAllResults,
    handleSearchAllProviders
  };
}
