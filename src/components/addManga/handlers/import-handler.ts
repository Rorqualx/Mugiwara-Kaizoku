/**
 * Import Handler for Universal Import Wizard
 *
 * Handles the final import step that creates a manga entry with:
 * - Aggregated metadata from selected providers
 * - Volume and chapter information
 * - Cover images and external IDs
 *
 * @module import-handler
 * @provenance Extracted from UniversalImportWizard.tsx lines 566-641
 */

import { useCallback } from 'react';

import type { WizardFormData, ProviderMetadata } from '@/types/universalImportWizard.types';
import type { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import type { ImportService } from '../services/importService';
import type { SourceManagementService } from '../services/sourceManagementService';

/**
 * Parameters for the import handler hook
 */
export interface UseImportHandlerParams {
  // Library ID is required for import
  libraryId?: number;

  // Provider and metadata
  provider: string;
  selectedSourcesMetadata: Record<string, ProviderMetadata>;

  // Form data from wizard
  formData: Partial<WizardFormData>;

  // Media gallery and volumes
  mediaGallery: unknown;
  volumesData: unknown;

  // External IDs and links
  externalIds: unknown;
  externalLinks: string[];

  // Chapter metadata cache
  chapterMetadataCache: Map<string, unknown>;

  // Selected media
  selectedCover?: string;
  selectedBanner?: string;
  selectedGalleryImages?: string[];

  // Display source tracking
  volumeDisplaySource: string;
  chapterDisplaySource: string;

  // Volume and chapter selections
  selectedVolumes: (number | string)[];
  selectedChapters: unknown[];

  // Services
  importService: ImportService;
  sourceManagementService: SourceManagementService;

  // Callbacks
  setIsImporting: (importing: boolean) => void;
  setImportProgress: (progress: number) => void;

  // Logger
  logger: typeof logger;

  // Search mode flag
  isSearchMode?: boolean;

  // Local file path (from scan results)
  localPath?: string;
}

/**
 * Return type for the import handler hook
 */
export interface UseImportHandlerResult {
  handleImport: () => Promise<void>;
}

/**
 * Custom hook for handling manga import in the Universal Import Wizard.
 *
 * This hook encapsulates the final import step logic, which:
 * 1. Validates that a library ID is present
 * 2. Determines the correct volumes to import based on volumeDisplaySource
 * 3. Calculates total chapters from the display volumes
 * 4. Calls the ImportService to create the manga entry
 *
 * @param params - Import handler parameters including metadata, selections, and services
 * @returns Object containing the handleImport function
 *
 * @example
 * ```typescript
 * const { handleImport } = useImportHandler({
 *   libraryId: 1,
 *   provider: 'anilist',
 *   selectedSourcesMetadata,
 *   formData,
 *   // ... other params
 * });
 *
 * // Later, when user clicks Import button:
 * await handleImport();
 * ```
 */
export function useImportHandler(params: UseImportHandlerParams): UseImportHandlerResult {
  const {
    libraryId,
    provider,
    selectedSourcesMetadata,
    formData,
    mediaGallery,
    volumesData,
    externalIds,
    externalLinks,
    chapterMetadataCache,
    selectedCover,
    selectedBanner,
    selectedGalleryImages,
    volumeDisplaySource,
    chapterDisplaySource,
    selectedVolumes,
    selectedChapters,
    importService,
    sourceManagementService,
    setIsImporting,
    setImportProgress,
    logger,
    isSearchMode,
    localPath
  } = params;

  const handleImport = useCallback(async (): Promise<void> => {
    // Debug logging for library ID
    logger.info('[handleImport] Library ID check:', {
      libraryId,
      isSearchMode,
      hasLibraryId: !!libraryId
    });

    if (!libraryId) {
      notify({ severity: 'ERROR', title: 'Import Failed', message: 'Library ID is required for import' });
      return;
    }

    // CRITICAL FIX: Use displayVolumes (correct source) instead of volumesData (original primary source)
    // This ensures we import the volumes that match the user's volumeDisplaySource selection
    // Recalculate displayVolumes here since it's not available yet (defined later in the component)
    const currentDisplayVolumes = sourceManagementService.getVolumesForSource(
      volumeDisplaySource,
      volumesData as unknown as Record<string, unknown>,
      selectedSourcesMetadata,
      provider
    );

    const totalChapters = currentDisplayVolumes.reduce((sum: number, vol: unknown) => {
      const volObj = vol as Record<string, unknown>;
      const chapters = volObj["chapters"];
      const chapterCount = volObj["chapterCount"] as number | undefined;
      return sum + (Array.isArray(chapters) ? chapters.length : (chapterCount ?? 0));
    }, 0);

    const correctVolumesData = {
      volumes: currentDisplayVolumes,
      totalVolumes: currentDisplayVolumes.length,
      totalChapters
    };

    await importService.handleImport(
      formData,
      {
        libraryId,
        provider,
        selectedSourcesMetadata: selectedSourcesMetadata as Record<string, unknown>,
        mediaGallery,
        volumesData: correctVolumesData as unknown,
        externalIds,
        externalLinks,
        chapterMetadataCache,
        // Include selected media from WizardContext
        ...(selectedCover !== undefined && { selectedCover }),
        ...(selectedBanner !== undefined && { selectedBanner }),
        ...(selectedGalleryImages !== undefined && { selectedGalleryImages }),
        // Include volume/chapter source tracking for import profile
        volumeDisplaySource,
        chapterDisplaySource,
        // Include field-level provider selections
        ...(formData.fieldSelections !== undefined && { fieldSelections: formData.fieldSelections }),
        // Include local file path from scan results
        ...(localPath !== undefined && { localPath })
      },
      selectedVolumes,
      selectedChapters,
      {
        setIsImporting,
        setImportProgress
      }
    );

    // If import successful, manga ID will be returned and onComplete will be called by ImportService
    // The onComplete callback in ImportService will handle navigation
  }, [
    libraryId,
    provider,
    selectedSourcesMetadata,
    formData,
    mediaGallery,
    volumesData,
    externalIds,
    externalLinks,
    chapterMetadataCache,
    selectedCover,
    selectedBanner,
    selectedGalleryImages,
    volumeDisplaySource,
    chapterDisplaySource,
    selectedVolumes,
    selectedChapters,
    importService,
    sourceManagementService,
    setIsImporting,
    setImportProgress,
    logger,
    isSearchMode,
    localPath
  ]);

  return {
    handleImport
  };
}
