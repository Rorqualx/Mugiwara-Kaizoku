/**
 * Display Data Handlers for Universal Import Wizard
 *
 * Computes display-ready data structures from raw API responses:
 * - Aggregated volume details with covers
 * - Chapter listings
 * - Chapter URL collections
 *
 * @module display-data-handlers
 * @provenance Extracted from UniversalImportWizard.tsx lines 760-795
 */

import { useMemo } from 'react';

import type { VolumeDetails } from '@/components/addManga/wizard-utils';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import type { SourceManagementService } from '../services/sourceManagementService';

// ============================================================================
// Types
// ============================================================================

/**
 * Logger interface for debugging and diagnostics
 */
type Logger = typeof logger;

/**
 * Parameters for useDisplayDataHandlers hook
 */
export interface UseDisplayDataHandlersParams {
  /**
   * Currently selected source for volume display
   * Can be 'primary' or a specific provider name
   */
  volumeDisplaySource: string;

  /**
   * Currently selected source for chapter display
   * Can be 'primary' or a specific provider name
   */
  chapterDisplaySource: string;

  /**
   * Volumes data from all sources
   */
  volumesData: Record<string, unknown>;

  /**
   * Metadata from all selected provider sources
   */
  selectedSourcesMetadata: Record<string, ProviderMetadata>;

  /**
   * Primary provider name (e.g., 'anilist', 'comicvine', 'fandom', 'wikipedia')
   */
  provider: string;

  /**
   * Source management service instance for data retrieval
   */
  sourceManagementService: SourceManagementService;

  /**
   * Logger instance for debugging
   */
  logger: Logger;
}

/**
 * Return type for useDisplayDataHandlers hook
 */
export interface UseDisplayDataHandlersResult {
  /**
   * Display-ready volume details from selected volume source
   */
  displayVolumes: VolumeDetails[];

  /**
   * Display-ready chapter listings from selected chapter source
   */
  displayChapters: unknown[];

  /**
   * All chapter objects extracted from volumes or chapters
   * Contains full chapter objects (not just URL strings) to preserve metadata like coverImageUrl
   * Depends on whether chapterDisplaySource matches volumeDisplaySource
   */
  allChapterUrls: unknown[];
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Computes display-ready data for volumes and chapters from raw API responses
 *
 * This hook transforms raw metadata from multiple providers into UI-ready formats:
 * - Aggregates volume details with cover images
 * - Extracts chapter listings
 * - Collects all chapter URLs for bulk operations
 *
 * The hook respects user-selected display sources, allowing volumes and chapters
 * to be displayed from different providers simultaneously.
 *
 * @param params - Configuration and data sources
 * @returns Computed display data structures
 *
 * @example
 * ```tsx
 * const { displayVolumes, displayChapters, allChapterUrls } = useDisplayDataHandlers({
 *   volumeDisplaySource: 'comicvine',
 *   chapterDisplaySource: 'fandom',
 *   volumesData,
 *   selectedSourcesMetadata,
 *   provider: 'comicvine',
 *   sourceManagementService,
 *   logger
 * });
 * ```
 */
export function useDisplayDataHandlers(
  params: UseDisplayDataHandlersParams
): UseDisplayDataHandlersResult {
  const {
    volumeDisplaySource,
    chapterDisplaySource,
    volumesData,
    selectedSourcesMetadata,
    provider,
    sourceManagementService,
    logger,
  } = params;

  // Debug: Log when selectedSourcesMetadata changes (effect runs on each render)
  // Count chapter covers in the fandom metadata directly
  let fandomChapterCovers = 0;
  const fandomMeta = selectedSourcesMetadata['fandom'];
  if (fandomMeta?.volumeData && Array.isArray(fandomMeta.volumeData)) {
    fandomMeta.volumeData.forEach((vol: unknown) => {
      const volObj = vol as Record<string, unknown>;
      const chapters = volObj['chapters'];
      if (Array.isArray(chapters)) {
        chapters.forEach((ch: unknown) => {
          const chObj = ch as Record<string, unknown>;
          if (chObj['coverImageUrl']) {
            fandomChapterCovers++;
          }
        });
      }
    });
  }
  logger.debug('[useDisplayDataHandlers] Hook called with metadata', {
    metadataKeys: Object.keys(selectedSourcesMetadata),
    volumeDisplaySource,
    chapterDisplaySource,
    provider,
    fandomChapterCovers,
    fandomVolumeCount: fandomMeta?.volumeData?.length ?? 0,
  });

  // Calculate display volumes from selected source
  const displayVolumes = useMemo((): VolumeDetails[] => {
    logger.debug('[useDisplayDataHandlers] Computing displayVolumes:', {
      volumeDisplaySource,
      provider,
      selectedSourcesMetadataKeys: Object.keys(selectedSourcesMetadata),
      comicvineVolumeDataLength: selectedSourcesMetadata['comicvine']?.volumeData?.length ?? 0
    });

    logger.info('[useDisplayDataHandlers] Computing displayVolumes', {
      volumeDisplaySource,
      provider,
    });

    const volumes = sourceManagementService.getVolumesForSource(
      volumeDisplaySource,
      volumesData,
      selectedSourcesMetadata,
      provider
    );

    logger.debug('[useDisplayDataHandlers] getVolumesForSource returned:', {
      volumesLength: volumes.length,
      volumeDisplaySource,
      provider
    });

    // Debug: Check for chapter covers in volumes
    let chapterCoversCount = 0;
    volumes.forEach((vol: Record<string, unknown>) => {
      const chapters = vol['chapters'];
      if (Array.isArray(chapters)) {
        chapters.forEach((ch: unknown) => {
          const chObj = ch as Record<string, unknown>;
          if (chObj['coverImageUrl']) {
            chapterCoversCount++;
          }
        });
      }
    });

    logger.debug('[useDisplayDataHandlers] displayVolumes computed', {
      volumeCount: volumes.length,
      chapterCoversCount,
      source: volumeDisplaySource,
    });

    logger.info('[useDisplayDataHandlers] Computed displayVolumes', {
      count: volumes.length,
    });

    return volumes as VolumeDetails[];
  }, [
    volumeDisplaySource,
    volumesData,
    selectedSourcesMetadata,
    provider,
    sourceManagementService,
    logger,
  ]);

  // Calculate display chapters - separate from display volumes
  const displayChapters = useMemo((): unknown[] => {
    logger.info('[useDisplayDataHandlers] Computing displayChapters', {
      chapterDisplaySource,
      provider,
    });

    const chapters = sourceManagementService.getChaptersForSource(
      chapterDisplaySource,
      provider,
      volumesData,
      selectedSourcesMetadata
    );

    logger.info('[useDisplayDataHandlers] Computed displayChapters', {
      count: chapters.length,
    });

    return chapters;
  }, [
    chapterDisplaySource,
    provider,
    volumesData,
    selectedSourcesMetadata,
    sourceManagementService,
    logger,
  ]);

  // Calculate all chapter URLs - uses displayChapters when chapterDisplaySource differs from volumeDisplaySource
  // NOTE: Despite the name "allChapterUrls", this returns full chapter objects (not just URL strings)
  // to preserve metadata like coverImageUrl, title, description, etc.
  const allChapterUrls = useMemo((): unknown[] => {
    logger.info('[useDisplayDataHandlers] Computing allChapterUrls', {
      chapterDisplaySource,
      volumeDisplaySource,
      sourcesMatch: chapterDisplaySource === volumeDisplaySource,
    });

    // If chapter source is the same as volume source, extract chapters from volumes
    if (chapterDisplaySource === volumeDisplaySource) {
      const chapters: unknown[] = [];
      displayVolumes.forEach((volume: unknown) => {
        const volumeObj = volume as Record<string, unknown>;
        const volumeChapters = volumeObj['chapters'];
        if (Array.isArray(volumeChapters)) {
          // Push full chapter objects (not just URLs) to preserve metadata like coverImageUrl
          for (const ch of volumeChapters) {
            chapters.push(ch as unknown);
          }
        }
      });

      logger.info('[useDisplayDataHandlers] Computed allChapterUrls from volumes', {
        count: chapters.length,
        // Check if any chapters have cover images
        withCovers: chapters.filter((ch) => {
          const chObj = ch as Record<string, unknown>;
          return chObj['coverImageUrl'] ?? chObj['coverUrl'] ?? chObj['coverImage'];
        }).length
      });

      return chapters;
    }

    // Otherwise use the chapters from the selected chapter source
    logger.info('[useDisplayDataHandlers] Computed allChapterUrls from chapters', {
      count: displayChapters.length,
    });

    return displayChapters;
  }, [chapterDisplaySource, volumeDisplaySource, displayVolumes, displayChapters, logger]);

  return {
    displayVolumes,
    displayChapters,
    allChapterUrls,
  };
}
