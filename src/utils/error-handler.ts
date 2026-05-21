/**
 * Error Handler Utilities
 *
 * Provides utilities for handling errors consistently across the application,
 * including integration with AsyncResult pattern and logging.
 */
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isError as isAsyncError
} from '@/utils/async-result';
import type { BaseError } from '@/utils/errors/base-error';
import { isBaseError } from '@/utils/errors/base-error';
import { ValidationError } from '@/utils/errors/domain-errors';
import { logger } from '@/utils/logger';
export interface ErrorHandlerOptions {
  logger?: typeof logger;
  includeStack?: boolean;
  rethrow?: boolean;
}
/**
 * Central error handler class
 */
export class ErrorHandler {
  private logger: typeof logger;
  private includeStack: boolean;
  constructor(options?: ErrorHandlerOptions) {
    this.logger = options?.logger ?? logger;
    this.includeStack = options?.includeStack ?? process.env.NODE_ENV !== 'production';
  }
  /**
   * Wrap any error into a BaseError
   */
  wrap(error: unknown, code: string = 'UNKNOWN_ERROR'): BaseError {
    if (isBaseError(error)) {
      return error;
    }
    // Check if it's an AsyncResult with error status
    const errorRecord = error as Record<string, unknown>;
    if (typeof error === 'object' && error !== null && 'status' in error && errorRecord["status"] === 'error' && 'error' in error) {
      // Use ValidationError as a concrete implementation
      const asyncError = error as { status: 'error'; error: unknown };
      return new ValidationError((asyncError.error instanceof Error ? asyncError.error.message : String(asyncError.error)), undefined, undefined, { code }, asyncError.error instanceof Error ? asyncError.error : undefined);
    }
    return new ValidationError(String(error), undefined, undefined, { code });
  }
  /**
   * Handle async operation with error logging
   */
  async handle<T>(operation: () => Promise<T>, context: string, options?: {
    code?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AsyncResult<T, BaseError>> {
    try {
      const result = await operation();
      return createSuccessResult(result);
    }
    catch (error: unknown) {
      const wrappedError = this.wrap(error, options?.code);
      // Log with context
      this.logger.error(`Operation failed: ${context}`, wrappedError, options?.metadata);
      return createErrorResult(wrappedError);
    }
  }
  /**
   * Handle sync operation with error logging
   */
  handleSync<T>(operation: () => T, context: string, options?: {
    code?: string;
    metadata?: Record<string, unknown>;
  }): AsyncResult<T, BaseError> {
    try {
      const result = operation();
      return createSuccessResult(result);
    }
    catch (error: unknown) {
      const wrappedError = this.wrap(error, options?.code);
      // Log with context
      this.logger.error(`Operation failed: ${context}`, wrappedError, options?.metadata);
      return createErrorResult(wrappedError);
    }
  }
  /**
   * Execute operation with retry logic
   */
  async retry<T>(operation: () => Promise<T>, options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
    context?: string;
    shouldRetry?: (error: BaseError, attempt: number) => boolean;
  } = {}): Promise<AsyncResult<T, BaseError>> {
    const maxAttempts = options.maxAttempts ?? 3;
    const delay = options.delay ?? 1000;
    const backoff = options.backoff ?? 2;
    const context = options.context ?? 'retry operation';
    let lastError: BaseError | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // eslint-disable-next-line no-await-in-loop -- Intentional: retry logic requires sequential attempts
      const result = await this.handle(operation, `${context} (attempt ${attempt})`);
      if (result.status === 'success') {
        return result;
      }
      if (isAsyncError(result)) {
        lastError = result.error;
        // Check if should retry
        if (options.shouldRetry && !options.shouldRetry(result.error, attempt)) {
          return result;
        }
        // Don't delay after last attempt
        if (attempt < maxAttempts) {
          const waitTime = delay * Math.pow(backoff, attempt - 1);
          this.logger.info(`Retrying in ${waitTime}ms...`, {
            attempt,
            maxAttempts,
            error: result.error instanceof Error ? result.error.message : String(result.error)
          });
          // eslint-disable-next-line no-await-in-loop -- Intentional: delay between sequential retry attempts
          await new Promise((resolve) => { setTimeout(resolve, waitTime); });
        }
      }
    }
    // All attempts failed
    return createErrorResult(lastError ?? new ValidationError('All retry attempts failed', undefined, undefined, { code: 'RETRY_EXHAUSTED' }));
  }
  /**
   * Log and rethrow error (for use in catch blocks)
   */
  logAndThrow(error: unknown, context: string, metadata?: Record<string, unknown>): never {
    const wrappedError = this.wrap(error);
    this.logger.error(`Fatal error in ${context}`, wrappedError, metadata);
    throw wrappedError;
  }
  /**
   * Log error and return default value
   */
  logAndDefault<T>(error: unknown, defaultValue: T, context: string, metadata?: Record<string, unknown>): T {
    const wrappedError = this.wrap(error);
    this.logger.error(`Error in ${context}, using default value`, wrappedError, {
      ...metadata,
      defaultValue
    });
    return defaultValue;
  }
  /**
   * Create a child error handler with specific logger context
   */
  child(context: Record<string, unknown>): ErrorHandler {
    return new ErrorHandler({
      logger: this.logger.child('ErrorHandler', context),
      includeStack: this.includeStack
    });
  }
}
/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();
/**
 * Convenience functions
 */
/**
 * Wrap error in BaseError
 */
export function wrapError(error: unknown, code?: string): BaseError {
  return errorHandler.wrap(error, code);
}
/**
 * Handle async operation with error logging
 */
export async function handleAsync<T>(operation: () => Promise<T>, context: string): Promise<AsyncResult<T, BaseError>> {
  return errorHandler.handle(operation, context);
}
/**
 * Handle sync operation with error logging
 */
export function handleSync<T>(operation: () => T, context: string): AsyncResult<T, BaseError> {
  return errorHandler.handleSync(operation, context);
}
/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(operation: () => Promise<T>, options?: Parameters<ErrorHandler['retry']>[1]): Promise<AsyncResult<T, BaseError>> {
  return errorHandler.retry(operation, options);
}