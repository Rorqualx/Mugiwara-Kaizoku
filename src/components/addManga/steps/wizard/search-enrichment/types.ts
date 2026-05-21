/**
 * Search Enrichment Types
 *
 * Shared types for search result enrichment functions.
 */

import type { ProviderMetadata, VolumesData } from '@/types/universalImportWizard.types';

export interface MediaGallery {
  covers: string[];
  banners: string[];
  gallery: string[];
  volumeCovers: string[];
  chapterCovers: string[];
}

export interface EnrichmentContext {
  primaryProvider: string;
  primaryMetadata: ProviderMetadata;
  setSelectedSourcesMetadata: (fn: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void;
  setMediaGallery: (gallery: MediaGallery | ((prev: MediaGallery) => MediaGallery)) => void;
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void;
  updateFormData: (data: Record<string, unknown>) => void;
}

/**
 * Callback type for updating metadata after background fetch
 */
export type MetadataUpdateCallback = (
  updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>
) => void;
