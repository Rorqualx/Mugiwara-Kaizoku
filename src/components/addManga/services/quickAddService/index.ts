/**
 * Quick Add Service - Main Aggregator
 *
 * Provides streamlined manga import when field provider preferences are configured.
 * Bypasses the wizard by automatically applying saved preferences and importing
 * all available volumes/chapters.
 *
 * Architecture:
 * - types.ts - Type definitions (10+ interfaces)
 * - preferences-loader.ts - Settings access and availability checks
 * - field-selector.ts - Field value selection with provider fallback
 * - volume-fetcher.ts - Multi-provider volume fetching
 * - data-builder.ts - Form data and metadata construction
 * - import-executor.ts - Import mutation execution
 *
 * @module components/addManga/services/quickAddService
 */


import type { AppRouter } from '@/server/trpc/root';
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { vanillaTrpcClient } from '@/utils/trpc-client/vanilla';


/**
 * Get providers to search for auto-matching from user preferences.
 * Excludes the current provider (we're searching OTHER providers for matches).
 */
function getProvidersToSearch(
  preferences: Record<string, string[]>,
  currentProvider: string
): string[] {
  // Get provider order from 'title' field preference (or default)
  // Fall back to a hardcoded list if DEFAULT_FIELD_PRIORITIES doesn't have 'title'
  const providerOrder = preferences['title']
    ?? DEFAULT_FIELD_PRIORITIES['title']
    ?? ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];

  // Filter out the current provider and only include searchable providers
  const searchableProviders = ['mangadex', 'comicvine', 'fandom', 'wikipedia'];
  return providerOrder.filter(
    p => p !== currentProvider.toLowerCase() && searchableProviders.includes(p)
  );
}

import { autoSelectVolumesChapters, buildSourcesMetadata, constructFormData } from './data-builder';
import { constructFieldSelections } from './field-selector';
import { performImport } from './import-executor';
import { buildVolumeFieldSources, isQuickAddAvailable, loadPreferences } from './preferences-loader';
import { findProviderMatches, mergeSearchResults } from './provider-matcher';
import { fetchVolumesFromMultipleProviders } from './volume-fetcher';

import type { QuickAddCallbacks, QuickAddServiceDependencies } from './types';
import type { TRPCClient } from '@trpc/client';

// ============================================================================
// QuickAddService Class
// ============================================================================

/**
 * Quick Add Service
 *
 * Provides streamlined manga import when field provider preferences are configured.
 * Bypasses the wizard by automatically applying saved preferences and importing
 * all available volumes/chapters.
 */
export class QuickAddService {
  private trpcClient: TRPCClient<AppRouter>;

  constructor(dependencies: QuickAddServiceDependencies) {
    this.trpcClient = dependencies.trpcClient;
  }

  /**
   * Execute quick-add flow for a search result
   *
   * @param searchResult - Selected manga search result
   * @param allSearchResults - All search results from providers
   * @param libraryId - Target library ID
   * @param callbacks - Progress and completion callbacks
   * @param selectedSourcesMetadata - User's explicitly selected metadata for each provider
   * @returns Promise resolving to manga ID or null on failure
   */
  // eslint-disable-next-line complexity, max-statements -- Orchestration function coordinating 8 workflow stages; complexity is inherent to multi-step import flow
  async quickAddManga(
    searchResult: ExtendedMangaSearchResult,
    allSearchResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
    libraryId: number,
    callbacks: QuickAddCallbacks = {},
    selectedSourcesMetadata?: Record<string, unknown>
  ): Promise<number | null> {
    const { onProgress, onSuccess, onError } = callbacks;

    try {
      logger.info('[QuickAddService] Starting quick-add flow', {
        mangaTitle: searchResult.title,
        provider: searchResult.provider,
        libraryId
      });

      // Stage 1: Load field provider preferences
      onProgress?.({ stage: 'loading_preferences', message: 'Loading field provider preferences...', progress: 10 });
      const preferences = await loadPreferences(this.trpcClient);

      if (!preferences.enabled) {
        throw new Error('Field provider preferences are not enabled');
      }

      logger.info('[QuickAddService] Loaded preferences', {
        fieldCount: Object.keys(preferences.preferences).length,
        autoMatchEnabled: preferences.autoMatchEnabled
      });

      // Stage 2: Auto-match providers (if enabled)
      let enrichedSearchResults = allSearchResults ?? {};

      console.warn('[QuickAddService] Stage 2: Auto-matching check', {
        autoMatchEnabled: preferences.autoMatchEnabled,
        willRunAutoMatch: preferences.autoMatchEnabled !== false,
      });

      if (preferences.autoMatchEnabled !== false) {
        onProgress?.({
          stage: 'auto_matching',
          message: 'Finding matches on other providers...',
          progress: 20
        });

        console.warn('[QuickAddService] Starting auto-matching for', searchResult.title);

        try {
          // Derive providers to search from user preferences (excludes current provider)
          const providersToSearch = getProvidersToSearch(preferences.preferences, searchResult.provider);

          const autoMatchResult = await findProviderMatches(
            searchResult,
            allSearchResults,
            this.trpcClient,
            { enabled: true, confidenceThreshold: 0.65, timeoutMs: 15000, providersToSearch }
          );

          console.warn('[QuickAddService] Auto-matching result', {
            matchedProviders: autoMatchResult.matchedProviders,
            skippedProviders: autoMatchResult.skippedProviders,
            errors: autoMatchResult.errors,
            enrichedKeys: Object.keys(autoMatchResult.enrichedSearchResults),
          });

          enrichedSearchResults = mergeSearchResults(allSearchResults, autoMatchResult);

          console.warn('[QuickAddService] Merged search results', {
            allSearchResultsKeys: allSearchResults ? Object.keys(allSearchResults) : [],
            enrichedSearchResultsKeys: Object.keys(enrichedSearchResults),
          });

          logger.info('[QuickAddService] Auto-matching complete', {
            matchedProviders: autoMatchResult.matchedProviders,
            skippedProviders: autoMatchResult.skippedProviders,
            hasErrors: Object.keys(autoMatchResult.errors).length > 0
          });
        } catch (error) {
          // Non-blocking: continue with existing results
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn('[QuickAddService] Auto-matching EXCEPTION', { error: errorMessage });
          logger.warn('[QuickAddService] Auto-matching failed, continuing with existing results', {
            error: errorMessage
          });
        }
      } else {
        console.warn('[QuickAddService] Auto-matching SKIPPED (disabled)');
      }

      // Stage 3: Construct field selections from preferences
      onProgress?.({ stage: 'constructing_data', message: 'Applying field provider preferences...', progress: 40 });
      const fieldSelections = constructFieldSelections(searchResult, enrichedSearchResults, preferences.preferences, selectedSourcesMetadata);

      logger.info('[QuickAddService] Constructed field selections', { fieldCount: Object.keys(fieldSelections).length });

      // Stage 4: Fetch volume/chapter data from providers
      onProgress?.({ stage: 'fetching_volumes', message: 'Fetching volume and chapter data...', progress: 50 });
      const sourcesMetadata = buildSourcesMetadata(searchResult, enrichedSearchResults, selectedSourcesMetadata);

      const volumePreferredProvider = preferences.preferences['volumes']?.[0] ?? 'comicvine';
      const chapterPreferredProvider = preferences.preferences['chapters']?.[0] ?? 'fandom';

      logger.info('[QuickAddService] Fetching from providers based on preferences', {
        volumePreferredProvider,
        chapterPreferredProvider,
        willFetchBoth: volumePreferredProvider !== chapterPreferredProvider
      });

      const fetchedVolumeData = await fetchVolumesFromMultipleProviders(
        sourcesMetadata,
        volumePreferredProvider,
        chapterPreferredProvider,
        this.trpcClient
      );

      logger.info('[QuickAddService] Fetched volume data', {
        provider: fetchedVolumeData?.provider ?? 'none',
        totalVolumes: fetchedVolumeData?.totalVolumes ?? 0,
        totalChapters: fetchedVolumeData?.totalChapters ?? 0
      });

      // Stage 5: Prepare wizard form data
      onProgress?.({ stage: 'constructing_data', message: 'Preparing import data...', progress: 60 });
      const formData = constructFormData(searchResult, fieldSelections);

      // Stage 6: Auto-select volumes and chapters
      const { selectedVolumes, selectedChapters, volumesData } = autoSelectVolumesChapters(searchResult, fetchedVolumeData);

      logger.info('[QuickAddService] Auto-selected volumes/chapters', {
        volumeCount: selectedVolumes.length,
        chapterCount: selectedChapters.length,
        hasVolumeDetails: volumesData.volumes && volumesData.volumes.length > 0
      });

      // Build volumeFieldSources from preferences
      const volumeFieldSources = buildVolumeFieldSources(preferences.preferences);

      logger.info('[QuickAddService] Built volumeFieldSources from preferences', {
        volumeCover: volumeFieldSources.volumeCover,
        volumeSummary: volumeFieldSources.volumeSummary,
        chapterCover: volumeFieldSources.chapterCover
      });

      // Stage 7: Import manga
      onProgress?.({ stage: 'importing', message: 'Importing manga...', progress: 70 });

      // Build config object conditionally for exactOptionalPropertyTypes
      const importConfig: { libraryId: number; onProgress?: (progress: import('./types').QuickAddProgress) => void } = { libraryId };
      if (onProgress) {
        importConfig.onProgress = onProgress;
      }

      const mangaId = await performImport({
        searchData: { searchResult, allSearchResults: enrichedSearchResults },
        formData,
        fieldSelections,
        selections: { volumes: selectedVolumes, chapters: selectedChapters },
        volumesData,
        volumeFieldSources,
        providerPreferences: { volumeProvider: volumePreferredProvider, chapterProvider: chapterPreferredProvider },
        config: importConfig,
        selectedSourcesMetadata
      }, this.trpcClient);

      if (mangaId) {
        onProgress?.({ stage: 'complete', message: 'Import complete!', progress: 100 });
        onSuccess?.(mangaId);
        logger.info('[QuickAddService] Quick-add completed successfully', { mangaId });
      } else {
        throw new Error('Import returned null manga ID');
      }

      return mangaId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[QuickAddService] Quick-add failed', error instanceof Error ? error : new Error(errorMessage));

      onProgress?.({ stage: 'error', message: `Import failed: ${errorMessage}`, progress: 0 });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return null;
    }
  }

  /**
   * Check if quick-add is available for user
   *
   * @param checkPreferencesEnabled - Whether to check if preferences are enabled
   * @returns Promise resolving to true if quick-add is available
   */
  async isQuickAddAvailable(checkPreferencesEnabled: boolean = true): Promise<boolean> {
    return isQuickAddAvailable(this.trpcClient, checkPreferencesEnabled);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a QuickAddService instance with the provided tRPC client
 *
 * @param trpcClient - tRPC client instance for API calls
 * @returns QuickAddService instance
 */
export function createQuickAddService(trpcClient: TRPCClient<AppRouter>): QuickAddService {
  return new QuickAddService({ trpcClient });
}

/**
 * Get or create QuickAddService instance using the default vanilla tRPC client
 *
 * This is the primary way to obtain a QuickAddService instance in non-React contexts.
 * Uses the vanilla tRPC client which includes credentials for authenticated requests.
 *
 * Note: This function is synchronous but callers may still use `await getQuickAddService()`
 * for forward compatibility if async initialization is needed in the future.
 *
 * @returns QuickAddService instance
 */
export function getQuickAddService(): QuickAddService {
  return createQuickAddService(vanillaTrpcClient as TRPCClient<AppRouter>);
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  QuickAddStage,
  QuickAddProgress,
  QuickAddCallbacks,
  FieldProviderPreferences,
  VolumeFieldSources,
  FetchedVolumeData,
  QuickAddServiceDependencies,
  AutoMatchConfig,
  AutoMatchResult
} from './types';

export { findProviderMatches, mergeSearchResults } from './provider-matcher';
