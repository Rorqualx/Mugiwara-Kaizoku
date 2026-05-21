/**
 * Custom hook for provider search functionality
 *
 * Handles searching across multiple providers and auto-selecting best values
 */

import { useState, useCallback } from 'react';

import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { PROVIDER_LIST, SOURCE_PREFERENCE_KEYS, autoSelectBestValues, isRecord, normalizeProviderResult } from './utils';

import type { FieldSelection, ProviderBindings } from './types';

interface UseProviderSearchOptions {
  mangaTitle: string;
  currentMetadata?: Record<string, unknown> | undefined;
  autoSelectBest: boolean;
  /** Existing provider bindings (provider → providerId) */
  providerBindings?: ProviderBindings | undefined;
}

interface UseProviderSearchResult {
  providerData: Record<string, unknown>;
  fieldSelections: Record<string, FieldSelection>;
  isSearching: boolean;
  /** Non-empty when the search was skipped or all providers failed */
  searchError: string | null;
  searchAllProviders: () => Promise<void>;
  setFieldSelections: React.Dispatch<React.SetStateAction<Record<string, FieldSelection>>>;
  resetState: () => void;
}

export function useProviderSearch({
  mangaTitle,
  currentMetadata,
  autoSelectBest,
  providerBindings
}: UseProviderSearchOptions): UseProviderSearchResult {
  const [providerData, setProviderData] = useState<Record<string, unknown>>({});
  const [fieldSelections, setFieldSelections] = useState<Record<string, FieldSelection>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const resetState = useCallback((): void => {
    setFieldSelections({});
    setProviderData({});
    setSearchError(null);
  }, []);

  const searchAllProviders = useCallback(async (): Promise<void> => {
    setIsSearching(true);
    setSearchError(null);

    // Guard: title must be at least 3 characters (matches Zod schema on server)
    if (!mangaTitle || mangaTitle.trim().length < 3) {
      const results: Record<string, unknown> = {};
      if (currentMetadata) {
        results['current'] = currentMetadata;
      }
      setProviderData(results);
      setSearchError(
        mangaTitle.trim().length === 0
          ? 'Manga title is empty. Cannot search providers.'
          : `Manga title "${mangaTitle}" is too short (min 3 characters). Cannot search providers.`
      );
      setIsSearching(false);
      return;
    }

    try {
      // Search providers sequentially with a small delay to avoid rate limits.
      // Parallel requests trigger the server-side rate limiter.
      const DELAY_MS = 1200;
      const results: Record<string, unknown> = {};
      const failedProviders: string[] = [];

      const searchProvider = async (provider: string, delayMs: number): Promise<void> => {
        if (delayMs > 0) {
          await new Promise<void>((resolve) => { setTimeout(resolve, delayMs); });
        }

        const rawBoundId = providerBindings?.[provider];
        // Normalize bound IDs to lowercase (MangaDex UUIDs, Fandom wiki names)
        const boundId = rawBoundId && (provider === 'mangadex' || provider === 'fandom')
          ? rawBoundId.toLowerCase() : rawBoundId;

        try {
          let raw: unknown;

          if (boundId) {
            // Provider is bound → fetch by ID for exact match
            logger.info(`Using bound ID for ${provider}: ${boundId}`);
            raw = await utils.client.search.getMetadata.query({
              provider,
              id: boundId,
              title: mangaTitle
            });
          } else {
            // No binding → fall back to title search
            const searchResult = await utils.client.search.withProvider.query({
              provider,
              query: mangaTitle,
              limit: 1
            });
            raw = Array.isArray(searchResult) && searchResult.length > 0 ? searchResult[0] : null;
          }

          if (raw !== null && raw !== undefined) {
            results[provider] = isRecord(raw) ? normalizeProviderResult(raw) : raw;
          }
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to search ${provider}: ${msg}`);
          failedProviders.push(provider);
        }
      };

      // Execute sequentially to respect rate limits
      for (let i = 0; i < PROVIDER_LIST.length; i++) {
        // eslint-disable-next-line no-await-in-loop -- intentionally sequential to avoid rate limits
        await searchProvider(PROVIDER_LIST[i] as string, i > 0 ? DELAY_MS : 0);
      }

      // Include current metadata as an option
      if (currentMetadata) {
        results['current'] = currentMetadata;
      }

      setProviderData(results);

      // Surface failures to the user
      if (failedProviders.length > 0 && failedProviders.length < PROVIDER_LIST.length) {
        setSearchError(`Some providers failed: ${failedProviders.join(', ')}. Try refreshing.`);
      } else if (failedProviders.length === PROVIDER_LIST.length) {
        setSearchError('All provider searches failed (rate limited). Wait a moment and try again.');
      }

      // Auto-select best values if enabled
      if (autoSelectBest) {
        const selections = autoSelectBestValues(results, providerBindings);
        setFieldSelections(selections);
      }
    } finally {
      setIsSearching(false);
    }
  }, [mangaTitle, currentMetadata, autoSelectBest, providerBindings, utils.client.search.withProvider, utils.client.search.getMetadata]);

  return {
    providerData,
    fieldSelections,
    isSearching,
    searchError,
    searchAllProviders,
    setFieldSelections: (action) => {
      if (typeof action === 'function') {
        setFieldSelections(action);
      } else {
        setFieldSelections(action);
      }
    },
    resetState
  };
}

/**
 * Handle field selection from a provider
 */
 
export function createFieldSelectionHandler(
  providerData: Record<string, unknown>,
  setFieldSelections: React.Dispatch<React.SetStateAction<Record<string, FieldSelection>>>
): (field: string, provider: string) => void {
  return (field: string, provider: string): void => {
    // Source preference fields store the provider name as the value
    if (SOURCE_PREFERENCE_KEYS.has(field)) {
      setFieldSelections(prev => ({
        ...prev,
        [field]: { field, provider, value: provider }
      }));
      return;
    }

    const providerEntry = providerData[provider];
    const value = isRecord(providerEntry) ? providerEntry[field] : undefined;

    if (value !== undefined) {
      setFieldSelections(prev => ({
        ...prev,
        [field]: { field, provider, value }
      }));
    }
  };
}
