/**
 * Data Retrieval Module
 *
 * Retrieves volumes and chapters from metadata sources.
 * Handles case-insensitive source lookup and multiple data formats (volumeData, chapterData, rawData).
 *
 * Extracted from: sourceManagementService.ts (lines 441-621)
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deduplicate chapters by chapter number, keeping first occurrence
 * This fixes the Fire Force issue where chapters 296-302 appear twice
 * in Volume 34 due to duplicate entries in Wikipedia HTML tables.
 *
 * @param chapters - Array of chapter records
 * @returns Deduplicated array of chapters
 */
function deduplicateChapters(
  chapters: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  return chapters.filter(ch => {
    const num = String(ch['chapterNumber'] ?? ch['number'] ?? '');
    if (num === '') return true; // Keep chapters without numbers
    if (seen.has(num)) return false;
    seen.add(num);
    return true;
  });
}

/**
 * Extract chapters from a metadata object by trying multiple data sources
 *
 * Tries extraction in this order:
 * 1. volumeData[].chapters - Array of chapters nested in volume objects
 * 2. chapterData - Direct array of chapter records
 * 3. rawData.volumeList[].chapters - Wikipedia format nested chapters
 *
 * @param metadata - Provider metadata to extract chapters from
 * @returns Array of chapter records (may be empty)
 */
function extractChaptersFromMetadata(
  metadata: ProviderMetadata
): Array<Record<string, unknown>> {
  const chapters: Array<Record<string, unknown>> = [];

  // Try volumeData first
  if (metadata.volumeData && Array.isArray(metadata.volumeData)) {
    for (const volume of metadata.volumeData) {
      const vol = volume as unknown as Record<string, unknown>;
      if (vol['chapters'] && Array.isArray(vol['chapters'])) {
        chapters.push(...(vol['chapters'] as Array<Record<string, unknown>>));
      }
    }
    if (chapters.length > 0) return chapters;
  }

  // Try chapterData
  if (metadata.chapterData && Array.isArray(metadata.chapterData)) {
    return metadata.chapterData as Array<Record<string, unknown>>;
  }

  // Try rawData.volumeList (Wikipedia format)
  if (metadata.rawData && typeof metadata.rawData === 'object') {
    const rawData = metadata.rawData as Record<string, unknown>;
    if (rawData['volumeList'] && Array.isArray(rawData['volumeList'])) {
      for (const volume of rawData['volumeList'] as Array<unknown>) {
        const vol = volume as Record<string, unknown>;
        if (vol['chapters'] && Array.isArray(vol['chapters'])) {
          chapters.push(...(vol['chapters'] as Array<Record<string, unknown>>));
        }
      }
    }
  }

  return chapters;
}

/**
 * Find source metadata using case-insensitive lookup
 *
 * Handles three scenarios:
 * 1. Direct key match in selectedSourcesMetadata
 * 2. 'primary' source - resolves to provider's lowercase key
 * 3. Case-insensitive fallback search
 *
 * @param source - Source name ('primary' or specific source key)
 * @param provider - Provider name (used when source is 'primary')
 * @param selectedSourcesMetadata - Metadata lookup table
 * @returns ProviderMetadata if found, null otherwise
 */
function findSourceMetadata(
  source: string,
  provider: string,
  selectedSourcesMetadata: Record<string, ProviderMetadata>
): ProviderMetadata | null {
  // Use a local variable to avoid parameter reassignment
  let lookupSource = source;

  logger.info('[findSourceMetadata] === DEBUG ===', {
    source,
    provider,
    availableKeys: Object.keys(selectedSourcesMetadata),
  });

  // Log volumeData for each source
  Object.entries(selectedSourcesMetadata).forEach(([key, metadata]) => {
    const volumeDataLength = metadata.volumeData?.length ?? 0;
    let chaptersInVolumeData = 0;
    if (metadata.volumeData && Array.isArray(metadata.volumeData)) {
      metadata.volumeData.forEach((vol) => {
        const volObj = vol as unknown as Record<string, unknown>;
        const chapters = volObj['chapters'];
        if (Array.isArray(chapters)) {
          chaptersInVolumeData += chapters.length;
        }
      });
    }
    logger.info(`[findSourceMetadata] Source "${key}" has:`, {
      volumeDataLength,
      chaptersInVolumeData,
      metadataChapters: metadata.chapters,
    });
  });

  // If source is 'primary', resolve to the provider's key
  if (lookupSource === 'primary') {
    const providerLower = provider.toLowerCase();
    const providerKey = Object.keys(selectedSourcesMetadata).find(
      (key) => key.toLowerCase() === providerLower
    );
    if (providerKey) {
      lookupSource = providerKey;
      logger.info('[findSourceMetadata] Using primary provider:', lookupSource);
    } else {
      logger.info('[findSourceMetadata] No source found for primary provider');
      return null;
    }
  }

  // Try direct lookup first
  let sourceData = selectedSourcesMetadata[lookupSource];

  // If not found, try case-insensitive search
  if (!sourceData) {
    const sourceLower = lookupSource.toLowerCase();
    const matchingKey = Object.keys(selectedSourcesMetadata).find(
      (key) => key.toLowerCase() === sourceLower
    );
    if (matchingKey) {
      sourceData = selectedSourcesMetadata[matchingKey];
      logger.info(
        '[findSourceMetadata] Found source data with case-insensitive match:',
        { requested: lookupSource, matched: matchingKey }
      );
    }
  }

  // Log what we found
  if (sourceData) {
    const volumeDataLength = sourceData.volumeData?.length ?? 0;
    let chaptersInVolumeData = 0;
    if (sourceData.volumeData && Array.isArray(sourceData.volumeData)) {
      sourceData.volumeData.forEach((vol) => {
        const volObj = vol as unknown as Record<string, unknown>;
        const chapters = volObj['chapters'];
        if (Array.isArray(chapters)) {
          chaptersInVolumeData += chapters.length;
        }
      });
    }
    logger.info('[findSourceMetadata] Returning sourceData:', {
      lookupSource,
      volumeDataLength,
      chaptersInVolumeData,
    });
  } else {
    logger.info('[findSourceMetadata] No sourceData found for:', lookupSource);
  }

  return sourceData ?? null;
}

// ============================================================================
// Source Data Availability Helpers
// ============================================================================

/**
 * Get list of sources that have volumeData available
 *
 * Used to determine which sources can provide detailed volume information
 * for display in the wizard. AniList, for example, never has volumeData.
 *
 * @param selectedSourcesMetadata - Metadata lookup table
 * @returns Array of source names that have volumeData
 */
export function getSourcesWithVolumeData(
  selectedSourcesMetadata: Record<string, ProviderMetadata>
): string[] {
  return Object.entries(selectedSourcesMetadata)
    .filter(([_source, metadata]) =>
      metadata.volumeData &&
      Array.isArray(metadata.volumeData) &&
      metadata.volumeData.length > 0
    )
    .map(([source]) => source);
}

// ============================================================================
// Volume Data Retrieval
// ============================================================================

/**
 * Get volumes for a specific source
 *
 * Retrieves volumes in the following order of preference:
 * 1. volumeData array from ProviderMetadata
 * 2. rawData.volumeList (for Wikipedia-style data)
 *
 * @param source - Source name ('primary' or specific source key)
 * @param volumesData - Volumes data object (unused, kept for API compatibility)
 * @param selectedSourcesMetadata - Metadata lookup table
 * @param provider - Provider name (used when source is 'primary')
 * @returns Array of volume records, empty array if not found
 */
export function getVolumesForSource(
  source: string,
  volumesData: Record<string, unknown>,
  selectedSourcesMetadata: Record<string, ProviderMetadata>,
  provider: string
): Array<Record<string, unknown>> {
  logger.info('[getVolumesForSource] === START DEBUG ===');
  logger.info('[getVolumesForSource] Input parameters:', {
    source,
    provider,
    volumesDataKeys: Object.keys(volumesData),
    selectedSourcesMetadataKeys: Object.keys(selectedSourcesMetadata)
  });

  const sourceData = findSourceMetadata(source, provider, selectedSourcesMetadata);

  // Helper to extract volumes from metadata
  const extractVolumes = (metadata: ProviderMetadata | null): Array<Record<string, unknown>> | null => {
    if (!metadata) return null;

    // Return volumeData if available
    if (metadata.volumeData && Array.isArray(metadata.volumeData) && metadata.volumeData.length > 0) {
      return metadata.volumeData as unknown as Array<Record<string, unknown>>;
    }

    // Fallback: Check if rawData has volumeList (for Wikipedia)
    if (metadata.rawData && typeof metadata.rawData === 'object') {
      const rawData = metadata.rawData as Record<string, unknown>;
      if (rawData['volumeList'] && Array.isArray(rawData['volumeList']) && (rawData['volumeList'] as unknown[]).length > 0) {
        return rawData['volumeList'] as Array<Record<string, unknown>>;
      }
    }

    return null;
  };

  // Try primary source first
  let volumes = extractVolumes(sourceData);

  // Helper to deduplicate volumes
  const deduplicateVolumes = (vols: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
    return vols.map(vol => {
      const chapters = vol['chapters'];
      if (Array.isArray(chapters)) {
        return {
          ...vol,
          chapters: deduplicateChapters(chapters as Array<Record<string, unknown>>)
        };
      }
      return vol;
    });
  };

  if (volumes && volumes.length > 0) {
    // Deduplicate chapters in each volume to fix duplicate chapter issues
    const deduplicatedVolumes = deduplicateVolumes(volumes);

    // Count total chapters across all volumes (after deduplication)
    let totalChapters = 0;
    const volumesWithChapters: number[] = [];
    deduplicatedVolumes.forEach((vol, idx) => {
      const chapters = vol['chapters'];
      if (Array.isArray(chapters) && chapters.length > 0) {
        totalChapters += chapters.length;
        volumesWithChapters.push(idx + 1);
      }
    });

    logger.info(`[getVolumesForSource] Found ${deduplicatedVolumes.length} volumes from source: ${source}`);
    logger.info(`[getVolumesForSource] Chapter analysis (after deduplication):`, {
      totalChapters,
      volumesWithChaptersCount: volumesWithChapters.length,
    });
    return deduplicatedVolumes;
  }

  // IMPORTANT: Only fallback when source is 'primary'
  // When user explicitly selects a source (like 'anilist'), respect their choice
  // even if that source has no volumeData - show empty instead of fallback
  if (source !== 'primary') {
    logger.info('[getVolumesForSource] User explicitly selected source with no data, respecting choice:', source);
    logger.info('[getVolumesForSource] === END DEBUG - Returning empty array (no fallback for explicit selection) ===');
    return [];
  }

  // Fallback: Only when source is 'primary' and has no volumes, check other sources
  // Priority order: wikipedia, fandom, comicvine (sources likely to have volumeData)
  logger.info('[getVolumesForSource] Primary source has no volumes, trying fallback sources...');
  const fallbackOrder = ['wikipedia', 'fandom', 'comicvine'];

  for (const fallbackSource of fallbackOrder) {
    if (fallbackSource === provider.toLowerCase()) continue; // Skip the primary provider

    const fallbackKey = Object.keys(selectedSourcesMetadata).find(
      key => key.toLowerCase() === fallbackSource
    );

    if (fallbackKey) {
      const fallbackMetadata = selectedSourcesMetadata[fallbackKey] ?? null;
      volumes = extractVolumes(fallbackMetadata);

      if (volumes && volumes.length > 0) {
        // Deduplicate chapters in fallback volumes too
        const deduplicatedVolumes = deduplicateVolumes(volumes);
        logger.info(`[getVolumesForSource] Found ${deduplicatedVolumes.length} volumes from fallback source: ${fallbackKey}`);
        return deduplicatedVolumes;
      }
    }
  }

  logger.info('[getVolumesForSource] No volumes found for source:', source);
  logger.info('[getVolumesForSource] === END DEBUG - Returning empty array ===');
  return [];
}

// ============================================================================
// Chapter Data Retrieval
// ============================================================================

/**
 * Get chapters for a specific source
 *
 * Retrieves chapters in the following order of preference:
 * 1. Chapters nested within volumeData volumes
 * 2. chapterData array from ProviderMetadata
 * 3. Chapters nested in rawData.volumeList (for Wikipedia-style data)
 *
 * @param source - Source name ('primary' or specific source key)
 * @param provider - Provider name (used when source is 'primary')
 * @param volumesData - Volumes data object (unused, kept for API compatibility)
 * @param selectedSourcesMetadata - Metadata lookup table
 * @returns Array of chapter records, empty array if not found
 */
// eslint-disable-next-line complexity -- Multi-source chapter retrieval with nested metadata path resolution
export function getChaptersForSource(
  source: string,
  provider: string,
  volumesData: Record<string, unknown>,
  selectedSourcesMetadata: Record<string, ProviderMetadata>
): Array<Record<string, unknown>> {
  logger.info('[getChaptersForSource] === START DEBUG ===');
  logger.info('[getChaptersForSource] Input parameters:', {
    source,
    provider,
    volumesDataKeys: Object.keys(volumesData),
    selectedSourcesMetadataKeys: Object.keys(selectedSourcesMetadata)
  });

  // Log metadata for each source
  Object.entries(selectedSourcesMetadata).forEach(([key, metadata]) => {
    logger.info(`[getChaptersForSource] Metadata for "${key}":`, {
      hasVolumeData: !!metadata.volumeData,
      volumeDataLength: metadata.volumeData?.length ?? 0,
      volumeCount: metadata.volumes ?? 0,
      chapterCount: metadata.chapters ?? 0,
      allKeys: Object.keys(metadata)
    });
  });

  const sourceData = findSourceMetadata(source, provider, selectedSourcesMetadata);

  if (!sourceData) {
    logger.info('[getChaptersForSource] No source data found for:', source);
    logger.info('[getChaptersForSource] Will try fallback sources...');
  }

  // Collect all chapters from volumeData
  const chapters: Array<Record<string, unknown>> = [];

  // Only try to extract from sourceData if it exists
  if (sourceData) {
    if (sourceData.volumeData && Array.isArray(sourceData.volumeData)) {
      sourceData.volumeData.forEach((volume) => {
        const vol = volume as unknown as Record<string, unknown>;
        if (vol['chapters'] && Array.isArray(vol['chapters'])) {
          chapters.push(...(vol['chapters'] as Array<Record<string, unknown>>));
        }
      });
      logger.info(
        `[getChaptersForSource] Found ${chapters.length} chapters from volumeData for source:`,
        source
      );
    }

    // If no chapters from volumeData, check chapterData
    if (chapters.length === 0 && sourceData.chapterData && Array.isArray(sourceData.chapterData)) {
      chapters.push(...(sourceData.chapterData as Array<Record<string, unknown>>));
      logger.info(
        `[getChaptersForSource] Found ${chapters.length} chapters from chapterData for source:`,
        source
      );
    }

    // Fallback for Wikipedia: Check if rawData has volumeList
    if (chapters.length === 0 && sourceData.rawData && typeof sourceData.rawData === 'object') {
      const rawData = sourceData.rawData as Record<string, unknown>;
      if (rawData['volumeList'] && Array.isArray(rawData['volumeList'])) {
        logger.info('[getChaptersForSource] Checking Wikipedia rawData.volumeList for chapters');
        rawData['volumeList'].forEach((volume: unknown) => {
          const vol = volume as Record<string, unknown>;
          if (vol['chapters'] && Array.isArray(vol['chapters'])) {
            chapters.push(...(vol['chapters'] as Array<Record<string, unknown>>));
          }
        });
        logger.info(
          `[getChaptersForSource] Found ${chapters.length} chapters from rawData.volumeList for source:`,
          source
        );
      }
    }
  }

  // If still no chapters, try fallback sources ONLY when source is 'primary'
  // When user explicitly selects a source, respect their choice even if it has no data
  if (chapters.length === 0 && source === 'primary') {
    logger.info('[getChaptersForSource] Primary source has no chapters, trying fallback sources...');
    const fallbackOrder = ['wikipedia', 'fandom', 'comicvine'];

    for (const fallbackSource of fallbackOrder) {
      if (fallbackSource === provider.toLowerCase()) continue; // Skip the primary provider

      const fallbackKey = Object.keys(selectedSourcesMetadata).find(
        key => key.toLowerCase() === fallbackSource
      );

      if (!fallbackKey) continue;

      const fallbackMetadata = selectedSourcesMetadata[fallbackKey];
      if (!fallbackMetadata) continue;

      // Use helper to extract chapters from all possible data sources
      const extractedChapters = extractChaptersFromMetadata(fallbackMetadata);
      if (extractedChapters.length > 0) {
        chapters.push(...extractedChapters);
        logger.info(`[getChaptersForSource] Found ${chapters.length} chapters from fallback source: ${fallbackKey}`);
        break;
      }
    }
  } else if (chapters.length === 0 && source !== 'primary') {
    logger.info('[getChaptersForSource] User explicitly selected source with no chapters, respecting choice:', source);
  }

  // Deduplicate chapters by chapter number to handle wikis with JP/EN tabs
  const deduplicated = deduplicateChapters(chapters);
  logger.info('[getChaptersForSource] === END DEBUG - Returning chapters ===', {
    beforeDedup: chapters.length,
    afterDedup: deduplicated.length
  });
  return deduplicated;
}
