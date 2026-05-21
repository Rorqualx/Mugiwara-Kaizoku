import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Get volumes for a specific source
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

  // Use a local variable to avoid parameter reassignment
  let lookupSource = source;

  // If source is 'primary', use the main provider
  if (lookupSource === 'primary') {
    const providerLower = provider.toLowerCase();
    const providerKey = Object.keys(selectedSourcesMetadata).find(
      key => key.toLowerCase() === providerLower
    );
    if (providerKey) {
      lookupSource = providerKey;
      logger.info('[getVolumesForSource] Using primary provider:', lookupSource);
    } else {
      logger.info('[getVolumesForSource] No volumes found for primary');
      logger.info('[getVolumesForSource] === END DEBUG - Returning empty array for primary ===');
      return [];
    }
  }

  // Handle case-insensitive lookup for source data
  let sourceData = selectedSourcesMetadata[lookupSource];

  // If not found, try case-insensitive search
  if (!sourceData) {
    const sourceLower = lookupSource.toLowerCase();
    const matchingKey = Object.keys(selectedSourcesMetadata).find(
      key => key.toLowerCase() === sourceLower
    );
    if (matchingKey) {
      sourceData = selectedSourcesMetadata[matchingKey];
      logger.info(`[getVolumesForSource] Found source data with case-insensitive match: ${matchingKey} for ${lookupSource}`);
    }
  }

  if (!sourceData) {
    logger.info('[getVolumesForSource] No source data found for:', lookupSource);
    logger.info('[getVolumesForSource] === END DEBUG - No source data, returning empty ===');
    return [];
  }

  // Return volumeData if available
  if (sourceData.volumeData && Array.isArray(sourceData.volumeData)) {
    logger.info(`[getVolumesForSource] Found ${sourceData.volumeData.length} volumes from volumeData for source:`, lookupSource);
    logger.info('[getVolumesForSource] === END DEBUG - Returning volumes ===');
    return sourceData.volumeData as unknown as Array<Record<string, unknown>>;
  }

  // Fallback: Check if rawData has volumeList (for Wikipedia)
  if (sourceData.rawData && typeof sourceData.rawData === 'object') {
    const rawData = sourceData.rawData as Record<string, unknown>;
    if (rawData['volumeList'] && Array.isArray(rawData['volumeList'])) {
      logger.info(`[getVolumesForSource] Found ${(rawData['volumeList'] as unknown[]).length} volumes from rawData.volumeList for source:`, lookupSource);
      logger.info('[getVolumesForSource] === END DEBUG - Returning volumes from rawData ===');
      return rawData['volumeList'] as Array<Record<string, unknown>>;
    }
  }

  logger.info('[getVolumesForSource] No volumes found for source:', lookupSource);
  logger.info('[getVolumesForSource] === END DEBUG - Returning empty array ===');
  return [];
}

/**
 * Get chapters for a specific source
 */
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

  // Use a local variable to avoid parameter reassignment
  let lookupSource = source;

  // If source is 'primary', use the main provider
  if (lookupSource === 'primary') {
    const providerLower = provider.toLowerCase();
    const providerKey = Object.keys(selectedSourcesMetadata).find(
      key => key.toLowerCase() === providerLower
    );
    if (providerKey) {
      lookupSource = providerKey;
      logger.info('[getChaptersForSource] Using primary provider:', lookupSource);
    } else {
      logger.info('[getChaptersForSource] No chapters found for primary');
      logger.info('[getChaptersForSource] === END DEBUG - Returning empty array for primary ===');
      return [];
    }
  }

  // Handle case-insensitive lookup for source data
  let sourceData = selectedSourcesMetadata[lookupSource];

  // If not found, try case-insensitive search
  if (!sourceData) {
    const sourceLower = lookupSource.toLowerCase();
    const matchingKey = Object.keys(selectedSourcesMetadata).find(
      key => key.toLowerCase() === sourceLower
    );
    if (matchingKey) {
      sourceData = selectedSourcesMetadata[matchingKey];
      logger.info(`[getChaptersForSource] Found source data with case-insensitive match: ${matchingKey} for ${lookupSource}`);
    }
  }

  if (!sourceData) {
    logger.info('[getChaptersForSource] No source data found for:', lookupSource);
    logger.info('[getChaptersForSource] === END DEBUG - No source data, returning empty ===');
    return [];
  }

  // Collect all chapters from volumeData
  const chapters: Array<Record<string, unknown>> = [];

  if (sourceData.volumeData && Array.isArray(sourceData.volumeData)) {
    sourceData.volumeData.forEach((volume) => {
      if (volume.chapters && Array.isArray(volume.chapters)) {
        chapters.push(...(volume.chapters as Array<Record<string, unknown>>));
      }
    });
    logger.info(`[getChaptersForSource] Found ${chapters.length} chapters from volumeData for source:`, lookupSource);
  }

  // If no chapters from volumeData, check chapterData
  if (chapters.length === 0 && sourceData.chapterData && Array.isArray(sourceData.chapterData)) {
    chapters.push(...(sourceData.chapterData as Array<Record<string, unknown>>));
    logger.info(`[getChaptersForSource] Found ${chapters.length} chapters from chapterData for source:`, lookupSource);
  }

  // Fallback for Wikipedia: Check if rawData has volumeList (Wikipedia stores chapters there)
  if (chapters.length === 0 && sourceData.rawData && typeof sourceData.rawData === 'object') {
    const rawData = sourceData.rawData as Record<string, unknown>;
    if (rawData["volumeList"] && Array.isArray(rawData["volumeList"])) {
      logger.info('[getChaptersForSource] Checking Wikipedia rawData.volumeList for chapters');
      rawData["volumeList"].forEach((volume: unknown) => {
        const vol = volume as Record<string, unknown>;
        if (vol["chapters"] && Array.isArray(vol["chapters"])) {
          chapters.push(...(vol["chapters"] as Array<Record<string, unknown>>));
        }
      });
      logger.info(`[getChaptersForSource] Found ${chapters.length} chapters from rawData.volumeList for source:`, source);
    }
  }

  logger.info('[getChaptersForSource] === END DEBUG - Returning chapters ===');
  return chapters;
}
