/**
 * Helper functions for useProviderSearch hook
 *
 * Extracted to reduce complexity and improve maintainability.
 */

import type { SearchResult } from '@/server/services/search/types';
import { logger } from '@/utils/logger';

import { transformSearchResult } from './transformers';

import type { EnhancedSearchResult, SearchAction } from './types';

interface ProviderInfo {
  id: string;
  name: string;
  status?: string;
}

/**
 * Get user-friendly error message based on error type
 */
export function getUserFriendlyErrorMessage(error: unknown, providerId: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed') || errorMessage.includes('Network Error')) {
    return 'Could not connect to search service. Please check your internet connection.';
  }
  if (errorMessage.includes('timeout')) {
    return 'Search timed out. The service might be experiencing high load.';
  }
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return 'Search rate limit exceeded. Please wait a moment and try again.';
  }
  if (errorMessage.includes('client-only function')) {
    return 'Search initialization error. Please try refreshing the page.';
  }
  if (errorMessage.includes('Provider') && errorMessage.includes('not found')) {
    return `Provider "${providerId}" is not available. Please try a different provider.`;
  }

  return errorMessage;
}

/**
 * Handle errors for disabled or unavailable providers
 */
export function handleDisabledProviderErrors(
  selectedProviders: string[],
  enabledProviders: ProviderInfo[],
  dispatch: React.Dispatch<SearchAction>
): void {
  for (const providerId of selectedProviders) {
    const provider = enabledProviders.find((p) => p.id === providerId);

    if (!provider) {
      dispatch({
        type: 'SEARCH_ERROR',
        payload: {
          providerId,
          error: `Provider "${providerId}" is not available. Please check your settings.`
        }
      });
      continue;
    }

    if (provider.status !== 'active') {
      const providerConfig = getProviderConfig(providerId);
      dispatch({
        type: 'SEARCH_ERROR',
        payload: {
          providerId,
          error: `${providerConfig.name} provider is disabled. Please enable it in Settings > Metadata > ${providerConfig.settingsPath}.`
        }
      });
    }
  }
}

/**
 * Get provider display name and settings path
 */
function getProviderConfig(providerId: string): { name: string; settingsPath: string } {
  const providerMap: Record<string, { name: string; settingsPath: string }> = {
    comicvine: { name: 'ComicVine', settingsPath: 'ComicVine' },
    anilist: { name: 'Anilist', settingsPath: 'Anilist' }
  };

  return providerMap[providerId] ?? { name: providerId, settingsPath: providerId };
}

/**
 * Process and transform search results
 */
export function processSearchResults(
  searchResults: SearchResult[],
  providerId: string
): EnhancedSearchResult[] {
  const firstResult = searchResults[0];

  if (firstResult === undefined) {
    return [];
  }

  // Log first result for debugging
  logger.debug(`First result from "${providerId}": ${JSON.stringify({
    id: firstResult.id,
    title: firstResult.title,
    hasImage: Boolean(firstResult.cover || firstResult.coverImage)
  })}`);

  // Handle AniList special format
  let processedResults = searchResults;
  if (providerId === 'anilist' && 'json' in firstResult) {
    logger.info('Processing special AniList response format with nested json property');
    const firstResultTyped = firstResult as { json?: unknown };
    if (Array.isArray(firstResultTyped.json)) {
      processedResults = firstResultTyped.json as SearchResult[];
    }
  }

  // Transform to EnhancedSearchResult
  const resultsWithProvider: EnhancedSearchResult[] = processedResults.map((result, idx) =>
    transformSearchResult(result, providerId, idx)
  );

  logger.info(`Transformed ${resultsWithProvider.length} results from ${providerId} with provider information`);

  // Log URL preservation for Fandom results
  if (providerId === 'fandom' && resultsWithProvider.length > 0) {
    logger.debug(`[useProviderSearch] Fandom results after transformation:`, resultsWithProvider.slice(0, 2).map(r => {
      const result = r as unknown as Record<string, unknown>;
      return {
        id: result['id'],
        title: result['title'],
        hasWikiUrl: !!result['wikiUrl'],
        wikiUrl: result['wikiUrl'],
        hasUrl: !!result['url'],
        url: result['url']
      };
    }));
  }

  return resultsWithProvider;
}

/**
 * Finalize search results, handling already-transformed data
 */
export function finalizeSearchResults(
  searchResults: SearchResult[],
  providerId: string
): EnhancedSearchResult[] {
  if (searchResults.length === 0) {
    return [];
  }

  const firstRes = searchResults[0];

  // Check if already transformed
  if (firstRes && 'provider' in firstRes && firstRes.provider === providerId) {
    return searchResults as EnhancedSearchResult[];
  }

  // Transform to EnhancedSearchResult
  return searchResults.map(result => ({
    ...result,
    provider: providerId
  })) as EnhancedSearchResult[];
}
