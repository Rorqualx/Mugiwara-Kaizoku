/**
 * Add Manga Handler Module
 *
 * Handles the core logic for adding manga to the library.
 * Extracted and decomposed from form.tsx (lines 633-829) for better
 * maintainability and testability.
 *
 * @module components/addManga/form/add-manga-handler
 */

import { logger } from '@/utils/logger';

import type {
  FormType,
  FormValuesExtended,
  MetadataObject,
} from './form-types';

/**
 * Callbacks for the add manga operation
 */
export interface AddMangaCallbacks {
  /** Callback when manga is successfully added via form values */
  onSuccess: () => void;
  /** Optional callback after manga is added */
  onAdd?: () => void;
  /** Callback to close the form */
  onClose: () => void;
  /** Show success notification with title and message */
  showSuccessNotification: (title: string, message: string) => void;
  /** Show error notification with message */
  showErrorNotification: (title: string, message: string) => void;
  /** Navigate to the manga page */
  navigateToManga: (id: number) => void;
  /** Invalidate queries to refresh data */
  invalidateQueries: () => Promise<void>;
}

/**
 * Input structure for the mutation
 */
export interface MutationInput {
  title: string;
  source: string;
  libraryId: number;
  interval: string;
  mangaId: string;
  metadata: {
    cover?: string | undefined;
    bannerImage?: string | undefined;
    description?: string | undefined;
    status?: string | undefined;
    genres: string[];
    volumes: number | null;
    chapters: number | null;
    dynamicSections?: Record<string, string> | undefined;
  };
  rawProviderData: Record<string, unknown>;
  providerMetadata: Record<string, unknown>;
}

/**
 * Mutation context for adding manga
 */
export interface MutationContext {
  /** Async mutation function */
  mutateAsync: (input: MutationInput) => Promise<{ id: number; title: string }>;
}

/**
 * Result of adding manga with just ID
 */
export interface IdOnlyResult {
  id: number;
}

/**
 * Result of adding manga with full data
 */
export interface MangaResult {
  id: number;
  title: string;
}

/**
 * Volume/chapter count extraction result
 */
interface VolumeCounts {
  volumeCount: number | null;
  chapterCount: number | null;
}

/**
 * Error details for logging
 */
interface ErrorDetails {
  message?: unknown | undefined;
  data?: Record<string, unknown> | undefined;
  shape?: Record<string, unknown> | undefined;
  code?: unknown | undefined;
  stack?: unknown | undefined;
}

/**
 * Handle adding manga when only ID is provided
 *
 * This handles the case when a manga ID is passed from a standardized component
 * that has already added the manga.
 *
 * @param mangaId - The manga ID
 * @param callbacks - Callback functions
 * @returns The result with the manga ID
 */
export function handleIdOnlyAdd(
  mangaId: number,
  callbacks: AddMangaCallbacks
): IdOnlyResult {
  callbacks.showSuccessNotification(
    'Manga Added',
    'Manga has been added to the library.'
  );

  if (callbacks.onAdd) {
    callbacks.onAdd();
  }

  callbacks.onClose();

  return { id: mangaId };
}

/**
 * Extract volume and chapter counts from multiple possible locations
 *
 * Different providers store counts in different places, so we check
 * multiple locations in order of preference.
 *
 * @param values - The form values
 * @returns Object containing volumeCount and chapterCount
 */
export function extractVolumeCounts(values: FormType): VolumeCounts {
  const valuesExt = values as FormValuesExtended;
  const parsedData = values.parsedVolumeData;

  // Calculate volume count - check multiple locations
  const volumeCount =
    valuesExt.volumeCount ??
    valuesExt.totalVolumes ??
    valuesExt.rawData?.totalVolumes ??
    valuesExt.rawData?.volumeCount ??
    (parsedData
      ? Array.isArray(parsedData.volumes)
        ? parsedData.volumes.length
        : parsedData.volumes
      : null) ??
    null;

  // Calculate chapter count - check multiple locations
  const chapterCount =
    valuesExt.chapterCount ??
    valuesExt.totalChapters ??
    valuesExt.rawData?.totalChapters ??
    valuesExt.rawData?.chapterCount ??
    (parsedData
      ? Array.isArray(parsedData.chapters)
        ? parsedData.chapters.length
        : parsedData.chapters
      : null) ??
    null;

  return { volumeCount, chapterCount };
}

/**
 * Build the mutation input object from form values
 *
 * Constructs the properly formatted input for the manga.add mutation
 * including metadata, raw provider data, and provider metadata.
 *
 * @param values - The form values
 * @param volumeCount - Extracted volume count
 * @param chapterCount - Extracted chapter count
 * @returns The mutation input object
 */
export function buildMutationInput(
  values: FormType,
  volumeCount: number | null,
  chapterCount: number | null
): MutationInput {
  const valuesExt = values as FormValuesExtended;
  const valuesMetadata = values['metadata'] as MetadataObject | undefined;

  // Build dynamic sections if available
  const dynamicSections =
    valuesMetadata?.['dynamicSections'] ?? valuesExt['dynamicSections'];
  const dynamicSectionsObj =
    dynamicSections &&
    Object.keys(dynamicSections as Record<string, unknown>).length > 0
      ? { dynamicSections: dynamicSections as Record<string, string> }
      : {};

  // Build provider metadata
  const baseMetadata = valuesExt.providerMetadata ?? {};
  const rawData = valuesExt.rawData ?? {};

  let providerMetadata: Record<string, unknown>;
  if (rawData.providerMetadata) {
    providerMetadata = {
      ...baseMetadata,
      ...rawData.providerMetadata,
      importProfile: valuesExt.importProfile ?? rawData.importProfile,
    };
  } else {
    providerMetadata = {
      ...baseMetadata,
      importProfile: valuesExt.importProfile,
    };
  }

  return {
    title: values.mangaTitle,
    source: values['source'] ?? 'anilist',
    libraryId: values.libraryId,
    interval: 'daily',
    mangaId: values.mangaId,
    metadata: {
      cover: values.cover,
      bannerImage: valuesExt.banner,
      description: values['description'] as string | undefined,
      status: values['status'] as string | undefined,
      genres: (values['genres'] as string[] | undefined) ?? [],
      volumes: volumeCount,
      chapters: chapterCount,
      ...dynamicSectionsObj,
    },
    rawProviderData: valuesExt.rawData ?? {},
    providerMetadata,
  };
}

/**
 * Process and extract error message from various error formats
 *
 * tRPC errors have nested structures, so we need to check multiple
 * locations to find the actual error message.
 *
 * @param error - The caught error
 * @returns Object with error message and details for logging
 */
export function handleAddError(error: unknown): {
  message: string;
  details: ErrorDetails;
} {
  let errorMessage = 'Unknown error';
  let errorDetails: ErrorDetails = {};

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const errorData = errorObj['data'] as Record<string, unknown> | undefined;
    const errorShape = errorObj['shape'] as Record<string, unknown> | undefined;

    // Try to extract message from various locations
    const objMessage =
      typeof errorObj['message'] === 'string' ? errorObj['message'] : null;
    const dataMessage =
      typeof errorData?.['message'] === 'string' ? errorData['message'] : null;
    const shapeMessage =
      typeof errorShape?.['message'] === 'string'
        ? errorShape['message']
        : null;

    errorMessage =
      objMessage ?? dataMessage ?? shapeMessage ?? JSON.stringify(error);

    // Capture full error structure for debugging
    errorDetails = {
      message: errorObj['message'],
      data: errorData,
      shape: errorShape,
      code: errorObj['code'],
      stack: errorObj['stack'],
    };
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorDetails = { stack: error.stack };
  } else {
    errorMessage = String(error);
  }

  return { message: errorMessage, details: errorDetails };
}

/**
 * Add manga to the library
 *
 * Main orchestrator function that handles the complete add manga flow.
 * Supports both ID-only adds (from standardized components) and full
 * form value adds with metadata.
 *
 * @param valuesOrId - Form values or manga ID
 * @param mutation - Mutation context
 * @param callbacks - Callback functions
 * @returns The result of the add operation
 */
export async function addMangaToLibrary(
  valuesOrId: FormType | number,
  mutation: MutationContext,
  callbacks: AddMangaCallbacks
): Promise<IdOnlyResult | MangaResult | null> {
  // Check if we received a number (manga ID) or form values
  if (typeof valuesOrId === 'number') {
    return handleIdOnlyAdd(valuesOrId, callbacks);
  }

  // We received form values
  const values = valuesOrId;
  const valuesExt = values as FormValuesExtended;
  const parsedData = values.parsedVolumeData;

  logger.info('[FORM] Calling manga.add mutation with data:', {
    title: values.mangaTitle,
    source: values['source'] ?? 'anilist',
    libraryId: values.libraryId,
    hasMetadata: !!values['metadata'],
    hasProviderMetadata: !!valuesExt.providerMetadata,
    volumesCount: parsedData
      ? Array.isArray(parsedData.volumes)
        ? parsedData.volumes.length
        : parsedData.volumes
      : 0,
    chaptersCount: parsedData
      ? Array.isArray(parsedData.chapters)
        ? parsedData.chapters.length
        : parsedData.chapters
      : 0,
  });

  // Extract volume/chapter counts
  const { volumeCount, chapterCount } = extractVolumeCounts(values);

  logger.info('[FORM] Sending to manga.add mutation:', {
    title: values.mangaTitle,
    volumes: volumeCount,
    chapters: chapterCount,
    source: values['source'] ?? 'anilist',
  });

  // Build mutation input
  const mutationInput = buildMutationInput(values, volumeCount, chapterCount);

  // Execute mutation
  const newManga = await mutation.mutateAsync(mutationInput);

  logger.info('[FORM] Manga added successfully:', {
    id: newManga.id,
    title: newManga.title,
  });

  callbacks.showSuccessNotification(
    'Manga Added',
    `${values.mangaTitle} has been added to the library.`
  );

  // Invalidate manga queries to refresh the list
  await callbacks.invalidateQueries();

  // Navigate to the manga page
  if (newManga.id) {
    callbacks.navigateToManga(newManga.id);
  }

  if (callbacks.onAdd) {
    callbacks.onAdd();
  }

  callbacks.onClose();

  // Return the newly created manga
  return newManga;
}

/**
 * Wrapper function that handles loading state and error handling
 *
 * This wrapper adds try-catch-finally around the core add logic
 * for use in the component.
 *
 * @param valuesOrId - Form values or manga ID
 * @param mutation - Mutation context
 * @param callbacks - Callback functions
 * @param setIsLoading - Loading state setter
 * @returns The result of the add operation
 */
export async function addMangaWithErrorHandling(
  valuesOrId: FormType | number,
  mutation: MutationContext,
  callbacks: AddMangaCallbacks,
  setIsLoading: (loading: boolean) => void
): Promise<IdOnlyResult | MangaResult | null> {
  setIsLoading(true);

  try {
    return await addMangaToLibrary(valuesOrId, mutation, callbacks);
  } catch (error: unknown) {
    const { message: errorMessage, details: errorDetails } =
      handleAddError(error);

    logger.error('[FORM] Failed to add manga:', {
      message: errorMessage,
      details: errorDetails,
      stringified: JSON.stringify(
        error,
        Object.getOwnPropertyNames(error as object),
        2
      ),
    });

    callbacks.showErrorNotification(
      'Error',
      `Failed to add manga. ${errorMessage}`
    );

    return null;
  } finally {
    setIsLoading(false);
  }
}
