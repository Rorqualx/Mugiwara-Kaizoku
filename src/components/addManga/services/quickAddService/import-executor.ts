/**
 * Quick Add Service - Import Executor
 *
 * Handles the actual manga import operation using vanilla tRPC client.
 * Builds additional data, validates input, and executes the import mutation.
 *
 * @module components/addManga/services/quickAddService/import-executor
 */


import { getVolumesForSource } from '@/components/addManga/services/sourceManagementService/data-retrieval';
import { mapWizardDataToMangaInput, validateMangaInput, type AdditionalData } from '@/components/addManga/utils/wizard-mapper';
import type { AppRouter } from '@/server/trpc/root';
import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';


import { buildSourcesMetadata } from './data-builder';
import { mergeChaptersIntoDisplayVolumes } from './import-executor/chapter-merging';
import {
  buildVolumesDataObject,
  buildExternalIds,
  determineDisplaySources,
  injectProviderData,
  filterToUsedProviders,
  buildFinalVolumesData
} from './import-executor/data-builders';

import type { BuildAdditionalDataOptions, PerformImportOptions, QuickAddProgress } from './types';
import type { TRPCClient } from '@trpc/client';

// ============================================================================
// Import Execution
// ============================================================================

/**
 * Perform the manga import operation
 * Uses vanilla tRPC client directly instead of ImportService to avoid React hook dependency
 */
export async function performImport(
  options: PerformImportOptions,
  trpcClient: TRPCClient<AppRouter>
): Promise<number | null> {
  const { searchData, formData, fieldSelections, selections, volumesData, volumeFieldSources, providerPreferences, config, selectedSourcesMetadata } = options;
  const { searchResult, allSearchResults } = searchData;
  const { volumes: selectedVolumes, chapters: selectedChapters } = selections;
  const { libraryId, onProgress } = config;

  try {
    // Build all the necessary data
    const volumesDataObj = buildVolumesDataObject(volumesData, searchResult);
    const externalIdsObj = buildExternalIds(searchResult);
    const sourcesMetadata = buildSourcesMetadata(searchResult, allSearchResults, selectedSourcesMetadata);
    const { volumeDisplaySource, chapterDisplaySource } = determineDisplaySources(volumesData, providerPreferences, searchResult.provider);

    // Inject provider data and get display volumes
    const enrichedSourcesMetadata = injectProviderData(volumesData, sourcesMetadata);
    const displayVolumes = getVolumesForSource(volumeDisplaySource, volumesDataObj, enrichedSourcesMetadata as Record<string, ProviderMetadata>, searchResult.provider);
    mergeChaptersIntoDisplayVolumes(displayVolumes, volumeDisplaySource, chapterDisplaySource, enrichedSourcesMetadata);

    // Build final data and execute import
    const finalVolumesData = buildFinalVolumesData(displayVolumes, volumesDataObj);

    // Filter to only include providers we actually need (reduces payload size)
    // Keep: volumeDisplaySource, chapterDisplaySource, and primary provider
    const filteredSourcesMetadata = filterToUsedProviders(
      enrichedSourcesMetadata,
      volumeDisplaySource,
      chapterDisplaySource,
      searchResult.provider
    );

    const additionalData = buildAdditionalData({
      core: { libraryId, searchResult },
      volumes: { finalVolumesData, selectedVolumes, selectedChapters },
      sources: { sourcesMetadata: filteredSourcesMetadata, volumeDisplaySource, chapterDisplaySource },
      externalIds: externalIdsObj,
      fieldConfig: { fieldSelections, volumeFieldSources }
    });

    return await executeImport(trpcClient, formData, additionalData, onProgress);
  } catch (error) {
    logImportError(error);
    throw error;
  }
}

/**
 * Execute the actual import mutation
 */
async function executeImport(
  trpcClient: TRPCClient<AppRouter>,
  formData: PerformImportOptions['formData'],
  additionalData: AdditionalData,
  onProgress?: (progress: QuickAddProgress) => void
): Promise<number> {
  onProgress?.({ stage: 'importing', message: 'Preparing import data...', progress: 75 });

  const mangaInput = mapWizardDataToMangaInput(formData, additionalData);
  const validation = validateMangaInput(mangaInput);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }

  onProgress?.({ stage: 'importing', message: 'Saving to database...', progress: 85 });

  // Calculate approximate payload size for debugging
  const payloadJson = JSON.stringify(mangaInput);
  const payloadSizeKB = Math.round(payloadJson.length / 1024);
  const payloadSizeMB = (payloadJson.length / (1024 * 1024)).toFixed(2);

  logger.info('[import-executor] Calling manga.add mutation', {
    title: mangaInput.title,
    source: mangaInput.source,
    libraryId: mangaInput.libraryId,
    payloadSizeKB,
    payloadSizeMB: `${payloadSizeMB}MB`
  });

  // Log warning if payload is large
  if (payloadSizeKB > 500) {
    logger.warn(`[import-executor] Large payload detected: ${payloadSizeMB}MB (${payloadSizeKB}KB)`);
  }

  const newManga = await trpcClient.manga.add.mutate(
    mangaInput as Parameters<typeof trpcClient.manga.add.mutate>[0]
  );

  logger.info('[import-executor] Manga created successfully', { mangaId: newManga.id, title: mangaInput.title });
  onProgress?.({ stage: 'importing', message: 'Import complete!', progress: 100 });

  return newManga.id;
}

/**
 * Log import error with details
 */
function logImportError(error: unknown): void {
  // Extract error details including TRPCClientError specifics
  let errorMessage: string;
  let errorDetails: Record<string, unknown> = {};

  if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = {
      name: error.name,
      stack: error.stack,
      // TRPCClientError has additional properties
      cause: 'cause' in error ? String(error.cause) : undefined,
    };

    // Check for response body in the error (tRPC includes this)
    const errWithMeta = error as Error & { meta?: { response?: Response; responseText?: string } };
    if (errWithMeta.meta?.responseText) {
      errorDetails['responseText'] = errWithMeta.meta.responseText.slice(0, 500);
    }
  } else if (typeof error === 'object' && error !== null) {
    errorMessage = JSON.stringify(error);
    errorDetails = { rawError: error };
  } else {
    errorMessage = String(error);
  }

  logger.error('[import-executor] Import failed', {
    error: errorMessage,
    ...errorDetails
  });
}

// ============================================================================
// Additional Data Building
// ============================================================================

/**
 * Build AdditionalData for the wizard mapper
 */
function buildAdditionalData(options: BuildAdditionalDataOptions): AdditionalData {
  const { core, volumes, sources, externalIds, fieldConfig } = options;
  const { libraryId, searchResult } = core;
  const { finalVolumesData, selectedVolumes, selectedChapters } = volumes;
  const { sourcesMetadata, volumeDisplaySource, chapterDisplaySource } = sources;
  const { fieldSelections, volumeFieldSources } = fieldConfig;

  return {
    libraryId,
    provider: searchResult.provider,
    selectedSourcesMetadata: sourcesMetadata as Record<string, ProviderMetadata>,
    volumesData: finalVolumesData as AdditionalData['volumesData'],
    mediaGallery: { covers: [], gallery: [], volumeCovers: [] },
    externalIds,
    externalLinks: [],
    selectedCover: searchResult.coverImage ?? searchResult.cover ?? '',
    selectedBanner: searchResult.bannerImage ?? '',
    selectedVolumes,
    selectedChapters,
    selectedGalleryImages: [],
    volumeDisplaySource,
    chapterDisplaySource,
    fieldSelections,
    volumeFieldSources
  };
}
