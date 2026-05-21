/**
 * Type Safety Utilities
 * 
 * This module provides utility functions for type-safe operations in TypeScript.
 * It includes helpers for handling common error patterns, AsyncResult operations,
 * and safe property access.
 * 
 * For basic type guards, import from /utils/type-guards directly.
 */

import {
  isSuccess,
  isError,
  isLoading,
  isIdle,
  createSuccessResult} from
'./async-result';
import { isObject } from './type-guards';

import type {
  AsyncResult} from './async-result';

/**
 * Safely unwraps AsyncResult data with type guard and default value
 * 
 * @param result - The AsyncResult to unwrap
 * @param defaultValue - The default value to return if not success
 * @returns The data from the result or the default value
 * 
 * @example
 * ```ts
 * // Instead of unsafe access: result.data (which may not exist)
 * const items = unwrapResultOr(result, []);
 * items.forEach(item => processItem(item)); // Safe array operations
 * ```
 */
export function unwrapResultOr<T, E = Error>(
result: AsyncResult<T, E>,
defaultValue: T)
: T {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Safely process arrays from AsyncResult with fallback
 * 
 * @param result - The AsyncResult containing an array
 * @param fallback - The fallback value if result is not success or not an array
 * @returns The array data or fallback
 * 
 * @example
 * ```ts
 * // Instead of unsafe operations: result.data.map(...)
 * const processedItems = getArrayResultOr(result, [])
 *   .map(item => processItem(item));
 * ```
 */
export function getArrayResultOr<T, E = Error>(
result: AsyncResult<T[], E>,
fallback: T[] = [])
: T[] {
  if (!isSuccess(result)) {
    return fallback;
  }

  if (!Array.isArray(result.data)) {
    return fallback;
  }

  return result.data;
}

/**
 * Safely extracts properties from objects with type checking
 * 
 * @param obj - The object to extract properties from
 * @param key - The key to extract
 * @param defaultValue - Default value if property doesn't exist or is wrong type
 * @returns The property value or default value
 * 
 * @example
 * ```ts
 * // Instead of unsafe access: obj.prop (which may be undefined)
 * const name = getProperty(user, 'name', 'Unknown User');
 * const age = getProperty(user, 'age', 0, isNumber);
 * ```
 */
export function getProperty<T, K extends string, V>(
obj: T,
key: K,
defaultValue: V,
validator?: (value: unknown) => boolean)
: V {
  if (!isObject(obj)) {
    return defaultValue;
  }

  const objRecord = obj as Record<string, unknown>;

  if (!(key in objRecord)) {
    return defaultValue;
  }

  const value = objRecord[key];

  if (validator && !validator(value)) {
    return defaultValue;
  }

  return value as V;
}

/**
 * Type-safe way to access nested properties
 * 
 * @param obj - The object to access
 * @param path - The property path (e.g., 'user.profile["name"]')
 * @param defaultValue - Default value if path doesn't exist
 * @returns The value at the path or default value
 * 
 * @example
 * ```ts
 * const name = getNestedProperty(user, 'profile["name"]', 'Unknown');
 * ```
 */
export function getNestedProperty<T = unknown>(
obj: unknown,
path: string,
defaultValue: T)
: T {
  if (!isObject(obj)) {
    return defaultValue;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current as T;
}

/**
 * Safely applies a function to an AsyncResult's data if it's successful
 * 
 * @param result - The AsyncResult to process
 * @param fn - The function to apply to the data
 * @param defaultValue - Default value if not success
 * @returns The processed data or default value
 * 
 * @example
 * ```ts
 * // Instead of unsafe operations:
 * // const processedData = isSuccess(result) ? processData(result.data) : defaultValue;
 * const processedData = mapResultOr(result, processData, defaultValue);
 * ```
 */
export function mapResultOr<T, U, E = Error>(
result: AsyncResult<T, E>,
fn: (data: T) => U,
defaultValue: U)
: U {
  return isSuccess(result) ? fn(result.data) : defaultValue;
}

/**
 * Safely filter items in an AsyncResult array
 * 
 * @param result - The AsyncResult containing an array
 * @param predicate - The filter function
 * @returns A new AsyncResult with filtered array or the original error
 * 
 * @example
 * ```ts
 * // Instead of unsafe operations:
 * // const filtered = unwrapOr(filterAsyncResult(result, predicate), []);
 * const filteredResult = filterResult(result, item => item.active);
 * ```
 */
export function filterResult<T, E = Error>(
result: AsyncResult<T[], E>,
predicate: (item: T) => boolean)
: AsyncResult<T[], E> {
  if (!isSuccess(result)) {
    return result;
  }

  return createSuccessResult(result.data.filter(predicate));
}

/**
 * Safely map items in an AsyncResult array
 * 
 * @param result - The AsyncResult containing an array
 * @param mapper - The mapping function
 * @returns A new AsyncResult with mapped array or the original error
 * 
 * @example
 * ```ts
 * // Instead of unsafe operations:
 * // const mapped = isSuccess(result) ? result.data.map(mapper) : [];
 * const mappedResult = mapResult(result, item => processItem(item));
 * ```
 */
export function mapResult<T, U, E = Error>(
result: AsyncResult<T[], E>,
mapper: (item: T) => U)
: AsyncResult<U[], E> {
  if (!isSuccess(result)) {
    return result;
  }

  return createSuccessResult(result.data.map(mapper));
}

/**
 * Chain multiple AsyncResult operations safely
 * 
 * @param result - The initial AsyncResult
 * @param operations - Array of operations to apply
 * @returns The final AsyncResult after all operations
 * 
 * @example
 * ```ts
 * const result = chainResults(
 *   fetchData(),
 *   [
 *     data => processData(data),
 *     processed => validateData(processed),
 *     validated => saveData(validated)
 *   ]
 * );
 * ```
 */
export async function chainResults<T, E = Error>(
result: AsyncResult<T, E> | Promise<AsyncResult<T, E>>,
operations: Array<(data: T) => AsyncResult<T, E> | Promise<AsyncResult<T, E>>>)
: Promise<AsyncResult<T, E>> {
  let current = await result;

  for (const operation of operations) {
    if (!isSuccess(current)) {
      return current;
    }

    // Sequential execution is intentional - each operation depends on the previous result
    // eslint-disable-next-line no-await-in-loop
    current = await operation(current.data);
  }

  return current;
}

/**
 * Combines multiple AsyncResults, failing if any are errors
 * 
 * @param results - Array of AsyncResults to combine
 * @returns A single AsyncResult with all data or the first error
 * 
 * @example
 * ```ts
 * const combined = combineResults([
 *   fetchUser(),
 *   fetchSettings(),
 *   fetchPermissions()
 * ]);
 * ```
 */
export function combineResults<T, E = Error>(
results: AsyncResult<T, E>[])
: AsyncResult<T[], E> {
  const errors = results.filter(isError);
  if (errors.length > 0) {
    const firstError = errors[0];
    if (firstError !== undefined) {
      return firstError;
    }
  }

  const pending = results.filter(isLoading);
  if (pending.length > 0) {
    const firstPending = pending[0];
    if (firstPending !== undefined) {
      return firstPending;
    }
  }

  const idle = results.filter(isIdle);
  if (idle.length > 0) {
    const firstIdle = idle[0];
    if (firstIdle !== undefined) {
      return firstIdle;
    }
  }

  // All must be success at this point
  const data = results.
  filter(isSuccess).
  map((r) => r.data);

  return createSuccessResult(data);
}