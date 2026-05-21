/**
 * Hook for managing batch updates to manga, library, and settings data
 * 
 * TypeScript Migration:
 * - Added proper Error typing to AsyncResult
 * - Updated type signatures for batch operations
 * - Added proper generic type parameters to AsyncResult
 * - Implemented comprehensive state checking
 * - Fixed return type annotations
 * - Added array validation before operations
 * - Enhanced type guards for error objects
 * - Implemented proper error context handling
 */

import { useCallback, useRef, useState } from 'react';

import { useStoreActions } from '../store/hooks';
import { createSuccessResult, createErrorResult, createLoadingResult, createIdleResult, isSuccess, isError, isLoading } from '../utils/async-result';
import { processAsyncOperations } from '../utils/async-result'
import { toNumberId } from "../utils/id-converters";

import type { ID } from '../types/common';
import type { IntegrationSettings } from '../types/config.types';
import type { AsyncResult } from '../utils/async-result';
import type { Library as LibraryEntity, Manga as MangaEntity} from '@prisma/client';

/**
 * Base entity type for batch updates
 */
export interface BatchUpdateEntity {
  id: ID;
  [key: string]: unknown;
}

/**
 * Data structure for batch update operations
 * 
 * @interface BatchUpdateData<T extends BatchUpdateEntity>
 * @property {T[]} [manga] - Manga data to update
 * @property {Pick<LibraryEntity, 'id' | 'path'>} [library] - Library data to update
 * @property {IntegrationSettings} [settings] - Integration settings to update
 */
export interface BatchUpdateData<T extends BatchUpdateEntity = MangaEntity> {
  manga?: T[];
  library?: Pick<LibraryEntity, 'id' | 'path'>;
  settings?: IntegrationSettings;
}

/**
 * Type for manga update entries
 */
export interface MangaUpdateEntry {
  id: ID;
  title: string;
  interval: string;
}

/**
 * Result of a batch update operation
 */
export interface BatchUpdateResult {
  /** Number of successfully updated items */
  updatedCount: number;
  /** Details about the update operation */
  details: string;
  /** Any errors that occurred during the update */
  errors?: Error[];
}

/**
 * Return type for the useBatchUpdates hook
 */
export interface UseBatchUpdatesResult<T extends BatchUpdateEntity = MangaEntity> {
  /** Function to process batch updates */
  handleBatchUpdate: (data: BatchUpdateData<T>) => Promise<AsyncResult<BatchUpdateResult, Error>>;
  /** Current batch update operation status */
  batchUpdateStatus: AsyncResult<BatchUpdateResult, Error>;
  /** Whether a batch update is in progress */
  isUpdating: boolean;
  /** Reset batch update status to idle */
  resetStatus: () => void;
}

/**
 * Options for the useBatchUpdates hook
 */
export interface UseBatchUpdatesOptions<T extends BatchUpdateEntity = MangaEntity> {
  /** Custom transform function for entities */
  transformEntity?: (entity: T) => MangaUpdateEntry;
  /** Custom handler for update errors */
  onError?: (error: Error) => void;
  /** Custom handler for update success */
  onSuccess?: (result: BatchUpdateResult) => void;
  /** Whether to continue processing on error */
  continueOnError?: boolean;
  /** Batch size for parallel processing */
  batchSize?: number;
  /** Delay between operations (ms) */
  operationDelay?: number;
}

/**
 * Hook for managing batch updates to manga, library, and settings data
 * 
 * This hook provides functionality to perform batch updates while handling
 * loading states, versioning, and error handling. It ensures that only
 * the most recent update operation is processed when multiple updates
 * are triggered in succession. It follows the AsyncResult pattern for
 * robust error handling and state management.
 * 
 * @template T Type of entities being updated, must extend BatchUpdateEntity
 * @param {UseBatchUpdatesOptions<T>} options - Configuration options
 * @returns {UseBatchUpdatesResult<T>} Batch update functionality and status
 * 
 * @example
 * ```tsx
 * const { 
 *   handleBatchUpdate, 
 *   batchUpdateStatus, 
 *   isUpdating,
 *   resetStatus
 * } = useBatchUpdates();
 * 
 * // Update multiple manga
 * const result = await handleBatchUpdate({
 *   manga: [
 *     { id: 1, title: 'Manga 1', status: 'ONGOING' },
 *     { id: 2, title: 'Manga 2', status: 'COMPLETED' }
 *   ]
 * });
 * 
 * // Check update status with proper AsyncResult pattern
 * if (isSuccess(result)) {
 *   logger.info(`Updated ${result.data.updatedCount} items`);
 * } else if (isError(result)) {
 *   console.error(`Update failed: ${result.error instanceof Error ? result.error.message : String(result.error)}`);
 * }
 * 
 * // Reset update status
 * resetStatus();
 * 
 * // With custom options
 * const { handleBatchUpdate } = useBatchUpdates({
 *   transformEntity: (manga) => ({
 *     id: manga["id"],
 *     title: manga["title"],
 *     interval: manga["status"] === MangaPublicationStatus.ONGOING ? 'weekly' : 'never'
 *   }),
 *   onSuccess: (result) => {
 *     logger.info(`Successfully updated ${result.updatedCount} items`);
 *   },
 *   onError: (error) => {
 *     console.error(`Update failed: ${(error instanceof Error ? error.message : String(error))}`);
 *   },
 *   continueOnError: true,
 *   batchSize: 5,
 *   operationDelay: 100
 * });
 * ```
 */
export function useBatchUpdates<T extends BatchUpdateEntity = MangaEntity>(options: UseBatchUpdatesOptions<T> = {}): UseBatchUpdatesResult<T> {
  const {
    handleMangaUpdate,
    setLoading,
    setError
  } = useStoreActions();
  const updateVersionRef = useRef(0);
  const [batchUpdateStatus, setBatchUpdateStatus] = useState<AsyncResult<BatchUpdateResult, Error>>(createIdleResult<BatchUpdateResult, Error>());

  // Extract options with defaults
  const {
    continueOnError = false,
    batchSize = 0,
    operationDelay = 0,
    onSuccess,
    onError
  } = options;

  /**
   * Default transform function for manga entities
   */
  const defaultTransform = useCallback((manga: T): MangaUpdateEntry => ({
    id: manga["id"],
    title: String(manga["title"] ?? ''),
    interval: manga["status"] === 'ONGOING' ? 'daily' : 'never'
  }), []);

  /**
   * Actual transform function to use
   */
  const transformEntity = options.transformEntity ?? defaultTransform;

  /**
   * Process a single manga update with AsyncResult pattern
   */
  const processMangaUpdate = useCallback(async (entry: MangaUpdateEntry): Promise<AsyncResult<boolean, Error>> => {
    try {
      // Convert ID to number if needed for API compatibility
      const numericId = typeof entry["id"] === 'string' ? toNumberId(entry["id"]) : entry["id"];
      await handleMangaUpdate(numericId);
      return createSuccessResult<boolean, Error>(true);
    } catch (error: unknown) {
      return createErrorResult<boolean, Error>(error instanceof Error ? error : new Error(`Failed to update manga ${entry["title"]}: ${String(error)}`));
    }
  }, [handleMangaUpdate]);

  /**
   * Process manga updates and extract results
   */
  const processMangaUpdates = useCallback(async (
    mangaData: unknown[]
  ): Promise<{ updatedCount: number; details: string; errors: Error[]; shouldReturn?: AsyncResult<BatchUpdateResult, Error> }> => {
    const updates = mangaData.map((item) => transformEntity(item as unknown as T));
    const errors: Error[] = [];

    const mangaResult = await processAsyncOperations<MangaUpdateEntry, boolean, Error>(updates, processMangaUpdate, {
      continueOnError,
      ...(batchSize > 0 && { batchSize }),
      delay: operationDelay
    });

    // Handle success case
    if (isSuccess(mangaResult)) {
      const resultErrors: Error[] = [];
      if (Array.isArray(mangaResult.data.errors)) {
        mangaResult.data.errors.forEach(({ error, item }) => {
          resultErrors.push(error instanceof Error ? error : new Error(`Failed to update manga ${item["title"]}: ${String(error)}`));
        });
      }
      return {
        updatedCount: mangaResult.data.successCount,
        details: `Updated ${mangaResult.data.successCount}/${updates.length} manga. `,
        errors: resultErrors
      };
    }

    // Handle error case
    if (isError(mangaResult)) {
      if (!continueOnError) {
        return {
          updatedCount: 0,
          details: '',
          errors,
          shouldReturn: createErrorResult<BatchUpdateResult, Error>(mangaResult.error)
        };
      }
      errors.push(mangaResult.error);
      return {
        updatedCount: 0,
        details: `Error updating manga: ${mangaResult.error instanceof Error ? mangaResult.error.message : String(mangaResult.error)}. `,
        errors
      };
    }

    // Handle loading/idle states
    if (isLoading(mangaResult)) {
      return {
        updatedCount: 0,
        details: '',
        errors,
        shouldReturn: createLoadingResult<BatchUpdateResult, Error>()
      };
    }

    return {
      updatedCount: 0,
      details: '',
      errors,
      shouldReturn: createIdleResult<BatchUpdateResult, Error>()
    };
  }, [transformEntity, processMangaUpdate, continueOnError, batchSize, operationDelay]);

  /**
   * Process library update
   */
  const processLibraryUpdate = useCallback(async (
    libraryData: unknown
  ): Promise<{ updatedCount: number; details: string; error?: Error }> => {
    try {
      if (!libraryData || typeof libraryData !== 'object') {
        throw new Error('Invalid library data');
      }
      const lib = libraryData as Record<string, unknown>;
      const libraryId = typeof lib['id'] === 'string' ? toNumberId(lib['id']) : lib['id'] as number;
      await handleMangaUpdate(libraryId);
      return {
        updatedCount: 1,
        details: 'Updated library settings. '
      };
    } catch (error: unknown) {
      const libraryError = error instanceof Error ? error : new Error(`Failed to update library: ${String(error)}`);
      return {
        updatedCount: 0,
        details: `Error updating library: ${libraryError.message}. `,
        error: libraryError
      };
    }
  }, [handleMangaUpdate]);

  /**
   * Process settings update
   */
  const processSettingsUpdate = useCallback(async (): Promise<{ updatedCount: number; details: string; error?: Error }> => {
    try {
      await handleMangaUpdate(0);
      return {
        updatedCount: 1,
        details: 'Updated integration settings. '
      };
    } catch (error: unknown) {
      const settingsError = error instanceof Error ? error : new Error(`Failed to update settings: ${String(error)}`);
      return {
        updatedCount: 0,
        details: `Error updating settings: ${settingsError.message}. `,
        error: settingsError
      };
    }
  }, [handleMangaUpdate]);

  /**
   * Handle batch updates with proper AsyncResult pattern
   */
  const handleBatchUpdate = useCallback(async (data: BatchUpdateData<T>): Promise<AsyncResult<BatchUpdateResult, Error>> => {
    const currentVersion = ++updateVersionRef.current;
    setLoading('batch-update', true);
    setBatchUpdateStatus(createLoadingResult<BatchUpdateResult, Error>());

    try {
      // Only process if this is still the latest update
      if (currentVersion !== updateVersionRef.current) {
        return createIdleResult<BatchUpdateResult, Error>();
      }

      let updatedCount = 0;
      let details = '';
      const errors: Error[] = [];

      // Process manga data
      if (data.manga && Array.isArray(data.manga)) {
        const mangaResult = await processMangaUpdates(data.manga);
        if (mangaResult.shouldReturn) {
          return mangaResult.shouldReturn;
        }
        updatedCount += mangaResult.updatedCount;
        details += mangaResult.details;
        errors.push(...mangaResult.errors);
      }

      // Process library data
      if (data.library) {
        const libResult = await processLibraryUpdate(data.library);
        if (libResult.error) {
          errors.push(libResult.error);
          if (!continueOnError) {
            return createErrorResult<BatchUpdateResult, Error>(libResult.error);
          }
        }
        updatedCount += libResult.updatedCount;
        details += libResult.details;
      }

      // Process settings
      if (data.settings) {
        const settingsResult = await processSettingsUpdate();
        if (settingsResult.error) {
          errors.push(settingsResult.error);
          if (!continueOnError) {
            return createErrorResult<BatchUpdateResult, Error>(settingsResult.error);
          }
        }
        updatedCount += settingsResult.updatedCount;
        details += settingsResult.details;
      }

      // Create success result
      const result: BatchUpdateResult = {
        updatedCount,
        details: details.trim(),
        ...(errors.length > 0 && { errors })
      };

      if (onSuccess) {
        onSuccess(result);
      }
      const successResult = createSuccessResult<BatchUpdateResult, Error>(result);
      setBatchUpdateStatus(successResult);
      return successResult;
    } catch (error: unknown) {
      // Create error message with context
      const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Batch update failed';

      // Create error object with context
      const errorObject = error instanceof Error ? error : new Error(`Batch update failed: ${String(error)}`);

      // Call onError handler if provided
      if (onError) {
        onError(errorObject);
      }

      // Set error in store
      setError(errorMessage, null);

      // Create error result
      const errorResult = createErrorResult<BatchUpdateResult, Error>(errorObject);
      setBatchUpdateStatus(errorResult);
      return errorResult;
    } finally {
      if (currentVersion === updateVersionRef.current) {
        setLoading('batch-update', false);
      }
    }
  }, [setLoading, setError, processMangaUpdates, processLibraryUpdate, processSettingsUpdate, onSuccess, onError, continueOnError]);

  /**
   * Reset batch update status to idle
   */
  const resetStatus = useCallback((): void => {
    setBatchUpdateStatus(createIdleResult<BatchUpdateResult, Error>());
  }, []);
  return {
    handleBatchUpdate,
    batchUpdateStatus,
    isUpdating: isLoading(batchUpdateStatus),
    resetStatus
  };
}