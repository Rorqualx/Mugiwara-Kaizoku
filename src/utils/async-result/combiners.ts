/**
 * AsyncResult Combiners
 *
 * Functions for combining, chaining, and batch processing AsyncResults.
 *
 * @module async-result/combiners
 */

import { ValidationError } from '../errors';

// Import types - these will need to be defined in types.ts
export type AsyncResultStatus = 'idle' | 'loading' | 'success' | 'error';

export type AsyncResult<T = unknown, E = Error> = {
  status: 'idle';
} | {
  status: 'loading';
} | {
  status: 'success';
  data: T;
} | {
  status: 'error';
  error: E;
};

// Type guards
export const isIdle = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'idle';
} => result.status === 'idle';

export const isLoading = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'loading';
} => result.status === 'loading';

export const isSuccess = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'success';
  data: T;
} => result.status === 'success';

export const isError = <T, E>(result: AsyncResult<T, E>): result is {
  status: 'error';
  error: E;
} => result.status === 'error';

// Creators
export const createIdleResult = <T, E = Error>(): AsyncResult<T, E> => ({
  status: 'idle'
});

export const createLoadingResult = <T, E = Error>(): AsyncResult<T, E> => ({
  status: 'loading'
});

export const createSuccessResult = <T, E = Error>(data: T): AsyncResult<T, E> => ({
  status: 'success',
  data
});

export const createErrorResult = <T, E = Error>(error: E): AsyncResult<T, E> => ({
  status: 'error',
  error
});

/**
 * Safely converts an unknown error to a specific error type
 *
 * @template E - The target error type
 * @param error - The error to convert (unknown type)
 * @param fallbackMessage - Optional message to use if error cannot be converted
 * @returns The error converted to type E
 */
export function toErrorType<E = Error>(error: unknown, fallbackMessage?: string): E {
  if (error instanceof Error) {
    return error as unknown as E;
  }
  const message = fallbackMessage ?? String(error);
  return new Error(message) as unknown as E;
}

/**
 * Converts a Promise to an AsyncResult
 *
 * @template T - The expected data type
 * @template E - The error type
 * @param promise - The promise to convert
 * @returns Promise resolving to an AsyncResult
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>
): Promise<AsyncResult<T, E>> {
  try {
    const data = await promise;
    return createSuccessResult<T, E>(data);
  } catch (error: unknown) {
    return createErrorResult<T, E>(toErrorType<E>(error));
  }
}

/**
 * Converts a Promise to an AsyncResult with custom error handling
 *
 * Similar to fromPromise, but allows providing a custom error handler function
 * that processes the caught error before creating the error result.
 *
 * @template T - The expected data type
 * @template E - The error type
 * @param promise - The promise to convert
 * @param errorHandler - Optional custom error handler function
 * @returns Promise resolving to an AsyncResult
 */
export async function fromPromiseCatch<T, E = Error>(
  promise: Promise<T>,
  errorHandler?: (error: unknown) => E
): Promise<AsyncResult<T, E>> {
  try {
    const data = await promise;
    return createSuccessResult<T, E>(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorHandler && typeof errorHandler === 'function') {
      return createErrorResult<T, E>(errorHandler(errorMessage));
    }
    return createErrorResult<T, E>(toErrorType<E>(error));
  }
}

/**
 * Converts a Promise<T | null | undefined> to an AsyncResult that handles null/undefined as errors
 *
 * @template T - The expected data type
 * @template E - The error type
 * @param promise - The promise that may resolve to null or undefined
 * @param errorMessage - The error message to use if the result is null or undefined
 * @returns Promise resolving to an AsyncResult
 */
export async function fromNullablePromise<T, E = Error>(
  promise: Promise<T | null | undefined>,
  errorMessage: string = 'Result was null or undefined'
): Promise<AsyncResult<T, E>> {
  try {
    const result = await promise;
    if (result === null || result === undefined) {
      return createErrorResult<T, E>(toErrorType<E>(new Error(errorMessage)));
    }
    return createSuccessResult<T, E>(result);
  } catch (error: unknown) {
    return createErrorResult<T, E>(toErrorType<E>(error));
  }
}

/**
 * Chains multiple AsyncResult operations together
 *
 * @template T - The input data type
 * @template U - The output data type
 * @template E - The error type
 * @param result - The initial async result
 * @param fn - The function to apply to the result data
 * @returns Promise resolving to a new AsyncResult
 */
export async function chain<T, U, E = Error>(
  result: AsyncResult<T, E>,
  fn: (data: T) => Promise<AsyncResult<U, E>>
): Promise<AsyncResult<U, E>> {
  if (!isSuccess(result)) {
    if (isError(result)) {
      return createErrorResult<U, E>(result.error);
    }
    if (isLoading(result)) {
      return createLoadingResult<U, E>();
    }
    return createIdleResult<U, E>();
  }
  return fn(result.data);
}

/**
 * Combines multiple AsyncResults into a single AsyncResult
 *
 * @template T - Tuple type of result data
 * @template E - The error type
 * @param results - Array of AsyncResults
 * @returns Combined AsyncResult
 */
export function combine<T extends readonly unknown[], E = Error>(
  results: { [K in keyof T]: AsyncResult<T[K], E> }
): AsyncResult<T, E> {
  // If any result is an error, return the first error
  for (const result of results) {
    if (isError(result)) {
      return createErrorResult<T, E>(result.error);
    }
  }

  // If any result is loading, return loading
  if (results.some(isLoading)) {
    return createLoadingResult<T, E>();
  }

  // If any result is idle, return idle
  if (results.some(isIdle)) {
    return createIdleResult<T, E>();
  }

  // All results are success, combine their data
  try {
    const data = results.map((result) => {
      if (isSuccess(result)) {
        return result.data;
      }
      throw new ValidationError('Unexpected AsyncResult state');
    }) as unknown as T;
    return createSuccessResult<T, E>(data);
  } catch (error: unknown) {
    return createErrorResult<T, E>(toErrorType<E>(error));
  }
}

/**
 * Process multiple async operations with proper error handling
 *
 * @template T - The input item type
 * @template R - The result type
 * @template E - The error type
 * @param items - Items to process
 * @param asyncOperation - Async operation to perform on each item
 * @param options - Processing options
 * @returns Combined results with success/error counts
 */
export async function processAsyncOperations<T, R, E = Error>(
  items: T[],
  asyncOperation: (item: T, index: number) => Promise<AsyncResult<R, E>>,
  options: {
    continueOnError?: boolean;
    batchSize?: number;
    delay?: number;
  } = {}
): Promise<AsyncResult<{
  results: R[];
  successCount: number;
  errors: {
    item: T;
    error: E;
    index: number;
  }[];
}, E>> {
  const results: R[] = [];
  const errors: {
    item: T;
    error: E;
    index: number;
  }[] = [];

  const { continueOnError = true, batchSize = 10, delay = 0 } = options;

  // Sequential batch processing is intentional for rate limiting and controlled resource usage
  // Each batch processes items in parallel, but batches are processed sequentially
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const index = i + batchIndex;
      const result = await asyncOperation(item, index);

      if (isSuccess(result)) {
        results.push(result.data);
      } else if (isError(result)) {
        errors.push({ item, error: result.error, index });
        if (!continueOnError) {
          throw toErrorType<Error>(result.error);
        }
      }
    });

    // Wait for current batch to complete before starting next batch (rate limiting)
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(batchPromises);

    // Optional delay between batches for API rate limiting
    if (delay > 0 && i + batchSize < items.length) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), delay);
      });
    }
  }

  return createSuccessResult({
    results,
    successCount: results.length,
    errors
  });
}
