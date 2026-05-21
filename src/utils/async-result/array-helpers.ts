/**
 * AsyncResult Array Helpers
 *
 * Specialized functions for working with AsyncResult containing arrays.
 *
 * @module async-result/array-helpers
 */

import { createSuccessResult } from './creators';
import { isSuccess } from './guards';
import { mapAsyncResult } from './mappers';

import type { AsyncResult } from './types';

/**
 * Helper for safe filtering of AsyncResult array data
 *
 * @template T - The array item type
 * @template E - The error type
 * @param result - AsyncResult containing array data
 * @param filterFn - Function to filter the array items
 * @returns A new AsyncResult with filtered array
 */
export function filterAsyncResult<T, E = Error>(
  result: AsyncResult<T[], E>,
  filterFn: (item: T) => boolean
): AsyncResult<T[], E> {
  return mapAsyncResult(result, (data) => {
    if (!Array.isArray(data)) {
      return [] as T[];
    }
    return data.filter(filterFn);
  });
}

/**
 * Helper for map operations on AsyncResult array data
 *
 * Provides a type-safe way to map over AsyncResult data as if it were an array.
 * This prevents the common error of trying to call .map() directly on an AsyncResult.
 *
 * @template T - The original array item type
 * @template U - The mapped array item type
 * @template E - The error type
 * @param result - AsyncResult containing array data
 * @param mapFn - Function to map each array item
 * @returns A new AsyncResult with mapped array
 */
export function mapAsyncResultArray<T, U, E = Error>(
  result: AsyncResult<T[], E>,
  mapFn: (item: T, index: number, array: T[]) => U
): AsyncResult<U[], E> {
  return mapAsyncResult(result, (data) => {
    if (!Array.isArray(data)) {
      return [] as U[];
    }
    return data.map(mapFn);
  });
}

/**
 * Helper for finding an item in AsyncResult array data
 *
 * @template T - The array item type
 * @template E - The error type
 * @param result - AsyncResult containing array data
 * @param findFn - Function to find an item in the array
 * @returns The found item or undefined
 */
export function findInAsyncResult<T, E = Error>(
  result: AsyncResult<T[], E>,
  findFn: (item: T) => boolean
): T | undefined {
  if (!isSuccess(result) || !Array.isArray(result.data)) {
    return undefined;
  }
  return result.data.find(findFn);
}

/**
 * Filters successful AsyncResults and extracts their data
 *
 * @template T - The data type
 * @template E - The error type
 * @param results - Array of AsyncResults
 * @returns Array of successful result data
 */
export function filterSuccessResults<T, E = Error>(results: AsyncResult<T, E>[]): T[] {
  return results
    .filter(
      (result): result is AsyncResult<T, E> & {
        status: 'success';
        data: T;
      } => isSuccess(result)
    )
    .map((result) => result.data);
}

/**
 * Creates a type-safe reducer function for array data in AsyncResult
 *
 * @template T - The array item type
 * @template A - The accumulator type
 * @template E - The error type
 * @param result - The AsyncResult containing array data
 * @param reducerFn - The reducer function to apply
 * @param initialValue - Initial accumulator value
 * @returns The reduced value or initial value
 */
export function reduceAsyncResult<T, A, E = Error>(
  result: AsyncResult<T[], E>,
  reducerFn: (accumulator: A, item: T, index: number, array: T[]) => A,
  initialValue: A
): A {
  if (!isSuccess(result) || !Array.isArray(result.data)) {
    return initialValue;
  }
  return result.data.reduce(reducerFn, initialValue);
}

/**
 * Safely validates and maps array items from AsyncResult
 *
 * @template T - The validated item type
 * @template U - The mapped item type
 * @template E - The error type
 * @param result - The AsyncResult containing array data
 * @param itemValidator - Function to validate array items
 * @param mapFn - Function to map valid items
 * @param defaultValue - Default value if result is not success
 * @returns Mapped array or default value
 */
export function validateAndMapArray<T, U, E = Error>(
  result: AsyncResult<unknown[], E>,
  itemValidator: (item: unknown) => item is T,
  mapFn: (item: T) => U,
  defaultValue: U[] = []
): U[] {
  if (!isSuccess(result)) {
    return defaultValue;
  }
  if (!Array.isArray(result.data)) {
    return defaultValue;
  }
  return result.data.filter(itemValidator).map(mapFn);
}

/**
 * Transforms an array of items into an array of success results
 *
 * @template T - The item type
 * @template E - The error type
 * @param items - Array of items to transform
 * @returns Array of success results
 */
export function arrayToSuccessResults<T, E = Error>(items: T[]): AsyncResult<T, E>[] {
  return items.map((item) => createSuccessResult<T, E>(item));
}
