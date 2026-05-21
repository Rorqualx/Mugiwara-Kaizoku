/**
 * Volumes Extractors Module
 *
 * Handles volumes and chapters extraction from provider responses.
 * Supports multiple providers with different data structures:
 * - Fandom: volumeDetails (new) and volumesAndChapters (legacy)
 * - ComicVine: issues mapped to volumes
 *
 * Extracted from: urlParsingService.ts (lines 459-535)
 */

import { safeGet, isRecord } from './utils';

// ============================================================================
// Volume Data Types
// ============================================================================

/**
 * Volumes data structure returned by extraction
 *
 * Contains volumes array and aggregated counts.
 */
export interface VolumesData {
  volumes: unknown[];
  totalVolumes: number;
  totalChapters: number;
}

// ============================================================================
// Volumes Extractor
// ============================================================================

/**
 * Extract volumes from parse result
 *
 * Handles provider-specific volume structures:
 * - Fandom: Extracts from volumeDetails or volumesAndChapters
 * - ComicVine: Converts issues to volumes
 * - Generic: Extracts from volumes array
 *
 * @param data - Raw parse result data
 * @param provider - Provider name (e.g., 'fandom', 'comicvine')
 * @returns VolumesData structure with volumes and counts
 */
export function extractVolumesFromResult(
  data: unknown,
  provider: string
): VolumesData {
  const volumesData: VolumesData = {
    volumes: [],
    totalVolumes: 0,
    totalChapters: 0
  };

  if (!isRecord(data)) return volumesData;

  // Extract base volumes
  const volumes = safeGet(data, 'volumes');
  if (Array.isArray(volumes)) {
    volumesData.volumes = volumes;
    volumesData.totalVolumes = volumes.length;

    // Count chapters across all volumes
    volumesData.totalChapters = volumes.reduce((sum: number, vol: unknown) => {
      if (!isRecord(vol)) return sum;
      const chapters = safeGet(vol, 'chapters');
      return sum + (Array.isArray(chapters) ? chapters.length : 0);
    }, 0);
  }

  // Provider-specific extraction
  // Fandom: Check for volumeDetails first (new structure), then volumesAndChapters (legacy)
  const volumeDetails = safeGet(data, 'volumeDetails');
  if (provider === 'fandom' && Array.isArray(volumeDetails)) {
    // Map volumeDetails to volumes array with proper field mapping
    volumesData.volumes = volumeDetails.map((vol: unknown) => {
      if (!isRecord(vol)) return {};
      return {
        volumeNumber: safeGet(vol, 'volumeNumber'),
        title: safeGet(vol, 'title'),  // This is the key field that preserves Fandom volume titles!
        chapterCount: safeGet(vol, 'chapterCount'),
        coverImageUrl: safeGet(vol, 'coverImageUrl'),
        chapters: safeGet(vol, 'chapters') ?? []
      };
    });
    volumesData.totalVolumes = volumeDetails.length;
    volumesData.totalChapters = Number(safeGet(data, 'totalChapters') ?? safeGet(data, 'chapters')) || 0;
  } else {
    const volumesAndChapters = safeGet(data, 'volumesAndChapters');
    if (provider === 'fandom' && isRecord(volumesAndChapters)) {
      // Legacy fallback for backward compatibility
      const volumes = safeGet(volumesAndChapters, 'volumes');
      volumesData.volumes = Array.isArray(volumes) ? volumes : [];
      volumesData.totalVolumes = volumesData.volumes.length;
      volumesData.totalChapters = Number(safeGet(volumesAndChapters, 'totalChapters')) || 0;
    }
  }

  const issues = safeGet(data, 'issues');
  if (provider === 'comicvine' && Array.isArray(issues)) {
    // Convert issues to volumes for ComicVine
    volumesData.volumes = issues.map((issue: unknown, index: number) => {
      if (!isRecord(issue)) {
        return {
          volumeNumber: index + 1,
          title: `Issue #${index + 1}`,
          chapters: []
        };
      }
      const image = safeGet(issue, 'image');
      return {
        volumeNumber: index + 1,
        title: safeGet(issue, 'name') || `Issue #${safeGet(issue, 'issue_number')}`,
        issueNumber: safeGet(issue, 'issue_number'),
        coverImageUrl: isRecord(image) ? safeGet(image, 'original_url') : undefined,
        chapters: [] // ComicVine doesn't have chapters
      };
    });
    volumesData.totalVolumes = volumesData.volumes.length;
  }

  return volumesData;
}
