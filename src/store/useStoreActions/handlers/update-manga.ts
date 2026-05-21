/**
 * Update Manga Handler
 *
 * Handles manga updates with optimistic UI updates.
 * Extracted to reduce main hook complexity.
 *
 * Extracted from: useStoreActions.ts (lines 184-395)
 *
 * @module store/useStoreActions/handlers/update-manga
 */

import { useCallback } from 'react';

import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import type { Chapter, Manga, MangaWithRelations, UpdatedManga } from '../types';

/**
 * Dependencies for the update manga handler
 */
interface UpdateMangaDependencies {
  updateMangaMutation:
    | {
        mutateAsync: (params: {
          id: number;
          title: string;
          monitoringConfig: string;
        }) => Promise<MutationResult>;
      }
    | undefined;
  mangaActions: {
    updateManga: (id: number, updates: Partial<Manga>) => void;
  };
  uiActions: {
    setLoading: (key: string, value: boolean) => void;
  };
  showSuccess: (opts: { title: string; message: string }) => void;
  showError: (opts: { title: string; message: string }) => void;
}

/**
 * Result type from the mutation
 */
interface MutationResult {
  id: number;
  title: string;
  source: string;
  sourceId: string;
  libraryId: number;
  metadataId: number | null;
  lastChecked: string | Date | null;
  libraryPath: string;
  mangaTitle: string;
  createdAt: string | Date;
  errorMessage: string | null;
  lastErrorAt: string | Date | null;
  lastSyncAt: string | Date | null;
  summary: string | null;
  syncCount: number;
  updatedAt: string | Date;
  publicationStatus: string | null;
  fileStatus: string | null;
  libraryStatus: string | null;
  searchProvider: string | null;
  providerMetadata: unknown;
  rawProviderData: unknown;
  monitoringConfig: string | unknown;
  mlCorrected: boolean | null;
  selectedSourceId: string | null;
  metadataConfidence: number | null;
  Metadata: unknown;
  Chapter: ChapterFromApi[];
  Library: {
    id: number;
    name: string;
    path: string;
    createdAt: string | Date;
    lastScanAt: string | Date | null;
  };
}

/**
 * Chapter shape from API response
 */
interface ChapterFromApi {
  id: number;
  title: string;
  index: number;
  mangaId: number | string;
  downloadStatus: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  [key: string]: unknown;
}

/**
 * Creates the handleUpdateManga callback
 *
 * Handles manga updates with:
 * - API mutation
 * - Local state update
 * - Error handling
 * - Loading state management
 *
 * @param deps - Dependencies for the update manga handler
 * @returns Callback function to update manga
 */
export function useUpdateMangaHandler(
  deps: UpdateMangaDependencies
): (id: number, updates: Partial<MangaWithRelations>) => Promise<void> {
  const { updateMangaMutation, mangaActions, uiActions, showSuccess, showError } = deps;

  return useCallback(
    async (id: number, updates: Partial<MangaWithRelations>): Promise<void> => {
      uiActions.setLoading('update-manga', true);
      try {
        // Convert monitoringConfig to a string for the API if it's an object
        const monitoringConfigForApi = buildMonitoringConfig(updates.monitoringConfig);

        // Guard against undefined mutation (fixes TS18048)
        if (!updateMangaMutation) {
          throw new Error('Update mutation not available');
        }

        const result = await updateMangaMutation.mutateAsync({
          id,
          title: String(updates.title ?? ''),
          monitoringConfig: monitoringConfigForApi,
        });

        // Transform result to UpdatedManga
        const updated = transformResultToUpdatedManga(result);

        // Construct a properly typed MangaWithRelations object
        const mangaWithRelations = buildMangaWithRelations(result);

        // Convert chapters with required relations
        const chaptersWithRelations = transformChapters(updated.chapters);

        // Update the manga object with the proper chapters
        mangaWithRelations.Chapter = chaptersWithRelations;

        // Get numeric ID for the store action
        const mangaId = getMangaId(updated.id);
        if (mangaId === null) {
          return;
        }

        // Create a partial object for the update to avoid type conflicts
        const updatePayload: Partial<Manga> = {
          id: mangaId,
          title: mangaWithRelations.title,
        };

        // Update the manga in the store
        mangaActions.updateManga(mangaId, updatePayload);
        showSuccess({
          title: 'Update Successful',
          message: `Updated ${updated.title}`,
        });
      } catch (error: unknown) {
        showError({
          title: 'Update Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        uiActions.setLoading('update-manga', false);
      }
    },
    [updateMangaMutation, mangaActions, uiActions, showSuccess, showError]
  );
}

// Helper functions to reduce complexity

/**
 * Build monitoring config string for API
 */
function buildMonitoringConfig(config: unknown): string {
  if (typeof config === 'object' && config !== null) {
    return JSON.stringify(config);
  }
  if (typeof config === 'string') {
    return config;
  }
  return JSON.stringify({
    isMonitored: false,
    interval: 'custom',
    customIntervalDays: 7,
  });
}

/**
 * Transform API result to UpdatedManga type
 */
function transformResultToUpdatedManga(result: MutationResult): UpdatedManga {
  const chapters = Array.isArray(result.Chapter)
    ? result.Chapter.map((chapter) => ({
        ...chapter,
        id: chapter.id,
        title: chapter.title,
        index: chapter.index,
        mangaId: typeof chapter.mangaId === 'string' ? toNumberId(chapter.mangaId) : chapter.mangaId,
        downloadStatus: chapter.downloadStatus,
        createdAt: new Date(chapter.createdAt),
        updatedAt: new Date(chapter.updatedAt),
      }))
    : [];

  return {
    ...result,
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
    lastChecked: result.lastChecked ? new Date(result.lastChecked) : null,
    chapters: chapters as Chapter[],
    outOfSyncChapters: [],
  } as unknown as UpdatedManga;
}

/**
 * Build MangaWithRelations from API result
 */
function buildMangaWithRelations(result: MutationResult): MangaWithRelations {
  // Parse monitoringConfig safely (fixes unsafe-assignment)
  let parsedMonitoringConfig: unknown;
  if (typeof result.monitoringConfig === 'string') {
    try {
      parsedMonitoringConfig = JSON.parse(result.monitoringConfig) as unknown;
    } catch {
      parsedMonitoringConfig = result.monitoringConfig;
    }
  } else {
    parsedMonitoringConfig = result.monitoringConfig;
  }

  return {
    id: result.id,
    title: result.title,
    source: result.source,
    sourceId: result.sourceId,
    libraryId:
      typeof result.libraryId === 'string' ? toNumberId(result.libraryId) : result.libraryId,
    metadataId: result.metadataId,
    lastChecked: result.lastChecked ? new Date(result.lastChecked) : null,
    libraryPath: result.libraryPath,
    mangaTitle: result.mangaTitle,
    createdAt: new Date(result.createdAt),
    errorMessage: result.errorMessage,
    lastErrorAt: result.lastErrorAt ? new Date(result.lastErrorAt) : null,
    lastSyncAt: result.lastSyncAt ? new Date(result.lastSyncAt) : null,
    summary: result.summary,
    syncCount: result.syncCount,
    updatedAt: new Date(result.updatedAt),
    publicationStatus: result.publicationStatus,
    fileStatus: result.fileStatus,
    libraryStatus: result.libraryStatus,
    searchProvider: result.searchProvider,
    providerMetadata: result.providerMetadata,
    rawProviderData: result.rawProviderData,
    monitoringConfig: parsedMonitoringConfig,
    mlCorrected: result.mlCorrected ?? false,
    selectedSourceId: result.selectedSourceId,
    metadataConfidence: result.metadataConfidence,
    suwayomiPluginConfig: null,
    mediaType: 'MANGA',
    Metadata: result.Metadata,
    Chapter: [],
    Library: {
      id: result.Library.id,
      name: result.Library.name,
      path: result.Library.path,
      createdAt: new Date(result.Library.createdAt),
      lastScanAt: result.Library.lastScanAt ? new Date(result.Library.lastScanAt) : null,
    },
  } as MangaWithRelations;
}

/**
 * Transform chapters array with proper typing
 */
function transformChapters(chapters: Chapter[]): Chapter[] {
  return chapters.map((chapter) => ({
    ...chapter,
    id: chapter.id,
    title: chapter.title,
    index: chapter.index,
    mangaId: typeof chapter.mangaId === 'string' ? toNumberId(chapter.mangaId) : chapter.mangaId,
    downloadStatus: chapter.downloadStatus,
    createdAt: new Date(chapter.createdAt),
    updatedAt: new Date(chapter.updatedAt),
  }));
}

/**
 * Get numeric manga ID from various input types
 */
function getMangaId(id: unknown): number | null {
  if (typeof id === 'string') {
    const parsed = toNumberId(id);
    if (!isNaN(parsed)) {
      return parsed;
    }
    logger.error('Failed to convert manga ID to number:', { id });
    return null;
  }
  if (typeof id === 'number') {
    return id;
  }
  logger.error('Invalid manga ID type:', { type: typeof id });
  return null;
}
