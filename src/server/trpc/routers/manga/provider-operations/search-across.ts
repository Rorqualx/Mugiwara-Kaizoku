/**
 * Provider Operations - Search Across Providers
 *
 * Searches for manga across multiple providers for the confirmation step.
 *
 * Extracted from: providerOperations.ts (lines 156-240)
 */

import { detectErrorType } from '@/server/services/search/unified-registry/registry-utils';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { ProviderErrorInfo } from '@/types/search-types/provider.types';
import { logger } from '@/utils/logger';

import { providerConfirmationSearchSchema } from './schemas';
import { isMangaLike } from './utils';

interface SearchProvider {
  search: (query: string) => Promise<unknown[]>;
}

function standardizeResult(item: unknown): Record<string, unknown> {
  if (isMangaLike(item)) {
    return {
      id: item.id ?? `unknown-${Date.now()}`,
      title: item.title ?? 'Untitled',
      cover: item.cover ?? item.coverImage ?? '/cover-not-found.jpg',
      coverImage: item.coverImage ?? item.cover ?? '/cover-not-found.jpg',
      description: item.description ?? 'No description available',
      status: item.status ?? 'Unknown',
      alternativeTitles: item.alternativeTitles ?? [],
      score: item.score ?? 0,
      popularity: item.popularity ?? 0,
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      genres: item.genres ?? [],
    };
  }
  return {
    id: `unknown-${Date.now()}`,
    title: 'Untitled',
    cover: '/cover-not-found.jpg',
    coverImage: '/cover-not-found.jpg',
    description: 'No description available',
    status: 'Unknown',
    alternativeTitles: [],
    score: 0,
    popularity: 0,
    startDate: null,
    endDate: null,
    genres: [],
  };
}

interface ProviderSearchOutcome {
  results: unknown[];
  error?: ProviderErrorInfo;
}

async function searchProvider(
  registry: { get: (name: string) => SearchProvider | undefined; getAll: () => Record<string, unknown> },
  providerName: string,
  title: string,
): Promise<ProviderSearchOutcome> {
  if (!providerName) {
    logger.warn('Undefined provider name passed to searchAcrossProviders');
    return { results: [] };
  }

  const normalizedName = providerName.toLowerCase();
  const provider = registry.get(normalizedName);

  if (!provider) {
    logger.warn(`Provider ${normalizedName} not found in registry, skipping. Available: ${Object.keys(registry.getAll()).join(', ')}`);
    return { results: [] };
  }

  if (!title || title.trim() === '') {
    logger.warn(`Empty title passed for provider ${normalizedName}, skipping`);
    return { results: [] };
  }

  try {
    const searchResults = await provider.search(title);
    logger.info(`${normalizedName} search found ${searchResults.length} results for ${title}`);
    return { results: searchResults.map(standardizeResult) };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = detectErrorType(error);
    logger.error(`Error searching ${providerName}: ${errorMessage}`);
    return {
      results: [],
      error: { provider: providerName, error: errorMessage, errorType, timestamp: Date.now() },
    };
  }
}

export const searchAcrossRouter = router({
  searchAcrossProviders: publicProcedure
    .input(providerConfirmationSearchSchema)
    .query(async ({ input }): Promise<{ results: Record<string, unknown[]>; providerErrors: ProviderErrorInfo[] }> => {
      logger.info(`Multi-provider search request for title: ${input.title}, providers: ${input.providers.join(', ')}`);

      try {
        const { getInitializedProviderRegistry } = await import('@/server/services/search/ensureProviderRegistry');
        const registry = await getInitializedProviderRegistry();
        const results: Record<string, unknown[]> = {};
        const providerErrors: ProviderErrorInfo[] = [];

        if (input.providers.length === 0) {
          logger.warn('Empty providers array passed to searchAcrossProviders');
          return { results, providerErrors };
        }

        await Promise.all(input.providers.map(async (providerName) => {
          const outcome = await searchProvider(registry, providerName, input.title);
          results[providerName] = outcome.results;
          if (outcome.error) providerErrors.push(outcome.error);
        }));

        return { results, providerErrors };
      } catch (error: unknown) {
        logger.error(`Error in searchAcrossProviders: ${error instanceof Error ? error.message : String(error)}`);
        return { results: {}, providerErrors: [] };
      }
    }),
});
