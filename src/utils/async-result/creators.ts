/**
 * AsyncResult Creator Functions
 *
 * Factory functions for creating AsyncResult instances in different states.
 *
 * @module async-result/creators
 */

import type { AsyncResult, ContextualError } from './types';

/**
 * Create a new idle async result
 *
 * @template T - The expected data type
 * @template E - The error type
 * @returns An AsyncResult in the idle state
 */
export const createIdleResult = <T, E = Error>(): AsyncResult<T, E> => ({
  status: 'idle'
});

/**
 * Create a new loading async result
 *
 * @template T - The expected data type
 * @template E - The error type
 * @returns An AsyncResult in the loading state
 */
export const createLoadingResult = <T, E = Error>(): AsyncResult<T, E> => ({
  status: 'loading'
});

/**
 * Create a new success async result
 *
 * @template T - The expected data type
 * @template E - The error type
 * @param data - The successful result data
 * @returns An AsyncResult in the success state with the provided data
 */
export const createSuccessResult = <T, E = Error>(data: T): AsyncResult<T, E> => ({
  status: 'success',
  data
});

/**
 * Create a new error async result
 *
 * @template T - The expected data type
 * @template E - The error type
 * @param error - The error that occurred
 * @returns An AsyncResult in the error state with the provided error
 */
export const createErrorResult = <T, E = Error>(error: E): AsyncResult<T, E> => ({
  status: 'error',
  error
});

/**
 * Create a detailed contextual error
 *
 * @param message - Error message
 * @param code - Optional error code
 * @param context - Optional context information
 * @param originalError - Optional original error
 * @returns Contextual error object
 */
export function createContextualError(
  message: string,
  code?: string,
  context?: Record<string, unknown>,
  originalError?: Error
): ContextualError {
  const error = new Error(message) as ContextualError;
  if (code) {
    error.code = code;
  }
  if (context) {
    error.context = context;
  }
  if (originalError) {
    error.originalError = originalError;
  }
  return error;
}

/**
 * Creates a typed error for use with AsyncResult
 *
 * @template T - The expected data type
 * @template E - The error type (must extend Error)
 * @param message - The error message
 * @param cause - The original error that caused this error
 * @returns An error result with the specified error
 */
export function createTypedError<T, E extends Error>(
  message: string,
  cause?: unknown
): AsyncResult<T, E> {
  // Create error and set cause manually for ES2021 compatibility
  const baseError = new Error(message);
  if (cause !== undefined) {
    (baseError as Error & { cause?: unknown }).cause = cause;
  }
  // Cast to the expected error type
  const error = baseError as unknown as E;
  return createErrorResult<T, E>(error);
}

/**
 * Creates a contextual error creator function with pre-defined context
 *
 * @param defaultContext - Default context to include in all errors
 * @returns Function that creates contextual errors with the default context
 */
export function createContextualErrorCreator(
  defaultContext: Record<string, unknown>
): (
  message: string,
  code?: string,
  additionalContext?: Record<string, unknown>,
  originalError?: Error
) => ContextualError {
  return (
    message: string,
    code?: string,
    additionalContext?: Record<string, unknown>,
    originalError?: Error
  ): ContextualError => {
    return createContextualError(
      message,
      code,
      { ...defaultContext, ...additionalContext },
      originalError
    );
  };
}
