/**
 * Provider Data Assembler Module
 *
 * Handles assembly of raw provider data and provider metadata objects
 * for storing volume/chapter data, media selections, and import profiles.
 *
 * @module components/addManga/utils/wizard-mapper/provider-data-assembler
 */

import type { ImportProfile } from './import-profile-builder';
import type { Volume } from './types';

/**
 * Input data for assembling provider data
 */
export interface ProviderDataAssemblerInput {
  selectedCover?: string;
  selectedBanner?: string;
  selectedGalleryImages?: string[];
  processedVolumes: Volume[];
  volumeCount?: number | null;
  chapterCount?: number | null;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  mediaGallery: {
    volumeCovers: unknown[];
  };
  formData: Partial<{
    metadata?: unknown;
  }>;
  selectedSourcesMetadata: Record<string, unknown>;
  provider: string;
  importProfile: ImportProfile;
}

/**
 * Raw provider data structure
 */
export interface RawProviderData {
  selectedCover?: string;
  selectedBanner?: string;
  selectedGalleryImages: string[];
  volumes: Volume[];
  totalVolumes?: number | null;
  totalChapters?: number | null;
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];
  volumeCovers: unknown[];
  chapterMetadataCache: unknown;
  providerSpecific: unknown;
  providerMetadata: {
    [key: string]: unknown;
    importProfile: ImportProfile;
  };
}

/**
 * Provider metadata structure
 */
export interface ProviderMetadata {
  [key: string]: unknown;
  selectedGalleryImages: string[];
  importProfile: ImportProfile;
}

/**
 * Assemble raw provider data object
 */
export function assembleRawProviderData(input: ProviderDataAssemblerInput): RawProviderData {
  const {
    selectedCover,
    selectedBanner,
    selectedGalleryImages,
    processedVolumes,
    volumeCount,
    chapterCount,
    selectedVolumes,
    selectedChapters,
    mediaGallery,
    formData,
    selectedSourcesMetadata,
    provider,
    importProfile
  } = input;

  const rawProviderData: RawProviderData = {
    // Selected media
    ...(selectedCover && { selectedCover }),
    ...(selectedBanner && { selectedBanner }),
    selectedGalleryImages: selectedGalleryImages ?? [],

    // Volume and chapter data
    volumes: processedVolumes,
    ...(volumeCount !== undefined && { totalVolumes: volumeCount }),
    ...(chapterCount !== undefined && { totalChapters: chapterCount }),
    selectedVolumes,
    selectedChapters,

    // Volume covers
    volumeCovers: mediaGallery.volumeCovers,

    // Chapter metadata cache - convert Map to object
    chapterMetadataCache: formData.metadata ?? {},

    // Provider-specific data
    providerSpecific: selectedSourcesMetadata[provider] as { rawData?: unknown },

    // Store all provider metadata for future reference WITH importProfile
    providerMetadata: {
      ...selectedSourcesMetadata,
      importProfile
    }
  };

  return rawProviderData;
}

/**
 * Assemble provider metadata object
 */
export function assembleProviderMetadata(
  selectedSourcesMetadata: Record<string, unknown>,
  selectedGalleryImages: string[] | undefined,
  importProfile: ImportProfile
): ProviderMetadata {
  // Prepare provider metadata (for cross-provider field tracking) - reuse importProfile
  const providerMetadata: ProviderMetadata = {
    ...selectedSourcesMetadata,
    // Store selectedGalleryImages at top level for easy access by imageExtractor
    // Also stored in importProfile.mediaSelections for historical reference
    selectedGalleryImages: selectedGalleryImages ?? [],
    importProfile
  };

  return providerMetadata;
}