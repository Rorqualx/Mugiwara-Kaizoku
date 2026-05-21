/**
 * Source Selection Module
 *
 * Orchestrates additional metadata source selection and fetching.
 */

import type * as React from 'react';

import { fetchFandomMetadataAsync, extractFandomUrl, fetchFandomChapterCoversBackground } from '@/components/addManga/steps/wizard/search-enrichment';
import type { VolumesData } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import {
  handleSourceDeselection,
  removeOldProviderCovers,
  updateSelectedSources,
  updateSourceMetadata,
  logMetadataDetails,
  showSuccessNotification,
  showErrorNotification,
  logVolumeInfo
} from '../helpers/sourceSelectionHelpers';
import { fetchAnilistMetadata } from '../modules/anilistProvider';
import { fetchComicvineMetadata, fetchComicVineChapterCoversBackground } from '../modules/comicvineProvider';
import { extractPrimaryProviderMedia } from '../modules/mediaExtractor';
import { fetchWikipediaMetadata } from '../modules/wikipediaProvider';

import type {
  ProviderMetadata,
  MediaGallery,
  SourceManagementServiceConfig
} from './types';

/**
 * Callbacks interface for state management
 */
export interface SourceSelectionCallbacks {
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
  setVolumesData: React.Dispatch<React.SetStateAction<VolumesData>>;
  selectedSources: string[];
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  // Optional callback for tracking pending async fetches (for Quick Add to wait)
  registerPendingFetch?: (key: string, promise: Promise<void>) => void;
}

/**
 * Dependencies for source selection
 */
export interface SourceSelectionDependencies {
  mutations: SourceManagementServiceConfig;
  extractBasicMetadata: (result: Record<string, unknown>) => ProviderMetadata;
}

/**
 * Handle selection of an additional metadata source
 */
// eslint-disable-next-line complexity, max-statements -- Provider-specific handling requires branching for each source type
export async function handleAdditionalSourceSelection(
  provider: string,
  result: Record<string, unknown>,
  callbacks: SourceSelectionCallbacks,
  dependencies: SourceSelectionDependencies,
  forceUpdate: boolean = false
): Promise<void> {
  const { setMediaGallery, selectedSources, selectedSourcesMetadata } = callbacks;
  const { mutations, extractBasicMetadata } = dependencies;

  const normalizedProviderName = provider.toLowerCase();
  logger.info(`[Source Selection] ${normalizedProviderName} result selected:`, {
    result,
    forceUpdate,
    currentSelectedSources: selectedSources,
    isCurrentlySelected: selectedSources.includes(normalizedProviderName)
  });

  // Toggle selection (skip if forceUpdate is true)
  // Use normalized provider name for consistent comparison with selectedSources
  if (!forceUpdate && selectedSources.includes(normalizedProviderName)) {
    logger.info(`[Source Selection] Deselecting ${normalizedProviderName} (already selected, forceUpdate=false)`);
    handleSourceDeselection(normalizedProviderName, callbacks);
    return;
  }

  logger.info(`[Source Selection] Proceeding with ${normalizedProviderName} metadata fetch`);

  // Fetch metadata based on provider
  try {
    let metadata: ProviderMetadata | null = null;

    switch (provider.toLowerCase()) {
      case 'anilist':
        metadata = await fetchAnilistMetadata(result, mutations.fetchAnilistMutation);
        break;

      case 'comicvine': {
        metadata = await fetchComicvineMetadata(result, {
          fetchComicvineVolumeDetailsMutation: mutations.fetchComicvineVolumeDetailsMutation,
          ...(mutations.scrapeComicVineChaptersMutation && {
            scrapeComicVineChaptersMutation: mutations.scrapeComicVineChaptersMutation
          }),
          ...(mutations.scrapeComicVineVolumeUrlsMutation && {
            scrapeComicVineVolumeUrlsMutation: mutations.scrapeComicVineVolumeUrlsMutation
          }),
          ...(mutations.scrapeComicVineVolumeMutation && {
            scrapeComicVineVolumeMutation: mutations.scrapeComicVineVolumeMutation
          })
        }, extractBasicMetadata);

        // Start background fetch for chapter data (fire-and-forget)
        // Similar to Fandom's background fetch pattern
        // Check multiple possible URL fields - metadata-assembler sets url and siteDetailUrl
        const comicVineUrl = metadata.comicVineUrl ?? metadata.url ?? metadata.siteDetailUrl ?? (result['url'] as string | undefined) ?? (result['site_detail_url'] as string | undefined);

        if (comicVineUrl && metadata.volumeData && metadata.volumeData.length > 0) {
          logger.info('[ComicVine SECONDARY] Starting background chapter scraping', {
            url: comicVineUrl,
            volumeCount: metadata.volumeData.length
          });
          fetchComicVineChapterCoversBackground(
            comicVineUrl,
            metadata.volumeData,
            callbacks.setSelectedSourcesMetadata,
            callbacks.setVolumesData
          );
        } else {
          logger.warn('[ComicVine SECONDARY] Skipping background scraping - missing URL or volumes', {
            hasUrl: !!comicVineUrl,
            volumeCount: metadata.volumeData?.length ?? 0
          });
        }
        break;
      }

      case 'fandom': {
        // Use the same canonical path as primary - fetchFandomMetadataAsync
        // DEBUG: Log full result to understand structure
        logger.warn('[Fandom SECONDARY] Full result:', JSON.stringify(result, null, 2));
        logger.warn('[Fandom SECONDARY] URL fields:', {
          url: result['url'],
          wikiUrl: result['wikiUrl'],
          providerUrl: result['providerUrl'],
          metadataUrl: (result['metadata'] as Record<string, unknown> | undefined)?.['url'],
        });
        const fandomUrl = extractFandomUrl(result);
        logger.warn('[Fandom SECONDARY] Extracted URL:', { fandomUrl });

        if (!fandomUrl) {
          logger.warn('[Source Selection] Fandom SECONDARY - no URL found, using basic extraction');
          metadata = extractBasicMetadata(result);
        } else {
          // Build base metadata from search result (title, id, etc.)
          const baseMetadata = extractBasicMetadata(result);
          // Fetch full metadata using the same path as primary
          // Pass the full search result so rawData fields (format, status) can be extracted
          metadata = await fetchFandomMetadataAsync(fandomUrl, baseMetadata, result);
          logger.info('[Source Selection] Fandom SECONDARY - fetchFandomMetadataAsync complete', {
            hasDescription: !!metadata.description,
            descriptionLength: metadata.description?.length ?? 0,
            hasAuthors: !!metadata.authors?.length,
            authors: metadata.authors,
            hasGallery: !!metadata.gallery?.length,
            galleryLength: metadata.gallery?.length ?? 0,
          });

          // Start background fetch for chapter covers (fire-and-forget)
          // This avoids the 30s timeout while still getting chapter covers eventually
          fetchFandomChapterCoversBackground(fandomUrl, callbacks.setSelectedSourcesMetadata);
        }
        break;
      }

      case 'wikipedia': {
        // If mutation available, fetch enhanced metadata (author, publisher, dates, etc.)
        logger.warn('[Wikipedia SECONDARY] Starting selection', {
          hasMutation: !!mutations.fetchWikipediaMutation,
          resultKeys: Object.keys(result)
        });
        logger.warn('[Wikipedia SECONDARY] Full result:', JSON.stringify(result, null, 2));

        if (mutations.fetchWikipediaMutation) {
          const title = (result["title"] ?? '') as string;
          logger.warn('[Wikipedia SECONDARY] title extracted', { title });
          if (title) {
            const { fetchEnhancedWikipediaMetadata } = await import('../modules/wikipediaProvider');
            logger.warn('[Wikipedia SECONDARY] calling fetchEnhancedWikipediaMetadata');
            metadata = await fetchEnhancedWikipediaMetadata(result, mutations.fetchWikipediaMutation);
            logger.warn('[Wikipedia SECONDARY] enhanced metadata received', {
              authors: metadata.authors,
              publisher: metadata.publisher,
              startDate: metadata.startDate,
              hasVolumeData: !!metadata.volumeData?.length,
              volumeCount: metadata.volumeData?.length ?? 0
            });
          } else {
            // Fallback to basic extraction if no title
            logger.warn('[Wikipedia SECONDARY] no title, falling back to basic extraction');
            metadata = fetchWikipediaMetadata(result);
          }
        } else {
          // Fallback to basic extraction without mutation
          logger.warn('[Wikipedia SECONDARY] no mutation available, falling back to basic extraction');
          metadata = fetchWikipediaMetadata(result);
        }
        break;
      }

      default:
        logger.warn(`Unknown provider: ${provider}`);
        metadata = extractBasicMetadata(result);
    }

    // Add to selected sources - normalize provider name to lowercase
    const normalizedProvider = provider.toLowerCase();

    // When forceUpdate=true, remove old covers from this provider before adding new ones
    if (forceUpdate) {
      removeOldProviderCovers(normalizedProvider, setMediaGallery);
    }

    const volumeCount = metadata?.volumeData?.length ?? 0; // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- metadata could be null from failed mutations
    logger.warn(`[Source Selection] About to add ${normalizedProvider} to selectedSources`, {
      currentSelectedSources: selectedSources,
      metadataReceived: !!metadata,
      volumeCount
    });

    // Only add to selectedSources if not already there (for forceUpdate case)
    updateSelectedSources(provider, callbacks);

    // Add/update selected sources metadata with normalized key
    updateSourceMetadata(provider, metadata, callbacks);

    // Log the updated state with volumeData details
    logMetadataDetails(provider, metadata, selectedSourcesMetadata);

    // Use the same media extraction logic as primary provider
    // This ensures consistent behavior for all sources
    extractPrimaryProviderMedia(normalizedProvider, metadata, setMediaGallery);

    // Update volumes if provider has volume data
    logVolumeInfo(provider, metadata);

    logger.info(`[Source Selection] ${normalizedProviderName} selection complete - showing success notification`);
    showSuccessNotification(normalizedProviderName, forceUpdate);
  } catch (error) {
    logger.error(`[Source Selection] ${normalizedProviderName} selection failed:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    showErrorNotification(normalizedProviderName, error);
  }
}
