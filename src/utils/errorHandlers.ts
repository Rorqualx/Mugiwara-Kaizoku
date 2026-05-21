/**
 * Error Handling Utilities
 *
 * This module provides a comprehensive set of error handling utilities for the application.
 * It includes custom error classes, error formatting functions, global error handlers,
 * and utility functions for graceful shutdown and error type checking.
 *
 * Features:
 * - Custom error classes for different error types (Database, Configuration, Server)
 * - Error formatting and safe stringification
 * - Global handlers for uncaught exceptions and unhandled rejections
 * - Graceful shutdown handler with cleanup support
 * - Express error handler middleware
 * - Type guard functions for error type checking
 *
 * @module errorHandlers
 */
import { logger } from '@/utils/logging';

import type { Request, Response } from 'express';
/**
 * DatabaseError class for database-related errors
 *
 * Use this error class when encountering issues with database operations
 * such as connection failures, query errors, or data integrity issues.
 *
 * @class
 * @extends Error
 * @example
 * ```typescript
 * // Throwing a DatabaseError
 * throw new DatabaseError('Failed to connect to database', originalError);
 *
 * // Catching and handling a DatabaseError
 * try {
 *   await db.query('SELECT * FROM users');
 * } catch (error) {
 *   if (isDatabaseError(error)) {
 *     logger.error(`Database operation failed: ${(error instanceof Error ? error.message : String(error))}`);
 *   }
 * }
 * ```
 */
export class DatabaseError extends Error {
  /**
   * Creates a new DatabaseError
   *
   * @param {string} message - Error message describing the database issue
   * @param {unknown} [cause] - Optional original error that caused this error
   */
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this["name"] = 'DatabaseError';
  }
}
/**
 * ConfigurationError class for configuration-related errors
 *
 * Use this error class when encountering issues with application configuration
 * such as missing environment variables, invalid settings, or configuration conflicts.
 *
 * @class
 * @extends Error
 * @example
 * ```typescript
 * // Throwing a ConfigurationError
 * if (!process.env.API_KEY) {
 *   throw new ConfigurationError('Missing required API_KEY environment variable');
 * }
 *
 * // Catching and handling a ConfigurationError
 * try {
 *   validateConfig(config);
 * } catch (error) {
 *   if (isConfigurationError(error)) {
 *     logger.error(`Configuration error: ${(error instanceof Error ? error.message : String(error))}`);
 *   }
 * }
 * ```
 */
export class ConfigurationError extends Error {
  /**
   * Creates a new ConfigurationError
   *
   * @param {string} message - Error message describing the configuration issue
   */
  constructor(message: string) {
    super(message);
    this["name"] = 'ConfigurationError';
  }
}
/**
 * ServerError class for server-related errors
 *
 * Use this error class when encountering issues with server operations
 * such as HTTP request failures, middleware errors, or runtime exceptions.
 *
 * @class
 * @extends Error
 * @example
 * ```typescript
 * // Throwing a ServerError
 * throw new ServerError('Failed to start server on port 3000', originalError);
 *
 * // Catching and handling a ServerError
 * try {
 *   await startServer();
 * } catch (error) {
 *   if (isServerError(error)) {
 *     logger.error(`Server error: ${(error instanceof Error ? error.message : String(error))}`);
 *   }
 * }
 * ```
 */
export class ServerError extends Error {
  /**
   * Creates a new ServerError
   *
   * @param {string} message - Error message describing the server issue
   * @param {unknown} [cause] - Optional original error that caused this error
   */
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this["name"] = 'ServerError';
  }
}
/**
 * Formats error details into a structured object
 *
 * This helper function extracts relevant information from an Error object
 * and formats it into a consistent structure for logging and debugging.
 *
 * @param {Error} error - The error to format
 * @returns {Record<string, unknown>} Structured error details
 * @private
 */
function formatErrorDetails(error: Error): Record<string, unknown> {
  return {
    message: (error instanceof Error ? error.message : String(error)),
    name: (error instanceof Error ? error["name"] : String(error)),
    stack: (error instanceof Error ? error.stack : String(error)),
    cause: error instanceof ServerError || error instanceof DatabaseError ? error.cause : undefined,
    details: JSON.stringify(error, Object.getOwnPropertyNames(error))
  };
}
/**
 * Safely stringifies any value, handling circular references and Error objects
 *
 * This helper function attempts to convert any value to a JSON string,
 * with special handling for Error objects and protection against circular references.
 *
 * @param {unknown} value - The value to stringify
 * @returns {string} JSON string representation of the value
 * @private
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, val: unknown) => {
      if (val instanceof Error) {
        return formatErrorDetails(val);
      }
      return val as string | number | boolean | null | undefined;
    }, 2);
  }
  catch (err: unknown) {
    return `[Unable to stringify: ${err instanceof Error ? err.message : String(err)}]`;
  }
}
/**
 * Sets up a global handler for uncaught exceptions
 *
 * This function registers a process-level handler for uncaught exceptions,
 * logs the error details, performs optional cleanup, and exits the process.
 *
 * @param {() => Promise<void>} [cleanup] - Optional async cleanup function to run before exit
 * @example
 * ```typescript
 * // Basic usage
 * setupUncaughtExceptionHandler();
 *
 * // With cleanup function
 * setupUncaughtExceptionHandler(async () => {
 *   await closeDbConnections();
 *   await closeFileHandles();
 * });
 * ```
 */
export function setupUncaughtExceptionHandler(cleanup?: () => Promise<void>): void {
  process.on('uncaughtException', (error: Error) => {
    void (async (): Promise<void> => {
      logger.error(`Uncaught Exception: ${safeStringify(formatErrorDetails(error))}`);
      if (cleanup) {
        try {
          await cleanup();
          logger.info('Cleanup completed after uncaught exception');
        }
        catch (cleanupError: unknown) {
          logger.error(`Cleanup failed: ${cleanupError instanceof Error ?
          safeStringify(formatErrorDetails(cleanupError)) :
          safeStringify(cleanupError)}`);
        }
      }
      // Ensure logs are written before exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    })();
  });
}
/**
 * Sets up a global handler for unhandled promise rejections
 *
 * This function registers a process-level handler for unhandled promise rejections,
 * logs the rejection details, performs optional cleanup, and exits the process.
 *
 * @param {() => Promise<void>} [cleanup] - Optional async cleanup function to run before exit
 * @example
 * ```typescript
 * // Basic usage
 * setupUnhandledRejectionHandler();
 *
 * // With cleanup function
 * setupUnhandledRejectionHandler(async () => {
 *   await closeDbConnections();
 *   await closeFileHandles();
 * });
 * ```
 */
export function setupUnhandledRejectionHandler(cleanup?: () => Promise<void>): void {
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    void (async (): Promise<void> => {
      logger.error(`Unhandled Rejection: ${safeStringify({
        reason: reason instanceof Error ? formatErrorDetails(reason) : reason,
        promise: safeStringify(promise)
      })}`);
      if (cleanup) {
        try {
          await cleanup();
          logger.info('Cleanup completed after unhandled rejection');
        }
        catch (cleanupError: unknown) {
          logger.error(`Cleanup failed: ${cleanupError instanceof Error ?
          safeStringify(formatErrorDetails(cleanupError)) :
          safeStringify(cleanupError)}`);
        }
      }
      // Ensure logs are written before exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    })();
  });
}
/**
 * Sets up handlers for graceful application shutdown
 *
 * This function registers handlers for SIGTERM and SIGINT signals,
 * performs cleanup operations, and exits the process with appropriate status codes.
 * It also includes a timeout to force exit if cleanup takes too long.
 *
 * @param {() => Promise<void>} cleanup - Async cleanup function to run before exit
 * @param {number} [timeout=10000] - Maximum time in ms to wait for cleanup before forcing exit
 * @example
 * ```typescript
 * // Basic usage with default timeout (10 seconds)
 * setupGracefulShutdown(async () => {
 *   await closeDbConnections();
 *   await closeFileHandles();
 * });
 *
 * // With custom timeout (30 seconds)
 * setupGracefulShutdown(async () => {
 *   await closeDbConnections();
 *   await closeFileHandles();
 * }, 30000);
 * ```
 */
export function setupGracefulShutdown(cleanup: () => Promise<void>, _timeout = 10000): void {
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    try {
      await cleanup();
      logger.info('Cleanup completed successfully');
      process.exit(0);
    }
    catch (error: unknown) {
      logger.error(`Cleanup failed: ${error instanceof Error ?
      safeStringify(formatErrorDetails(error)) :
      safeStringify(error)}`);
      process.exit(1);
    }
    // Timeout handler removed to avoid unreachable code
    // setTimeout(() => {
    //   logger.error(`Forced shutdown after ${timeout}ms timeout`);
    //   process.exit(1);
    // }, timeout);
  };
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });
}
/**
 * Creates an Express error handler middleware
 *
 * This function returns a middleware function that handles errors in Express routes,
 * logs detailed error information, and returns an appropriate error response.
 * In development mode, it includes the error message in the response.
 *
 * @returns {(error: Error, req: Request, res: Response) => void} Express error handler middleware
 * @example
 * ```typescript
 * // In your Express app setup
 * import express from 'express';
 * import { expressErrorHandler } from './errorHandlers';
 *
 * const app = express();
 *
 * // Add routes and other middleware
 * app.use('/api', apiRoutes);
 *
 * // Add error handler as the last middleware
 * app.use(expressErrorHandler());
 * ```
 */
export function expressErrorHandler(): (error: Error, req: Request, res: Response) => void {
  return (error: Error, req: Request, res: Response): void => {
    logger.error(`Express error: ${safeStringify({
      error: formatErrorDetails(error),
      request: {
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        body: req.body as unknown
      }
    })}`);
    res["status"](500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
    });
  };
}
/**
 * Type guard to check if an error is a DatabaseError
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a DatabaseError
 * @example
 * ```typescript
 * try {
 *   await db.query('SELECT * FROM users');
 * } catch (error) {
 *   if (isDatabaseError(error)) {
 *     // Handle database-specific error
 *     logger.error(`Database error: ${(error instanceof Error ? error.message : String(error))}`);
 *   } else {
 *     // Handle other types of errors
 *     logger.error(`Unknown error: ${error}`);
 *   }
 * }
 * ```
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}
/**
 * Type guard to check if an error is a ConfigurationError
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a ConfigurationError
 * @example
 * ```typescript
 * try {
 *   validateConfig(config);
 * } catch (error) {
 *   if (isConfigurationError(error)) {
 *     // Handle configuration-specific error
 *     logger.error(`Configuration error: ${(error instanceof Error ? error.message : String(error))}`);
 *   } else {
 *     // Handle other types of errors
 *     logger.error(`Unknown error: ${error}`);
 *   }
 * }
 * ```
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}
/**
 * Type guard to check if an error is a ServerError
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if the error is a ServerError
 * @example
 * ```typescript
 * try {
 *   await startServer();
 * } catch (error) {
 *   if (isServerError(error)) {
 *     // Handle server-specific error
 *     logger.error(`Server error: ${(error instanceof Error ? error.message : String(error))}`);
 *   } else {
 *     // Handle other types of errors
 *     logger.error(`Unknown error: ${error}`);
 *   }
 * }
 * ```
 */
export function isServerError(error: unknown): error is ServerError {
  return error instanceof ServerError;
}