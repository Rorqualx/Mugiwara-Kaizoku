/**
 * WizardContext Types
 * Type definitions for the universal import wizard context.
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type {
  WizardFormData,
  ProviderMetadata,
  MediaGallery,
  VolumesData,
  ExternalIds,
  DescriptionEditMode,
  BatchFetchProgress,
  ImportProgress,
  UnifiedFieldSelections
} from '@/types/universalImportWizard.types';

export interface WizardContextValue {
  // Core state
  currentStep: number;
  setCurrentStep: (step: number) => void;
  formData: Partial<WizardFormData>;
  updateFormData: (data: Partial<WizardFormData>) => void;

  // Library ID (for manga creation)
  libraryId?: number;
  setLibraryId?: (id: number) => void;

  // Search mode state
  cachedSearchResults?: unknown[];
  setCachedSearchResults?: (results: unknown[]) => void;
  selectedSearchResult?: ExtendedMangaSearchResult | null;
  setSelectedSearchResult?: (result: ExtendedMangaSearchResult | null) => void;

  // Provider and source data
  provider: string;
  selectedSources: string[];
  setSelectedSources: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;
  setSelectedSourcesMetadata: React.Dispatch<React.SetStateAction<Record<string, ProviderMetadata>>>;

  // Media and volumes
  mediaGallery: MediaGallery;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;
  volumesData: VolumesData;
  setVolumesData: React.Dispatch<React.SetStateAction<VolumesData>>;

  // Selection states
  selectedCover: string;
  setSelectedCover: (cover: string) => void;
  selectedBanner: string;
  setSelectedBanner: (banner: string) => void;
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  selectedChapters: unknown[];
  setSelectedChapters: React.Dispatch<React.SetStateAction<unknown[]>>;
  selectedGalleryImages: string[];
  setSelectedGalleryImages: React.Dispatch<React.SetStateAction<string[]>>;

  // UI states
  descriptionEditMode: DescriptionEditMode;
  setDescriptionEditMode: React.Dispatch<React.SetStateAction<DescriptionEditMode>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Progress tracking
  batchFetchProgress: BatchFetchProgress;
  setBatchFetchProgress: (progress: BatchFetchProgress) => void;
  importProgress: ImportProgress;
  setImportProgress: (progress: ImportProgress) => void;

  // Chapter metadata cache
  chapterMetadataCache: Map<string, unknown>;
  setChapterMetadataCache: React.Dispatch<React.SetStateAction<Map<string, unknown>>>;

  // External IDs and links
  externalIds: ExternalIds;
  setExternalIds: React.Dispatch<React.SetStateAction<ExternalIds>>;
  externalLinks: string[];
  setExternalLinks: React.Dispatch<React.SetStateAction<string[]>>;

  // Unified field selections
  fieldSelections: UnifiedFieldSelections;
  setFieldSelections: React.Dispatch<React.SetStateAction<UnifiedFieldSelections>>;
  updateFieldSelection: (field: string, provider: string, value: unknown, confidence: number) => void;
  getMergedMetadata: () => Record<string, unknown>;

  // Local file path (from scan results)
  localPath: string | undefined;
  setLocalPath: (path: string | undefined) => void;

  // Helper functions
  canProceedToNextStep: () => boolean;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  resetWizard: () => void;

  // Pending fetch tracking for async source operations
  pendingFetchCount: number;
  registerPendingFetch: (key: string, promise: Promise<void>) => void;
  hasPendingFetches: () => boolean;
  waitForAllPendingFetches: () => Promise<void>;
}

export interface WizardProviderProps {
  children: React.ReactNode;
  provider: string;
  initialData?: ExtendedMangaSearchResult;
  libraryId?: number;
}
