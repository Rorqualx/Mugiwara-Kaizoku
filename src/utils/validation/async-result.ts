/**
 * Async Result Type - Re-exported from utils
 *
 * This file re-exports AsyncResult from the new modular async-result package.
 * All types and functions are now available from the decomposed module structure.
 *
 * @deprecated Import directly from '@/utils/async-result' instead
 */

// Re-export from the new modular async-result package
export type { AsyncResult, AsyncResultStatus } from '../async-result/index';

// Legacy interfaces for backward compatibility
// These will be deprecated in the future
export interface AsyncResultIdle {
  status: 'idle';
  data: undefined;
  error: undefined;
}

export interface AsyncResultLoading {
  status: 'loading';
  data: undefined;
  error: undefined;
}

export interface AsyncResultSuccess<T> {
  status: 'success';
  data: T;
  error: undefined;
}

export interface AsyncResultError<E = Error> {
  status: 'error';
  data: undefined;
  error: E;
}
// Re-export helper functions from the new modular async-result package
export {
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  isIdle,
  isLoading,
  isSuccess,
  isError,
  mapAsyncResult,
  unwrapOr,
  fromPromise,
  combine,
  filterSuccessResults,
} from '../async-result/index';