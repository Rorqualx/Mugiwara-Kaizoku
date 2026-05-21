/**
 * AsyncResult Handlers
 *
 * Functions for handling, validating, and executing operations with AsyncResults.
 * Provides pattern-matching style handlers and safe execution wrappers.
 *
 * @module async-result/handlers
 */

import { createSuccessResult, createErrorResult } from './creators';
import { toErrorType } from './error-utils';
import { isSuccess, isError, isLoading, isIdle } from './guards';

import type { AsyncResult } from './types';

/**
 * Safely executes a function with AsyncResult data if it's in success state
 *
 * @template T - The data type
 * @template E - The error type
 * @param result - The AsyncResult to work with
 * @param fn - Function to execute with the data
 * @returns void
 */
export function withSuccessData<T, E = Error>(
  result: AsyncResult<T, E>,
  fn: (data: T) => void
): void {
  if (isSuccess(result)) {
    fn(result.data);
  }
}

/**
 * Executes appropriate callback based on AsyncResult state
 *
 * @template T - The data type
 * @template E - The error type
 * @template R - The return type from handlers
 * @param result - The AsyncResult to handle
 * @param handlers - Object with callbacks for different states
 * @returns The return value from the executed handler, or undefined if no handler matches
 */
export function handleAsyncResult<T, E = Error, R = void>(
  result: AsyncResult<T, E>,
  handlers: {
    onSuccess?: (data: T) => R;
    onError?: (error: E) => R;
    onLoading?: () => R;
    onIdle?: () => R;
    onAny?: (result: AsyncResult<T, E>) => R;
  }
): R | undefined {
  if (handlers.onAny) {
    return handlers.onAny(result);
  }
  if (isSuccess(result) && handlers.onSuccess) {
    return handlers.onSuccess(result.data);
  }
  if (isError(result) && handlers.onError) {
    return handlers.onError(result.error);
  }
  if (isLoading(result) && handlers.onLoading) {
    return handlers.onLoading();
  }
  if (isIdle(result) && handlers.onIdle) {
    return handlers.onIdle();
  }
  return undefined;
}

/**
 * Applies a validation function to AsyncResult data
 *
 * Returns the validated data if successful and validation passes,
 * otherwise returns the default value.
 *
 * @template T - The original data type
 * @template S - The validated subtype (extends T)
 * @template E - The error type
 * @param result - The AsyncResult to validate
 * @param validator - Validation function that narrows the type
 * @param defaultValue - Default value if validation fails
 * @returns The validated data or default value
 */
export function validateData<T, S extends T, E = Error>(
  result: AsyncResult<T, E>,
  validator: (data: T) => data is S,
  defaultValue: S
): S {
  if (isSuccess(result) && validator(result.data)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Applies a validation function to a successful result's data
 *
 * Unlike validateData, this returns an AsyncResult, allowing you to
 * continue chaining operations or handling errors.
 *
 * @template T - The data type
 * @template E - The error type
 * @param result - The AsyncResult to validate
 * @param validationFn - Function that returns true if data is valid
 * @param errorMessage - The error message to use if validation fails
 * @returns The original result or an error if validation fails
 */
export function validateResult<T, E = Error>(
  result: AsyncResult<T, E>,
  validationFn: (data: T) => boolean,
  errorMessage: string = 'Validation failed'
): AsyncResult<T, E> {
  if (!isSuccess(result)) {
    return result;
  }
  if (!validationFn(result.data)) {
    return createErrorResult<T, E>(toErrorType<E>(new Error(errorMessage)));
  }
  return result;
}

/**
 * Performs a side effect with a successful result's data without changing the result
 *
 * Useful for logging, analytics, or other side effects that shouldn't
 * affect the result flow.
 *
 * @template T - The data type
 * @template E - The error type
 * @param result - The AsyncResult to tap into
 * @param fn - Function to execute with the data (side effect only)
 * @returns The original result unchanged
 */
export function tapResult<T, E = Error>(
  result: AsyncResult<T, E>,
  fn: (data: T) => void
): AsyncResult<T, E> {
  if (isSuccess(result)) {
    fn(result.data);
  }
  return result;
}

/**
 * Recovers from an error result with a fallback value
 *
 * If the result is in error state, replaces it with a success state
 * containing the fallback value. Loading and idle states are preserved.
 *
 * @template T - The data type
 * @template E - The error type
 * @param result - The AsyncResult to recover from
 * @param fallbackValue - The fallback value to use on error
 * @returns A success result with either the original data or fallback value
 */
export function recoverWithFallback<T, E = Error>(
  result: AsyncResult<T, E>,
  fallbackValue: T
): AsyncResult<T, E> {
  if (isSuccess(result)) {
    return result;
  }
  if (isError(result)) {
    return createSuccessResult<T, E>(fallbackValue);
  }
  return result; // Keep loading or idle state
}

/**
 * Attempts to execute a function and return its result as an AsyncResult
 *
 * Wraps synchronous operations in AsyncResult error handling.
 *
 * @template T - The expected return type
 * @template E - The error type
 * @param fn - The function to execute
 * @param errorFactory - Optional function to create custom errors
 * @returns An AsyncResult with the function's result or an error
 */
export function tryResult<T, E = Error>(
  fn: () => T,
  errorFactory?: (error: unknown) => E
): AsyncResult<T, E> {
  try {
    return createSuccessResult<T, E>(fn());
  } catch (error: unknown) {
    if (errorFactory) {
      return createErrorResult<T, E>(errorFactory(error));
    }
    return createErrorResult<T, E>(toErrorType<E>(error));
  }
}

/**
 * Attempts to execute an async function and return its result as an AsyncResult
 *
 * Wraps asynchronous operations in AsyncResult error handling.
 *
 * @template T - The expected return type
 * @template E - The error type
 * @param fn - The async function to execute
 * @param errorFactory - Optional function to create custom errors
 * @returns A Promise resolving to an AsyncResult with the function's result or an error
 */
export async function tryAsyncResult<T, E = Error>(
  fn: () => Promise<T>,
  errorFactory?: (error: unknown) => E
): Promise<AsyncResult<T, E>> {
  try {
    return createSuccessResult<T, E>(await fn());
  } catch (error: unknown) {
    if (errorFactory) {
      return createErrorResult<T, E>(errorFactory(error));
    }
    return createErrorResult<T, E>(toErrorType<E>(error));
  }
}

/**
 * Execute a synchronous function with error handling
 *
 * Similar to tryResult but with a customizable error mapper.
 *
 * @template T - The expected return type
 * @template E - The error type
 * @param fn - The function to execute
 * @param errorMapper - Function to transform caught errors (defaults to toErrorType)
 * @returns An AsyncResult with the function's result or a mapped error
 */
export function safeExecute<T, E = Error>(
  fn: () => T,
  errorMapper: (error: unknown) => E = (err): E => toErrorType<E>(err)
): AsyncResult<T, E> {
  try {
    const result = fn();
    return createSuccessResult<T, E>(result);
  } catch (error: unknown) {
    return createErrorResult<T, E>(errorMapper(error));
  }
}
