/**
 * Provider Metadata Hook
 *
 * Extracts volume titles from provider metadata as a fallback when
 * selected provider volumeData and rawProviderData are unavailable.
 *
 * This is the lowest priority extraction (PRIORITY 4) and only runs when
 * previous extraction attempts (selected provider, rawProviderData) have failed.
 *
 * Supports volume title extraction from:
 * - ComicVine issues (regular and fallback paths)
 * - Fandom volumes (multiple metadata structures)
 * - Wikipedia volumes (volumeList)
 * - AniList volumes (numeric volume count)
 *
 * Extracted from: ResponsiveChapterList.tsx lines 187-374
 * Created: 2025-11-17
 */

import { useMemo } from 'react';

import { logger } from '@/utils/logger';

import {
  parseDoubleEncodedJSON,
  safeGetString,
  isRecord,
} from '../utils';

import {
  extractComicVineIssues,
  extractFandomVolumes,
  extractWikipediaVolumes,
  extractAniListVolumes,
  extractComicVineFallback,
} from './provider-extractors';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of provider metadata extraction
 */
export interface ProviderMetadataResult {
  /** Volume number -> title lookup map */
  volumeTitles: Record<number, string>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse selectedSourceId into a record
 */
function parseSelectedSources(selectedSourceId: unknown): Record<string, unknown> {
  if (!selectedSourceId) {
    return {};
  }

  try {
    const parsed: unknown = typeof selectedSourceId === 'string'
      ? JSON.parse(selectedSourceId)
      : selectedSourceId;
    return isRecord(parsed) ? parsed : { default: selectedSourceId };
  } catch {
    logger.debug('[useProviderMetadata] selectedSourceId is not JSON, using as default:', selectedSourceId);
    return { default: selectedSourceId };
  }
}

/**
 * Try provider-specific extractor based on volume source
 */
function extractByVolumeSource(
  volumesSource: string | undefined,
  metadata: Record<string, unknown>
): Record<number, string> | null {
  if (volumesSource === 'comicvine') {
    const titles = extractComicVineIssues(metadata);
    if (Object.keys(titles).length > 0) return titles;
  } else if (volumesSource === 'fandom') {
    const titles = extractFandomVolumes(metadata);
    if (Object.keys(titles).length > 0) return titles;
  } else if (volumesSource === 'wikipedia') {
    const titles = extractWikipediaVolumes(metadata);
    if (Object.keys(titles).length > 0) return titles;
  } else if (volumesSource === 'anilist') {
    const titles = extractAniListVolumes(metadata);
    if (Object.keys(titles).length > 0) return titles;
  }
  return null;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to extract volume titles from provider metadata
 *
 * This is a fallback extraction (PRIORITY 4) that only runs when:
 * 1. shouldExtract is true (previous extractions failed)
 * 2. No volume titles were found from selected provider or rawProviderData
 *
 * @param providerMetadata - Raw provider metadata (possibly double-encoded JSON)
 * @param selectedSourceId - Selected source IDs object (possibly JSON string)
 * @param shouldExtract - Only extract if this is true (previous extractions failed)
 * @returns ProviderMetadataResult with volumeTitles map
 */
export function useProviderMetadata(
  providerMetadata: unknown,
  selectedSourceId: unknown,
  shouldExtract: boolean
): ProviderMetadataResult {
  const volumeTitles = useMemo(() => {
    if (!shouldExtract || !providerMetadata) {
      return {};
    }

    try {
      const metadata = parseDoubleEncodedJSON<Record<string, unknown>>(providerMetadata);
      if (!metadata) {
        return {};
      }

      const selectedSources = parseSelectedSources(selectedSourceId);
      const volumesSource = safeGetString(selectedSources, 'volumes');

      // Try provider-specific extractors
      const sourceResult = extractByVolumeSource(volumesSource, metadata);
      if (sourceResult) {
        return sourceResult;
      }

      // Fallback: Try ComicVine if chapters are from ComicVine
      const fallbackTitles = extractComicVineFallback(metadata, selectedSources);
      if (Object.keys(fallbackTitles).length > 0) {
        return fallbackTitles;
      }

      return {};
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[useProviderMetadata] Error parsing providerMetadata for volume titles:', errorMessage);
      return {};
    }
  }, [providerMetadata, selectedSourceId, shouldExtract]);

  return { volumeTitles };
}
