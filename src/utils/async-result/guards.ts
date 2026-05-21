/**
 * AsyncResult Type Guards
 *
 * Type guard functions for checking AsyncResult states.
 * These narrow the type to allow safe access to state-specific properties.
 *
 * @module async-result/guards
 */

import type { AsyncResult } from './types';

/**
 * Check if an async result is in the idle state
 */
export const isIdle = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'idle';
} => result['status'] === 'idle';

/**
 * Check if an async result is in the loading state
 */
export const isLoading = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'loading';
} => result['status'] === 'loading';

/**
 * Check if an async result is in the success state
 */
export const isSuccess = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'success';
  data: T;
} => result['status'] === 'success';

/**
 * Check if an async result is in the error state
 */
export const isError = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'error';
  error: E;
} => result['status'] === 'error';

/**
 * Type guard to check if an AsyncResult is of a specific subtype
 *
 * @template T - The data type
 * @template S - The specific subtype to check for
 * @template E - The error type
 * @param result - The AsyncResult to check
 * @param typeGuard - Function to check if data is of subtype S
 * @returns True if result is a success with data of type S
 */
export function isSuccessWithType<T, S extends T, E = Error>(
  result: AsyncResult<T, E>,
  typeGuard: (data: T) => data is S
): result is AsyncResult<S, E> & { status: 'success'; data: S } {
  return isSuccess(result) && typeGuard(result.data);
}
