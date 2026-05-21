/**
 * useWizardImportData Hook
 *
 * Extracts enriched volume data from provider metadata based on the selected
 * chapter source from the import wizard.
 *
 * This hook handles:
 * - Parsing provider metadata (including double-encoded JSON)
 * - Extracting the selected chapter source from importProfile
 * - Loading volume data from the selected provider (ComicVine, Fandom, Wikipedia, AniList)
 * - Building volume title and cover URL lookup maps
 *
 * Extracted from: ResponsiveChapterList.tsx (lines 60-116)
 * Created: 2025-11-17
 */

import { useMemo } from 'react';

import { logger } from '@/utils/logger';

import {
  parseJSON,
  parseDoubleEncodedJSON,
  isRecord,
  safeGet,
  safeGetArray,
  safeGetRecord,
  createVolumeMetadata,
} from '../utils';

import type { EnrichedVolume } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of wizard import data extraction
 */
export interface WizardImportDataResult {
  /** Enriched volume array from selected provider (null if no data found) */
  enrichedVolumeData: EnrichedVolume[] | null;
  /** Volume number -> title lookup map */
  volumeTitles: Record<number, string>;
  /** Volume number -> cover URL lookup map */
  volumeCovers: Record<number, string>;
  /** Selected chapter source provider name (null if not found) */
  selectedChapterSource: string | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Extract enriched volume data from wizard import metadata
 *
 * PRIORITY 1: Use the selected chapter source provider from wizard import
 *
 * The wizard import process stores:
 * - `importProfile.chapterSource`: Primary selected source
 * - `importProfile.primarySource`: Fallback selected source
 *
 * Then extracts volume data from that specific provider's metadata:
 * - ComicVine: `comicvine.volumeData` or `COMICVINE.volumeData`
 * - Fandom: `fandom.volumeData` or `FANDOM.volumeData`
 * - Wikipedia: `wikipedia.volumeData` or `WIKIPEDIA.volumeData`
 * - AniList: `anilist.volumeData` or `ANILIST.volumeData`
 *
 * @param providerMetadata - Raw provider metadata (string or object, may be double-encoded)
 * @returns WizardImportDataResult with enriched volume data and metadata maps
 *
 * @example
 * ```tsx
 * const { enrichedVolumeData, volumeTitles, volumeCovers } = useWizardImportData(
 *   manga.providerMetadata
 * );
 * ```
 */
export function useWizardImportData(
  providerMetadata: unknown
): WizardImportDataResult {
  return useMemo(() => {
    // Initialize empty result
    const result: WizardImportDataResult = {
      enrichedVolumeData: null,
      volumeTitles: {},
      volumeCovers: {},
      selectedChapterSource: null,
    };

    // Early return if no provider metadata
    if (!providerMetadata) {
      return result;
    }

    try {
      // Parse provider metadata (handle string, object, or double-encoded JSON)
      let parsed = parseJSON(providerMetadata);

      // Handle double-encoded JSON (parse again if still a string)
      if (typeof parsed === 'string') {
        parsed = parseDoubleEncodedJSON(parsed);
      }

      // Ensure we have a valid object
      if (!isRecord(parsed)) {
        logger.warn('[useWizardImportData] Invalid provider metadata structure', {
          type: typeof parsed,
        });
        return result;
      }

      // Extract importProfile
      const importProfile = safeGetRecord(parsed, 'importProfile');

      // Get selected chapter source (prioritize chapterSource, fallback to primarySource)
      const chapterSource = importProfile
        ? (safeGet<string>(importProfile, 'chapterSource') ??
           safeGet<string>(importProfile, 'primarySource') ??
           null)
        : null;

      result.selectedChapterSource = chapterSource;

      // If no chapter source selected, return early
      if (!chapterSource || typeof chapterSource !== 'string') {
        return result;
      }

      // Extract volume data from the selected provider
      // Try both lowercase and uppercase provider keys
      const sourceKey = chapterSource.toLowerCase();
      const sourceKeyUpper = chapterSource.toUpperCase();

      // Try lowercase key first
      const providerDataLower = safeGetRecord(parsed, sourceKey);
      const volumeDataLower = providerDataLower
        ? safeGetArray<EnrichedVolume>(providerDataLower, 'volumeData')
        : undefined;

      // Try uppercase key if lowercase didn't work
      const providerDataUpper = safeGetRecord(parsed, sourceKeyUpper);
      const volumeDataUpper = providerDataUpper
        ? safeGetArray<EnrichedVolume>(providerDataUpper, 'volumeData')
        : undefined;

      // Use whichever volume data we found
      const volumeData = volumeDataLower ?? volumeDataUpper;

      // Validate volume data exists and is non-empty
      if (!volumeData || volumeData.length === 0) {
        logger.debug('[useWizardImportData] No volume data found for selected source', {
          selectedSource: chapterSource,
          triedKeys: [sourceKey, sourceKeyUpper],
        });
        return result;
      }

      // Store enriched volume data
      result.enrichedVolumeData = volumeData;

      // Build volume titles and covers maps
      const metadata = createVolumeMetadata(volumeData);
      result.volumeTitles = metadata.volumeTitles;
      result.volumeCovers = metadata.volumeCovers;

      logger.debug('[useWizardImportData] Successfully extracted volume data', {
        selectedSource: chapterSource,
        volumeCount: volumeData.length,
        titleCount: Object.keys(metadata.volumeTitles).length,
        coverCount: Object.keys(metadata.volumeCovers).length,
      });

      return result;
    } catch (error) {
      logger.error('[useWizardImportData] Error parsing provider metadata', { error });
      return result;
    }
  }, [providerMetadata]);
}
