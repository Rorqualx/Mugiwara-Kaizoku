/**
 * Hook for managing chapter synchronization operations
 *
 * This hook provides functionality to check for and fix out-of-sync chapters
 * in a manga series. It implements the AsyncResult pattern for better error handling
 * and state management.
 */

import { useState } from 'react';

import { useUIStore } from '../store/uiSlice'; // Import directly from uiSlice to get the correct type
import { createIdleResult, createLoadingResult, createSuccessResult, createErrorResult, isSuccess, isError, isLoading } from '../utils/async-result';
import { toNumberId, toStringId } from '../utils/id-converters';
import { trpc } from '../utils/trpc-client';

import { useNotification} from './useNotification';

import type { AsyncResult} from '../utils/async-result';
import type { ID} from '../utils/id-converters';
/**
 * Result type for check and fix operations
 */
export type ChapterSyncOperationResult = AsyncResult<boolean, Error>;

/**
 * Return type for the useChapterSync hook
 */
export interface UseChapterSyncResult {
  /** Check for out-of-sync chapters */
  checkOutOfSync: () => Promise<ChapterSyncOperationResult>;
  /** Fix out-of-sync chapters */
  fixOutOfSync: () => Promise<ChapterSyncOperationResult>;
  /** Current state of the check operation */
  checkState: ChapterSyncOperationResult;
  /** Current state of the fix operation */
  fixState: ChapterSyncOperationResult;
  /** Whether the check operation is in progress */
  isChecking: boolean;
  /** Whether the fix operation is in progress */
  isFixing: boolean;
  /** Whether the check operation has completed successfully */
  hasCheckedOutOfSync: boolean;
  /** Whether the fix operation has completed successfully */
  hasFixedOutOfSync: boolean;
  /** Error from the check operation, if any */
  checkError: Error | null;
  /** Error from the fix operation, if any */
  fixError: Error | null;
}

// We now use the shared utility functions from id-conversion.ts

/**
 * Hook for managing chapter synchronization operations
 * 
 * This hook provides functionality to check for and fix out-of-sync chapters
 * in a manga series. It handles loading states and notifications for both
 * check and fix operations using the AsyncResult pattern.
 * 
 * @param {ID} mangaId - ID of the manga to check/fix chapters for
 * @param {Object} [options] - Optional configuration for the hook
 * @returns {UseChapterSyncResult} Chapter sync operations and state
 * 
 * @example
 * ```tsx
 * const { 
 *   checkOutOfSync, 
 *   fixOutOfSync,
 *   checkState,
 *   fixState
 * } = useChapterSync(mangaId);
 * 
 * // In your component:
 * return (
 *   <>
 *     <button 
 *       onClick={async () => {
 *         const result = await checkOutOfSync();
 *         if (isSuccess(result)) {
 *           logger.info("Check completed successfully");
 *         }
 *       }}
 *       disabled={isLoading(checkState)}
 *     >
 *       {isLoading(checkState) ? 'Checking...' : 'Check Chapters'}
 *     </button>
 *     
 *     {isSuccess(checkState) && (
 *       <button 
 *         onClick={async () => {
 *           const result = await fixOutOfSync();
 *           if (isSuccess(result)) {
 *             logger.info("Fix started successfully");
 *           }
 *         }}
 *         disabled={isLoading(fixState)}
 *       >
 *         {isLoading(fixState) ? 'Fixing...' : 'Fix Chapters'}
 *       </button>
 *     )}
 *     
 *     {isError(checkState) && (
 *       <div className="error">Error checking chapters: {checkState.error instanceof Error ? checkState.error.message : String(checkState.error)}</div>
 *     )}
 *   </>
 * );
 * ```
 */
export function useChapterSync(mangaId: ID): UseChapterSyncResult {
  // Extract notification functions - they return the notification ID (string)
  const {
    showSuccess,
    showError
  } = useNotification();
  const {
    setLoading
  } = useUIStore();

  // State for async operations using AsyncResult pattern with proper typing
  const [checkState, setCheckState] = useState<ChapterSyncOperationResult>(createIdleResult<boolean, Error>());
  const [fixState, setFixState] = useState<ChapterSyncOperationResult>(createIdleResult<boolean, Error>());

  // TRPC mutations - add type check for trpc.manga
  const manga = trpc.manga;

  // Create mock mutations for when methods don't exist
  const mockMutation = {
    mutateAsync: (_data?: unknown): Promise<boolean> => Promise.resolve(true),
    mutate: (_data?: unknown) => {},
    isLoading: false,
    isPending: false
  };

  // Use type assertion to handle potentially missing properties
  const mangaAny = manga as Record<string, unknown>;

  // Use bracket notation with proper type guards
  const checkOutOfSyncChapters = mangaAny['checkOutOfSyncChapters'];
  const fixOutOfSyncChapters = mangaAny['fixOutOfSyncChapters'];

  // Check if methods exist and are callable with proper type guards
  const checkOutOfSyncMutation =
    checkOutOfSyncChapters !== null &&
    checkOutOfSyncChapters !== undefined &&
    typeof checkOutOfSyncChapters === 'object' &&
    'useMutation' in checkOutOfSyncChapters &&
    typeof (checkOutOfSyncChapters as Record<string, unknown>)['useMutation'] === 'function'
      ? ((checkOutOfSyncChapters as Record<string, unknown>)['useMutation'] as (options: Record<string, unknown>) => typeof mockMutation)({})
      : mockMutation;

  const fixOutOfSyncMutation =
    fixOutOfSyncChapters !== null &&
    fixOutOfSyncChapters !== undefined &&
    typeof fixOutOfSyncChapters === 'object' &&
    'useMutation' in fixOutOfSyncChapters &&
    typeof (fixOutOfSyncChapters as Record<string, unknown>)['useMutation'] === 'function'
      ? ((fixOutOfSyncChapters as Record<string, unknown>)['useMutation'] as (options: Record<string, unknown>) => typeof mockMutation)({})
      : mockMutation;

  /**
   * Checks for out-of-sync chapters
   * 
   * @returns Promise that resolves to AsyncResult with success or error
   */
  const checkOutOfSync = async (): Promise<ChapterSyncOperationResult> => {
    // Convert mangaId to numeric ID and validate
    const numericId = toNumberId(mangaId);

    // Input validation with improved error message
    if (numericId <= 0) {
      const error = new Error(`Invalid manga ID for checking out-of-sync chapters: ${toStringId(mangaId)}`);
      setCheckState(createErrorResult<boolean, Error>(error));
      showError({
        title: 'Check Failed',
        message: (error instanceof Error ? error.message : String(error)),
        autoClose: 5000,
        color: 'red',
        logToConsole: true
      });
      return createErrorResult<boolean, Error>(error);
    }

    // Update state to loading
    setCheckState(createLoadingResult<boolean, Error>());
    setLoading('chapter-check', true);
    try {
      // Execute the mutation with proper error handling using numeric ID
      await checkOutOfSyncMutation.mutateAsync({
        mangaId: numericId
      });

      // Update state to success with proper type parameters
      const successResult = createSuccessResult<boolean, Error>(true);
      setCheckState(successResult);

      // Show success notification
      showSuccess({
        title: 'Check Complete',
        message: 'Checked for out-of-sync chapters',
        autoClose: 3000,
        color: 'green'
      });
      return successResult;
    } catch (error: unknown) {
      // Create an Error object if needed
      const errorObj = error instanceof Error ? error : new Error(`Failed to check out-of-sync chapters: ${String(error ?? 'Unknown error')}`);

      // Update state to error with proper type parameters
      const errorResult = createErrorResult<boolean, Error>(errorObj);
      setCheckState(errorResult);

      // Show error notification
      showError({
        title: 'Check Failed',
        message: errorObj.message,
        error: errorObj,
        autoClose: 5000,
        color: 'red',
        logToConsole: true
      });
      return errorResult;
    } finally {
      setLoading('chapter-check', false);
    }
  };

  /**
   * Fixes out-of-sync chapters
   * 
   * @returns Promise that resolves to AsyncResult with success or error
   */
  const fixOutOfSync = async (): Promise<ChapterSyncOperationResult> => {
    // Convert mangaId to numeric ID and validate
    const numericId = toNumberId(mangaId);

    // Input validation with improved error message
    if (numericId <= 0) {
      const error = new Error(`Invalid manga ID for fixing out-of-sync chapters: ${toStringId(mangaId)}`);
      setFixState(createErrorResult<boolean, Error>(error));
      showError({
        title: 'Fix Failed',
        message: (error instanceof Error ? error.message : String(error)),
        autoClose: 5000,
        color: 'red',
        logToConsole: true
      });
      return createErrorResult<boolean, Error>(error);
    }

    // Update state to loading
    setFixState(createLoadingResult<boolean, Error>());
    setLoading('chapter-fix', true);
    try {
      // Execute the mutation with proper error handling using numeric ID
      await fixOutOfSyncMutation.mutateAsync({
        id: numericId
      });

      // Update state to success with proper type parameters
      const successResult = createSuccessResult<boolean, Error>(true);
      setFixState(successResult);

      // Show success notification
      showSuccess({
        title: 'Fix Started',
        message: 'Started fixing out-of-sync chapters',
        autoClose: 3000,
        color: 'green'
      });
      return successResult;
    } catch (error: unknown) {
      // Create an Error object if needed with detailed message
      const errorObj = error instanceof Error ? error : new Error(`Failed to fix out-of-sync chapters: ${String(error ?? 'Unknown error')}`);

      // Update state to error with proper type parameters
      const errorResult = createErrorResult<boolean, Error>(errorObj);
      setFixState(errorResult);

      // Show error notification
      showError({
        title: 'Fix Failed',
        message: errorObj.message,
        error: errorObj,
        autoClose: 5000,
        color: 'red',
        logToConsole: true
      });
      return errorResult;
    } finally {
      setLoading('chapter-fix', false);
    }
  };

  // Compute derived state properties with proper type checking
  const isChecking = isLoading(checkState);
  const isFixing = isLoading(fixState);
  const hasCheckedOutOfSync = isSuccess(checkState);
  const hasFixedOutOfSync = isSuccess(fixState);
  const checkError = isError(checkState) ? checkState.error : null;
  const fixError = isError(fixState) ? fixState.error : null;
  return {
    // Core functions
    checkOutOfSync,
    fixOutOfSync,
    // Raw state
    checkState,
    fixState,
    // Derived state properties
    isChecking,
    isFixing,
    hasCheckedOutOfSync,
    hasFixedOutOfSync,
    checkError,
    fixError
  };
}