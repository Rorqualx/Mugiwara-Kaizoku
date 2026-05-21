/**
 * useRawProviderData Hook
 *
 * Extracts enriched volume data from manga.rawProviderData when wizard import
 * data is unavailable. This hook serves as a fallback data source (Priority 2).
 *
 * Responsibilities:
 * - Parse rawProviderData (handles string/object formats)
 * - Extract volumes array from rawData.volumes
 * - Extract volume covers from rawData.volumeCovers
 * - Build volumeTitles and volumeCovers lookup maps
 *
 * Performance Optimization:
 * - Early return if shouldExtract is false (wizard data takes priority)
 * - Memoized computation to prevent re-parsing on every render
 *
 * Extracted from: ResponsiveChapterList.tsx (lines 118-154)
 * Created: 2025-11-17
 */

import { useMemo } from 'react';

import { logger } from '@/utils/logger';

import {
  extractVolumeCover,
  extractVolumeNumber,
  extractVolumeTitle,
  isEnrichedVolumeArray,
  isRecord,
  parseJSON,
  safeGetArray,
} from '../utils';

import type { EnrichedVolume } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of raw provider data extraction
 *
 * Contains enriched volume data with embedded chapters,
 * plus extracted volume title and cover lookup maps.
 */
export interface RawProviderDataResult {
  /** Enriched volume array with embedded chapters (null if extraction failed) */
  enrichedVolumeData: EnrichedVolume[] | null;
  /** Volume number -> title lookup map */
  volumeTitles: Record<number, string>;
  /** Volume number -> cover URL lookup map */
  volumeCovers: Record<number, string>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Extract enriched volume data from rawProviderData
 *
 * This hook is used as a fallback (Priority 2) when wizard import data
 * is not available. It parses manga.rawProviderData and extracts:
 * - enrichedVolumeData: Full volume array with embedded chapters
 * - volumeTitles: Map of volume number -> title
 * - volumeCovers: Map of volume number -> cover URL
 *
 * @param rawProviderData - Raw provider data from manga.rawProviderData
 * @param shouldExtract - Only extract if wizard import data is empty (performance optimization)
 * @returns Extracted volume data with titles and covers
 *
 * @example
 * ```tsx
 * const { enrichedVolumeData, volumeTitles, volumeCovers } = useRawProviderData(
 *   manga.rawProviderData,
 *   !hasWizardData // Only extract if wizard data is missing
 * );
 * ```
 */
export function useRawProviderData(
  rawProviderData: unknown,
  shouldExtract: boolean
): RawProviderDataResult {
  return useMemo(() => {
    // Early return if we shouldn't extract (wizard data takes priority)
    if (!shouldExtract) {
      return {
        enrichedVolumeData: null,
        volumeTitles: {},
        volumeCovers: {},
      };
    }

    // Early return if no raw data provided
    if (!rawProviderData) {
      return {
        enrichedVolumeData: null,
        volumeTitles: {},
        volumeCovers: {},
      };
    }

    // Initialize result containers
    const volumeTitles: Record<number, string> = {};
    const volumeCovers: Record<number, string> = {};
    let enrichedVolumeData: EnrichedVolume[] | null = null;

    try {
      // Parse rawProviderData (handles both string and object formats)
      const rawData = parseJSON(rawProviderData);

      if (!isRecord(rawData)) {
        logger.warn('[useRawProviderData] rawProviderData is not a valid record');
        return {
          enrichedVolumeData: null,
          volumeTitles: {},
          volumeCovers: {},
        };
      }

      // Extract volumes array from rawData.volumes
      const volumes = safeGetArray(rawData, 'volumes');
      if (volumes && isEnrichedVolumeArray(volumes)) {
        enrichedVolumeData = volumes;

        // Build volumeTitles map
        volumes.forEach((volume) => {
          const volumeNum = extractVolumeNumber(volume);
          const title = extractVolumeTitle(volume);

          if (volumeNum !== undefined && title !== undefined && typeof title === 'string') {
            volumeTitles[volumeNum] = title;
          }
        });
      }

      // Extract volume covers from rawData.volumeCovers
      const coverArray = safeGetArray(rawData, 'volumeCovers');
      if (coverArray && isEnrichedVolumeArray(coverArray)) {
        // Build volumeCovers map
        coverArray.forEach((cover) => {
          const volumeNum = extractVolumeNumber(cover);
          const coverUrl = extractVolumeCover(cover);

          if (volumeNum !== undefined && coverUrl !== undefined && typeof coverUrl === 'string') {
            volumeCovers[volumeNum] = coverUrl;
          }
        });
      }

      return {
        enrichedVolumeData,
        volumeTitles,
        volumeCovers,
      };
    } catch (error) {
      logger.error('[useRawProviderData] Error parsing rawProviderData', { error });
      return {
        enrichedVolumeData: null,
        volumeTitles: {},
        volumeCovers: {},
      };
    }
  }, [rawProviderData, shouldExtract]);
}
