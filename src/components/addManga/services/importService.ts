import type { WizardFormData } from '@/types/universalImportWizard.types';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { mapWizardDataToMangaInput, validateMangaInput, type MangaAddInput } from '../utils/wizard-mapper';

// Import from extracted modules

import { isRecord } from './import-service/utils';

import type { ImportServiceConfig, ImportAdditionalData, ImportCallbacks } from './import-service/utils';
import type { Volume } from '../utils/wizard-mapper/types';

/**
 * Service for handling manga import
 */

export class ImportService {
  private config: ImportServiceConfig;

  constructor(config: ImportServiceConfig) {
    this.config = config;
  }

  /**
   * Handle the final import of manga data
   */
  // eslint-disable-next-line complexity -- Import orchestration with multi-provider metadata assembly and validation
  async handleImport(
    formData: Partial<WizardFormData>,
    additionalData: ImportAdditionalData,
    selectedVolumes: (number | string)[],
    selectedChapters: unknown[],
    callbacks: ImportCallbacks
  ): Promise<number | null> {
    const {
      libraryId,
      provider,
      selectedSourcesMetadata,
      mediaGallery,
      volumesData,
      externalIds,
      externalLinks,
      chapterMetadataCache: _chapterMetadataCache,
      selectedCover,
      selectedBanner,
      selectedGalleryImages,
      volumeDisplaySource,
      chapterDisplaySource,
      fieldSelections,
      localPath
    } = additionalData;

    const { setIsImporting, setImportProgress } = callbacks;

    logger.info('[Import] Starting manga import with data:', {
      title: formData["title"],
      provider,
      libraryId,
      sourcesCount: Object.keys(selectedSourcesMetadata).length,
      volumesCount: getUnknownProperty(volumesData, 'totalVolumes'),
      chaptersCount: getUnknownProperty(volumesData, 'totalChapters')
    });

    // ===== DETAILED INPUT LOGGING =====


    setIsImporting(true);
    setImportProgress(10);

    try {
      // Map wizard data to manga.add input schema

      const mangaInput: MangaAddInput = mapWizardDataToMangaInput(
        formData,
        {
          libraryId,
          provider,
          selectedSourcesMetadata: selectedSourcesMetadata as Record<string, ProviderMetadata>,
          volumesData: volumesData as { volumes?: Volume[]; totalVolumes?: number; totalChapters?: number; },
          mediaGallery: mediaGallery as { covers: unknown[]; gallery: unknown[]; volumeCovers: unknown[]; },
          externalIds: externalIds as { anilistId?: string; malId?: string; comicVineId?: string; kitsuId?: string; mangaUpdatesId?: string; },
          externalLinks,
          ...(selectedCover !== undefined && { selectedCover }),
          ...(selectedBanner !== undefined && { selectedBanner }),
          selectedVolumes,
          selectedChapters,
          ...(selectedGalleryImages !== undefined && { selectedGalleryImages }),
          ...(volumeDisplaySource !== undefined && { volumeDisplaySource }),
          ...(chapterDisplaySource !== undefined && { chapterDisplaySource }),
          ...(fieldSelections !== undefined && { fieldSelections }),
          ...(localPath !== undefined && { localPath })
        }
      );

      // ===== MANGA INPUT LOGGING =====


      setImportProgress(25);

      // Validate manga input
      const validation = validateMangaInput(mangaInput);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      setImportProgress(40);

      logger.info('[Import] Calling manga.add mutation with:', {
        title: mangaInput["title"],
        source: mangaInput["source"],
        libraryId: mangaInput.libraryId,
        hasMetadata: !!mangaInput["metadata"],
        metadataVolumes: mangaInput["metadata"]?.volumes,
        metadataChapters: mangaInput["metadata"]?.chapters,
        hasRawData: !!mangaInput.rawProviderData
      });

      // ===== MUTATION CALL LOGGING =====


      // Call the manga.add mutation
      const mutation = this.config.addMangaMutation as { mutateAsync: (input: MangaAddInput) => Promise<unknown> };
      const newManga = await mutation.mutateAsync(mangaInput);

      // ===== MUTATION RESPONSE LOGGING =====


      setImportProgress(90);

      if (!newManga || !isRecord(newManga) || !newManga["id"]) {
        throw new Error('Failed to create manga - no ID returned');
      }

      const mangaId = newManga["id"] as number;

      logger.info('[Import] Manga created successfully:', {
        id: mangaId,
        title: getUnknownProperty(newManga, 'title')
      });

      // Invalidate cache BEFORE calling onComplete to ensure fresh data on navigation
      logger.info('[Import] Invalidating cache before navigation');
      const utils = this.config.utils as { manga: { query: { invalidate: () => Promise<void> }, get: { invalidate: (params: { id: number }) => Promise<void> } } };
      await utils.manga.query.invalidate();
      await utils.manga.get.invalidate({ id: mangaId });

      // Small delay to ensure cache propagation
      await new Promise<void>(resolve => {
        setTimeout(() => {
          resolve();
        }, 200);
      });

      setImportProgress(100);

      notify({ severity: 'SUCCESS', title: 'Import Successful', message: `${mangaInput["title"]} has been added to your library` });

      // Call completion callback with manga ID - navigation will use fresh cache
      this.config.onComplete(mangaId);

      return mangaId;

    } catch (error) {
      // Extract error message - handle tRPC errors, regular errors, and unknown objects
      let errorMessage: string;
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle tRPC errors and other objects with message property
        const errObj = error as Record<string, unknown>;
        if (typeof errObj['message'] === 'string') {
          errorMessage = errObj['message'];
        } else if (typeof errObj['error'] === 'string') {
          errorMessage = errObj['error'];
        } else {
          try {
            errorMessage = JSON.stringify(error, null, 2);
          } catch {
            errorMessage = 'Unknown error occurred during import';
          }
        }
      } else {
        errorMessage = String(error);
      }

      logger.error('[Import] Import failed:', {
        error: errorMessage,
        errorType: error?.constructor?.name ?? typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });

      notify({ severity: 'ERROR', title: 'Import Failed', message: errorMessage });

      return null;
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportProgress(0), 1000); // Reset after delay
    }
  }


  /**
   * Cancel the import process
   */
  cancel(): void {
    logger.info('[Import] Import cancelled by user');
    this.config.onCancel();
  }
}

export default ImportService;