/**
 * AsyncResult Type Definitions
 *
 * Core type definitions for the AsyncResult pattern.
 * This is the foundation module - all other async-result modules depend on this.
 *
 * @module async-result/types
 */

// Import ValidationError for combine function - will be used by other modules
import type { ValidationError } from '../errors';

/**
 * Represents the possible states of an asynchronous operation
 */
export type AsyncResultStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * AsyncResult represents the state of an asynchronous operation
 *
 * This is a discriminated union type that can be used to represent
 * different states of an async operation in a type-safe way.
 *
 * @template T - The expected data type for success state (defaults to unknown)
 * @template E - The error type for error state (defaults to Error)
 *
 * @example
 * ```typescript
 * const result: AsyncResult<User, ApiError> = await fetchUser(id);
 * if (result.status === 'success') {
 *   console.log(result.data); // User object
 * }
 * ```
 */
export type AsyncResult<T = unknown, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

/**
 * Typed version of Error with optional context
 *
 * Extends the standard Error interface with additional properties
 * for better error tracking and debugging.
 */
export interface ContextualError extends Error {
  /** Additional context information about the error */
  context?: Record<string, unknown>;
  /** Optional error code for categorization */
  code?: string;
  /** The original error that caused this error */
  originalError?: Error;
}

// Re-export ValidationError type for use in other modules
export type { ValidationError };
