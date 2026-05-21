/**
 * useMangaSelection Hook
 *
 * Manages manga selection logic including:
 * - ComicVine metadata enrichment
 * - Result grouping by provider
 * - Deduplication
 * - Selection callback coordination
 */

import { useState, useCallback } from 'react';

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';
import { vanillaTrpcClient } from '@/utils/trpc-client/vanilla';

import { safeString } from '../helpers';

import type { UseMangaSelectionReturn } from './types';

/**
 * Props for useMangaSelection hook
 */
interface UseMangaSelectionProps {
  query: string;
  defaultSource: string;
  allProviderResults: ExtendedMangaSearchResult[];
  fetchingAllProviders: boolean;
  fetchAllProviderResults: (query: string) => Promise<ExtendedMangaSearchResult[]>;
  filteredResults: ExtendedMangaSearchResult[];
  searchState: AsyncResult<ExtendedMangaSearchResult[], Error>;
  onSelect?: ((manga: ExtendedMangaSearchResult, allResults?: Record<string, unknown[]>) => void) | undefined;
}

/**
 * Hook to manage manga selection and enrichment
 *
 * @param props - Hook configuration
 * @returns Selection state and handlers
 *
 * @example
 * ```tsx
 * const { selectingMangaId, handleMangaSelect } = useMangaSelection({
 *   query,
 *   defaultSource,
 *   allProviderResults,
 *   onSelect
 * });
 * ```
 */
export function useMangaSelection({
  query,
  defaultSource,
  allProviderResults,
  fetchingAllProviders,
  fetchAllProviderResults,
  filteredResults,
  searchState,
  onSelect
}: UseMangaSelectionProps): UseMangaSelectionReturn {
  const utils = trpc.useUtils();
  const [selectingMangaId, setSelectingMangaId] = useState<string | null>(null);

  // eslint-disable-next-line max-statements, complexity -- Provider-specific enrichment and metadata handling
  const handleMangaSelect = useCallback(async (selected: ExtendedMangaSearchResult): Promise<void> => {
    setSelectingMangaId(String(selected.id));

    try {
      let provider = defaultSource;
      if ('provider' in selected && typeof selected.provider === 'string') {
        provider = selected.provider.toLowerCase();
      } else if ('source' in selected && typeof selected.source === 'string') {
        provider = selected.source.toLowerCase();
      }

      // Enrich ComicVine results with detailed metadata (themes, authors, etc.)
      // since the ComicVine search API doesn't return these fields
      let enrichedSelected = selected;
      if (provider === 'comicvine' && selected.id) {
        try {
          logger.info('[handleMangaSelect] Enriching ComicVine result with detailed metadata', { id: selected.id });

          // Prefetch volume details in the background (including issue covers)
          // This runs in parallel with metadata enrichment so data is ready by Step 3
          const volumeId = String(selected.id);
          const comicvineUrl = `https://comicvine.gamespot.com/volume/4050-${volumeId}/`;
          logger.info('[handleMangaSelect] Prefetching ComicVine volume details for faster Step 3 load', { volumeId });

          // Fire and forget - don't await, let it run in background
          // Use vanilla client for mutations (React hooks can't be called in callbacks)
          vanillaTrpcClient.metadata.fetchComicvineVolumeDetails.mutate({
            url: comicvineUrl,
            id: volumeId,
            type: 'volume'
          }).then(() => {
            logger.info('[handleMangaSelect] ComicVine volume details prefetch complete', { volumeId });
          }).catch((prefetchError: unknown) => {
            // Non-critical - just log and continue, Step 3 will retry if needed
            logger.warn('[handleMangaSelect] ComicVine volume details prefetch failed (will retry in Step 3)', {
              error: prefetchError instanceof Error ? prefetchError.message : String(prefetchError)
            });
          });

          // Also warm up FlareSolverr in parallel - this caches CloudFlare cookies
          // so that chapter scraping in Step 3 will be fast (~0s instead of ~30-60s)
          logger.info('[handleMangaSelect] Warming up FlareSolverr for fast chapter scraping', { volumeId });
          vanillaTrpcClient.metadata.warmupFlareSolverr.mutate({
            volumeId
          }).then((warmupResult) => {
            // AsyncResult has status: 'success' | 'error' | 'idle' | 'loading'
            if (warmupResult.status === 'success') {
              logger.info('[handleMangaSelect] FlareSolverr warmup complete', {
                warmedUp: warmupResult.data.warmedUp,
                message: warmupResult.data.message
              });
            } else if (warmupResult.status === 'error') {
              logger.warn('[handleMangaSelect] FlareSolverr warmup returned error (scraping will retry)', {
                error: warmupResult.error.message
              });
            }
          }).catch((warmupError: unknown) => {
            // Non-critical - scraping will still work, just slower on first request
            logger.warn('[handleMangaSelect] FlareSolverr warmup failed (scraping will retry)', {
              error: warmupError instanceof Error ? warmupError.message : String(warmupError)
            });
          });

          const enrichedMetadata = await utils.search.getMetadata.fetch({
            provider: 'comicvine',
            id: String(selected.id),
            title: selected.title
          });
          // Merge enriched data with the selected result
          enrichedSelected = {
            ...selected,
            ...enrichedMetadata,
            // Preserve original provider/source
            provider: selected.provider,
            source: selected.source
          } as ExtendedMangaSearchResult;
          logger.info('[handleMangaSelect] ComicVine result enriched', {
            hasThemes: !!('themes' in enrichedMetadata && enrichedMetadata.themes),
            hasAuthors: !!('authors' in enrichedMetadata && enrichedMetadata.authors)
          });
        } catch (enrichError) {
          logger.warn('[handleMangaSelect] Failed to enrich ComicVine result, using original', {
            error: enrichError instanceof Error ? enrichError.message : String(enrichError)
          });
          // Continue with unenriched result
        }
      }

      // Enrich AniList results with detailed metadata (authors, artists, dates)
      // since AniList search results don't include staff data
      if (provider === 'anilist' && selected.id) {
        try {
          logger.debug('[useMangaSelection] Starting AniList enrichment', { id: selected.id });

          const anilistResult = await vanillaTrpcClient.metadata.fetchAnilistMetadata.mutate({
            id: String(selected.id)
          });

          logger.debug('[useMangaSelection] AniList fetch result', {
            isSuccess: isSuccess(anilistResult),
            hasData: !!anilistResult
          });

          if (isSuccess(anilistResult)) {
            const anilistData = anilistResult.data as Record<string, unknown>;
            logger.debug('[useMangaSelection] AniList enriched data', {
              hasAuthors: !!anilistData['authors'],
              authors: anilistData['authors'],
              hasArtists: !!anilistData['artists'],
              artists: anilistData['artists'],
              startDate: anilistData['startDate']
            });

            // Merge enriched data with the selected result
            // Build object incrementally to avoid spread type errors
            const enrichedFields: Partial<ExtendedMangaSearchResult> = {};
            if (Array.isArray(anilistData['authors']) && anilistData['authors'].length > 0) {
              enrichedFields.authors = anilistData['authors'] as string[];
            }
            if (Array.isArray(anilistData['artists']) && anilistData['artists'].length > 0) {
              (enrichedFields as Record<string, unknown>)['artists'] = anilistData['artists'] as string[];
            }
            if (anilistData['startDate'] && typeof anilistData['startDate'] === 'string') {
              (enrichedFields as Record<string, unknown>)['startDate'] = anilistData['startDate'];
            }
            if (anilistData['endDate'] && typeof anilistData['endDate'] === 'string') {
              (enrichedFields as Record<string, unknown>)['endDate'] = anilistData['endDate'];
            }

            enrichedSelected = {
              ...selected,
              ...enrichedFields,
              // Preserve original provider/source
              provider: selected.provider,
              source: selected.source
            } as ExtendedMangaSearchResult;

            logger.debug('[useMangaSelection] AniList result enriched', {
              hasAuthors: !!enrichedSelected.authors,
              authorsCount: enrichedSelected.authors?.length ?? 0,
              authors: enrichedSelected.authors
            });
          }
        } catch (enrichError) {
          logger.error('[useMangaSelection] AniList enrichment error', { error: enrichError });
          // Continue with unenriched result
        }
      }

      // Fetch all provider results if not already fetched
      let fetchedResults: ExtendedMangaSearchResult[] = [];
      if (allProviderResults.length === 0 && !fetchingAllProviders) {
        fetchedResults = await fetchAllProviderResults(query);
      } else {
        fetchedResults = allProviderResults;
      }

      // Build results grouped by provider
      const resultsByProvider: Record<string, ExtendedMangaSearchResult[]> = {};
      resultsByProvider[provider] = [enrichedSelected];

      const grouped = new Map<string, ExtendedMangaSearchResult[]>();
      // Track seen IDs per provider to prevent duplicates
      const seenIds = new Map<string, Set<string>>();

      const allResults = [
        ...filteredResults,
        ...(isSuccess(searchState) ? searchState.data : []),
        ...fetchedResults
      ];

      allResults.forEach(result => {
        const providerField = 'provider' in result ? result.provider : undefined;
        const source = 'source' in result ? result.source : undefined;
        const resultProvider = (providerField ?? source ?? 'unknown').toLowerCase();

        // Create unique identifier for deduplication
        const resultId = String(result.id);
        const sourceId = 'sourceId' in result ? String(result.sourceId) : '';
        const uniqueKey = `${resultId}-${sourceId}-${result.title}`;

        // Initialize tracking sets if needed
        if (!grouped.has(resultProvider)) {
          grouped.set(resultProvider, []);
          seenIds.set(resultProvider, new Set<string>());
        }

        // Only add if not already seen for this provider
        const providerSeenIds = seenIds.get(resultProvider);
        if (providerSeenIds && !providerSeenIds.has(uniqueKey)) {
          providerSeenIds.add(uniqueKey);
          grouped.get(resultProvider)?.push(result as ExtendedMangaSearchResult);
        }
      });

      grouped.forEach((results, key) => {
        resultsByProvider[key] = results;
      });

      if (onSelect) {
        onSelect(enrichedSelected, resultsByProvider);
      }
    } catch (error: unknown) {
      logger.error(`Error selecting manga: ${error instanceof Error ? error.message : safeString(error)}`);
      throw error; // Re-throw for parent error handling
    } finally {
      setSelectingMangaId(null);
    }
  }, [
    defaultSource,
    allProviderResults,
    fetchingAllProviders,
    filteredResults,
    searchState,
    onSelect,
    utils.search.getMetadata,
    fetchAllProviderResults,
    query
  ]);

  return {
    selectingMangaId,
    handleMangaSelect
  };
}
