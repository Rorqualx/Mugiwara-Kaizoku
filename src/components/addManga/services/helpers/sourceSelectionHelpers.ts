import type * as React from 'react';

import type { ProviderMetadata, MediaGallery } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
/**
 * Helper functions for handleAdditionalSourceSelection
 * Extracted to reduce complexity and improve maintainability
 */

export interface SourceSelectionCallbacks {
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
  setVolumesData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  selectedSources: string[];
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
}

/**
 * Handle deselection of a source
 */
export function handleSourceDeselection(
  provider: string,
  callbacks: Pick<SourceSelectionCallbacks, 'setSelectedSources' | 'setSelectedSourcesMetadata' | 'selectedSources'>
): void {
  const { setSelectedSources, setSelectedSourcesMetadata, selectedSources } = callbacks;

  setSelectedSources(selectedSources.filter(s => s !== provider));
  setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => {
    const newMetadata = { ...prev };
    delete newMetadata[provider];
    return newMetadata;
  });

  notify({ severity: 'WARNING', title: 'Source Removed', message: `${provider} metadata removed` });
}

/**
 * Remove old covers from a provider during force update
 */
export function removeOldProviderCovers(
  provider: string,
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>
): void {
  const normalizedProvider = provider.toLowerCase();
  logger.info(`[Source Selection] Force update - removing old ${normalizedProvider} covers`);

  setMediaGallery((prev: MediaGallery) => {
    const filteredCoversWithProviders = (prev.coversWithProviders ?? []).filter(
      (item: { url: string; provider: string }) => item.provider !== normalizedProvider
    );

    const remainingCoverUrls = new Set(filteredCoversWithProviders.map(item => item.url));
    const filteredCovers = prev.covers.filter(url => remainingCoverUrls.has(url));

    logger.info(
      `[Source Selection] Removed ${prev.covers.length - filteredCovers.length} old covers from ${normalizedProvider}`
    );

    return {
      ...prev,
      covers: filteredCovers,
      coversWithProviders: filteredCoversWithProviders
    };
  });
}

/**
 * Update selected sources list
 * Uses functional update to avoid race conditions when multiple sources are added concurrently
 */
export function updateSelectedSources(
  provider: string,
  callbacks: Pick<SourceSelectionCallbacks, 'setSelectedSources' | 'selectedSources'>
): void {
  const { setSelectedSources } = callbacks;
  const normalizedProvider = provider.toLowerCase();

  // Use functional update pattern to avoid race conditions
  // When multiple providers are added concurrently, each update will see the latest state
  setSelectedSources((prevSources: string[]) => {
    if (prevSources.includes(normalizedProvider)) {
      console.warn(`[updateSelectedSources] ${normalizedProvider} already in selectedSources`, {
        current: prevSources
      });
      return prevSources; // No change needed
    }

    const newSources = [...prevSources, normalizedProvider];
    console.warn(`[updateSelectedSources] Adding ${normalizedProvider} to selectedSources`, {
      before: prevSources,
      after: newSources
    });
    return newSources;
  });
}

// Type definitions for complex union types
type PublisherType = string | { name?: string; english?: string; japan?: string };
type DateType = string | { year?: number; month?: number; day?: number };

/**
 * Merge two metadata objects, preferring non-empty values from the new metadata
 * while preserving existing values when new ones are empty
 */
function mergeProviderMetadata(
  existing: ProviderMetadata | undefined,
  incoming: ProviderMetadata
): ProviderMetadata {
  if (!existing) {
    return incoming;
  }

  // Helper to get non-empty array
  const getArray = (primary: string[] | undefined, fallback: string[] | undefined): string[] | undefined => {
    if (Array.isArray(primary) && primary.length > 0) return primary;
    if (Array.isArray(fallback) && fallback.length > 0) return fallback;
    return undefined;
  };

  // Helper to get non-empty string
  const getString = (primary: string | undefined, fallback: string | undefined): string | undefined => {
    if (typeof primary === 'string' && primary.length > 0) return primary;
    if (typeof fallback === 'string' && fallback.length > 0) return fallback;
    return undefined;
  };

  // Helper to get complex publisher field (can be string or object)
  const getPublisher = (primary: PublisherType | undefined, fallback: PublisherType | undefined): PublisherType | undefined => {
    if (primary !== undefined) {
      if (typeof primary === 'string' && primary.length > 0) return primary;
      if (typeof primary === 'object' && Object.keys(primary).length > 0) return primary;
    }
    if (fallback !== undefined) {
      if (typeof fallback === 'string' && fallback.length > 0) return fallback;
      if (typeof fallback === 'object' && Object.keys(fallback).length > 0) return fallback;
    }
    return undefined;
  };

  // Helper to get complex date field (can be string or object)
  const getDate = (primary: DateType | undefined, fallback: DateType | undefined): DateType | undefined => {
    if (primary !== undefined) {
      if (typeof primary === 'string' && primary.length > 0) return primary;
      if (typeof primary === 'object' && Object.keys(primary).length > 0) return primary;
    }
    if (fallback !== undefined) {
      if (typeof fallback === 'string' && fallback.length > 0) return fallback;
      if (typeof fallback === 'object' && Object.keys(fallback).length > 0) return fallback;
    }
    return undefined;
  };

  // Merge with preference for incoming values, but preserve existing non-empty values
  return {
    // Start with existing as base, then override with incoming
    ...existing,
    ...incoming,

    // Array fields - prefer non-empty, incoming first
    genres: getArray(incoming.genres, existing.genres),
    authors: getArray(incoming.authors, existing.authors),
    artists: getArray(incoming.artists, existing.artists),
    tags: getArray(incoming.tags, existing.tags),
    themes: getArray(incoming.themes, existing.themes),
    alternativeTitles: getArray(incoming.alternativeTitles, existing.alternativeTitles),
    gallery: getArray(incoming.gallery, existing.gallery),
    volumeData: incoming.volumeData ?? existing.volumeData,
    chapterData: incoming.chapterData ?? existing.chapterData,

    // String fields - prefer non-empty, incoming first
    title: getString(incoming.title, existing.title) ?? '',
    description: getString(incoming.description, existing.description) ?? '',
    synopsis: getString(incoming.synopsis, existing.synopsis),
    status: getString(incoming.status, existing.status) ?? '',
    format: getString(incoming.format, existing.format),
    demographic: getString(incoming.demographic, existing.demographic),
    coverImage: getString(incoming.coverImage, existing.coverImage),
    bannerImage: getString(incoming.bannerImage, existing.bannerImage),
    url: getString(incoming.url, existing.url),
    wikiUrl: getString(incoming.wikiUrl, existing.wikiUrl),
    siteDetailUrl: getString(incoming.siteDetailUrl, existing.siteDetailUrl),
    siteUrl: getString(incoming.siteUrl, existing.siteUrl),
    volumesListUrl: getString(incoming.volumesListUrl, existing.volumesListUrl),

    // Complex union type fields (can be string or object)
    publisher: getPublisher(incoming.publisher, existing.publisher),
    startDate: getDate(incoming.startDate, existing.startDate),
    endDate: getDate(incoming.endDate, existing.endDate),

    // Numeric fields - prefer incoming if set
    volumes: incoming.volumes ?? existing.volumes,
    chapters: incoming.chapters ?? existing.chapters,

    // External ID fields - prefer incoming if set
    idMal: incoming.idMal ?? existing.idMal,
    anilistId: incoming.anilistId ?? existing.anilistId,
  } as ProviderMetadata;
}

/**
 * Update metadata for a selected source
 * Merges incoming metadata with existing to preserve fields while adding new data
 */
export function updateSourceMetadata(
  provider: string,
  metadata: ProviderMetadata,
  callbacks: Pick<SourceSelectionCallbacks, 'setSelectedSourcesMetadata' | 'selectedSourcesMetadata'>
): void {
  const { setSelectedSourcesMetadata } = callbacks;
  const normalizedProvider = provider.toLowerCase();

  // Debug: Log incoming metadata for authors/publisher
  logger.debug('[updateSourceMetadata] provider', { provider: normalizedProvider });
  logger.debug('[updateSourceMetadata] incoming metadata', {
    authors: metadata.authors,
    publisher: metadata.publisher,
    startDate: metadata.startDate
  });

  // Debug: Check incoming volumeData for chapter covers
  const incomingVolumeData = metadata.volumeData;
  let incomingChapterCovers = 0;
  if (Array.isArray(incomingVolumeData)) {
    incomingVolumeData.forEach((vol: unknown) => {
      const volRecord = vol as Record<string, unknown>;
      const chapters = volRecord['chapters'];
      if (Array.isArray(chapters)) {
        chapters.forEach((ch: unknown) => {
          const chRecord = ch as Record<string, unknown>;
          if (chRecord['coverImageUrl']) {
            incomingChapterCovers++;
          }
        });
      }
    });
  }
  logger.debug('[updateSourceMetadata] Incoming metadata chapter covers', {
    provider: normalizedProvider,
    volumeCount: Array.isArray(incomingVolumeData) ? incomingVolumeData.length : 0,
    chapterCoversCount: incomingChapterCovers,
    sampleCover: Array.isArray(incomingVolumeData) && incomingVolumeData.length > 0
      ? incomingVolumeData[0]?.chapters?.[0]?.coverImageUrl
      : undefined
  });

  setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => {
    const newMetadata = { ...prev };
    const existingMetadata = prev[normalizedProvider];

    // Merge instead of replace to preserve existing data
    newMetadata[normalizedProvider] = mergeProviderMetadata(existingMetadata, metadata);

    // Debug: Check merged volumeData
    const mergedVolumeData = newMetadata[normalizedProvider].volumeData;
    let mergedChapterCovers = 0;
    if (Array.isArray(mergedVolumeData)) {
      mergedVolumeData.forEach((vol: unknown) => {
        const volRecord = vol as Record<string, unknown>;
        const chapters = volRecord['chapters'];
        if (Array.isArray(chapters)) {
          chapters.forEach((ch: unknown) => {
            const chRecord = ch as Record<string, unknown>;
            if (chRecord['coverImageUrl']) {
              mergedChapterCovers++;
            }
          });
        }
      });
    }
    logger.debug('[updateSourceMetadata] After merge', {
      provider: normalizedProvider,
      hadExisting: !!existingMetadata,
      existingVolumeCount: Array.isArray(existingMetadata?.volumeData) ? existingMetadata.volumeData.length : 0,
      mergedVolumeCount: Array.isArray(mergedVolumeData) ? mergedVolumeData.length : 0,
      mergedChapterCoversCount: mergedChapterCovers,
    });

    logger.info(`[Source Selection] Merged metadata for ${normalizedProvider}:`, {
      hadExisting: !!existingMetadata,
      existingGenres: existingMetadata?.genres?.length ?? 0,
      incomingGenres: metadata.genres?.length ?? 0,
      mergedGenres: newMetadata[normalizedProvider].genres?.length ?? 0,
    });

    return newMetadata;
  });
}

/**
 * Log metadata details for debugging
 */
export function logMetadataDetails(
  provider: string,
  metadata: ProviderMetadata,
  selectedSourcesMetadata: Record<string, ProviderMetadata>
): void {
  const normalizedProvider = provider.toLowerCase();
  const updatedMetadata = {
    ...selectedSourcesMetadata,
    [normalizedProvider]: metadata
  };

  interface WikiRawData {
    volumeList?: Array<{
      chapters?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    }>;
    chapters?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  }

  const metadataRawData = metadata.rawData as WikiRawData | undefined;

  logger.info(`[Source Selection] Updated selectedSourcesMetadata:`, {
    keys: Object.keys(updatedMetadata),
    [normalizedProvider]: {
      hasVolumeData: !!metadata.volumeData,
      volumeDataLength: metadata.volumeData?.length ?? 0,
      volumes: metadata.volumes,
      chapters: metadata.chapters,
      firstVolume: metadata.volumeData?.[0],
      hasRawData: !!metadata.rawData,
      rawDataType: typeof metadata.rawData,
      rawDataVolumeList: metadataRawData?.volumeList?.length ?? 0
    }
  });
}

/**
 * Show success notification
 */
export function showSuccessNotification(provider: string, forceUpdate: boolean): void {
  notify({ severity: 'SUCCESS', title: forceUpdate ? 'Source Updated' : 'Source Added', message: `${provider} metadata ${forceUpdate ? 'updated' : 'loaded'} successfully` });
}

/**
 * Show error notification
 */
export function showErrorNotification(provider: string, error: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Failed to fetch ${provider} metadata:`, errorMessage);

  notify({ severity: 'ERROR', title: 'Failed to load metadata', message: errorMessage });
}

/**
 * Log volume information
 */
export function logVolumeInfo(provider: string, metadata: ProviderMetadata): void {
  if (metadata.volumes && Array.isArray(metadata.volumes)) {
    logger.info(`[Source Selection] ${provider} has ${metadata.volumes.length} volumes`);
  }
}
