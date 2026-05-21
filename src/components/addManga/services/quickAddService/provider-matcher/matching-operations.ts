/**
 * Provider Matcher - Matching Operations
 *
 * Core logic for cross-provider matching, filtering, and processing.
 *
 * @module components/addManga/services/quickAddService/provider-matcher/matching-operations
 */

import type { ProviderMatchResult } from '@/server/services/metadata/provider-matching/types-and-utils';
import type { AppRouter } from '@/server/trpc/root';
import type { ExtendedMangaSearchResult, MangaMetadata } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { convertMatchToSearchResult } from './type-conversion';

import type { AutoMatchConfig } from '../types';
import type { TRPCClient } from '@trpc/client';

// ============================================================================
// Provider Filtering
// ============================================================================

/**
 * Get providers to search for matches
 *
 * Filters out the primary provider and any providers that already have results.
 *
 * @param primaryProvider - The provider of the primary search result
 * @param existingResults - Already available search results
 * @param config - Auto-match configuration
 * @returns List of providers to search
 */
export function getProvidersToSearch(
  primaryProvider: string,
  existingResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  config: AutoMatchConfig
): { toSearch: string[]; skipped: string[] } {
  const normalizedPrimary = primaryProvider.toLowerCase();
  const skipped: string[] = [];
  const toSearch: string[] = [];

  for (const provider of config.providersToSearch) {
    const normalizedProvider = provider.toLowerCase();

    // Skip primary provider
    if (normalizedProvider === normalizedPrimary) {
      skipped.push(provider);
      continue;
    }

    // Skip providers with existing results
    const hasExisting = existingResults?.[provider]?.length ?? 0;
    const hasExistingLower = existingResults?.[normalizedProvider]?.length ?? 0;

    if (hasExisting > 0 || hasExistingLower > 0) {
      skipped.push(provider);
      continue;
    }

    toSearch.push(provider);
  }

  return { toSearch, skipped };
}

// ============================================================================
// Timeout Utility
// ============================================================================

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Auto-matching timed out after ${ms}ms`));
    }, ms);
  });
}

// ============================================================================
// Alternative Titles Extraction
// ============================================================================

/**
 * Extract alternative titles from search result in the format expected by providers
 *
 * Converts the array-based alternativeTitles to the structured format
 * that ComicVine's multi-query search can use for better matching.
 */
export function extractAlternativeTitlesForMatching(
  searchResult: ExtendedMangaSearchResult
): {
  english?: string | undefined;
  romaji?: string | undefined;
  native?: string | undefined;
  synonyms?: string[] | undefined;
} | undefined {
  // Get all possible alternative titles
  const altTitles = searchResult.alternativeTitles ?? [];
  const synonyms = searchResult.synonyms ?? searchResult.alternativeNames ?? [];

  // If no alternative info available, return undefined
  if (altTitles.length === 0 && synonyms.length === 0) {
    return undefined;
  }

  // Try to extract structured titles from the search result metadata if available
  const metadata = searchResult.metadata as Record<string, unknown> | undefined;
  const titleObj = metadata?.['title'] as Record<string, string> | undefined;

  return {
    english: titleObj?.['english'] ?? altTitles[0],
    romaji: titleObj?.['romaji'] ?? altTitles[1],
    native: titleObj?.['native'],
    synonyms: synonyms.length > 0 ? synonyms : (altTitles.length > 2 ? altTitles.slice(2) : undefined),
  };
}

// ============================================================================
// Cross-Provider Matching Execution
// ============================================================================

/**
 * Execute the cross-provider matching query
 */
export async function executeCrossProviderMatching(
  searchResult: ExtendedMangaSearchResult,
  providersToSearch: string[],
  trpcClient: TRPCClient<AppRouter>
): Promise<{
  query: string;
  matches: ProviderMatchResult[];
  bestMatch?: ProviderMatchResult;
  mergedMetadata?: MangaMetadata;
}> {
  // Extract alternative titles for better cross-provider matching
  const alternativeTitles = extractAlternativeTitlesForMatching(searchResult);

  logger.debug('[provider-matcher] Extracted alternative titles for matching', {
    title: searchResult.title,
    alternativeTitles,
  });

  return trpcClient.providerMatching.findCrossProviderMatches.query({
    title: searchResult.title,
    alternativeTitles,
    options: {
      providers: providersToSearch,
      limit: 1,
      fetchMetadata: true,
      mergeMetadata: false,
    },
  });
}

// ============================================================================
// Match Processing
// ============================================================================

/**
 * Process match results and filter by confidence threshold
 */
export function processMatches(
  matches: ProviderMatchResult[],
  config: AutoMatchConfig
): {
  enrichedResults: Record<string, ExtendedMangaSearchResult[]>;
  matchedProviders: string[];
  matchConfidences: Record<string, number>;
} {
  const enrichedResults: Record<string, ExtendedMangaSearchResult[]> = {};
  const matchedProviders: string[] = [];
  const matchConfidences: Record<string, number> = {};

  for (const match of matches) {
    // Skip low confidence matches
    if (match.confidence < config.confidenceThreshold) {
      logger.debug('[provider-matcher] Skipping low confidence match', {
        provider: match.provider,
        confidence: match.confidence,
        threshold: config.confidenceThreshold,
      });
      continue;
    }

    // Convert and store the match
    const searchResult = convertMatchToSearchResult(match);
    enrichedResults[match.provider] = [searchResult];
    matchedProviders.push(match.provider);
    matchConfidences[match.provider] = match.confidence;

    logger.debug('[provider-matcher] Added match from provider', {
      provider: match.provider,
      confidence: match.confidence,
      title: match.title,
    });
  }

  return { enrichedResults, matchedProviders, matchConfidences };
}
