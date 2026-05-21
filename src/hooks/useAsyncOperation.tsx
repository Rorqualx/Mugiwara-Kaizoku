/**
 * Shared hook for async operations with state management
 * 
 * This hook consolidates duplicate code found across multiple hooks
 * for handling async operations with AsyncResult state management
 * and optional notifications.
 */

import React, { useState, useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import {
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  isLoading } from
'../utils/async-result';

import type {
  AsyncResult} from '../utils/async-result';

export interface UseAsyncOperationOptions {
  /**
   * Success message to show when operation completes
   */
  successMessage?: string;

  /**
   * Error message to show when operation fails
   */
  errorMessage?: string;

  /**
   * Whether to show notifications (default: true)
   */
  showNotifications?: boolean;

  /**
   * Title for success notification
   */
  successTitle?: string;

  /**
   * Title for error notification
   */
  errorTitle?: string;
}

/**
 * Hook for managing async operations with consistent state and notification handling
 * 
 * @param operation The async operation to execute
 * @param options Configuration options for notifications and messages
 * @returns Object containing state, execute function, and loading status
 * 
 * @example
 * ```typescript
 * const updateManga = useAsyncOperation(
 *   async (id: string, data: UpdateData) => {
 *     return await api.updateManga(id, data);
 *   },
 *   {
 *     successMessage: 'Manga updated successfully',
 *     errorMessage: 'Failed to update manga'
 *   }
 * );
 * 
 * // Execute the operation
 * const result = await updateManga.execute(mangaId, updateData);
 * ```
 */
export function useAsyncOperation<T, P extends unknown[]>(
operation: (...args: P) => Promise<T>,
options?: UseAsyncOperationOptions): {
  state: AsyncResult<T, Error>;
  execute: (...args: P) => Promise<AsyncResult<T, Error>>;
  isLoading: boolean;
  reset: () => void;
}
{
  const [state, setState] = useState<AsyncResult<T, Error>>(createIdleResult());

  const showSuccess = useCallback((message: string, title: string = 'Success'): void => {
    if (options?.showNotifications !== false) {
      notifications.show({
        title,
        message,
        color: 'green',
        icon: <IconCheck size={18} />
      });
    }
  }, [options?.showNotifications]);

  const showError = useCallback((message: string, title: string = 'Error'): void => {
    if (options?.showNotifications !== false) {
      notifications.show({
        title,
        message,
        color: 'red',
        icon: <IconX size={18} />
      });
    }
  }, [options?.showNotifications]);

  const execute = useCallback(async (...args: P): Promise<AsyncResult<T, Error>> => {
    setState(createLoadingResult());

    try {
      const result = await operation(...args);
      setState(createSuccessResult(result));

      if (options?.showNotifications !== false && options?.successMessage) {
        showSuccess(
          options.successMessage,
          options.successTitle ?? 'Success'
        );
      }

      return createSuccessResult(result);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(createErrorResult(err));

      if (options?.showNotifications !== false) {
        showError(
          options?.errorMessage ?? (error instanceof Error ? error.message : String(error)),
          options?.errorTitle ?? 'Error'
        );
      }

      return createErrorResult(err);
    }
  }, [operation, options, showSuccess, showError]);

  const reset = useCallback((): void => {
    setState(createIdleResult());
  }, []);

  return {
    state,
    execute,
    isLoading: isLoading(state),
    reset
  };
}

/**
 * Helper function to wrap a promise with AsyncResult handling
 * This is used to convert standard promises to AsyncResult pattern
 * 
 * @param asyncFn The async function to wrap
 * @param errorMessage Default error message if the promise rejects
 * @returns AsyncResult containing the data or error
 * 
 * @example
 * ```typescript
 * const result = await fromPromiseCatch(
 *   () => api.fetchData(),
 *   'Failed to fetch data'
 * );
 * ```
 */
export async function fromPromiseCatch<T>(
asyncFn: () => Promise<T>): Promise<AsyncResult<T, Error>> {
  try {
    const result = await asyncFn();
    return createSuccessResult(result);
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ?
      error :
      new Error(`${(error instanceof Error ? error.message : String(error))}: ${String(error)}`)
    );
  }
}

/**
 * Helper function to execute an operation with loading state management
 * Useful for simple one-off operations that don't need full hook state
 * 
 * @param operation The operation to execute
 * @param setLoading Optional loading state setter
 * @param onSuccess Optional success callback
 * @param onError Optional error callback
 * @returns AsyncResult containing the data or error
 * 
 * @example
 * ```typescript
 * const result = await withAsyncOperation(
 *   () => api.updateData(id, data),
 *   setLoading,
 *   (data) => logger.info('Success:', data),
 *   (error) => console.error('Error:', error)
 * );
 * ```
 */
export async function withAsyncOperation<T>(
operation: () => Promise<T>,
setLoading?: (loading: boolean) => void,
onSuccess?: (data: T) => void,
onError?: (error: Error) => void): Promise<AsyncResult<T, Error>> {
  try {
    setLoading?.(true);
    const result = await operation();
    onSuccess?.(result);
    return createSuccessResult(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    return createErrorResult(err);
  } finally {
    setLoading?.(false);
  }
}