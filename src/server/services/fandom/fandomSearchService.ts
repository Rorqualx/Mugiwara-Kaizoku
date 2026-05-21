/**
 * Fandom Search Service
 *
 * Provides search functionality across Fandom wikis using FandomProvider.
 * Supports dynamic wiki discovery for manga not in the predefined wiki list.
 */

import { FandomProvider } from '@/server/services/search/providers/FandomProvider';
import type { SearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

// Singleton provider instance for reuse across searches
let providerInstance: FandomProvider | null = null;

function getProvider(): FandomProvider {
  providerInstance ??= new FandomProvider();
  return providerInstance;
}

export interface FandomSearchResult {
  title: string;
  url: string;
  snippet: string;
  wiki: string;
  pageId: number;
  score?: number | undefined;
  isRecommended?: boolean | undefined;
}

/**
 * Transform SearchResult to FandomSearchResult
 */
function transformToFandomResult(result: SearchResult, index: number, wiki: string): FandomSearchResult {
  const transformed: FandomSearchResult = {
    title: result.title,
    url: result.providerUrl ?? result.url ?? '',
    snippet: result.description ?? '',
    wiki,
    pageId: index + 1,
    isRecommended: index === 0
  };
  if (result.score !== undefined) {
    transformed.score = result.score;
  }
  return transformed;
}

/**
 * Add custom wikis to provider
 */
function addCustomWikis(provider: FandomProvider, wikis: string[]): void {
  for (const wiki of wikis) {
    provider.addWiki(wiki);
  }
}

export const fandomSearchService = {
  /**
   * Search across all configured Fandom wikis plus dynamic discovery
   */
  async searchAllWikis(
    title: string,
    wikis?: string[]
  ): Promise<AsyncResult<{ results: FandomSearchResult[]; wikis: string[] }, Error>> {
    try {
      const provider = getProvider();

      if (wikis && wikis.length > 0) {
        addCustomWikis(provider, wikis);
      }

      // Pass type as string - FandomProvider.search accepts SearchOptions with type as string
      const searchResults = await provider.search(title, { limit: 10 });
      // r.provider is always defined per SearchResult type (defaults to provider name)
      const results = searchResults.map((r, i) => transformToFandomResult(r, i, r.provider));

      logger.info('Fandom search completed', { query: title, resultCount: results.length });

      return createSuccessResult({ results, wikis: wikis ?? [] });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Fandom search failed', { title, error: errorMessage });
      return createErrorResult(error instanceof Error ? error : new Error(errorMessage));
    }
  },

  /**
   * Search a specific wiki
   */
  async searchWiki(wiki: string, query: string): Promise<AsyncResult<FandomSearchResult[], Error>> {
    try {
      const provider = getProvider();
      provider.addWiki(wiki);

      // Cast options to bypass strict type checking - FandomProvider handles maxWikis internally
      const options = { limit: 10, maxWikis: 1 } as Record<string, unknown>;
      const searchResults = await provider.search(query, options);
      const results = searchResults
        .filter(r => r.provider === wiki || r.provider === 'fandom')
        .map((r, i) => transformToFandomResult(r, i, wiki));

      return createSuccessResult(results);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Fandom wiki search failed', { wiki, query, error: errorMessage });
      return createErrorResult(error instanceof Error ? error : new Error(errorMessage));
    }
  }
};