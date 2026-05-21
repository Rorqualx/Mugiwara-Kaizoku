/**
 * Quick Add Service - Volume Fetcher
 *
 * Handles fetching volume and chapter data from multiple providers
 * (Fandom, ComicVine, Wikipedia) with preference-based ordering.
 *
 * @module components/addManga/services/quickAddService/volume-fetcher
 */

import {
  extractFandomUrl,
  extractComicVineUrl,
  extractFandomMetadata,
  extractComicVineMetadata,
  extractWikipediaMetadata,
  extractMangaDexMetadata
} from '@/components/addManga/steps/wizard/volumes-chapters/utils';
import type { AppRouter } from '@/server/trpc/root';
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import { logger } from '@/utils/logger';

import {
  tryFetchFromFandom,
  tryFetchFromComicVine,
  tryFetchFromWikipedia,
  tryFetchFromMangaDex,
  extractMangaDexId
} from './volume-fetcher/provider-fetchers';

import type { ExtendedFetchedVolumeData, FetchedVolumeData, ProviderMetadataMap } from './types';
import type { TRPCClient } from '@trpc/client';

// Re-export provider fetchers for external use
export { tryFetchFromFandom, tryFetchFromComicVine, tryFetchFromWikipedia, tryFetchFromMangaDex };

// ============================================================================
// Provider Dispatch
// ============================================================================

/**
 * Try to fetch volume data from a specific provider
 */
export async function tryFetchFromProvider(
  provider: string,
  metadata: ProviderMetadataMap,
  trpcClient: TRPCClient<AppRouter>
): Promise<FetchedVolumeData | null> {
  switch (provider.toLowerCase()) {
    case 'mangadex': {
      const mangadexId = extractMangaDexId(metadata.mangadexMetadata);
      return tryFetchFromMangaDex(mangadexId, trpcClient);
    }
    case 'fandom': {
      const fandomUrl = extractFandomUrl(metadata.fandomMetadata) ?? null;
      return tryFetchFromFandom(fandomUrl, trpcClient);
    }
    case 'comicvine': {
      const comicvineUrl = extractComicVineUrl(metadata.comicvineMetadata) ?? null;
      return tryFetchFromComicVine(comicvineUrl, trpcClient);
    }
    case 'wikipedia':
      return tryFetchFromWikipedia(metadata.wikipediaMetadata);
    default:
      logger.debug('[volume-fetcher] Unsupported provider for volume fetching:', { provider });
      return null;
  }
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract metadata for all providers from sources metadata
 */
function extractAllProviderMetadata(sourcesMetadata: Record<string, unknown>): ProviderMetadataMap {
  return {
    fandomMetadata: extractFandomMetadata(sourcesMetadata),
    comicvineMetadata: extractComicVineMetadata(sourcesMetadata),
    wikipediaMetadata: extractWikipediaMetadata(sourcesMetadata),
    mangadexMetadata: extractMangaDexMetadata(sourcesMetadata)
  };
}

// ============================================================================
// Multi-Provider Fetching
// ============================================================================

/**
 * Combine results from volume and chapter providers
 */
function combineProviderResults(
  volumeData: FetchedVolumeData | null,
  chapterData: FetchedVolumeData | null
): ExtendedFetchedVolumeData | null {
  // If we got chapter data (usually Fandom with chapter URLs), use it as primary
  if (chapterData?.volumes && chapterData.volumes.length > 0) {
    const result: ExtendedFetchedVolumeData = { ...chapterData };

    // Add secondary provider data for enrichment
    if (volumeData?.provider === 'comicvine') {
      result.comicVineData = volumeData;
    }
    if (chapterData.provider === 'fandom') {
      result.fandomData = chapterData;
    }
    if (volumeData && volumeData.provider !== 'comicvine') {
      result.secondaryData = volumeData;
    }

    logger.info('[volume-fetcher] Using chapter provider with volume enrichment', {
      chapterProvider: chapterData.provider,
      volumeProvider: volumeData?.provider,
      totalChapters: chapterData.totalChapters,
      hasSecondaryEnrichment: !!volumeData
    });

    return result;
  }

  // Fall back to volume data if no chapter data
  if (volumeData) {
    return volumeData as ExtendedFetchedVolumeData;
  }

  // Try any provider that has data
  return chapterData as ExtendedFetchedVolumeData | null;
}

/**
 * Fetch from multiple providers when volume and chapter sources differ.
 * This ensures we get ComicVine volume data (for titles) + Fandom chapter data (for chapter URLs).
 */
export async function fetchVolumesFromMultipleProviders(
  sourcesMetadata: Record<string, unknown>,
  volumeProvider: string,
  chapterProvider: string,
  trpcClient: TRPCClient<AppRouter>
): Promise<ExtendedFetchedVolumeData | null> {
  try {
    const metadataMap = extractAllProviderMetadata(sourcesMetadata);

    logger.info('[volume-fetcher] fetchVolumesFromMultipleProviders', {
      volumeProvider,
      chapterProvider,
      hasFandomMetadata: !!metadataMap.fandomMetadata,
      hasComicvineMetadata: !!metadataMap.comicvineMetadata
    });

    // If providers are the same, just fetch from one
    if (volumeProvider.toLowerCase() === chapterProvider.toLowerCase()) {
      const result = await tryFetchFromProvider(volumeProvider, metadataMap, trpcClient);
      return result as ExtendedFetchedVolumeData | null;
    }

    // Fetch from both providers in parallel
    const [volumeData, chapterData] = await Promise.all([
      tryFetchFromProvider(volumeProvider, metadataMap, trpcClient),
      tryFetchFromProvider(chapterProvider, metadataMap, trpcClient)
    ]);

    logger.info('[volume-fetcher] Multi-provider fetch results', {
      volumeDataProvider: volumeData?.provider ?? 'none',
      volumeDataCount: volumeData?.totalVolumes ?? 0,
      chapterDataProvider: chapterData?.provider ?? 'none',
      chapterDataCount: chapterData?.totalChapters ?? 0
    });

    return combineProviderResults(volumeData, chapterData);
  } catch (error) {
    logger.error('[volume-fetcher] Error in fetchVolumesFromMultipleProviders', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Fetch volume/chapter data from available providers using preferences
 *
 * @param sourcesMetadata - Metadata from all selected providers
 * @param preferences - Field provider preferences (uses 'chapters' field for order)
 * @param trpcClient - tRPC client instance
 * @returns FetchedVolumeData or null if no data could be fetched
 */
export async function fetchVolumesFromProviders(
  sourcesMetadata: Record<string, unknown>,
  preferences: Record<string, string[]>,
  trpcClient: TRPCClient<AppRouter>
): Promise<FetchedVolumeData | null> {
  try {
    // Get provider order from preferences
    const providerOrder = preferences['chapters']
      ?? preferences['volumes']
      ?? DEFAULT_FIELD_PRIORITIES['chapters']
      ?? ['fandom', 'comicvine', 'wikipedia'];

    logger.info('[volume-fetcher] Provider order for volume fetching:', {
      providerOrder,
      source: preferences['chapters'] ? 'chapters preference' : preferences['volumes'] ? 'volumes preference' : 'default',
      availableProviders: Object.keys(sourcesMetadata)
    });

    const metadataMap = extractAllProviderMetadata(sourcesMetadata);

    // Try providers in preference order
    for (const provider of providerOrder) {
      // eslint-disable-next-line no-await-in-loop -- Provider fallback chain - first successful provider returns
      const result = await tryFetchFromProvider(provider, metadataMap, trpcClient);
      if (result) {
        return result;
      }
    }

    logger.info('[volume-fetcher] No volume data available from any provider');
    return null;
  } catch (error) {
    logger.error('[volume-fetcher] Error fetching volumes from providers', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
