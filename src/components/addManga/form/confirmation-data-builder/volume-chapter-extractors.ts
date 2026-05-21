/**
 * Volume and Chapter Data Extractors
 *
 * Extracts volume and chapter data from various sources with type-safe processing.
 * Handles both numeric counts and detailed volume/chapter arrays.
 *
 * @module components/addManga/form/confirmation-data-builder/volume-chapter-extractors
 */

import type {
  MangaWithDynamicMetadata,
  RawDataObject,
  ProviderSpecificObject,
  MetadataObject,
  VolumeDetail,
} from './types';

/**
 * Type guard to check if value is a valid VolumeDetail
 */
function isVolumeDetail(value: unknown): value is VolumeDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'volumeNumber' in value &&
    typeof value.volumeNumber === 'number' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

/**
 * Processes array of volume data into VolumeDetail[]
 */
function processVolumeArray(volumes: unknown[]): VolumeDetail[] {
  const filteredVolumes = volumes.filter(isVolumeDetail);
  return filteredVolumes.map(v => ({
    number: v.volumeNumber,
    title: v.title,
    ...(v.chapterCount !== undefined ? { chapterCount: v.chapterCount } : {}),
    ...(v.coverImageUrl !== undefined ? { coverImageUrl: v.coverImageUrl } : {}),
    ...(v.summary !== undefined ? { summary: v.summary } : {}),
    ...(v.chapters !== undefined ? { chapters: v.chapters } : {}),
  } as VolumeDetail));
}

/**
 * Creates placeholder volumes for numeric counts
 */
function createPlaceholderVolumes(count: number): VolumeDetail[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    volumeNumber: i + 1,
    title: `Volume ${i + 1}`,
    chapterCount: 0,
  }));
}

/**
 * Extracts volume data from manga sources
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param providerSpecific - Provider-specific data
 * @param metadata - Metadata object
 * @returns Array of VolumeDetail objects
 */
export function extractVolumeData(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): VolumeDetail[] {
  const volumeData = manga.volumes ?? rawData?.volumes ?? providerSpecific?.volumes ?? metadata?.['volumes'];

  if (!volumeData) return [];

  if (Array.isArray(volumeData)) {
    return processVolumeArray(volumeData);
  }

  if (typeof volumeData === 'number') {
    return createPlaceholderVolumes(volumeData);
  }

  return [];
}

/**
 * Extracts chapter data from manga sources
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param providerSpecific - Provider-specific data
 * @param metadata - Metadata object
 * @returns Chapter data (number or array)
 */
export function extractChapterData(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  providerSpecific?: ProviderSpecificObject,
  metadata?: MetadataObject
): number | unknown[] | undefined {
  const chapters = manga.chapters ?? rawData?.['chapters'] ?? providerSpecific?.chapters ?? metadata?.['chapters'];
  return (typeof chapters === 'number' || Array.isArray(chapters)) ? chapters : undefined;
}

/**
 * Extracts total volumes count
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Total volumes count
 */
export function extractTotalVolumes(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): number | undefined {
  const totalVolumes = (manga['totalVolumes'] as number | undefined) ?? rawData?.totalVolumes ?? rawData?.volumeCount ?? (metadata?.['totalVolumes'] as number | undefined);
  return typeof totalVolumes === 'number' ? totalVolumes : undefined;
}

/**
 * Extracts total chapters count
 *
 * @param manga - Main manga object
 * @param rawData - Raw data from wizard/Fandom
 * @param metadata - Metadata object
 * @returns Total chapters count
 */
export function extractTotalChapters(
  manga: MangaWithDynamicMetadata,
  rawData?: RawDataObject,
  metadata?: MetadataObject
): number | undefined {
  const totalChapters = (manga['totalChapters'] as number | undefined) ?? rawData?.totalChapters ?? rawData?.chapterCount ?? (metadata?.['totalChapters'] as number | undefined);
  return typeof totalChapters === 'number' ? totalChapters : undefined;
}
