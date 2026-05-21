/**
 * Console Logger Implementation
 *
 * Provides a fallback console-based logger implementation for server-side logging.
 * Used when Pino logger initialization fails or is not available.
 *
 * Extracted from: serverLogger.ts (lines 64-74)
 */

import { logger } from '@/utils/logger';

import { LoggerInterface } from './types';

/**
 * Creates a console-based logger instance as a fallback implementation
 *
 * This logger delegates all logging calls to the standard logger utility,
 * providing a consistent interface when file-based logging is unavailable.
 * The child method returns the same logger instance to maintain interface compatibility.
 *
 * @returns A LoggerInterface implementation backed by console/standard logger
 */
export const createConsoleLogger = (): LoggerInterface => {
  const consoleLogger: LoggerInterface = {
    log: (message: string, ...args: unknown[]): void => logger.info(message, ...args),
    error: (message: string, error?: unknown, ...args: unknown[]): void => logger.error(message, error, ...args),
    warn: (message: string, ...args: unknown[]): void => logger.warn(message, ...args),
    info: (message: string, ...args: unknown[]): void => logger.info(message, ...args),
    debug: (message: string, ...args: unknown[]): void => logger.debug(message, ...args),
    child: (): LoggerInterface => consoleLogger
  };
  return consoleLogger;
};
