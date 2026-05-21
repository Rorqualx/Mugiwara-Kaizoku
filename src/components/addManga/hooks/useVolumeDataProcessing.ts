import { useState, useEffect } from 'react';

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { VolumesData, Volume, Chapter, ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { hasProperty } from '@/utils/type-guards';
import { isRecord } from '@/utils/type-guards/index';

/**
 * Manages lazy loading and transformation of volume/chapter data when wizard reaches step 2
 *
 * This hook handles the complex logic of:
 * - Searching for volumeData in multiple locations (initialData, metadata, cachedSearchResults)
 * - Transforming volumeData array into Volume[] format
 * - Calculating totalChapters across all volumes
 * - Updating both volumesData state AND selectedSourcesMetadata
 *
 * @param currentStep - Current wizard step (processing starts when step >= 2)
 * @param initialData - Search result data containing potential volume information
 * @param provider - Current provider (normalized to lowercase)
 * @param setSelectedSourcesMetadata - setState function to update provider metadata
 * @returns Object containing volumesData state and setter
 */
export function useVolumeDataProcessing(
  currentStep: number,
  initialData: ExtendedMangaSearchResult | undefined,
  provider: string,
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>
): {
  volumesData: VolumesData;
  setVolumesData: React.Dispatch<React.SetStateAction<VolumesData>>;
} {
  // OPTIMIZATION: Initialize volumesData as empty - populate lazily when step 2 (VolumesChaptersStep) is reached
  const [volumesData, setVolumesData] = useState<VolumesData>({
    volumes: [],
    totalVolumes: 0,
    totalChapters: 0
  });

  // OPTIMIZATION: Lazy volumeData extraction and transformation - only runs when step 2 is reached
  // This defers the expensive volume data processing out of the critical mount path
  // eslint-disable-next-line complexity -- Complex volume data processing with multiple data sources
  useEffect(() => {
    if (currentStep >= 2 && volumesData.volumes.length === 0 && initialData) {
      logger.info('[WizardContext] Step 2 reached - extracting volumeData lazily');

      // Look for volumeData in cachedSearchResults if not directly available
      let volumeDataToUse = initialData['volumeData'] ?? (hasProperty(initialData['metadata'], 'volumeData') && Array.isArray(initialData['metadata']['volumeData']) ? initialData['metadata']['volumeData'] : undefined);

      if (!volumeDataToUse && hasProperty(initialData, 'cachedSearchResults') && Array.isArray(initialData['cachedSearchResults'])) {
        // Find the matching result that has volumeData
        // eslint-disable-next-line complexity -- Complex result matching with multiple provider checks
        const matchingResult = (initialData['cachedSearchResults'] as unknown[]).find((result: unknown) => {
          if (!isRecord(result)) return false;
          const resultProvider = ((hasProperty(result, 'provider') && typeof result['provider'] === 'string' ? result['provider'] : hasProperty(result, 'source') && typeof result['source'] === 'string' ? result['source'] : '')).toLowerCase();
          const isProvider = resultProvider === provider.toLowerCase();

          // Check for volumeData at root level, metadata level, and rawData level
          const metadata = hasProperty(result, 'metadata') && isRecord(result['metadata']) ? result['metadata'] : undefined;
          const rawData = hasProperty(result, 'rawData') && isRecord(result['rawData']) ? result['rawData'] : undefined;
          const volData = (hasProperty(result, 'volumeData') && Array.isArray(result['volumeData']) ? result['volumeData'] : undefined) ?? (metadata && hasProperty(metadata, 'volumeData') && Array.isArray(metadata['volumeData']) ? metadata['volumeData'] : undefined) ?? (rawData && hasProperty(rawData, 'volumeData') && Array.isArray(rawData['volumeData']) ? rawData['volumeData'] : undefined);
          const hasVolData = !!Array.isArray(volData) && volData.length > 0;

          // Match by title or ID
          const resultTitle = hasProperty(result, 'title') && typeof result['title'] === 'string' ? result['title'] : undefined;
          const initialTitle = initialData['title'];
          const isSameTitle = resultTitle?.toLowerCase() === initialTitle.toLowerCase();
          const isSameId = hasProperty(result, 'id') ? result['id'] === initialData['id'] : false;

          return isProvider && hasVolData && (isSameTitle || isSameId);
        });

        if (matchingResult && isRecord(matchingResult)) {
          const metadata = hasProperty(matchingResult, 'metadata') && isRecord(matchingResult['metadata']) ? matchingResult['metadata'] : undefined;
          const rawData = hasProperty(matchingResult, 'rawData') && isRecord(matchingResult['rawData']) ? matchingResult['rawData'] : undefined;
          volumeDataToUse = (hasProperty(matchingResult, 'volumeData') && Array.isArray(matchingResult['volumeData']) ? matchingResult['volumeData'] : undefined) ?? (metadata && hasProperty(metadata, 'volumeData') && Array.isArray(metadata['volumeData']) ? metadata['volumeData'] : undefined) ?? (rawData && hasProperty(rawData, 'volumeData') && Array.isArray(rawData['volumeData']) ? rawData['volumeData'] : undefined);
          if (Array.isArray(volumeDataToUse)) {
            logger.info('[WizardContext] Found volumeData in cachedSearchResults:', {
              provider,
              volumeCount: volumeDataToUse.length
            });
          }
        }
      }

      // Transform volumeData if found
      if (Array.isArray(volumeDataToUse) && volumeDataToUse.length > 0) {
        logger.info(`[WizardContext] Processing ${volumeDataToUse.length} volumes`);

        // eslint-disable-next-line complexity -- Complex volume data transformation with multiple field mappings
        const volumes: Volume[] = volumeDataToUse.map((vol: unknown) => {
          if (!isRecord(vol)) {
            return { title: '' };
          }

          const chapters = hasProperty(vol, 'chapters') && Array.isArray(vol['chapters']) ? vol['chapters'] as Chapter[] : undefined;
          const volume: Volume = {
            title: (hasProperty(vol, 'title') && typeof vol['title'] === 'string' ? vol['title'] : '')
          };

          const volumeNumber = (hasProperty(vol, 'volumeNumber') && typeof vol['volumeNumber'] === 'number' ? vol['volumeNumber'] : hasProperty(vol, 'number') && typeof vol['number'] === 'number' ? vol['number'] : undefined);
          if (volumeNumber !== undefined) volume.volumeNumber = volumeNumber;
          if (Array.isArray(chapters)) volume.chapters = chapters;

          const chapterCount = (hasProperty(vol, 'chapterCount') && typeof vol['chapterCount'] === 'number' ? vol['chapterCount'] : 0) || (Array.isArray(chapters) ? chapters.length : 0);
          if (chapterCount > 0) volume.chapterCount = chapterCount;

          if (hasProperty(vol, 'coverImage') && typeof vol['coverImage'] === 'string') volume.coverImage = vol['coverImage'];
          if (hasProperty(vol, 'coverImageUrl') && typeof vol['coverImageUrl'] === 'string') volume.coverImageUrl = vol['coverImageUrl'];
          if (hasProperty(vol, 'coverUrl') && typeof vol['coverUrl'] === 'string') volume.coverUrl = vol['coverUrl'];
          if (hasProperty(vol, 'description') && typeof vol['description'] === 'string') volume.description = vol['description'];
          if (hasProperty(vol, 'summary') && typeof vol['summary'] === 'string') volume.volumeSummary = vol['summary'];
          if (hasProperty(vol, 'volumeSummary') && typeof vol['volumeSummary'] === 'string') volume.volumeSummary = vol['volumeSummary'];
          if (hasProperty(vol, 'name') && typeof vol['name'] === 'string') volume.name = vol['name'];
          if (hasProperty(vol, 'volumeName') && typeof vol['volumeName'] === 'string') volume.volumeName = vol['volumeName'];
          if (hasProperty(vol, 'url') && typeof vol['url'] === 'string') volume.url = vol['url'];

          return volume;
        });

        const totalChapters = volumes.reduce((sum: number, vol: Volume) => {
          return sum + (vol.chapterCount ?? 0);
        }, 0);

        setVolumesData({
          volumes,
          totalVolumes: volumes.length,
          totalChapters
        });

        // Also update selectedSourcesMetadata with volumeData for the primary provider
        setSelectedSourcesMetadata(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            volumeData: volumeDataToUse as Volume[]
          }
        }));

        logger.info('[WizardContext] Volumes processed and state updated');
      }
    }
  }, [currentStep, volumesData.volumes.length, initialData, provider, setSelectedSourcesMetadata]); // Only process when step 2 is reached

  return { volumesData, setVolumesData };
}
