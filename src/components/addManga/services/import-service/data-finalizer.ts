/**
 * Data Finalizer Module
 *
 * Handles final data preparation and cleaning before import.
 * Breaks down complex logic into focused helper functions.
 *
 * Extracted from: importService.ts (lines 554-620)
 */

import { logger } from '@/utils/logger/index';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { isRecord } from './utils';

/**
 * Clean up undefined/null values from object recursively
 */
function cleanData(obj: unknown): unknown {
  if (!isRecord(obj)) return obj;

  const cleaned: Record<string, unknown> = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null) {
      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanData(value);
      } else {
        cleaned[key] = value;
      }
    }
  });

  return cleaned;
}

/**
 * Extract all chapters from volumes array
 */
function extractAllChapters(volumes: unknown): unknown[] {
  if (!Array.isArray(volumes)) return [];

  return volumes.flatMap((v: unknown) => {
    if (!isRecord(v)) return [];
    return getUnknownProperty(v, 'chapters') ?? [];
  });
}

/**
 * Build raw data structure for confirmation screen
 */
function buildRawData(cleanedData: unknown): Record<string, unknown> {
  const volumes = isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'volumes') : null;

  return {
    volumes: volumes ?? [],
    chapters: extractAllChapters(volumes),
    totalVolumes: isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'totalVolumes') : undefined,
    totalChapters: isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'totalChapters') : undefined,
    selectedVolumesData: volumes ?? [],
    coverImage: isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'coverImage') : undefined,
    bannerImage: isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'bannerImage') : undefined,
    volumeCovers: (isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'volumeCovers') : null) ?? [],
    chapterCovers: (isRecord(cleanedData) ? getUnknownProperty(cleanedData, 'chapterCovers') : null) ?? []
  };
}

/**
 * Log final data structure for debugging
 */
function logFinalDataStructure(finalData: Record<string, unknown>): void {
  const rawData = finalData['rawData'];
  const rawDataVolumes = Array.isArray(rawData) ? [] :
    (isRecord(rawData) && Array.isArray((rawData as Record<string, unknown>)['volumes'])
      ? (rawData as Record<string, unknown>)['volumes'] as unknown[]
      : []);
  const firstVolume = rawDataVolumes.length > 0 ? rawDataVolumes[0] : null;

  logger.info('🎯 [IMPORT-SERVICE] prepareFinalData complete:', {
    hasVolumes: !!getUnknownProperty(finalData, 'volumes'),
    volumesLength: Array.isArray(getUnknownProperty(finalData, 'volumes'))
      ? (getUnknownProperty(finalData, 'volumes') as unknown[]).length
      : 0,
    hasRawData: !!rawData,
    rawDataVolumesLength: rawDataVolumes.length,
    rawDataTotalVolumes: isRecord(rawData)
      ? getUnknownProperty(rawData as Record<string, unknown>, 'totalVolumes')
      : undefined,
    rawDataTotalChapters: isRecord(rawData)
      ? getUnknownProperty(rawData as Record<string, unknown>, 'totalChapters')
      : undefined,
    firstRawVolume: firstVolume && isRecord(firstVolume) ? {
      volumeNumber: getUnknownProperty(firstVolume, 'volumeNumber'),
      title: getUnknownProperty(firstVolume, 'title'),
      coverImageUrl: getUnknownProperty(firstVolume, 'coverImageUrl'),
      summary: getUnknownProperty(firstVolume, 'summary'),
      chaptersCount: Array.isArray(getUnknownProperty(firstVolume, 'chapters'))
        ? (getUnknownProperty(firstVolume, 'chapters') as unknown[]).length
        : 0
    } : null
  });
}

/**
 * Prepare final data for import
 *
 * Cleans undefined/null values and wraps data in rawData structure
 * for consistency with ConfirmationStep expectations.
 *
 * @param data - Data to prepare
 * @returns Final structured data
 */
export function prepareFinalData(data: unknown): unknown {
  const cleanedData = cleanData(data);
  const rawData = buildRawData(cleanedData);

  const finalData = {
    ...(isRecord(cleanedData) ? cleanedData : {}),
    rawData
  };

  logFinalDataStructure(finalData as Record<string, unknown>);

  return finalData;
}
