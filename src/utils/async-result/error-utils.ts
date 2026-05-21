/**
 * AsyncResult Error Utilities
 *
 * Utilities for error handling, conversion, and enhanced error context.
 * This is a foundational module - creators.ts depends on toErrorType from here.
 *
 * @module async-result/error-utils
 */

import type { AsyncResult, ContextualError } from './types';

/**
 * Safely converts an unknown error to a specific error type
 *
 * This utility provides type-safe error conversion without unsafe type assertions.
 * It handles the common pattern of catching unknown errors and converting them
 * to a specific error type E.
 *
 * @template E - The target error type
 * @param error - The error to convert (unknown type)
 * @param fallbackMessage - Optional message to use if error cannot be converted
 * @returns The error converted to type E
 */
export function toErrorType<E = Error>(error: unknown, fallbackMessage?: string): E {
  // If error is already an Error instance, cast it
  if (error instanceof Error) {
    return error as unknown as E;
  }

  // Convert non-Error values to Error
  const message = fallbackMessage ?? String(error);
  return new Error(message) as unknown as E;
}

/**
 * Executes an async function with enhanced error handling
 *
 * This wrapper function executes an async operation and ensures all errors
 * are converted to ContextualErrors with additional context information.
 * It handles both errors returned in the AsyncResult and unexpected thrown errors.
 *
 * Note: This function uses late imports to avoid circular dependencies with creators.ts
 *
 * @template T - The expected data type
 * @param fn - Async function to execute that returns an AsyncResult
 * @param errorContext - Context to add to any errors
 * @returns Promise resolving to AsyncResult with ContextualError
 */
export async function withEnhancedErrorHandling<T>(
  fn: () => Promise<AsyncResult<T, Error>>,
  errorContext: Record<string, unknown> = {}
): Promise<AsyncResult<T, ContextualError>> {
  // Late import to avoid circular dependency
  const { isError, isSuccess, isLoading } = await import('./guards');
  const {
    createSuccessResult,
    createErrorResult,
    createLoadingResult,
    createIdleResult,
    createContextualError
  } = await import('./creators');

  try {
    const result = await fn();

    if (isError(result)) {
      // Convert regular Error to ContextualError
      return createErrorResult<T, ContextualError>(
        createContextualError(
          result.error instanceof Error ? result.error.message : String(result.error),
          undefined,
          errorContext,
          result.error
        )
      );
    }

    // Safe conversion for success/loading/idle states
    if (isSuccess(result)) {
      return createSuccessResult<T, ContextualError>(result.data);
    }

    if (isLoading(result)) {
      return createLoadingResult<T, ContextualError>();
    }

    return createIdleResult<T, ContextualError>();
  } catch (error: unknown) {
    // Handle unexpected errors
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResult<T, ContextualError>(
      createContextualError(
        message,
        'UNEXPECTED_ERROR',
        errorContext,
        error instanceof Error ? error : undefined
      )
    );
  }
}
