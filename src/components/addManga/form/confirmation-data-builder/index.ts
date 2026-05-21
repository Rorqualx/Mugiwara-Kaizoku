/**
 * Confirmation Data Builder - Main Orchestrator
 *
 * Builds the confirmation data object for the ConfirmationStep component.
 * This module coordinates all extraction modules to create a unified structure
 * from various data sources (direct properties, rawData, providerSpecific, metadata).
 *
 * Complexity reduced from 72 → <15 through modular extraction.
 *
 * @module components/addManga/form/confirmation-data-builder
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';

import {
  extractFormat,
} from './basic-metadata-extractors';
import { extractComicVineFields } from './comicvine-extractors';
import { extractComprehensiveMetadata } from './comprehensive-metadata-extractors';
import {
  extractBannerImage,
} from './image-url-extractors';
import {
  extractSelectedProviders,
  extractProviderMetadata,
} from './import-profile-extractors';
import {
  extractDescriptions,
  extractIdentifiers,
} from './publisher-identifier-extractors';
import { removeUndefined } from './utilities';
import {
  extractVolumeData,
  extractChapterData,
} from './volume-chapter-extractors';

import type {
  MangaWithDynamicMetadata,
  RawDataObject,
  MetadataObject,
  ConfirmationDataObject,
  ProviderSpecificObject,
  VolumeDetail,
  PublisherObject,
} from './types';

/**
 * Builds the rawData property object with Fandom and wizard-specific fields
 */
function buildRawDataObject(rawData?: RawDataObject): RawDataObject {
  if (!rawData) return {};

  return {
    ...rawData,
    // Include Fandom-specific fields (only if defined)
    ...(rawData.volumeDetails ? { volumeDetails: rawData.volumeDetails } : {}),
    ...(rawData.chapterDetails ? { chapterDetails: rawData.chapterDetails } : {}),
    ...(rawData.chapterUrls ? { chapterUrls: rawData.chapterUrls } : {}),
    ...(rawData.shouldFetchChapterDetails !== undefined ? { shouldFetchChapterDetails: rawData.shouldFetchChapterDetails } : {}),
    // Include selected volumes data from wizard
    ...(rawData.selectedVolumes ? { selectedVolumes: rawData.selectedVolumes } : {}),
    ...(rawData.selectedVolumesData ? { selectedVolumesData: rawData.selectedVolumesData } : {}),
    ...(rawData.chapterMetadataCache ? { chapterMetadataCache: rawData.chapterMetadataCache } : {}),
    ...(rawData.providerMetadata ? { providerMetadata: rawData.providerMetadata } : {}),
    ...(rawData.selectedProviders ? { selectedProviders: rawData.selectedProviders } : {}),
  };
}

/**
 * Builds the metadata property object with all comprehensive fields
 */
function buildMetadataObject(
  selectedManga: ExtendedMangaSearchResult,
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): Record<string, unknown> {
  const descriptions = extractDescriptions(manga, rawData, metadata);
  const identifiers = extractIdentifiers(manga, rawData, metadata);
  const comicVineFields = extractComicVineFields(manga, providerSpecific, metadata);

  return removeUndefined({
    ...(selectedManga.metadata ?? {}),
    coverUrl: selectedManga.cover ?? selectedManga.coverImage ?? selectedManga.coverUrl ?? '',
    description: selectedManga.description ?? '',
    // Include all description fields in metadata
    descriptions: metadata?.descriptions ?? {
      main: selectedManga.description,
      synopsis: descriptions['synopsis'],
      plot: descriptions['plot'],
      background: descriptions['background'],
      history: descriptions['history'],
    },
    // Include IDs in metadata
    ...identifiers,
    status: selectedManga.status ?? '',
    genres: Array.isArray(selectedManga.genres) ? selectedManga.genres : [],
    authors: Array.isArray(selectedManga.authors) ? selectedManga.authors : [],
    artists: Array.isArray(manga.artists) ? manga.artists : [],
    alternativeTitles: Array.isArray(selectedManga.alternativeTitles) ? selectedManga.alternativeTitles : [],
    // Include all fields in metadata
    chapters: extractChapterData(manga, rawData, providerSpecific, metadata),
    volumes: extractVolumeData(manga, rawData, providerSpecific, metadata),
    format: extractFormat(manga, rawData, providerSpecific, metadata),
    ...extractComprehensiveMetadata(manga, rawData, providerSpecific, metadata),
    bannerImage: extractBannerImage(manga, rawData, metadata),
    // Include ComicVine-specific fields
    ...comicVineFields,
  });
}

/**
 * Builds the complete confirmation data object from selected manga
 *
 * Complexity reduced from 72 → <15 through modular extraction.
 *
 * @param selectedManga - The manga selected from search results
 * @returns Complete confirmation data object for ConfirmationStep
 */
export function buildConfirmationData(
  selectedManga: ExtendedMangaSearchResult
): ConfirmationDataObject {
  const manga = selectedManga as MangaWithDynamicMetadata;
  const metadata = manga.metadata as MetadataObject | undefined;
  const rawData = manga.rawData;
  const providerSpecific = manga.providerSpecific;

  // Extract data from all modules
  const descriptions = extractDescriptions(manga, rawData, metadata);
  const identifiers = extractIdentifiers(manga, rawData, metadata);
  const comicVineFields = extractComicVineFields(manga, providerSpecific, metadata);
  const comprehensiveMetadata = extractComprehensiveMetadata(manga, rawData, providerSpecific, metadata);

  return {
    id: String(selectedManga.id),
    type: 'manga' as const,
    title: selectedManga.title,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: selectedManga.source may be undefined at runtime
    source: String(selectedManga.source ?? selectedManga.provider ?? 'unknown'),
    sourceId: String(selectedManga.id),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: selectedManga.provider may be undefined at runtime
    provider: String(selectedManga.provider ?? selectedManga.source ?? 'unknown'),
    // Pass cover and description at top level as expected by ConfirmationStep
    cover: selectedManga.cover,
    coverImage: selectedManga.coverImage,
    coverUrl: selectedManga.coverUrl,
    description: selectedManga.description,
    // Add all description fields from wizard
    ...descriptions,
    // Add IDs from wizard
    ...identifiers,
    status: selectedManga.status,
    genres: selectedManga.genres,
    alternativeTitles: selectedManga.alternativeTitles,
    authors: selectedManga.authors ?? rawData?.authors ?? providerSpecific?.authors ?? metadata?.authors,
    // Include ComicVine-specific fields at top level for easy access
    ...comicVineFields,
    // Include all comprehensive metadata fields
    ...comprehensiveMetadata,
    // Pass both rawData and providerSpecific data
    rawData: buildRawDataObject(rawData),
    providerSpecific: providerSpecific ?? rawData,
    // Pass provider metadata and selected providers at top level too
    providerMetadata: extractProviderMetadata(rawData) ?? manga.providerMetadata,
    selectedProviders: extractSelectedProviders(rawData) ?? manga.selectedProviders,
    // Also ensure metadata has all fields including chapters/volumes
    metadata: buildMetadataObject(selectedManga, manga, rawData, providerSpecific, metadata),
  } as ConfirmationDataObject;
}

// Export types for use in form.tsx
export type {
  VolumeDetail,
  MetadataObject,
  RawDataObject,
  ProviderSpecificObject,
  MangaWithDynamicMetadata,
  ConfirmationDataObject,
  PublisherObject,
};
