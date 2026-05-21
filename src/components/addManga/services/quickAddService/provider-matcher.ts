/**
 * Quick Add Service - Provider Matcher
 *
 * Handles cross-provider matching during quick-add flow.
 * Automatically finds matching entries on other providers and converts
 * them to ExtendedMangaSearchResult format for field selection.
 *
 * @module components/addManga/services/quickAddService/provider-matcher
 */


import type { ProviderMatchResult } from '@/server/services/metadata/provider-matching/types-and-utils';
import type { AppRouter } from '@/server/trpc/root';
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import {
  getProvidersToSearch,
  createTimeout,
  executeCrossProviderMatching,
  processMatches
} from './provider-matcher/matching-operations';

import type { AutoMatchConfig, AutoMatchResult } from './types';
import type { TRPCClient } from '@trpc/client';

// ============================================================================
// Constants
// ============================================================================

/**
 * Get searchable providers from default priorities.
 * Filters to only include providers that support cross-search.
 */
function getDefaultSearchableProviders(): string[] {
  const searchableProviders = ['comicvine', 'fandom', 'wikipedia'];
  const defaultOrder = DEFAULT_FIELD_PRIORITIES['title'] ?? ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];
  return defaultOrder.filter(p => searchableProviders.includes(p));
}

/** Default configuration for auto-matching */
const DEFAULT_AUTO_MATCH_CONFIG: AutoMatchConfig = {
  enabled: true,
  confidenceThreshold: 0.65,
  timeoutMs: 15000,
  providersToSearch: getDefaultSearchableProviders(),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty auto-match result
 */
function createEmptyResult(): AutoMatchResult {
  return {
    matchedProviders: [],
    enrichedSearchResults: {},
    matchConfidences: {},
    skippedProviders: [],
    errors: {},
  };
}

/**
 * Log individual match details
 */
function logMatchDetails(match: ProviderMatchResult, index: number): void {
  logger.debug(`[provider-matcher] Match ${index + 1}:`, {
    provider: match.provider,
    title: match.title,
    confidence: match.confidence,
    hasMetadata: !!match.metadata,
  });
}

/**
 * Execute matching and process results
 */
async function executeAndProcessMatching(
  searchResult: ExtendedMangaSearchResult,
  toSearch: string[],
  skipped: string[],
  fullConfig: AutoMatchConfig,
  trpcClient: TRPCClient<AppRouter>
): Promise<AutoMatchResult> {
  const matchingResult = await Promise.race([
    executeCrossProviderMatching(searchResult, toSearch, trpcClient),
    createTimeout(fullConfig.timeoutMs),
  ]);

  logger.debug('[provider-matcher] tRPC call completed', {
    matchCount: matchingResult.matches.length,
  });

  matchingResult.matches.forEach(logMatchDetails);

  const { enrichedResults, matchedProviders, matchConfidences } = processMatches(
    matchingResult.matches,
    fullConfig
  );

  logger.info('[provider-matcher] Cross-provider matching complete', {
    matchedProviders,
    skippedProviders: skipped,
    totalMatches: matchingResult.matches.length,
    matchesAboveThreshold: matchedProviders.length,
  });

  const result: AutoMatchResult = {
    matchedProviders,
    enrichedSearchResults: enrichedResults,
    matchConfidences,
    skippedProviders: skipped,
    errors: {},
  };

  if (matchingResult.mergedMetadata) {
    result.mergedMetadata = matchingResult.mergedMetadata;
  }

  return result;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Find matching entries on other providers
 *
 * Calls the providerMatching.findCrossProviderMatches tRPC endpoint to find
 * matching manga entries on providers that don't already have results.
 * Converts matches to ExtendedMangaSearchResult format for field selection.
 *
 * This operation is non-blocking - failures return an empty result rather
 * than throwing, allowing quick-add to continue with existing data.
 */
export async function findProviderMatches(
  searchResult: ExtendedMangaSearchResult,
  existingResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  trpcClient: TRPCClient<AppRouter>,
  config?: Partial<AutoMatchConfig>
): Promise<AutoMatchResult> {
  const fullConfig: AutoMatchConfig = { ...DEFAULT_AUTO_MATCH_CONFIG, ...config };
  const emptyResult = createEmptyResult();

  if (!fullConfig.enabled) {
    logger.debug('[provider-matcher] Auto-matching disabled by config');
    return emptyResult;
  }

  const { toSearch, skipped } = getProvidersToSearch(
    searchResult.provider,
    existingResults,
    fullConfig
  );

  if (toSearch.length === 0) {
    logger.info('[provider-matcher] No providers to search, all skipped', { skippedProviders: skipped });
    return { ...emptyResult, skippedProviders: skipped };
  }

  logger.info('[provider-matcher] Starting cross-provider matching', {
    primaryTitle: searchResult.title,
    primaryProvider: searchResult.provider,
    providersToSearch: toSearch,
  });

  try {
    return await executeAndProcessMatching(searchResult, toSearch, skipped, fullConfig, trpcClient);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('[provider-matcher] Cross-provider matching failed', {
      error: errorMessage,
      primaryTitle: searchResult.title,
    });
    return { ...emptyResult, skippedProviders: skipped, errors: { _general: errorMessage } };
  }
}

/**
 * Merge auto-match results with existing search results
 *
 * Combines existing search results with newly matched results,
 * preferring existing results when both are available.
 */
export function mergeSearchResults(
  existingResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  autoMatchResult: AutoMatchResult
): Record<string, ExtendedMangaSearchResult[]> {
  const merged: Record<string, ExtendedMangaSearchResult[]> = { ...existingResults };

  for (const [provider, results] of Object.entries(autoMatchResult.enrichedSearchResults)) {
    if (!merged[provider] || merged[provider].length === 0) {
      merged[provider] = results;
    }
  }

  return merged;
}
