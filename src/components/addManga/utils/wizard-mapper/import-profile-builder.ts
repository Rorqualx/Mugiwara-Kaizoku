/**
 * Import Profile Builder Module
 *
 * Handles construction of the import profile which tracks provider selections,
 * volume/chapter sources, and media selections for future refresh operations.
 *
 * @module components/addManga/utils/wizard-mapper/import-profile-builder
 */

import { logger } from '@/utils/logger';

import { resolveSourceToProvider, hasChapterData } from './helpers';

import type { Volume } from './types';

/**
 * Input data for building import profile
 */
export interface ImportProfileBuilderInput {
  provider: string;
  selectedSourcesMetadata: Record<string, unknown>;
  volumeDisplaySource?: string;
  chapterDisplaySource?: string;
  fieldSelections?: Record<string, unknown>;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  volumesData: {
    totalVolumes?: number;
    totalChapters?: number;
  };
  processedVolumes: unknown[];
  selectedCover?: string;
  selectedBanner?: string;
  selectedGalleryImages?: string[];
  resolvedVolumeSource: string;
  resolvedChapterSource: string;
}

/**
 * Import profile for tracking provider selections and refresh configuration
 */
export interface ImportProfile {
  primarySource: string;
  volumeSource: string;
  chapterSource: string;
  selectedFields: Record<string, unknown>;
  selectedVolumes: (number | string)[];
  selectedChapters: number;
  totalAvailableVolumes: number;
  totalAvailableChapters: number;
  mediaSelections: {
    cover?: string;
    banner?: string;
    galleryImages: string[];
  };
  volumesListUrl?: string;
  chaptersListUrl?: string;
}

/**
 * Build import profile for manga import
 */
// eslint-disable-next-line complexity -- Profile assembly with multi-source field selection and image URL resolution
export function buildImportProfile(input: ImportProfileBuilderInput): ImportProfile {
  const {
    provider,
    selectedSourcesMetadata,
    chapterDisplaySource,
    fieldSelections,
    selectedVolumes,
    selectedChapters,
    volumesData,
    processedVolumes,
    selectedCover,
    selectedBanner,
    selectedGalleryImages,
    resolvedVolumeSource
  } = input;

  // Resolve chapter source
  const finalResolvedChapterSource = resolveSourceToProvider(
    chapterDisplaySource,
    selectedSourcesMetadata,
    provider,
    true
  );

  // Log warning if selected source doesn't have data, but DON'T override the selection
  const chapterSourceKey = Object.keys(selectedSourcesMetadata).find(
    k => k.toLowerCase() === finalResolvedChapterSource.toLowerCase()
  );
  // Check both volumeData (ComicVine) and volumeDetails (Fandom)
  const chapterSourceData = chapterSourceKey ?
    selectedSourcesMetadata[chapterSourceKey] as { volumeData?: unknown[]; volumeDetails?: unknown[] } : undefined;
  const chapterSourceVolumes = chapterSourceData?.volumeData ?? chapterSourceData?.volumeDetails ?? [];

  if (!hasChapterData(finalResolvedChapterSource, chapterSourceVolumes as Volume[])) {
    logger.warn(`[wizardToMangaInputMapper] Warning: Selected chapter source '${finalResolvedChapterSource}' has no chapter data in metadata. Chapters will need to be fetched during refresh.`);
  }

  logger.info('[wizardToMangaInputMapper] Resolved chapter source:', {
    chapterDisplaySource,
    resolvedChapterSource: finalResolvedChapterSource
  });

  // Extract provider-specific URLs for refresh operations
  // Fandom: volumesListUrl for List_of_Volumes page
  type ProviderUrlMetadata = { volumesListUrl?: string; chaptersListUrl?: string } | undefined;
  const volumeSourceMetadata = selectedSourcesMetadata[resolvedVolumeSource] as ProviderUrlMetadata;
  const chapterSourceMetadata = selectedSourcesMetadata[finalResolvedChapterSource] as ProviderUrlMetadata;

  const volumesListUrl = volumeSourceMetadata?.volumesListUrl ?? chapterSourceMetadata?.volumesListUrl;
  const chaptersListUrl = volumeSourceMetadata?.chaptersListUrl ?? chapterSourceMetadata?.chaptersListUrl;

  logger.info('[wizardToMangaInputMapper] Extracting provider URLs for importProfile:', {
    volumeSource: resolvedVolumeSource,
    chapterSource: finalResolvedChapterSource,
    volumesListUrl,
    chaptersListUrl
  });

  // Prepare import profile with resolved provider names
  const importProfile: ImportProfile = {
    primarySource: provider,
    // Track which provider to use for volumes and chapters - use RESOLVED names, not 'primary'
    volumeSource: resolvedVolumeSource,
    chapterSource: finalResolvedChapterSource,
    // Field-by-field provider selections for metadata refresh
    selectedFields: fieldSelections ?? {},
    // Volume and chapter selections
    selectedVolumes: selectedVolumes,
    selectedChapters: selectedChapters.length,
    totalAvailableVolumes: volumesData.totalVolumes || processedVolumes.length,
    totalAvailableChapters: volumesData.totalChapters || 0,
    // Media selections for cover/banner preservation
    mediaSelections: {
      ...(selectedCover && { cover: selectedCover }),
      ...(selectedBanner && { banner: selectedBanner }),
      galleryImages: selectedGalleryImages ?? []
    },
    // Provider-specific URLs for refresh operations
    ...(volumesListUrl && { volumesListUrl }),
    ...(chaptersListUrl && { chaptersListUrl })
  };

  return importProfile;
}