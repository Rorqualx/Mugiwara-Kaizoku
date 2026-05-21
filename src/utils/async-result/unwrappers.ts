/**
 * AsyncResult Unwrappers
 *
 * Functions for safely extracting data from AsyncResult instances.
 *
 * @module async-result/unwrappers
 */

import { isSuccess, isError } from './guards';

import type { AsyncResult, AsyncResultStatus } from './types';

/**
 * Unwraps the data from an AsyncResult, or returns a default value if not successful
 *
 * @param result - The async result to unwrap
 * @param defaultValue - The default value to return if not successful
 * @returns The data or default value
 */
export function unwrapOr<T, E = Error>(result: AsyncResult<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Get data from AsyncResult or return default value
 * Alias for unwrapOr with backward compatibility
 *
 * @param result - The AsyncResult to extract data from
 * @param defaultValue - Default value to return if result is not in success state
 * @returns The data or default value
 */
export function getDataOr<T, E = Error, D = T>(result: AsyncResult<T, E>, defaultValue: D): T | D {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Safely extracts data from an AsyncResult, providing a default value if not successful
 *
 * @param result - The AsyncResult to extract data from
 * @param defaultValue - Default value to return if result is not in success state
 * @returns The data or default value
 * @deprecated Use unwrapOr instead
 */
export function getDataOrDefault<T, E = Error>(result: AsyncResult<T, E>, defaultValue: T): T {
  return unwrapOr(result, defaultValue);
}

/**
 * Safely extracts array data from an AsyncResult, ensuring it's valid
 *
 * @param result - The AsyncResult potentially containing an array
 * @param defaultValue - Default array to return if not success or data is not an array
 * @returns The array data or default
 */
export function getArrayData<T, E = Error>(
  result: AsyncResult<T[], E>,
  defaultValue: T[] = []
): T[] {
  if (!isSuccess(result)) {
    return defaultValue;
  }
  if (!Array.isArray(result.data)) {
    return defaultValue;
  }
  return result.data;
}

/**
 * Safely extracts a property from an AsyncResult's data object
 *
 * @param result - The AsyncResult to extract property from
 * @param property - The property key to extract
 * @param defaultValue - Default value if result is not success or property doesn't exist
 * @returns The property value or default value
 */
export function getProperty<T, K extends keyof T, E = Error>(
  result: AsyncResult<T, E>,
  property: K,
  defaultValue: T[K]
): T[K] {
  if (isSuccess(result)) {
    return result.data[property] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Safely retrieves a property from an object in an AsyncResult
 *
 * @param result - The AsyncResult containing an object
 * @param propName - Property name to access
 * @param defaultValue - Default value if property is not found
 * @returns The property value or default
 */
export function getNestedProperty<T, K extends string, V, E = Error>(
  result: AsyncResult<T, E>,
  propName: K,
  defaultValue: V
): V {
  if (!isSuccess(result)) {
    return defaultValue;
  }
  const data = result.data as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof data !== 'object' || data === null) {
    return defaultValue;
  }
  if (!(propName in data)) {
    return defaultValue;
  }
  const value = data[propName] as V;
  return value ?? defaultValue;
}

/**
 * Returns the current status of an AsyncResult
 *
 * @param result - The AsyncResult to check
 * @returns The status string
 */
export function getAsyncResultStatus<T, E = Error>(result: AsyncResult<T, E>): AsyncResultStatus {
  return result.status;
}

/**
 * Safe accessor for AsyncResult data
 * Returns undefined if not in success state
 *
 * @param result - The AsyncResult to extract data from
 * @returns The data or undefined
 */
export function safeGetData<T, E = Error>(result: AsyncResult<T, E>): T | undefined {
  return isSuccess(result) ? result.data : undefined;
}

/**
 * Safe accessor for AsyncResult error
 * Returns undefined if not in error state
 *
 * @param result - The AsyncResult to extract error from
 * @returns The error or undefined
 */
export function safeGetError<T, E = Error>(result: AsyncResult<T, E>): E | undefined {
  return isError(result) ? result.error : undefined;
}

/**
 * Safely extracts the error from an AsyncResult, or returns a default error
 *
 * @template T - The expected data type
 * @template E - The error type
 * @template D - The default error type
 * @param result - The AsyncResult to extract error from
 * @param defaultError - The default error to return if result is not error
 * @returns The actual error or default error
 */
export function getErrorOr<T, E = Error, D = E>(
  result: AsyncResult<T, E>,
  defaultError: D
): E | D {
  return isError(result) ? result.error : defaultError;
}
