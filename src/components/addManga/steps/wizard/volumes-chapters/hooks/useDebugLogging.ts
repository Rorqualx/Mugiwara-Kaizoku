/**
 * useDebugLogging Hook
 *
 * Custom React hook for logging component state for debugging purposes.
 * Logs selectedSourcesMetadata, volumesData info, displayVolumes, and allChapterUrls.
 */

import * as React from 'react';

import {
  isRecord,
  hasProperty,
  extractVolumeCount,
} from '../index';

import type { Logger } from '../index';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for the useDebugLogging hook
 */
export interface UseDebugLoggingParams {
  selectedSourcesMetadata: Record<string, unknown>;
  volumesData: unknown;
  displayVolumes: unknown[];
  allChapterUrls: unknown[];
  volumeDisplaySource: string;
  logger: Logger;
  hasAttemptedAutoFetch: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to log component state for debugging
 *
 * @param params - The parameters for debug logging
 */
export function useDebugLogging(params: UseDebugLoggingParams): void {
  const {
    selectedSourcesMetadata,
    volumesData,
    displayVolumes,
    allChapterUrls,
    volumeDisplaySource,
    logger,
    hasAttemptedAutoFetch,
  } = params;

  // Log component mounted/updated state
  React.useEffect(() => {
    const volumesDataObj = isRecord(volumesData) ? volumesData : null;
    const totalVolumes = volumesDataObj && hasProperty(volumesDataObj, 'totalVolumes')
      ? volumesDataObj['totalVolumes']
      : undefined;
    const totalChapters = volumesDataObj && hasProperty(volumesDataObj, 'totalChapters')
      ? volumesDataObj['totalChapters']
      : undefined;

    logger.info('[VolumesChaptersStep] Component mounted/updated with data:', {
      hasSelectedSourcesMetadata: !!selectedSourcesMetadata,
      metadataProviders: Object.keys(selectedSourcesMetadata),
      volumesDataInfo: {
        hasVolumesData: !!volumesData,
        volumeCount: extractVolumeCount(volumesData),
        totalVolumes,
        totalChapters,
      },
      displayVolumesLength: displayVolumes.length,
      allChapterUrlsLength: allChapterUrls.length,
      hasAttemptedAutoFetch,
    });
  }, [selectedSourcesMetadata, volumesData, displayVolumes, allChapterUrls, logger, hasAttemptedAutoFetch]);

  // Log details for each provider's metadata
  React.useEffect(() => {
    Object.entries(selectedSourcesMetadata).forEach(([providerKey, metadata]) => {
      if (!isRecord(metadata)) return;

      const metaVolumeData = hasProperty(metadata, 'volumeData') ? metadata['volumeData'] : undefined;
      const metaChapterData = hasProperty(metadata, 'chapterData') ? metadata['chapterData'] : undefined;
      const volumes = hasProperty(metadata, 'volumes') ? metadata['volumes'] : undefined;
      const chapters = hasProperty(metadata, 'chapters') ? metadata['chapters'] : undefined;

      logger.info(`[VolumesChaptersStep] ${providerKey} metadata:`, {
        volumes,
        chapters,
        hasVolumeData: !!metaVolumeData,
        volumeDataLength: Array.isArray(metaVolumeData) ? metaVolumeData.length : 0,
        volumeDataSample: Array.isArray(metaVolumeData) ? (metaVolumeData[0] as unknown) : null,
        hasChapterData: !!metaChapterData,
        chapterDataLength: Array.isArray(metaChapterData) ? metaChapterData.length : 0,
        chapterDataSample: Array.isArray(metaChapterData) ? (metaChapterData[0] as unknown) : null,
      });
    });

    // Log what getVolumesForSource returns
    logger.info('[VolumesChaptersStep] displayVolumes details:', {
      source: volumeDisplaySource,
      displayVolumes,
      firstVolume: displayVolumes[0],
    });
  }, [selectedSourcesMetadata, volumesData, displayVolumes, allChapterUrls, volumeDisplaySource, logger]);
}
