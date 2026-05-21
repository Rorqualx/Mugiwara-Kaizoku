/**
 * Error Helper Utilities
 * 
 * Centralized error handling utilities to eliminate code duplication
 * and ensure consistent error message extraction across the application.
 */

/**
 * Safely extract error message from any error type
 * Replaces ~528 instances of: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
 * 
 * @param error - Any error type (Error, string, unknown)
 * @returns A string error message
 * 
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   console.error(message);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle objects with message property
  if (error && typeof error === 'object' && 'message' in error) {
    const errorObj = error as Record<string, unknown>;
    const message = errorObj['message'];
    return typeof message === 'string' ? message : String(message);
  }
  
  // Handle objects with error property (AsyncResult pattern)
  if (error && typeof error === 'object' && 'error' in error) {
    const errorWithErrorProp = error as { error: unknown };
    return getErrorMessage(errorWithErrorProp.error);
  }
  
  // Handle null/undefined
  if (error === null) {
    return 'An unknown error occurred';
  }
  
  // Fallback to string conversion
  return String(error);
}

/**
 * Format error for display with optional fallback message
 * 
 * @param error - Any error type
 * @param fallback - Fallback message if error is empty
 * @returns Formatted error message
 * 
 * @example
 * ```ts
 * const message = formatError(error, 'Failed to load data');
 * ```
 */
export function formatError(error: unknown, fallback = 'Operation failed'): string {
  const message = getErrorMessage(error);
  return message || fallback;
}

/**
 * Create an error with additional context
 * Useful for wrapping low-level errors with business context
 * 
 * @param message - Context message
 * @param error - Original error
 * @param context - Additional context data
 * @returns Enhanced Error object
 * 
 * @example
 * ```ts
 * throw createContextualError(
 *   'Failed to save user preferences',
 *   originalError,
 *   { userId: user["id"], action: 'save' }
 * );
 * ```
 */
export function createContextualError(
  message: string, 
  error: unknown, 
  context?: Record<string, unknown>
): Error {
  const originalMessage = getErrorMessage(error);
  const fullMessage = `${message}: ${originalMessage}`;
  
  const enhancedError = new Error(fullMessage);
  
  // Preserve original stack trace if available
  if (error instanceof Error) {
    const stack = error.stack;
    if (stack !== undefined) {
      enhancedError.stack = stack;
    }
  }
  
  // Add context and original error as properties
  Object.assign(enhancedError, { 
    context, 
    originalError: error,
    timestamp: new Date().toISOString()
  });
  
  return enhancedError;
}

/**
 * Check if an error is of a specific type
 * Useful for error discrimination in catch blocks
 * 
 * @param error - Error to check
 * @param errorClass - Error class to check against
 * @returns Boolean indicating if error is of specified type
 * 
 * @example
 * ```ts
 * if (isErrorType(error, ValidationError)) {
 *   // Handle validation error
 * }
 * ```
 */
export function isErrorType<T extends Error>(
  error: unknown,
  errorClass: new (...args: unknown[]) => T
): error is T {
  return error instanceof errorClass;
}

/**
 * Extract error code from various error types
 * 
 * @param error - Any error type
 * @returns Error code or undefined
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    // Check for code property
    if ('code' in error) {
      const errorWithCode = error as { code: unknown };
      if (typeof errorWithCode.code === 'string') {
        return errorWithCode.code;
      }
    }

    // Check for statusCode property (HTTP errors)
    if ('statusCode' in error) {
      const errorWithStatusCode = error as { statusCode: unknown };
      return String(errorWithStatusCode.statusCode);
    }

    // Check for status property
    if ('status' in error) {
      const errorWithStatus = error as { status: unknown };
      return String(errorWithStatus.status);
    }
  }

  return undefined;
}

/**
 * Format error for logging with full details
 * 
 * @param error - Any error type
 * @returns Detailed error object for logging
 */
export function formatErrorForLogging(error: unknown): {
  message: string;
  code?: string;
  stack?: string;
  context?: unknown;
  timestamp: string;
} {
  const timestamp = new Date().toISOString();
  
  if (error instanceof Error) {
    const code = getErrorCode(error);
    const stack = error.stack;
    const errorWithContext = error as Error & { context?: unknown };
    const context = errorWithContext.context;

    return {
      message: error.message,
      ...(code !== undefined ? { code } : {}),
      ...(stack !== undefined ? { stack } : {}),
      ...(context !== undefined ? { context } : {}),
      timestamp
    };
  }

  const code = getErrorCode(error);

  return {
    message: getErrorMessage(error),
    ...(code !== undefined ? { code } : {}),
    timestamp
  };
}

/**
 * Wrap an async function with error handling
 * 
 * @param fn - Async function to wrap
 * @param errorHandler - Error handler function
 * @returns Wrapped async function
 * 
 * @example
 * ```ts
 * const safeOperation = withErrorHandling(
 *   async () => fetchData(),
 *   (error) => console.error('Fetch failed:', error)
 * );
 * ```
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  errorHandler: (error: unknown, ...args: Parameters<T>) => void
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      errorHandler(errorMessage, ...args);
      throw new Error(errorMessage);
    }
  }) as T;
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of the operation
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Intentionally await in loop for retry logic
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      lastError = errorMessage;

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        if (onRetry) {
          onRetry(attempt + 1, errorMessage);
        }
        
        // Intentionally await in loop for retry backoff delay
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => {
          setTimeout(resolve, delay);
        });
      }
    }
  }
  
  throw createContextualError(
    `Operation failed after ${maxRetries + 1} attempts`,
    lastError,
    { maxRetries }
  );
}