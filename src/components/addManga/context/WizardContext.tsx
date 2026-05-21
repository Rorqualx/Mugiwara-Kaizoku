import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

import { hasProperty, isRecord } from '@/lib/type-guards';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { WizardFormData, ExternalIds, DescriptionEditMode, BatchFetchProgress, ImportProgress, UnifiedFieldSelections } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import { useMediaExtraction } from '../hooks/useMediaExtraction';
import { useMetadataInitialization } from '../hooks/useMetadataInitialization';
import { useVolumeDataProcessing } from '../hooks/useVolumeDataProcessing';

import type { WizardContextValue, WizardProviderProps } from './types';

// Re-export types for external use
export type { WizardContextValue, WizardProviderProps } from './types';

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

export const useWizardContext = (): WizardContextValue => {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizardContext must be used within WizardProvider');
  }
  return context;
};

// eslint-disable-next-line max-lines-per-function, complexity -- React context provider with colocated state management; splitting would fragment provider logic
export const WizardProvider: React.FC<WizardProviderProps> = ({
  children,
  provider: rawProvider,
  initialData,
  libraryId: initialLibraryId
}): React.ReactElement => {
  // Normalize provider name to lowercase
  const provider = rawProvider.toLowerCase();

  // Core state
  const [currentStep, setCurrentStep] = useState(0);
  const [libraryId] = useState<number | undefined>(initialLibraryId);
  const [cachedSearchResults] = useState<unknown[]>([]);
  const [selectedSearchResult] = useState<ExtendedMangaSearchResult | null>(null);
  const [formData, setFormData] = useState<Partial<WizardFormData>>({
    title: initialData?.title ?? '',  // Only use title from initial data
    searchProvider: provider,
    selectedSource: provider,
    selectedSourceId: initialData?.sourceId || (initialData?.id ? String(initialData.id) : ''),  // Extract from search result
    description: '',  // Don't pre-fill description
    status: '',  // Don't pre-fill status
    format: '',  // Don't pre-fill format
    genres: [],  // Don't pre-fill genres
    tags: [],
    themes: [],
    authors: [],  // Don't pre-fill authors
    artists: [],  // Don't pre-fill artists
    publisher: '',
    demographic: '',
    startDate: '',
    endDate: '',
    volumeInfo: '',
    alternativeTitles: [],
    isAdult: false,
    coverUrl: '',
    bannerUrl: '',
    externalIds: {
      anilistId: '',
      malId: '',
      comicVineId: '',
      kitsuId: '',
      mangaUpdatesId: ''
    },
    externalLinks: [],
    volumes: [],
    chapters: [],
    selectedVolumes: [],
    selectedChapters: [],
    // Only include specific fields from initialData that aren't form fields
    ...(initialData && hasProperty(initialData, 'cachedSearchResults') && Array.isArray((initialData as unknown as Record<string, unknown>)['cachedSearchResults']) ? { cachedSearchResults: (initialData as unknown as Record<string, unknown>)['cachedSearchResults'] as unknown[] } : {}),
    ...(initialData && isRecord(initialData.metadata) ? { metadata: initialData.metadata } : {})
  });

  // Debug log selectedSourceId extraction
  logger.info('[WizardContext] formData initialized with selectedSourceId:', {
    selectedSourceId: initialData?.sourceId || (initialData?.id ? String(initialData.id) : ''),

    hasSourceId: !!initialData?.sourceId,
    sourceId: initialData?.sourceId,

    hasId: !!initialData?.id,
    id: initialData?.id,
    provider
  } as unknown);

  // Provider and source data
  const [selectedSources, setSelectedSources] = useState<string[]>([provider]);

  // Metadata initialization - delegated to custom hook
  const { selectedSourcesMetadata, setSelectedSourcesMetadata } = useMetadataInitialization(
    provider,
    initialData,
    currentStep
  );

  // Media extraction - delegated to custom hook
  const { mediaGallery, setMediaGallery } = useMediaExtraction(
    currentStep,
    selectedSources,
    selectedSourcesMetadata
  );

  // Volume data processing - delegated to custom hook
  const { volumesData, setVolumesData } = useVolumeDataProcessing(
    currentStep,
    initialData,
    provider,
    setSelectedSourcesMetadata
  );

  // Selection states
  const [selectedCover, setSelectedCover] = useState<string>('');
  const [selectedBanner, setSelectedBanner] = useState<string>('');
  const [selectedVolumes, setSelectedVolumes] = useState<(number | string)[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<unknown[]>([]);
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<string[]>([]);

  // UI states
  const [descriptionEditMode, setDescriptionEditMode] = useState<DescriptionEditMode>({
    description: false,
    synopsis: false,
    volumeInfo: false
  });
  const [isLoading, setIsLoading] = useState(false);

  // Progress tracking
  const [batchFetchProgress, setBatchFetchProgress] = useState<BatchFetchProgress>({
    current: 0,
    total: 0
  });
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle',
    progress: 0
  });

  // Chapter metadata cache
  const [chapterMetadataCache, setChapterMetadataCache] = useState<Map<string, unknown>>(new Map());

  // External IDs and links
  const [externalIds, setExternalIds] = useState<ExternalIds>({
    anilistId: '',
    malId: '',
    comicVineId: '',
    kitsuId: '',
    mangaUpdatesId: ''
  });
  const [externalLinks, setExternalLinks] = useState<string[]>([]);

  // Unified field selections
  const [fieldSelections, setFieldSelections] = useState<UnifiedFieldSelections>({});

  // Local file path (from scan results for importing scanned manga)
  const [localPath, setLocalPath] = useState<string | undefined>(
    initialData && hasProperty(initialData, 'localPath') && typeof initialData['localPath'] === 'string'
      ? initialData['localPath']
      : undefined
  );

  // Pending fetch tracking - tracks async operations like Fandom scraping
  const [pendingFetches, setPendingFetches] = useState<Map<string, Promise<void>>>(new Map());

  const registerPendingFetch = useCallback((key: string, promise: Promise<void>) => {
    setPendingFetches(prev => {
      const updated = new Map(prev);
      updated.set(key, promise);
      return updated;
    });
    // Auto-cleanup when promise resolves (void since we intentionally fire-and-forget)
    void promise.finally(() => {
      setPendingFetches(prev => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });
    });
    logger.info('[WizardContext] Registered pending fetch', { key, totalPending: pendingFetches.size + 1 });
  }, [pendingFetches.size]);

  const hasPendingFetches = useCallback(() => pendingFetches.size > 0, [pendingFetches.size]);

  const waitForAllPendingFetches = useCallback(async () => {
    if (pendingFetches.size === 0) return;
    logger.info('[WizardContext] Waiting for pending fetches', { count: pendingFetches.size });
    await Promise.allSettled(Array.from(pendingFetches.values()));
    logger.info('[WizardContext] All pending fetches completed');
  }, [pendingFetches]);

  // Helper functions
  const updateFormData = useCallback((data: Partial<WizardFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);

  // Field selection helpers
  const updateFieldSelection = useCallback((
    field: string,
    provider: string,
    value: unknown,
    confidence: number
  ) => {
    setFieldSelections(prev => ({
      ...prev,
      [field]: {
        field,
        selectedProvider: provider,
        value,
        confidence,
        isExplicit: true
      }
    }));
    logger.info('[WizardContext] Field selection updated', { field, provider, confidence });
  }, []);

  const getMergedMetadata = useCallback((): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};

    // Apply explicit user selections first
    Object.entries(fieldSelections).forEach(([field, selection]) => {
      if (selection.isExplicit) {
        merged[field] = selection.value;
      }
    });

    // Fill remaining fields with auto-selected values from primary provider
    const primaryProvider = selectedSources[0];
    if (primaryProvider && selectedSourcesMetadata[primaryProvider]) {
      const primaryMetadata = selectedSourcesMetadata[primaryProvider];
      Object.entries(primaryMetadata).forEach(([field, value]) => {
        if (!(field in merged) && value !== null && value !== undefined) {
          merged[field] = value;
        }
      });
    }

    return merged;
  }, [fieldSelections, selectedSources, selectedSourcesMetadata]);

  const canProceedToNextStep = useCallback(() => {
    // Basic validation logic
    switch (currentStep) {
      case 0: // Basic Info
        return !!formData.title && !!formData.searchProvider;
      case 1: // Metadata
        return true; // Optional step
      case 2: // Volumes
        return true; // Optional step
      case 3: // IDs
        return true; // Optional step
      case 4: // Media
        return true; // Optional step
      case 5: // Review
        return !!formData.title && !!formData.selectedSource;
      default:
        return false;
    }
  }, [currentStep, formData]);

  const goToNextStep = useCallback(() => {
    if (canProceedToNextStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  }, [canProceedToNextStep]);

  const goToPreviousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const resetWizard = useCallback(() => {
    setCurrentStep(0);
    setFormData({
      title: '',
      searchProvider: provider,
      selectedSource: provider,
      description: '',
      status: '',
      format: '',
      genres: [],
      tags: [],
      themes: [],
      authors: [],
      artists: [],
      publisher: '',
      demographic: '',
      startDate: '',
      endDate: '',
      volumeInfo: '',
      alternativeTitles: [],
      isAdult: false,
      coverUrl: '',
      bannerUrl: '',
      externalIds: {
        anilistId: '',
        malId: '',
        comicVineId: '',
        kitsuId: '',
        mangaUpdatesId: ''
      },
      externalLinks: [],
      volumes: [],
      chapters: [],
      selectedVolumes: [],
      selectedChapters: []
    });
    setSelectedSources([provider]);
    setSelectedSourcesMetadata({});
    setMediaGallery({
      covers: [],
      banners: [],
      gallery: [],
      volumeCovers: [],
      chapterCovers: []
    });
    setVolumesData({
      volumes: [],
      totalVolumes: 0,
      totalChapters: 0
    });
    setSelectedCover('');
    setSelectedBanner('');
    setSelectedVolumes([]);
    setSelectedChapters([]);
    setChapterMetadataCache(new Map());
    setExternalIds({
      anilistId: '',
      malId: '',
      comicVineId: '',
      kitsuId: '',
      mangaUpdatesId: ''
    });
    setExternalLinks([]);
  }, [provider, setSelectedSourcesMetadata, setMediaGallery, setVolumesData]);

  const contextValue = useMemo<WizardContextValue>(() => {
    const value: WizardContextValue = {
      // Core state
      currentStep,
      setCurrentStep,
      formData,
      updateFormData,

      // Provider and source data
      provider,
      selectedSources,
      setSelectedSources,
      selectedSourcesMetadata,
      setSelectedSourcesMetadata,

      // Media and volumes
      mediaGallery,
      setMediaGallery,
      volumesData,
      setVolumesData,

      // Selection states
      selectedCover,
      setSelectedCover,
      selectedBanner,
      setSelectedBanner,
      selectedVolumes,
      setSelectedVolumes,
      selectedChapters,
      setSelectedChapters,
      selectedGalleryImages,
      setSelectedGalleryImages,

      // UI states
      descriptionEditMode,
      setDescriptionEditMode,
      isLoading,
      setIsLoading,

      // Progress tracking
      batchFetchProgress,
      setBatchFetchProgress,
      importProgress,
      setImportProgress,

      // Chapter metadata cache
      chapterMetadataCache,
      setChapterMetadataCache,

      // External IDs and links
      externalIds,
      setExternalIds,
      externalLinks,
      setExternalLinks,

      // Unified field selections
      fieldSelections,
      setFieldSelections,
      updateFieldSelection,
      getMergedMetadata,

      // Local file path (from scan results)
      localPath,
      setLocalPath,

      // Helper functions
      canProceedToNextStep,
      goToNextStep,
      goToPreviousStep,
      resetWizard,

      // Pending fetch tracking
      pendingFetchCount: pendingFetches.size,
      registerPendingFetch,
      hasPendingFetches,
      waitForAllPendingFetches
    };

    // Add optional properties only if defined
    if (libraryId !== undefined) {
      value.libraryId = libraryId;
    }
    if (cachedSearchResults.length > 0) {
      value.cachedSearchResults = cachedSearchResults;
    }
    if (selectedSearchResult !== null) {
      value.selectedSearchResult = selectedSearchResult;
    }

    return value;
  }, [
    currentStep,
    formData,
    libraryId,
    cachedSearchResults,
    selectedSearchResult,
    provider,
    selectedSources,
    selectedSourcesMetadata,
    mediaGallery,
    volumesData,
    selectedCover,
    selectedBanner,
    selectedVolumes,
    selectedChapters,
    selectedGalleryImages,
    descriptionEditMode,
    isLoading,
    batchFetchProgress,
    importProgress,
    chapterMetadataCache,
    externalIds,
    externalLinks,
    fieldSelections,
    updateFieldSelection,
    getMergedMetadata,
    localPath,
    setLocalPath,
    updateFormData,
    canProceedToNextStep,
    goToNextStep,
    goToPreviousStep,
    resetWizard,
    setSelectedSourcesMetadata,
    setMediaGallery,
    setVolumesData,
    pendingFetches.size,
    registerPendingFetch,
    hasPendingFetches,
    waitForAllPendingFetches
  ]);

  return (
    <WizardContext.Provider value={contextValue}>
      {children}
    </WizardContext.Provider>
  );
};

export default WizardContext;