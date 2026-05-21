/**
 * Main Mapper Orchestrator
 *
 * Coordinates the wizard-to-manga mapping process by orchestrating
 * all specialized modules in the correct sequence.
 *
 * @module components/addManga/utils/wizard-mapper
 */

import type { WizardFormData, ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';


import { buildImportProfile } from './import-profile-builder';
import { buildMetadata } from './metadata-builder';
import { assembleRawProviderData, assembleProviderMetadata } from './provider-data-assembler';
import { validateRequiredFields } from './validation';
import { processVolumes } from './volume-processor';

import type { MangaAddInput, Volume } from './types';

/**
 * Merge external IDs from all providers in selectedSourcesMetadata
 *
 * This ensures that external IDs from secondary providers are included
 * in the final import data, not just the primary provider's IDs.
 */
function mergeExternalIdsFromProviders(
  primaryExternalIds: AdditionalData['externalIds'],
  selectedSourcesMetadata: Record<string, ProviderMetadata>
): AdditionalData['externalIds'] {
  const merged = { ...primaryExternalIds };

  // Iterate all providers and collect external IDs
  for (const metadata of Object.values(selectedSourcesMetadata)) {
    // MAL ID
    if (!merged.malId && metadata.idMal) {
      merged.malId = String(metadata.idMal);
    }
    // AniList ID
    if (!merged.anilistId && metadata.anilistId) {
      merged.anilistId = String(metadata.anilistId);
    }
    // ComicVine ID
    if (!merged.comicVineId && metadata.comicVineId) {
      merged.comicVineId = metadata.comicVineId;
    }
    // MangaUpdates ID
    if (!merged.mangaUpdatesId && metadata.mangaUpdatesId) {
      merged.mangaUpdatesId = metadata.mangaUpdatesId;
    }
  }

  return merged;
}

/**
 * Additional data required for mapping
 */
export interface AdditionalData {
  libraryId: number;
  provider: string;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  volumesData: {
    volumes?: Volume[];
    totalVolumes?: number;
    totalChapters?: number;
  };
  mediaGallery: {
    covers: unknown[];
    gallery: unknown[];
    volumeCovers: unknown[];
  };
  externalIds: {
    anilistId?: string;
    malId?: string;
    comicVineId?: string;
    kitsuId?: string;
    mangaUpdatesId?: string;
  };
  externalLinks: string[];
  selectedCover?: string;
  selectedBanner?: string;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  selectedGalleryImages?: string[];
  volumeDisplaySource?: string;
  chapterDisplaySource?: string;
  fieldSelections?: Record<string, unknown>;
  /** Optional local path to the manga folder (from scan results) */
  localPath?: string;
  /** Field-level source preferences for volume and chapter data */
  volumeFieldSources?: {
    volumeCover: string;
    volumeSummary: string;
    volumeTitle: string;
    chapterCover: string;
    chapterSummary: string;
    chapterTitle: string;
  };
}

/**
 * Maps wizard form data to manga.add mutation input
 *
 * @param formData - The wizard form data
 * @param additionalData - Additional data from wizard context
 * @returns Input for manga.add mutation
 */
// eslint-disable-next-line complexity -- Complex data mapping orchestrator with multiple module integrations
export function mapWizardDataToMangaInput(
  formData: Partial<WizardFormData>,
  additionalData: AdditionalData
): MangaAddInput {
  const {
    libraryId,
    provider,
    selectedSourcesMetadata,
    volumesData,
    mediaGallery,
    externalIds,
    externalLinks,
    selectedCover,
    selectedBanner,
    selectedVolumes,
    selectedChapters,
    selectedGalleryImages,
    volumeDisplaySource,
    chapterDisplaySource,
    fieldSelections,
    localPath
  } = additionalData;

  logger.info('[wizardToMangaInputMapper] Mapping wizard data to manga input:', {
    title: formData.title,
    provider,
    libraryId,
    hasVolumes: !!volumesData.volumes?.length,
    totalVolumes: volumesData.totalVolumes,
    totalChapters: volumesData.totalChapters,
    selectedVolumesCount: selectedVolumes.length,
    selectedChaptersCount: selectedChapters.length
  });

  // Validate required fields
  const validationResult = validateRequiredFields(formData);
  if (!validationResult.isValid) {
    throw new Error(validationResult.errors.join(', '));
  }

  // Calculate final volume and chapter counts
  // Priority: totalVolumes/totalChapters > formData > 0
  const volumeCount = volumesData.totalVolumes ??
                      (typeof formData.volumes === 'number' ? formData.volumes : null);
  const chapterCount = volumesData.totalChapters ??
                       (typeof formData.chapters === 'number' ? formData.chapters : null);

  // Process volumes data
  const volumeProcessingResult = processVolumes({
    volumesData,
    selectedSourcesMetadata,
    provider,
    ...(volumeDisplaySource ? { volumeDisplaySource } : {}),
    selectedVolumes
  });

  // Build metadata - create compatible form data subset
  const metadataFormData = {
    ...(formData.title && { title: formData.title }),
    ...(formData.coverUrl && { coverUrl: formData.coverUrl }),
    ...(formData.bannerUrl && { bannerUrl: formData.bannerUrl }),
    ...(formData.description && { description: formData.description }),
    ...(formData.synopsis && { synopsis: formData.synopsis }),
    ...(formData.status && { status: formData.status }),
    ...(formData.format && { format: formData.format }),
    ...(formData.publisher && { publisher: formData.publisher }),
    ...(formData.startDate && { startDate: formData.startDate }),
    ...(formData.endDate && { endDate: formData.endDate }),
    ...(formData.averageScore && { averageScore: formData.averageScore }),
    ...(formData.popularity && { popularity: formData.popularity }),
    ...(formData.country && { country: formData.country }),
    ...(formData.genres && { genres: formData.genres }),
    ...(formData.authors && { authors: formData.authors }),
    ...(formData.artists && { artists: formData.artists }),
    ...(formData.tags && { tags: formData.tags }),
    ...(formData.alternativeTitles && { alternativeTitles: formData.alternativeTitles }),
    ...(typeof formData.volumes === 'number' && { volumes: formData.volumes }),
    ...(typeof formData.chapters === 'number' && { chapters: formData.chapters })
  };

  // Merge external IDs from all providers (primary + secondary)
  const mergedExternalIds = mergeExternalIdsFromProviders(externalIds, selectedSourcesMetadata);

  const metadata = buildMetadata({
    formData: metadataFormData,
    additionalData: {
      ...(selectedCover && { selectedCover }),
      ...(selectedBanner && { selectedBanner }),
      ...(selectedGalleryImages?.length && { selectedGalleryImages }),
      externalIds: mergedExternalIds,
      externalLinks
    },
    volumeCount,
    chapterCount
  });

  // Build import profile
  const importProfile = buildImportProfile({
    provider,
    selectedSourcesMetadata,
    ...(volumeDisplaySource && { volumeDisplaySource }),
    ...(chapterDisplaySource && { chapterDisplaySource }),
    ...(fieldSelections && { fieldSelections }),
    selectedVolumes,
    selectedChapters,
    volumesData,
    processedVolumes: volumeProcessingResult.processedVolumes,
    ...(selectedCover && { selectedCover }),
    ...(selectedBanner && { selectedBanner }),
    selectedGalleryImages: selectedGalleryImages ?? [],
    resolvedVolumeSource: volumeProcessingResult.resolvedVolumeSource,
    resolvedChapterSource: chapterDisplaySource ?? provider // Will be resolved in buildImportProfile
  });

  // Assemble provider data
  const rawProviderData = assembleRawProviderData({
    ...(selectedCover && { selectedCover }),
    ...(selectedBanner && { selectedBanner }),
    selectedGalleryImages: selectedGalleryImages ?? [],
    processedVolumes: volumeProcessingResult.processedVolumes,
    volumeCount,
    chapterCount,
    selectedVolumes,
    selectedChapters,
    mediaGallery,
    formData,
    selectedSourcesMetadata,
    provider,
    importProfile
  });

  const providerMetadata = assembleProviderMetadata(
    selectedSourcesMetadata,
    selectedGalleryImages,
    importProfile
  );

  // Create the final input object
  const searchProviderValue = formData.searchProvider ?? provider;
  const selectedSourceIdValue = formData.selectedSourceId;

  const input: MangaAddInput = {
    // Required fields
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Title is required for manga creation
    title: formData.title!,
    source: provider,
    libraryId,
    mangaId: formData.selectedSourceId ?? String(formData.externalIds?.anilistId ?? ''),

    // Optional fields
    ...(searchProviderValue ? { searchProvider: searchProviderValue } : {}),
    interval: 'daily', // Default monitoring interval

    // Local path from scan results (if importing from scanned files)
    ...(localPath ? { localPath } : {}),

    // Metadata - only include if it has meaningful data
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),

    // Raw data and provider metadata
    rawProviderData,
    providerMetadata,

    // Confidence tracking
    mlCorrected: false, // Not using ML in this flow
    ...(selectedSourceIdValue ? {
      selectedSourceId: JSON.stringify({
        [provider]: selectedSourceIdValue
      })
    } : {}),
    metadataConfidence: 0.9 // High confidence for user-selected data
  };

  logger.info('[wizardToMangaInputMapper] Created manga input:', {
    title: input.title,
    source: input.source,
    libraryId: input.libraryId,
    hasMetadata: !!input.metadata,
    metadataVolumes: input.metadata?.volumes,
    metadataChapters: input.metadata?.chapters,
    hasRawData: !!input.rawProviderData,
    rawDataVolumesLength: (input.rawProviderData as { volumes?: unknown[] }).volumes?.length,
    hasProviderMetadata: !!input.providerMetadata
  });

  // Final MangaAddInput created
  logger.debug('Final MangaAddInput created', {
    title: input.title,
    source: input.source,
    libraryId: input.libraryId,
    metadataVolumes: input.metadata?.volumes,
    metadataChapters: input.metadata?.chapters,
    rawDataVolumesLength: (input.rawProviderData as { volumes?: unknown[] }).volumes?.length
  });

  return input;
}

// Re-export all modules for external use
export * from './types';
export * from './helpers';
export * from './metadata-builder';
export * from './volume-processor';
export * from './import-profile-builder';
export * from './provider-data-assembler';
export * from './validation';