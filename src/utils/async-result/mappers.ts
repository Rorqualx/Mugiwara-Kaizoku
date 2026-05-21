/**
 * AsyncResult Mappers
 *
 * Functions for transforming AsyncResult data and errors.
 *
 * @module async-result/mappers
 */

import {
  createSuccessResult,
  createErrorResult,
  createLoadingResult,
  createIdleResult
} from './creators';
import { toErrorType } from './error-utils';
import { isSuccess, isError, isLoading } from './guards';

import type { AsyncResult } from './types';

/**
 * Maps over the data of a successful AsyncResult
 *
 * This function provides a safe way to apply mapping operations
 * to AsyncResult data without risking property access on non-success states.
 *
 * @template T - The original data type
 * @template U - The mapped data type
 * @template E - The error type
 * @param result - The AsyncResult to map
 * @param mapFn - Function to map the data if result is successful
 * @returns A new AsyncResult with mapped data (or the original error/loading/idle state)
 */
export function mapAsyncResult<T, U, E = Error>(
  result: AsyncResult<T, E>,
  mapFn: (data: T) => U
): AsyncResult<U, E> {
  if (isSuccess(result)) {
    try {
      return createSuccessResult<U, E>(mapFn(result.data));
    } catch (error: unknown) {
      // Handle errors in the mapping function
      return createErrorResult<U, E>(
        toErrorType<E>(error, `Error in mapAsyncResult: ${String(error)}`)
      );
    }
  }
  // Preserve other result states
  if (isError(result)) {
    return createErrorResult<U, E>(result.error);
  }
  if (isLoading(result)) {
    return createLoadingResult<U, E>();
  }
  // Default to idle
  return createIdleResult<U, E>();
}

/**
 * Maps the data of a successful AsyncResult
 *
 * @template T - The original data type
 * @template U - The mapped data type
 * @template E - The error type
 * @param result - The async result to map
 * @param mapFn - The mapping function
 * @returns A new AsyncResult with mapped data (or the original error/loading state)
 */
export function mapResult<T, U, E = Error>(
  result: AsyncResult<T, E>,
  mapFn: (data: T) => U
): AsyncResult<U, E> {
  if (isSuccess(result)) {
    try {
      return createSuccessResult<U, E>(mapFn(result.data));
    } catch (error: unknown) {
      return createErrorResult<U, E>(toErrorType<E>(error));
    }
  }
  if (isError(result)) {
    return createErrorResult<U, E>(result.error);
  }
  if (isLoading(result)) {
    return createLoadingResult<U, E>();
  }
  return createIdleResult<U, E>();
}

/**
 * Maps the data of a successful AsyncResult asynchronously
 *
 * @template T - The original data type
 * @template U - The mapped data type
 * @template E - The error type
 * @param result - The async result to map
 * @param mapFn - The async mapping function
 * @returns Promise resolving to a new AsyncResult with mapped data
 */
export async function mapResultAsync<T, U, E = Error>(
  result: AsyncResult<T, E>,
  mapFn: (data: T) => Promise<U>
): Promise<AsyncResult<U, E>> {
  if (isSuccess(result)) {
    try {
      const mappedData = await mapFn(result.data);
      return createSuccessResult<U, E>(mappedData);
    } catch (error: unknown) {
      return createErrorResult<U, E>(toErrorType<E>(error));
    }
  }
  if (isError(result)) {
    return createErrorResult<U, E>(result.error);
  }
  if (isLoading(result)) {
    return createLoadingResult<U, E>();
  }
  return createIdleResult<U, E>();
}

/**
 * Transforms an AsyncResult to have a fallback error handler
 *
 * @template T - The data type
 * @template E - The original error type
 * @template F - The new error type
 * @param result - Original AsyncResult
 * @param errorHandler - Function to handle errors
 * @returns AsyncResult with transformed error handling
 */
export function withFallbackError<T, E = Error, F = Error>(
  result: AsyncResult<T, E>,
  errorHandler: (error: E) => F
): AsyncResult<T, F> {
  if (isError(result)) {
    return createErrorResult<T, F>(errorHandler(result.error));
  }
  // Safe conversion for success/loading/idle states
  if (isSuccess(result)) {
    return createSuccessResult<T, F>(result.data);
  }
  if (isLoading(result)) {
    return createLoadingResult<T, F>();
  }
  return createIdleResult<T, F>();
}

/**
 * Transforms an error in an AsyncResult
 *
 * @template T - The data type
 * @template E1 - The original error type
 * @template E2 - The new error type
 * @param result - The AsyncResult to transform
 * @param transformFn - Function to transform the error
 * @returns A new AsyncResult with the transformed error
 */
export function mapError<T, E1 = Error, E2 = Error>(
  result: AsyncResult<T, E1>,
  transformFn: (error: E1) => E2
): AsyncResult<T, E2> {
  if (isError(result)) {
    return createErrorResult<T, E2>(transformFn(result.error));
  }
  if (isSuccess(result)) {
    return createSuccessResult<T, E2>(result.data);
  }
  if (isLoading(result)) {
    return createLoadingResult<T, E2>();
  }
  return createIdleResult<T, E2>();
}
