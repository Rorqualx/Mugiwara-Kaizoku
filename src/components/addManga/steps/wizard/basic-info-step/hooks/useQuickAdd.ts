/**
 * useQuickAdd Hook
 *
 * Manages quick add manga flow with automatic metadata fetching
 * and import using field provider preferences.
 *
 * @module components/addManga/steps/wizard/basic-info-step/hooks/useQuickAdd
 */

import { useState, useEffect, useCallback } from 'react';

import { notifications } from '@mantine/notifications';

import { getQuickAddService } from '@/components/addManga/services/quickAddService';
import type { QuickAddCallbacks } from '@/components/addManga/services/quickAddService';
import { isRecord } from '@/lib/type-guards';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import { getStringProp } from '../utils';

import type { Logger, ProviderSearchData } from '../types';

/**
 * Parameters for useQuickAdd hook
 */
export interface UseQuickAddParams {
  provider: string;
  title: string;
  url: string;
  additionalProviders: Record<string, ProviderSearchData>;
  selectedSourcesMetadata: Record<string, unknown>;
  /** Library ID for the import - required for correct library targeting */
  libraryId: number;
  onQuickAdd?: (() => Promise<void>) | undefined;
  setIsQuickAdding?: ((loading: boolean) => void) | undefined;
  setCanQuickAdd?: ((can: boolean) => void) | undefined;
  registerQuickAddHandler?: ((handler: () => Promise<void>) => void) | undefined;
  logger: Logger;
  onComplete?: ((mangaId: number) => void) | undefined;
  /** Check if there are pending async fetches (e.g., Fandom scraping) */
  hasPendingFetches?: () => boolean;
  /** Wait for all pending async fetches to complete */
  waitForAllPendingFetches?: () => Promise<void>;
}

/**
 * Return type for useQuickAdd hook
 */
export interface UseQuickAddReturn {
  handleQuickAdd: () => Promise<void>;
  canQuickAdd: boolean;
}

/**
 * Custom hook for managing quick add functionality
 *
 * @param params - Hook parameters
 * @returns Quick add handler and availability state
 */
export function useQuickAdd(params: UseQuickAddParams): UseQuickAddReturn {
  const {
    provider,
    title,
    additionalProviders,
    selectedSourcesMetadata,
    libraryId,
    setIsQuickAdding,
    setCanQuickAdd,
    registerQuickAddHandler,
    logger,
    onComplete,
    hasPendingFetches,
    waitForAllPendingFetches
  } = params;

  const [canQuickAdd, setLocalCanQuickAdd] = useState(false);
  const utils = trpc.useUtils();

  // Update canQuickAdd state for parent footer button
  useEffect(() => {
    const canQuickAddValue = !!(provider && title.trim() && Object.keys(additionalProviders).length > 0);
    setLocalCanQuickAdd(canQuickAddValue);
    if (setCanQuickAdd) {
      setCanQuickAdd(canQuickAddValue);
    }
  }, [provider, title, additionalProviders, setCanQuickAdd]);

  // Quick add handler
  // eslint-disable-next-line complexity, max-statements -- Multi-step import flow: validate, wait for pending fetches, build metadata, execute import
  const handleQuickAdd = useCallback(async (): Promise<void> => {
    if (!provider || !title.trim()) {
      notify({ severity: 'ERROR', title: 'Cannot Quick Add', message: 'Please select a primary provider and enter a title first' });
      return;
    }

    if (setIsQuickAdding) {
      setIsQuickAdding(true);
    }

    try {
      // Wait for any pending async fetches (e.g., Fandom scraping) before proceeding
      // This ensures volume/chapter data is available for Quick Add
      if (hasPendingFetches?.()) {
        logger.info('[useQuickAdd] Waiting for pending metadata fetches to complete...');
        notifications.show({
          id: 'quick-add-waiting',
          title: 'Loading Metadata',
          message: 'Waiting for metadata to finish loading...',
          loading: true,
          autoClose: false
        });

        await waitForAllPendingFetches?.();
        notifications.hide('quick-add-waiting');
        logger.info('[useQuickAdd] Pending fetches completed, proceeding with Quick Add');
      }

      const quickAddService = await getQuickAddService();

      // Check if quick add is available
      const isAvailable = await quickAddService.isQuickAddAvailable(true);
      if (!isAvailable) {
        notify({ severity: 'WARNING', title: 'Quick Add Not Available', message: 'Field provider preferences are not enabled or configured' });
        if (setIsQuickAdding) {
          setIsQuickAdding(false);
        }
        return;
      }

      // Find the primary search result
      const primaryProviderData = additionalProviders[provider];
      const primaryResults = primaryProviderData?.results ?? [];

      if (primaryResults.length === 0) {
        notify({ severity: 'ERROR', title: 'No Search Results', message: 'Please search and select a primary source first' });
        if (setIsQuickAdding) {
          setIsQuickAdding(false);
        }
        return;
      }

      // Find the user's selected result for this provider (not just first result)
      const selectedMetadata = selectedSourcesMetadata[provider];
      let primaryResult: unknown = primaryResults[0]; // Default fallback to first

      // If user has selected a specific result for this provider, find it
      if (selectedMetadata && isRecord(selectedMetadata)) {
        const selectedId = getStringProp(selectedMetadata, 'id');
        const selectedTitle = getStringProp(selectedMetadata, 'title');

        // Find matching result by ID or title
        const matchingResult = primaryResults.find((result) => {
          if (!isRecord(result)) return false;
          const resultId = getStringProp(result, 'id');
          const resultTitle = getStringProp(result, 'title');
          return (selectedId && resultId === selectedId) ||
                 (selectedTitle && resultTitle === selectedTitle);
        });

        if (matchingResult) {
          primaryResult = matchingResult;
          logger.info('[useQuickAdd] Using user-selected result', {
            selectedId,
            selectedTitle,
            matchedById: selectedId && getStringProp(matchingResult as Record<string, unknown>, 'id') === selectedId
          });
        } else {
          logger.warn('[useQuickAdd] Could not find selected result, using first result', {
            selectedId,
            selectedTitle,
            availableResults: primaryResults.length
          });
        }
      } else {
        logger.info('[useQuickAdd] No selection for provider, using first result', { provider });
      }

      if (!isRecord(primaryResult)) {
        notify({ severity: 'ERROR', title: 'Invalid Primary Result', message: 'Selected primary source data is invalid' });
        if (setIsQuickAdding) {
          setIsQuickAdding(false);
        }
        return;
      }

      // Prepare quick add callbacks
      const callbacks: QuickAddCallbacks = {
        onProgress: (progress) => {
          logger.info('[BasicInfoStep] Quick add progress:', progress);
        },
        onSuccess: (mangaId) => {
          notify({ severity: 'SUCCESS', title: 'Quick Add Complete', message: `Manga imported successfully with ID: ${mangaId}` });
          logger.info('[BasicInfoStep] Quick add completed successfully', { mangaId });

          // Pre-fetch manga data before navigation to ensure page loads correctly
          void (async (): Promise<void> => {
            try {
              // Invalidate stale cache first
              await utils.manga.query.invalidate();
              await utils.manga.get.invalidate({ id: mangaId });

              // Pre-fetch the manga data - this populates the cache
              // No chapter limit to support manga with 1000+ chapters (e.g., One Piece)
              await utils.manga.get.fetch({ id: mangaId, chapterLimit: 0 });
              logger.info('[BasicInfoStep] Pre-fetched manga data before navigation', { mangaId });
            } catch (e) {
              logger.warn('[BasicInfoStep] Pre-fetch failed, navigating anyway', e);
            }

            if (setIsQuickAdding) {
              setIsQuickAdding(false);
            }
            // Close the modal and navigate
            if (onComplete) {
              onComplete(mangaId);
            }
          })();
        },
        onError: (error) => {
          notify({ severity: 'ERROR', title: 'Quick Add Failed', message: error.message });
          logger.error('[BasicInfoStep] Quick add failed:', error);
          if (setIsQuickAdding) {
            setIsQuickAdding(false);
          }
        }
      };

      // Convert primary result to ExtendedMangaSearchResult format
      const searchResult: Record<string, unknown> = {
        ...primaryResult,
        provider: provider
      };

      // Build all search results map
      const allSearchResults: Record<string, unknown[]> = {};
      Object.entries(additionalProviders).forEach(([providerName, data]) => {
        const providerData = data;
        if (providerData.results && providerData.results.length > 0) {
          allSearchResults[providerName] = providerData.results;
        }
      });

      // DEBUG: Log selectedSourcesMetadata structure to trace user selection
      logger.warn('[BasicInfoStep] QuickAdd selectedSourcesMetadata debug', {
        keys: Object.keys(selectedSourcesMetadata),
        entries: Object.entries(selectedSourcesMetadata).map(([k, v]) => ({
          key: k,
          title: typeof v === 'object' && v ? (v as Record<string, unknown>)['title'] : undefined,
          publisher: typeof v === 'object' && v ? (v as Record<string, unknown>)['publisher'] : undefined,
          id: typeof v === 'object' && v ? (v as Record<string, unknown>)['id'] : undefined
        }))
      });

      logger.info('[BasicInfoStep] Starting quick add flow', {
        title: getStringProp(primaryResult, 'title'),
        provider,
        allProviders: Object.keys(allSearchResults),
        libraryId
      });

      await quickAddService.quickAddManga(
        searchResult as ExtendedMangaSearchResult,
        allSearchResults as Record<string, ExtendedMangaSearchResult[]> | undefined,
        libraryId,
        callbacks,
        selectedSourcesMetadata // Pass user's explicit provider selections to preserve correct edition
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[BasicInfoStep] Quick add error:', error);
      notify({ severity: 'ERROR', title: 'Quick Add Error', message: errorMessage });
      if (setIsQuickAdding) {
        setIsQuickAdding(false);
      }
    }
  }, [provider, title, additionalProviders, selectedSourcesMetadata, libraryId, setIsQuickAdding, logger, onComplete, utils, hasPendingFetches, waitForAllPendingFetches]);

  // Register quick add handler with parent
  useEffect(() => {
    if (registerQuickAddHandler) {
      registerQuickAddHandler(handleQuickAdd);
    }
  }, [registerQuickAddHandler, handleQuickAdd]);

  return {
    handleQuickAdd,
    canQuickAdd
  };
}
