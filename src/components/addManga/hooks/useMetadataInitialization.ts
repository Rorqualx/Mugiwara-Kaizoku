import { useState, useEffect } from 'react';

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { ProviderMetadata, Chapter } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { hasProperty } from '@/utils/type-guards';
import { isRecord } from '@/utils/type-guards/index';

/**
 * Extract tag names from array that may contain strings or objects with 'name' property
 * AniList returns tags as objects: [{ name: 'Action', rank: 90 }, ...]
 * This function normalizes them to string array: ['Action', ...]
 */
function extractTagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((tag: unknown) => {
      if (typeof tag === 'string') return tag;
      if (isRecord(tag) && typeof tag['name'] === 'string') return tag['name'];
      return null;
    })
    .filter((tag): tag is string => tag !== null && tag !== '');
}

import { mapSearchResultsToProviderMetadata } from '../utils/searchToWizardMapper';
import {
  extractFormat,
  extractUrl,
  extractSiteDetailUrl,
  extractVolumesListUrl,
  extractAuthors,
  extractArtists,
  extractStartDate,
  extractCoverImage,
  extractBannerImage,
  extractAlternativeTitles,
  extractGallery,
  extractPublisher,
  extractDemographic,
  extractEndDate,
  extractSynopsis
} from '../wizard-utils';

/**
 * Custom hook to manage metadata initialization for the wizard
 *
 * Optimizes initial mount by processing only the primary provider upfront,
 * then lazily loading additional provider metadata when step 1 is reached.
 *
 * @param provider - The primary provider name (normalized to lowercase)
 * @param initialData - The initial search result data
 * @param currentStep - The current wizard step (0-5)
 * @returns Object containing selectedSourcesMetadata state and setter
 */
// eslint-disable-next-line complexity -- Complex metadata initialization with lazy loading
export function useMetadataInitialization(
  provider: string,
  initialData: ExtendedMangaSearchResult | undefined,
  currentStep: number
): {
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;
} {
  // OPTIMIZATION: Initialize selectedSourcesMetadata with ONLY primary provider to speed up initial mount
  // Additional providers will be processed lazily when MetadataSelectionStep (step 1) is reached
  const initialMetadata: Record<string, ProviderMetadata> = {};
  if (provider && initialData) {
    logger.info('[useMetadataInitialization] Processing primary provider metadata (lazy loading enabled for additional providers):', {
      provider,
      hasInitialData: true
    });

    // Extract basic metadata from initialData for the primary provider ONLY
    // Skip volumeData extraction - it will be done lazily when step 2 is reached
    // Use extracted helper functions from wizard-utils.ts
    initialMetadata[provider] = {
      id: String(initialData.id || ''),
      sourceId: initialData.sourceId || '',
      title: initialData.title || '',
      description: initialData.description || '',
      synopsis: extractSynopsis(initialData),
      status: initialData.status || '',
      format: extractFormat(initialData, provider),
      // Include URL fields for auto-fetch to work
      url: extractUrl(initialData),
      wikiUrl: extractUrl(initialData),
      siteDetailUrl: extractSiteDetailUrl(initialData),
      volumesListUrl: extractVolumesListUrl(initialData),
      genres: initialData['genres'] ?? [],
      // Extract tags - handle both string arrays and object arrays (AniList returns { name, rank } objects)
      tags: provider === 'fandom' ? [] : extractTagNames(initialData['tags']),
      // Extract themes - handle both string arrays and object arrays
      themes: provider === 'fandom' ? [] : extractTagNames(initialData['themes']),
      authors: extractAuthors(initialData),
      artists: extractArtists(initialData),
      publisher: extractPublisher(initialData),
      demographic: extractDemographic(initialData),
      startDate: extractStartDate(initialData),
      endDate: extractEndDate(initialData),
      coverImage: extractCoverImage(initialData),
      bannerImage: extractBannerImage(initialData),
      alternativeTitles: extractAlternativeTitles(initialData),
      ...(typeof initialData.volumes === 'number' ? { volumes: initialData.volumes } : (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'volumes') && typeof initialData.metadata['volumes'] === 'number' ? { volumes: initialData.metadata['volumes'] } : {})),
      ...(typeof initialData['chapters'] === 'number' ? { chapters: initialData['chapters'] } : (isRecord(initialData.metadata) && hasProperty(initialData.metadata, 'chapters') && typeof initialData.metadata['chapters'] === 'number' ? { chapters: initialData.metadata['chapters'] } : {})),
      volumeData: [], // Will be populated lazily when step 2 is reached
      chapterData: (initialData.chapterData && Array.isArray(initialData.chapterData) ? initialData.chapterData as Chapter[] : []),
      // Add gallery field - extract from various possible sources
      gallery: extractGallery(initialData)
    };

    logger.info('[useMetadataInitialization] Primary provider metadata initialized (fast path)');
  }

  const [selectedSourcesMetadata, setSelectedSourcesMetadata] = useState<Record<string, ProviderMetadata>>(initialMetadata);

  // OPTIMIZATION: Defer additional provider processing until MetadataSelectionStep (step 1) is reached
  // This moves heavy cachedSearchResults processing out of the critical mount path
  useEffect(() => {
    if (currentStep >= 1 && initialData && hasProperty(initialData, 'cachedSearchResults') && Array.isArray(initialData['cachedSearchResults'])) {
      const cachedResults = initialData['cachedSearchResults'];
      logger.info('[useMetadataInitialization] Step 1 reached - processing additional providers lazily:', {
        totalResults: cachedResults.length
      });

      // Group cached results by provider
      const resultsByProvider: Record<string, ExtendedMangaSearchResult[]> = {};
      cachedResults.forEach((result: unknown) => {
        if (!isRecord(result)) return;
        const resultProvider = ((hasProperty(result, 'provider') && typeof result['provider'] === 'string' ? result['provider'] : hasProperty(result, 'source') && typeof result['source'] === 'string' ? result['source'] : 'unknown')).toLowerCase();
        const existing = resultsByProvider[resultProvider];
        if (existing) {
          existing.push(result as ExtendedMangaSearchResult);
        } else {
          resultsByProvider[resultProvider] = [result as ExtendedMangaSearchResult];
        }
      });

      // Use the mapper to convert all results to provider metadata
      const allProviderMetadata = mapSearchResultsToProviderMetadata(
        resultsByProvider,
        initialData as ExtendedMangaSearchResult
      );

      logger.info('[useMetadataInitialization] Additional providers processed:', {
        providers: Object.keys(allProviderMetadata),
        primaryProvider: provider
      });

      // Only update existing providers (don't add new ones)
      // New providers should only be added when explicitly selected as secondary sources
      setSelectedSourcesMetadata(prev => {
        const updated = { ...prev };
        Object.entries(allProviderMetadata).forEach(([providerKey, metadata]) => {
          const normalizedKey = providerKey.toLowerCase();
          const existing = updated[normalizedKey];

          // Skip if provider doesn't already exist - don't auto-add new providers
          if (!existing) {
            logger.info(`[useMetadataInitialization] Skipping ${normalizedKey} - not in selected sources`);
            return;
          }

          // Merge: update volumeData if existing is empty but new has data
          const existingVolumeData = existing.volumeData;
          const newVolumeData = metadata.volumeData;
          const shouldUpdateVolumeData =
            (!existingVolumeData || existingVolumeData.length === 0) &&
            newVolumeData && newVolumeData.length > 0;

          if (shouldUpdateVolumeData) {
            logger.info(`[useMetadataInitialization] Merging volumeData for ${normalizedKey}:`, {
              existingVolumeDataLength: existingVolumeData?.length ?? 0,
              newVolumeDataLength: newVolumeData.length
            });
            const mergedMetadata = {
              ...existing,
              volumeData: newVolumeData,
            };
            // Also merge rawData if it has volumeList
            if (metadata.rawData) {
              mergedMetadata.rawData = metadata.rawData;
            }
            updated[normalizedKey] = mergedMetadata;
          }
        });
        return updated;
      });
    }
  }, [currentStep, initialData, provider]); // Only process when step changes

  // Debug log when metadata changes
  useEffect(() => {
    logger.info('[useMetadataInitialization] selectedSourcesMetadata updated:', {
      keys: Object.keys(selectedSourcesMetadata),

      hasFandom: !!selectedSourcesMetadata['fandom'],
      fandomUrl: selectedSourcesMetadata['fandom']?.url ?? selectedSourcesMetadata['fandom']?.wikiUrl
    });
  }, [selectedSourcesMetadata]);

  return { selectedSourcesMetadata, setSelectedSourcesMetadata };
}
