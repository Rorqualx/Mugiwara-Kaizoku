/**
 * Field Value Helpers
 *
 * Helper functions for extracting specific field values from metadata.
 * These helpers reduce complexity in the main component.
 */

import { logger } from '@/utils/logger';

interface VolumeWithChapters {
  volumeNumber?: number;
  chapterCount?: number;
  chapters?: unknown[];
  [key: string]: unknown;
}

interface SelectedResult {
  title?: string;
  coverImage?: string;
  cover?: string;
  coverUrl?: string;
  description?: string;
  synopsis?: string;
  status?: string;
  format?: string;
  author?: string;
  artist?: string;
  year?: number;
  genres?: string[];
  tags?: string[];
  alternativeTitles?: string[];
  volumes?: VolumeWithChapters[] | number;
  chapters?: unknown[] | number;
  totalVolumes?: number;
  volumeCount?: number;
  totalChapters?: number;
  chapterCount?: number;
  url?: string;
  bannerImage?: string;
  rawData?: {
    coverImage?: string;
    cover?: string;
    synopsis?: string;
    totalChapters?: number;
    chapterCount?: number;
    totalVolumes?: number;
    volumes?: VolumeWithChapters[];
  };
  metadata?: {
    synopsis?: string;
    totalChapters?: number;
    chapterCount?: number;
  };
  [key: string]: unknown;
}

/**
 * Get cover image value from multiple possible sources
 */
export function getCoverImageValue(
  selectedResult: SelectedResult,
  getFieldSelectionValue: (field: string) => unknown
): unknown {
  const coverUrl = (
    getFieldSelectionValue('coverImage') ??
    getFieldSelectionValue('cover') ??
    selectedResult.coverImage ??
    selectedResult.cover ??
    selectedResult.coverUrl ??
    selectedResult.rawData?.coverImage ??
    selectedResult.rawData?.cover ??
    null
  );

  logger.info('[MetadataDisplay] Resolved cover URL:', coverUrl);
  return coverUrl;
}

/**
 * Calculate total chapters from volumes array
 */
function calculateChaptersFromVolumes(volumes: VolumeWithChapters[]): number {
  return volumes.reduce((sum: number, vol: VolumeWithChapters) => {
    return sum + ((vol.chapterCount ?? vol.chapters?.length) ?? 0);
  }, 0);
}

/**
 * Extract chapter count from direct properties
 */
function getDirectChapterCount(
  value: unknown,
  selectedResult: SelectedResult
): unknown {
  return (
    value ??
    selectedResult.totalChapters ??
    selectedResult.chapterCount ??
    selectedResult.rawData?.totalChapters ??
    selectedResult.rawData?.chapterCount ??
    selectedResult.metadata?.totalChapters ??
    selectedResult.metadata?.chapterCount ??
    null
  );
}

/**
 * Calculate chapter count from volumes if available
 */
function calculateFromVolumes(selectedResult: SelectedResult): number | null {
  if (selectedResult.volumes && Array.isArray(selectedResult.volumes)) {
    const calculatedCount = calculateChaptersFromVolumes(selectedResult.volumes);
    logger.info('[MetadataDisplay] Calculated from volumes:', calculatedCount);
    return calculatedCount > 0 ? calculatedCount : null;
  }

  if (selectedResult.rawData?.volumes && Array.isArray(selectedResult.rawData.volumes)) {
    const calculatedCount = calculateChaptersFromVolumes(selectedResult.rawData.volumes);
    logger.info('[MetadataDisplay] Calculated from rawData.volumes:', calculatedCount);
    return calculatedCount > 0 ? calculatedCount : null;
  }

  return null;
}

/**
 * Build debug info object for chapter count logging
 */
function buildChapterDebugInfo(
  selectedResult: SelectedResult,
  getFieldSelectionValue: (field: string) => unknown
): Record<string, unknown> {
  return {
    fieldSelectionsValue: getFieldSelectionValue('chapters'),
    selectedResultChapters: selectedResult.chapters,
    selectedResultTotalChapters: selectedResult.totalChapters,
    selectedResultChapterCount: selectedResult.chapterCount,
    rawDataTotalChapters: selectedResult.rawData?.totalChapters,
    rawDataChapterCount: selectedResult.rawData?.chapterCount,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Intentional: Explicit boolean conversion for status flags
    hasVolumes: !!selectedResult?.volumes,
    volumesLength: Array.isArray(selectedResult.volumes) ? selectedResult.volumes.length : 0,
    rawDataVolumesLength: selectedResult.rawData?.volumes?.length
  };
}

/**
 * Get chapters value with fallback logic
 */
export function getChaptersValue(
  selectedResult: SelectedResult,
  getFieldSelectionValue: (field: string) => unknown
): unknown {
  const value = getFieldSelectionValue('chapters') ?? selectedResult.chapters;

  logger.info('[MetadataDisplay] Chapter count debug:', buildChapterDebugInfo(selectedResult, getFieldSelectionValue));

  if (Array.isArray(value)) {
    logger.info('[MetadataDisplay] Chapters is array, length:', value.length);
    return value; // renderField will convert to count
  }

  // Check for direct chapter count
  const chapterCount = getDirectChapterCount(value, selectedResult);
  logger.info('[MetadataDisplay] Direct chapter count:', chapterCount);

  // If still no count, try to calculate from volumes
  if (!chapterCount) {
    const calculatedCount = calculateFromVolumes(selectedResult);
    if (calculatedCount !== null) {
      return calculatedCount;
    }
  }

  logger.info('[MetadataDisplay] Final chapter count:', chapterCount);
  return chapterCount;
}

/**
 * Get volumes value with fallback logic
 */
export function getVolumesValue(
  selectedResult: SelectedResult,
  getFieldSelectionValue: (field: string) => unknown
): unknown {
  const value = getFieldSelectionValue('volumes') ?? selectedResult.volumes;

  if (Array.isArray(value)) {
    return value; // renderField will convert to count
  }

  // Check for totalVolumes or volumeCount
  return (
    value ??
    selectedResult.totalVolumes ??
    selectedResult.volumeCount ??
    selectedResult.rawData?.totalVolumes ??
    null
  );
}
