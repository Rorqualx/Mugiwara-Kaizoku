/**
 * Search operations for Domain Search Hook
 */

import type { SearchResult, SearchOptions } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { transformSearchResults, createUserFriendlyError } from './helpers';

import type { SearchAction } from './types';

type Dispatch = React.Dispatch<SearchAction>;

/**
 * Log Fandom results for debugging
 */
function logFandomResults(
  results: SearchResult[],
  context: string
): void {
  if (results.length === 0) return;

  const firstResult = results[0];
  if (!firstResult) return;

  logger.info(`[useDomainSearch] ${context}:`, {
    firstResult: {
      hasWikiUrl: 'wikiUrl' in firstResult && !!firstResult.wikiUrl,
      wikiUrl: 'wikiUrl' in firstResult ? firstResult.wikiUrl : 'field not present',
      hasUrl: 'url' in firstResult && !!firstResult.url,
      url: 'url' in firstResult ? firstResult.url : 'field not present',
      title: firstResult.title,
      allKeys: Object.keys(firstResult)
    }
  });
}

/**
 * Build search parameters from options
 */
export function buildSearchParams(
  providerId: string,
  query: string,
  options: SearchOptions | undefined
): {
  provider: string;
  query: string;
  limit: number;
  includeAdult?: boolean;
  genres?: string[];
  sortBy?: string;
  sortOrder?: string;
} {
  const includeAdultValue = options?.filters?.["includeAdult"];
  const genresValue = options?.filters?.["genres"];

  // Type guard to ensure genres is a string array
  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item): item is string => typeof item === 'string');

  return {
    provider: providerId,
    query: query,
    limit: options?.limit ?? 20,
    ...(typeof includeAdultValue === 'boolean' && { includeAdult: includeAdultValue }),
    ...(isStringArray(genresValue) && { genres: genresValue }),
    ...(options?.sort && { sortBy: options.sort }),
    ...(options?.order && { sortOrder: options.order })
  };
}

/**
 * Process cached results for a provider
 */
export function processCachedResults(
  dispatch: Dispatch,
  providerId: string,
  searchQuery: string,
  cache: Record<string, SearchResult[]>
): boolean {
  const cacheKey = `${providerId}:${searchQuery}`;
  const cachedResults = cache[cacheKey];

  if (!cachedResults) {
    return false;
  }

  logger.debug(`Using cached results for "${searchQuery}" with provider "${providerId}"`);

  if (providerId.toLowerCase() === 'fandom') {
    logFandomResults(cachedResults, 'Using cached Fandom results');
  }

  dispatch({ type: 'SEARCH_START', payload: { providerId } });
  dispatch({
    type: 'SEARCH_SUCCESS',
    payload: { providerId, results: cachedResults }
  });
  return true;
}

/**
 * Get valid providers from selected providers
 */
export function getValidProviders(
  dispatch: Dispatch,
  selectedIds: string[],
  availableList: Array<Record<string, unknown>>
): string[] {
  const valid = selectedIds.filter((id: string) =>
    availableList.some((provider) =>
      provider["id"] === id && provider["status"] === 'active'
    )
  );

  if (valid.length === 0) {
    if (selectedIds.length > 0) {
      logger.warn(`No valid providers found for search. Selected: ${selectedIds.join(', ')}`);
      selectedIds.forEach((providerId) => {
        const provider = availableList.find((p) => p["id"] === providerId);
        if (!provider) {
          dispatch({
            type: 'SEARCH_ERROR',
            payload: {
              providerId,
              error: new Error(`Provider "${providerId}" is not available. Please check your settings.`)
            }
          });
        } else if (provider["status"] !== 'active') {
          dispatch({
            type: 'SEARCH_ERROR',
            payload: {
              providerId,
              error: new Error(`${provider["name"]} provider is disabled. Please enable it in Settings > Metadata Providers.`)
            }
          });
        }
      });
    } else {
      dispatch({
        type: 'SET_GENERAL_ERROR',
        payload: { error: new Error('Please select at least one search provider') }
      });
    }
  }

  return valid;
}

/**
 * Options for searchSingleProvider
 */
export interface SearchProviderOptions {
  dispatch: Dispatch;
  providerId: string;
  searchQuery: string;
  searchOptions: SearchOptions | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchFn: (...args: any[]) => Promise<unknown[]>;
  searchCache: React.MutableRefObject<Record<string, SearchResult[]>>;
}

/**
 * Search a single provider
 */
export async function searchSingleProvider(
  options: SearchProviderOptions
): Promise<void> {
  const { dispatch, providerId, searchQuery, searchOptions, fetchFn, searchCache } = options;

  dispatch({ type: 'SEARCH_START', payload: { providerId } });

  try {
    logger.info(`Initiating search for "${searchQuery}" with provider "${providerId}"`);

    const searchParams = buildSearchParams(providerId, searchQuery, searchOptions);
    const rawResults = await fetchFn(searchParams);
    const results = rawResults as SearchResult[];

    if (results.length === 0) {
      logger.debug(`No results found for "${searchQuery}" with provider "${providerId}"`);
      dispatch({
        type: 'SEARCH_SUCCESS',
        payload: { providerId, results: [] }
      });
      return;
    }

    logger.info(`Search for "${searchQuery}" with provider "${providerId}" returned ${results.length} results`);

    if (providerId.toLowerCase() === 'fandom') {
      logFandomResults(results, 'Fandom results received');
    }

    const resultsWithProvider = transformSearchResults(results, providerId);
    const cacheKey = `${providerId}:${searchQuery}`;
    // Update cache via the ref's current property
    const cache = searchCache.current;
    cache[cacheKey] = resultsWithProvider;

    if (providerId.toLowerCase() === 'fandom') {
      logFandomResults(resultsWithProvider, 'Fandom results after transform');
    }

    dispatch({
      type: 'SEARCH_SUCCESS',
      payload: { providerId, results: resultsWithProvider }
    });
  } catch (error: unknown) {
    const typedError = error instanceof Error
      ? error
      : new Error(`Search failed: ${String(error)}`);

    logger.error(`Search error for "${searchQuery}" with provider "${providerId}":`, typedError.message);

    const userError = createUserFriendlyError(typedError);
    dispatch({
      type: 'SEARCH_ERROR',
      payload: { providerId, error: userError }
    });
  }
}
