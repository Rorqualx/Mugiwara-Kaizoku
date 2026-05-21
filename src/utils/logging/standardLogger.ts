/**
 * Standardized Logger Interface
 * 
 * This module provides a standardized logger interface that works consistently
 * across different environments (browser, server) and can be used with various
 * logging backends (console, pino, etc.).
 * 
 * It addresses TypeScript compatibility issues by providing a consistent method
 * signature pattern throughout the codebase.
 */

import { logger as baseLogger } from '../logging';

import type { Logger } from 'pino';

/**
 * StandardLogger interface that all logger implementations must follow
 *
 * This interface provides a unified logging API that can be implemented
 * by different logging backends while maintaining type safety.
 */
export interface StandardLogger {
  /**
   * Log a message with the "info" level
   * @param message - Message to log
   * @param error - Optional error object
   */
  (message: string, error?: unknown): void;

  /**
   * Log a message with the "debug" level
   * @param message - Message to log
   * @param error - Optional error object
   */
  debug(message: string, error?: unknown): void;

  /**
   * Log a message with the "info" level
   * @param message - Message to log
   * @param error - Optional error object
   */
  info(message: string, error?: unknown): void;

  /**
   * Log a message with the "warn" level
   * @param message - Message to log
   * @param error - Optional error object
   */
  warn(message: string, error?: unknown): void;

  /**
   * Log a message with the "error" level
   * @param message - Message to log
   * @param error - Optional error object
   */
  error(message: string, error?: unknown): void;

  /**
   * Create a child logger with additional context
   * @param context - Additional context to include with all log messages
   * @returns A new logger instance with the specified context
   */
  child(context: Record<string, unknown>): StandardLogger;
}

/**
 * Logger method signature
 */
type LogMethod = (message: string, error?: unknown) => void;

/**
 * Type guard to check if a value is a function
 */
function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Safely get a log method from source logger
 */
function getLogMethod(source: Record<string, unknown>, methodName: string): LogMethod {
  const method = source[methodName];
  if (isFunction(method)) {
    return method as LogMethod;
  }
  // Fallback to console if method doesn't exist
  return (message: string, error?: unknown) => {
    // Map to only allowed console methods: warn and error
    const consoleMethod = methodName === 'error' ? console.error : console.warn;
    if (error) {
      consoleMethod(message, error);
    } else {
      consoleMethod(message);
    }
  };
}

/**
 * Create a StandardLogger adapter from an existing logger
 *
 * This function adapts existing logger implementations to the StandardLogger interface.
 *
 * @param source - Source logger to adapt (defaults to baseLogger)
 * @returns A StandardLogger-compatible instance
 */
export function createLoggerAdapter(source: Record<string, unknown> = baseLogger as unknown as Record<string, unknown>): StandardLogger {
  const infoMethod = getLogMethod(source, 'info');
  const debugMethod = getLogMethod(source, 'debug');
  const warnMethod = getLogMethod(source, 'warn');
  const errorMethod = getLogMethod(source, 'error');

  // Create the main function that acts as info logger
  const logger = ((message: string, error?: unknown) => {
    if (error !== undefined) {
      infoMethod(message, error);
    } else {
      infoMethod(message);
    }
  }) as StandardLogger;

  // Add all the methods
  logger.debug = (message: string, error?: unknown) => {
    if (error !== undefined) {
      debugMethod(message, error);
    } else {
      debugMethod(message);
    }
  };

  logger.info = (message: string, error?: unknown) => {
    if (error !== undefined) {
      infoMethod(message, error);
    } else {
      infoMethod(message);
    }
  };

  logger.warn = (message: string, error?: unknown) => {
    if (error !== undefined) {
      warnMethod(message, error);
    } else {
      warnMethod(message);
    }
  };

  logger.error = (message: string, error?: unknown) => {
    if (error !== undefined) {
      errorMethod(message, error);
    } else {
      errorMethod(message);
    }
  };

  logger.child = (context: Record<string, unknown>) => {
    // Handle different types of loggers
    const childMethod = source['child'];
    if (isFunction(childMethod)) {
      // If the source logger has a child method, use it
      const childSource = childMethod(context) as Record<string, unknown>;
      return createLoggerAdapter(childSource);
    } else {
      // Otherwise, create a new adapter that includes the context
      const childLogger = createLoggerAdapter(source);
      const contextPrefix = JSON.stringify(context);

      // Override each method to include the context
      const originalDebug = childLogger.debug;
      childLogger.debug = (message, error) =>
        originalDebug(`${contextPrefix} ${message}`, error);

      const originalInfo = childLogger.info;
      childLogger.info = (message, error) =>
        originalInfo(`${contextPrefix} ${message}`, error);

      const originalWarn = childLogger.warn;
      childLogger.warn = (message, error) =>
        originalWarn(`${contextPrefix} ${message}`, error);

      const originalError = childLogger.error;
      childLogger.error = (message, error) =>
        originalError(`${contextPrefix} ${message}`, error);

      return childLogger;
    }
  };

  return logger;
}

/**
 * Create a Pino-compatible logger adapter
 * 
 * This function creates a StandardLogger that works with Pino logger.
 * 
 * @param pinoLogger - Pino logger instance
 * @returns A StandardLogger-compatible instance
 */
export function createPinoAdapter(pinoLogger: Logger): StandardLogger {
  const logger = ((message: string, error?: unknown) => {
    if (error) {
      pinoLogger.info({ err: error }, message);
    } else {
      pinoLogger.info(message);
    }
  }) as StandardLogger;
  
  logger.debug = (message: string, error?: unknown) => {
    if (error) {
      pinoLogger.debug({ err: error }, message);
    } else {
      pinoLogger.debug(message);
    }
  };
  
  logger.info = (message: string, error?: unknown) => {
    if (error) {
      pinoLogger.info({ err: error }, message);
    } else {
      pinoLogger.info(message);
    }
  };
  
  logger.warn = (message: string, error?: unknown) => {
    if (error) {
      pinoLogger.warn({ err: error }, message);
    } else {
      pinoLogger.warn(message);
    }
  };
  
  logger.error = (message: string, error?: unknown) => {
    if (error) {
      pinoLogger.error({ err: error }, message);
    } else {
      pinoLogger.error(message);
    }
  };
  
  logger.child = (context: Record<string, unknown>) => {
    return createPinoAdapter(pinoLogger.child(context));
  };
  
  return logger;
}

/**
 * Default StandardLogger instance
 * 
 * This is a ready-to-use logger that adapts the default logger
 * to the StandardLogger interface.
 */
export const standardLogger = createLoggerAdapter();

/**
 * Create a no-op logger that doesn't actually log anything
 * 
 * Useful for testing or when you want to disable logging.
 * 
 * @returns A StandardLogger that doesn't log anything
 */
export function createNoopLogger(): StandardLogger {
  const noop = (): void => {};
  
  const logger = noop as unknown as StandardLogger;
  logger.debug = noop;
  logger.info = noop;
  logger.warn = noop;
  logger.error = noop;
  logger.child = () => logger;
  
  return logger;
}

export default standardLogger;