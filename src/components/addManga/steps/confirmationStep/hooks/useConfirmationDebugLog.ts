/**
 * useConfirmationDebugLog Hook
 *
 * Provides comprehensive debug logging for ConfirmationStep data audit
 */
import { useEffect } from 'react';

import type { VolumeData } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

interface ExtendedVolumeData extends VolumeData {
  summary?: string;
  description?: string;
}

interface MangaData {
  title?: string;
  provider?: string;
  source?: string;
  id?: string | number;
  coverImage?: string;
  cover?: string;
  bannerImage?: string;
  description?: string;
  volumes?: VolumeData[];
  chapters?: unknown[];
  totalVolumes?: number;
  totalChapters?: number;
  formData?: Record<string, unknown>;
  selectedSourcesMetadata?: Record<string, unknown>;
  providerMetadata?: unknown;
  metadata?: Record<string, unknown>;
  rawData?: {
    volumes?: VolumeData[];
    volumeCovers?: VolumeData[];
    chapterCovers?: unknown[];
    gallery?: string[];
    totalVolumes?: number;
    totalChapters?: number;
  };
  [key: string]: unknown;
}

interface UseConfirmationDebugLogProps {
  manga: MangaData;
  source: string;
  libraryId?: number;
  folderId?: number;
}

/**
 * Custom hook for comprehensive confirmation step debug logging
 */
export function useConfirmationDebugLog({
  manga,
  source,
  libraryId,
  folderId
}: UseConfirmationDebugLogProps): void {
  // eslint-disable-next-line complexity -- Complex debug logging with multiple data validation checks
  useEffect(() => {
    logger.info('[ConfirmationStep] === FULL DATA AUDIT ===');
    logger.info('[ConfirmationStep] Received props:', {
      hasManga: true,
      source,
      libraryId,
      folderId,
      mangaKeys: Object.keys(manga)
    });

    // Basic manga data
    logger.info('[ConfirmationStep] Basic manga data:', {
      title: manga['title'],
      provider: manga.provider,
      source: manga['source'],
      id: manga['id'],
      coverImage: manga.coverImage ?? manga.cover,
      bannerImage: manga.bannerImage,
      description: manga['description']?.substring(0, 100) + '...'
    });

    // Volumes/Chapters data
    logger.info('[ConfirmationStep] Volumes/Chapters:', {
      hasVolumesArray: Boolean(manga.volumes),
      volumesArrayLength: manga.volumes?.length,
      volumesArrayType: Array.isArray(manga.volumes) ? 'array' : typeof manga.volumes,
      totalVolumes: manga.totalVolumes,
      hasChaptersArray: Boolean(manga['chapters']),
      chaptersArrayLength: manga['chapters']?.length,
      chaptersArrayType: Array.isArray(manga['chapters']) ? 'array' : typeof manga['chapters'],
      totalChapters: manga.totalChapters,
      firstVolume: manga.volumes?.[0]
        ? {
            volumeNumber: manga.volumes[0].volumeNumber,
            title: manga.volumes[0].title,
            coverImageUrl: manga.volumes[0].coverImageUrl,
            summary: manga.volumes[0].summary,
            chaptersCount: manga.volumes[0].chapters?.length,
            allKeys: Object.keys(manga.volumes[0])
          }
        : null
    });

    // rawData audit
    logger.info('[ConfirmationStep] rawData audit:', {
      hasRawData: Boolean(manga.rawData),
      rawDataKeys: manga.rawData ? Object.keys(manga.rawData) : [],
      rawDataVolumesLength: manga.rawData?.volumes?.length,
      rawDataVolumesType: Array.isArray(manga.rawData?.volumes)
        ? 'array'
        : typeof manga.rawData?.volumes,
      rawDataTotalVolumes: manga.rawData?.totalVolumes,
      rawDataTotalChapters: manga.rawData?.totalChapters,
      rawDataFirstVolume: manga.rawData?.volumes?.[0]
        ? {
            volumeNumber: manga.rawData.volumes[0].volumeNumber,
            title: manga.rawData.volumes[0].title,
            coverImageUrl: manga.rawData.volumes[0].coverImageUrl,
            summary: (manga.rawData.volumes[0] as ExtendedVolumeData).summary,
            description: (manga.rawData.volumes[0] as ExtendedVolumeData).description,
            chaptersCount: manga.rawData.volumes[0].chapters?.length,
            allKeys: Object.keys(manga.rawData.volumes[0])
          }
        : null
    });

    // Media gallery audit
    logger.info('[ConfirmationStep] Media gallery:', {
      coverImage: manga.coverImage ?? manga.cover,
      bannerImage: manga.bannerImage,
      hasRawDataVolumeCovers: Boolean(manga.rawData?.volumeCovers),
      rawDataVolumeCoversLength: manga.rawData?.volumeCovers?.length,
      hasRawDataChapterCovers: Boolean(manga.rawData?.chapterCovers),
      rawDataChapterCoversLength: manga.rawData?.chapterCovers?.length,
      hasRawDataGallery: Boolean(manga.rawData?.gallery),
      rawDataGalleryLength: manga.rawData?.gallery?.length
    });

    // Metadata audit
    logger.info('[ConfirmationStep] Metadata:', {
      hasFormData: Boolean(manga.formData),
      hasSelectedSourcesMetadata: Boolean(manga.selectedSourcesMetadata),
      selectedSourcesMetadataKeys: manga.selectedSourcesMetadata
        ? Object.keys(manga.selectedSourcesMetadata)
        : [],
      hasProviderMetadata: Boolean(manga.providerMetadata),
      hasMetadata: Boolean(manga.metadata),
      metadataKeys: manga.metadata ? Object.keys(manga.metadata) : []
    });

    logger.info('[ConfirmationStep] === END DATA AUDIT ===');
  }, [manga, source, libraryId, folderId]);
}
