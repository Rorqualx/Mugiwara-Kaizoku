/**
 * Error Helper Utilities
 *
 * Provides type-safe error message extraction and handling
 * for various error types including tRPC query errors.
 */

/**
 * Extract error message from unknown error type
 * Handles Error objects, objects with message property, and unknowns
 *
 * @param error - The error to extract a message from
 * @returns The error message as a string
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error: unknown) {
 *   const message = extractErrorMessage(error);
 *   logger.error('Operation failed:', message);
 * }
 * ```
 */
export function extractErrorMessage(error: unknown): string {
  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle objects with message property
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    return typeof msg === 'string' ? msg : String(msg);
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback for unknown types
  return 'Unknown error';
}

/**
 * Extract error message from tRPC query error
 * Handles TypeScript's 'never' type inference issue with tRPC queries
 *
 * @param error - The tRPC query error (typed as unknown to handle 'never' type)
 * @param fallback - Fallback message if extraction fails
 * @returns The error message as a string
 *
 * @example
 * ```typescript
 * if (query.isError) {
 *   const errorMsg = extractTRPCErrorMessage(query.error, 'Failed to load data');
 *   throw new Error(`Query error: ${errorMsg}`);
 * }
 * ```
 */
export function extractTRPCErrorMessage(error: unknown, fallback = 'Query error'): string {
  try {
    return extractErrorMessage(error);
  } catch {
    return fallback;
  }
}

/**
 * Create a standardized error with context
 *
 * @param message - The error message
 * @param context - Additional context object
 * @returns Error with formatted message including context
 *
 * @example
 * ```typescript
 * throw createContextualError('Failed to load user', {
 *   userId: 123,
 *   operation: 'fetchUser'
 * });
 * ```
 */
export function createContextualError(message: string, context?: Record<string, unknown>): Error {
  if (!context || Object.keys(context).length === 0) {
    return new Error(message);
  }

  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(', ');

  return new Error(`${message} (${contextStr})`);
}

/**
 * Safe error logging that extracts message from any error type
 *
 * @param error - The error to log
 * @returns Object with message and optional stack trace
 *
 * @example
 * ```typescript
 * catch (error: unknown) {
 *   const { message, stack } = safeErrorLog(error);
 *   logger.error('Operation failed', { message, stack });
 * }
 * ```
 */
export function safeErrorLog(error: unknown): { message: string; stack?: string } {
  const message = extractErrorMessage(error);

  // Only include stack if it exists (exactOptionalPropertyTypes compliance)
  if (error instanceof Error && error.stack) {
    return { message, stack: error.stack };
  }

  return { message };
}
