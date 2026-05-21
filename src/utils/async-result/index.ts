/**
 * AsyncResult Pattern - Main Aggregator
 *
 * This module aggregates all async-result utilities into a single export point.
 * All functions are re-exported for backward compatibility with existing imports.
 *
 * Architecture:
 * - types.ts - Core type definitions (AsyncResult, ContextualError)
 * - creators.ts - Factory functions (createSuccessResult, createErrorResult, etc.)
 * - guards.ts - Type guards (isSuccess, isError, isLoading, isIdle)
 * - mappers.ts - Transform functions (mapAsyncResult, mapError, etc.)
 * - unwrappers.ts - Data extraction (unwrapOr, getDataOr, etc.)
 * - error-utils.ts - Error handling (toErrorType, withEnhancedErrorHandling)
 *
 * Original file: 977 lines -> Refactored: 6 modules
 * Total exports: ~35 functions/types
 */

// ============================================================================
// Type Exports
// ============================================================================
export type {
  AsyncResultStatus,
  AsyncResult,
  ContextualError,
  ValidationError,
} from './types';

// ============================================================================
// Creator Functions
// ============================================================================
export {
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  createContextualError,
  createTypedError,
  createContextualErrorCreator,
} from './creators';

// ============================================================================
// Type Guards
// ============================================================================
export {
  isIdle,
  isLoading,
  isSuccess,
  isError,
  isSuccessWithType,
} from './guards';

// ============================================================================
// Mappers
// ============================================================================
export {
  mapAsyncResult,
  mapResult,
  mapResultAsync,
  withFallbackError,
  mapError,
} from './mappers';

// ============================================================================
// Unwrappers
// ============================================================================
export {
  unwrapOr,
  getDataOr,
  getDataOrDefault,
  getArrayData,
  getProperty,
  getNestedProperty,
  getAsyncResultStatus,
  safeGetData,
  safeGetError,
  getErrorOr,
} from './unwrappers';

// ============================================================================
// Error Utilities
// ============================================================================
export {
  toErrorType,
  withEnhancedErrorHandling,
} from './error-utils';

// ============================================================================
// Array Helpers
// ============================================================================
export {
  filterAsyncResult,
  mapAsyncResultArray,
  findInAsyncResult,
  filterSuccessResults,
  reduceAsyncResult,
  validateAndMapArray,
  arrayToSuccessResults,
} from './array-helpers';

// ============================================================================
// Combiners
// ============================================================================
export {
  fromPromise,
  fromPromiseCatch,
  fromNullablePromise,
  chain,
  combine,
  processAsyncOperations,
} from './combiners';

// ============================================================================
// Handlers
// ============================================================================
export {
  withSuccessData,
  handleAsyncResult,
  validateData,
  validateResult,
  tapResult,
  recoverWithFallback,
  tryResult,
  tryAsyncResult,
  safeExecute,
} from './handlers';

