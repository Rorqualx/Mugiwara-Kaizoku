/**
 * Volume Processor Module
 *
 * Handles volume data processing, including source resolution,
 * format validation, and ComicVine title enrichment.
 *
 * @module components/addManga/utils/wizard-mapper/volume-processor
 */

import { logger } from '@/utils/logger';

import {
  resolveSourceToProvider,
  validateVolumeSourceFormat,
  formatComicVineTitle
} from './helpers';

import type { Volume } from './types';

/**
 * Filter volumes by user-selected volume numbers
 */
function filterVolumesBySelection(
  volumes: Volume[],
  selectedVolumes: (number | string)[]
): Volume[] {
  const selectedSet = new Set(selectedVolumes.map(v => typeof v === 'string' ? parseInt(v, 10) : v));

  return volumes.filter((vol: Volume) => {
    // volumeNumber is optional but number is required, so we always have a numeric value
    const volNum = vol.volumeNumber ?? vol.number;
    return selectedSet.has(volNum);
  });
}

/**
 * Input data for volume processing
 */
export interface VolumeProcessorInput {
  volumesData: {
    volumes?: Volume[];
  };
  selectedSourcesMetadata: Record<string, unknown>;
  provider: string;
  volumeDisplaySource?: string;
  /** User-selected volume numbers to filter by */
  selectedVolumes?: (number | string)[];
}

/**
 * Result of volume processing
 */
export interface VolumeProcessorResult {
  processedVolumes: Volume[];
  resolvedVolumeSource: string;
}

/**
 * Process volumes data including source resolution and format validation
 */
export function processVolumes(input: VolumeProcessorInput): VolumeProcessorResult {
  const {
    volumesData,
    selectedSourcesMetadata,
    provider,
    volumeDisplaySource
  } = input;

  const resolvedVolumeSource = resolveSourceToProvider(
    volumeDisplaySource,
    selectedSourcesMetadata,
    provider
  );

  logger.info('[wizardToMangaInputMapper] Resolved volume source:', {
    volumeDisplaySource,
    resolvedVolumeSource
  });

  // Get volumes from the correct location based on resolved source
  let processedVolumes = volumesData.volumes ?? [];

  // If volumes not in volumesData, check selectedSourcesMetadata
  if (processedVolumes.length === 0 && resolvedVolumeSource) {
    const sourceKey = Object.keys(selectedSourcesMetadata).find(
      k => k.toLowerCase() === resolvedVolumeSource.toLowerCase()
    );
    if (sourceKey) {
      const sourceData = selectedSourcesMetadata[sourceKey] as { volumeData?: Volume[] };
      if (sourceData.volumeData) {
        processedVolumes = sourceData.volumeData;
        logger.info(`[wizardToMangaInputMapper] Using volumeData from selectedSourcesMetadata['${sourceKey}']`, {
          volumeCount: processedVolumes.length
        });
      }
    }
  }

  // VALIDATION: Verify volumes match expected source
  // Check if volumes have the expected format for the resolved source
  if (processedVolumes.length > 0) {
    const firstVolume = processedVolumes[0];
    if (!firstVolume) {
      logger.warn('[wizardToMangaInputMapper] First volume is undefined despite length > 0');
    } else {
      validateVolumeSourceFormat(firstVolume, resolvedVolumeSource);
    }
  }

  // Extract enriched volume titles for ComicVine (to match refresh metadata behavior)
  logger.info('[wizardToMangaInputMapper] Volume enrichment check:', {
    resolvedVolumeSource,
    isComicVine: resolvedVolumeSource === 'comicvine',
    volumeCount: processedVolumes.length,
    willEnrich: resolvedVolumeSource === 'comicvine' && processedVolumes.length > 0
  });

  if (resolvedVolumeSource === 'comicvine' && processedVolumes.length > 0) {
    logger.info('[wizardToMangaInputMapper] Extracting enriched ComicVine volume titles');

    processedVolumes = processedVolumes.map((volume: Volume) => {
      const volumeNumber = volume.volumeNumber ?? volume.number;
      const volumeObj = volume as unknown as Record<string, unknown>;
      const titleCandidates = [
        volume.title,
        typeof volumeObj["volumeTitle"] === 'string' ? volumeObj["volumeTitle"] : null,
        typeof volumeObj["name"] === 'string' ? volumeObj["name"] : null,
        typeof volumeObj["volumeName"] === 'string' ? volumeObj["volumeName"] : null
      ];
      const rawTitle: string | undefined = titleCandidates.filter((t): t is string => typeof t === 'string')[0];

      // Extract enriched subtitle from ComicVine format
      const formattedTitle = formatComicVineTitle(rawTitle, volumeNumber);
      logger.info(`[wizardToMangaInputMapper] Volume ${volumeNumber}: "${rawTitle}" → "${formattedTitle}"`);

      // Return volume with enriched title
      const result: Volume = {
        ...volume,
        title: formattedTitle
      };
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- volumeNumber can be undefined from nullish coalescing
      if (volumeNumber !== undefined) {
        result.volumeNumber = volumeNumber;
        result.number = volumeNumber;
      }
      return result;
    });
  }

  // Filter by user selection if selectedVolumes provided
  const { selectedVolumes } = input;
  if (selectedVolumes && selectedVolumes.length > 0) {
    const beforeCount = processedVolumes.length;
    processedVolumes = filterVolumesBySelection(processedVolumes, selectedVolumes);
    logger.info('[wizardToMangaInputMapper] Filtered volumes by user selection:', {
      beforeCount,
      afterCount: processedVolumes.length,
      selectedVolumes
    });
  }

  // Volume processing complete
  logger.debug('Volume processing complete', {
    resolvedVolumeSource,
    processedVolumesCount: processedVolumes.length
  });

  return {
    processedVolumes,
    resolvedVolumeSource
  };
}