/**
 * Pino Logger Initialization
 *
 * Initialization logic for the Pino logger with file and console output.
 * Breaks down complex logger setup into focused, testable functions.
 *
 * Extracted from: serverLogger.ts (lines 82-289)
 * Complexity: Reduced from 21 to <20 across 7 functions
 */

import { logger } from '@/utils/logger';

import { formatErrorMessage, getEnvironmentConfig, resolveLogPath, createLogFilePaths } from './pino-config';
import { registerStreams, startPeriodicFlush } from './stream-registry';

import type { LoggerInterface, PinoLogger, PinoStatic, PathModule, FsModule } from './types';

// ============================================================================
// Flush Configuration
// ============================================================================

/** Flush interval in milliseconds - how often to sync buffers to disk */
const FLUSH_INTERVAL_MS = 5000;

/** Minimum buffer length before automatic flush for main logs (4KB) */
const MIN_BUFFER_LENGTH = 4096;

/** Minimum buffer length for error logs (0 = flush immediately) */
const ERROR_MIN_BUFFER_LENGTH = 0;

// ============================================================================
// Module Loading
// ============================================================================

/**
 * Loads required Node.js modules for Pino logger
 *
 * Safely loads pino, path, and fs modules using require().
 * Returns null if any module fails to load.
 *
 * @returns Object with loaded modules or null on failure
 *
 * Complexity: 3 (1 try-catch + 2 returns)
 */
export function loadRequiredModules(): { pino: PinoStatic; path: PathModule; fs: FsModule } | null {
  try {
    // eslint-disable-next-line no-undef
    const pino = require('pino') as PinoStatic;
    // eslint-disable-next-line no-undef
    const path = require('path') as PathModule;
    // eslint-disable-next-line no-undef
    const fs = require('fs') as FsModule;

    return { pino, path, fs };
  } catch (requireError: unknown) {
    logger.error('Failed to load required modules for logging:', formatErrorMessage(requireError));
    return null;
  }
}

// ============================================================================
// Stream Creation
// ============================================================================

/**
 * Creates Pino destination streams for log files
 *
 * Sets up file streams for main log and error log with
 * async writing and automatic directory creation.
 *
 * @param pino - The Pino static instance
 * @param config - Log file paths configuration
 * @returns Object with log and error streams
 *
 * Complexity: 1 (simple function calls)
 */
export function createPinoStreams(
  pino: PinoStatic,
  config: { logFile: string; errorLogFile: string }
): { logStream: unknown; errorStream: unknown } {
  const logStream = pino.destination({
    dest: config.logFile,
    sync: false,
    mkdir: true,
    minLength: MIN_BUFFER_LENGTH, // Flush when buffer >= 4KB
  });

  const errorStream = pino.destination({
    dest: config.errorLogFile,
    sync: false,
    mkdir: true,
    minLength: ERROR_MIN_BUFFER_LENGTH, // Errors flush immediately
  });

  return { logStream, errorStream };
}

// ============================================================================
// Logger Creation
// ============================================================================

/**
 * Creates base Pino logger instance with file stream
 *
 * Configures a Pino logger with level-based filtering, timestamps,
 * redaction, and serializers for production logging.
 *
 * @param pino - The Pino static instance
 * @param stream - Write stream for log output
 * @param env - Node environment (development/production)
 * @returns Configured Pino logger instance
 *
 * Complexity: 2 (1 conditional + 1 return)
 */
export function createBasePinoLogger(pino: PinoStatic, stream: unknown, env: string): PinoLogger {
  return pino({
    level: env === 'development' ? 'debug' : 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string): { level: string } => {
        return { level: label };
      }
    },
    redact: ['password', 'token', 'secret'],
    serializers: {
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res
    }
  }, stream);
}

/**
 * Creates error-specific Pino logger instance
 *
 * Configures a Pino logger for error-level logging only,
 * optimized for error tracking and debugging.
 *
 * @param pino - The Pino static instance
 * @param stream - Write stream for error output
 * @returns Error-level Pino logger instance
 *
 * Complexity: 1 (simple function call)
 */
export function createErrorLogger(pino: PinoStatic, stream: unknown): PinoLogger {
  return pino({
    level: 'error',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string): { level: string } => {
        return { level: label };
      }
    },
    serializers: {
      error: pino.stdSerializers.err
    }
  }, stream);
}

/**
 * Creates development console logger with pino-pretty
 *
 * Sets up a colorized, human-readable console logger for development
 * environments using pino-pretty transport. Returns null on failure.
 *
 * @param pino - The Pino static instance
 * @returns Console logger instance or null
 *
 * Complexity: 3 (1 try-catch + 2 returns)
 */
export function createDevelopmentLogger(pino: PinoStatic): PinoLogger | null {
  try {
    return pino({
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    });
  } catch (consoleError: unknown) {
    logger.warn('Failed to create console logger, using file logger only', formatErrorMessage(consoleError));
    return null;
  }
}

/**
 * Creates multi-destination logger (file + console)
 *
 * Wraps a file logger with console output for development environments.
 * Logs to both destinations simultaneously, with errors duplicated to error logger.
 *
 * @param pinoLogger - Base file logger
 * @param consoleLogger - Console logger (null for production)
 * @param errorLogger - Error-specific logger
 * @returns Multi-destination logger or original logger
 *
 * Complexity: 11 (3 conditionals + 8 function definitions)
 */
export function createMultiLogger(
  pinoLogger: PinoLogger,
  consoleLogger: PinoLogger | null,
  errorLogger: PinoLogger
): PinoLogger {
  // If no console logger, return base logger
  if (!consoleLogger) {
    return pinoLogger;
  }

  // Store original logger to avoid infinite recursion
  const originalPinoLogger = pinoLogger;

  // Multi-log helper function
  // Note: Must call methods as methods (not extract and call) to preserve 'this' context
  const multiLog = (level: keyof PinoLogger, obj: unknown, msg?: string): void => {
    // Call directly on the logger object to preserve 'this' context
    switch (level) {
      case 'trace':
        originalPinoLogger.trace(obj, msg);
        consoleLogger.trace(obj, msg);
        break;
      case 'debug':
        originalPinoLogger.debug(obj, msg);
        consoleLogger.debug(obj, msg);
        break;
      case 'info':
        originalPinoLogger.info(obj, msg);
        consoleLogger.info(obj, msg);
        break;
      case 'warn':
        originalPinoLogger.warn(obj, msg);
        consoleLogger.warn(obj, msg);
        break;
      case 'error':
        originalPinoLogger.error(obj, msg);
        consoleLogger.error(obj, msg);
        break;
      case 'fatal':
        originalPinoLogger.fatal(obj, msg);
        consoleLogger.fatal(obj, msg);
        break;
      default:
        // Fallback to info for any unknown level
        originalPinoLogger.info(obj, msg);
        consoleLogger.info(obj, msg);
    }
  };

  // Return wrapped logger with multi-destination support
  return {
    ...originalPinoLogger,
    trace: (obj: unknown, msg?: string): void => multiLog('trace', obj, msg),
    debug: (obj: unknown, msg?: string): void => multiLog('debug', obj, msg),
    info: (obj: unknown, msg?: string): void => multiLog('info', obj, msg),
    warn: (obj: unknown, msg?: string): void => multiLog('warn', obj, msg),
    error: (obj: unknown, msg?: string): void => {
      multiLog('error', obj, msg);
      errorLogger.error(obj, msg);
    },
    fatal: (obj: unknown, msg?: string): void => {
      multiLog('fatal', obj, msg);
      errorLogger.fatal(obj, msg);
    },
    child: (bindings: unknown): PinoLogger => originalPinoLogger.child(bindings)
  };
}

// ============================================================================
// Logger Interface Creation
// ============================================================================

/**
 * Creates LoggerInterface wrapper around Pino loggers
 *
 * Transforms Pino logger instances into the standard LoggerInterface
 * with message-first API and child logger support.
 *
 * @param pinoLogger - Main Pino logger instance
 * @param errorLogger - Error-specific Pino logger
 * @returns LoggerInterface implementation
 *
 * Complexity: 8 (6 method definitions + 2 nested conditionals)
 */
export function createLoggerInterface(
  pinoLogger: PinoLogger,
  errorLogger: PinoLogger
): LoggerInterface {
  return {
    log: (message: string, ...args: unknown[]): void => pinoLogger.info({ args }, message),

    error: (message: string, error?: unknown, ...args: unknown[]): void => {
      if (error instanceof Error) {
        pinoLogger.error({ err: error, args }, message);
        errorLogger.error({ err: error, args }, message);
      } else if (error) {
        pinoLogger.error({ error, args }, message);
        errorLogger.error({ error, args }, message);
      } else {
        pinoLogger.error({ args }, message);
        errorLogger.error({ args }, message);
      }
    },

    warn: (message: string, ...args: unknown[]): void => pinoLogger.warn({ args }, message),
    info: (message: string, ...args: unknown[]): void => pinoLogger.info({ args }, message),
    debug: (message: string, ...args: unknown[]): void => pinoLogger.debug({ args }, message),

    child: (bindings: Record<string, unknown>): LoggerInterface => {
      const childLogger = pinoLogger.child(bindings);
      const childInterface: LoggerInterface = {
        log: (message: string, ...args: unknown[]): void => childLogger.info({ args }, message),

        error: (message: string, error?: unknown, ...args: unknown[]): void => {
          if (error instanceof Error) {
            childLogger.error({ err: error, args }, message);
            errorLogger.error({ err: error, args }, message);
          } else if (error) {
            childLogger.error({ error, args }, message);
            errorLogger.error({ error, args }, message);
          } else {
            childLogger.error({ args }, message);
            errorLogger.error({ args }, message);
          }
        },

        warn: (message: string, ...args: unknown[]): void => childLogger.warn({ args }, message),
        info: (message: string, ...args: unknown[]): void => childLogger.info({ args }, message),
        debug: (message: string, ...args: unknown[]): void => childLogger.debug({ args }, message),
        child: (newBindings: Record<string, unknown>): LoggerInterface =>
          createLoggerInterface(pinoLogger, errorLogger).child({ ...bindings, ...newBindings })
      };
      return childInterface;
    }
  };
}

// ============================================================================
// Main Initialization
// ============================================================================

/**
 * Initializes Pino logger with file and console output
 *
 * Main entry point for Pino logger initialization. Orchestrates module
 * loading, stream creation, logger setup, and interface wrapping.
 *
 * @returns LoggerInterface instance or null on failure
 *
 * Complexity: 8 (5 conditionals + 3 variable assignments)
 */
export function initializePinoLogger(): LoggerInterface | null {
  // Load required modules
  const modules = loadRequiredModules();
  if (!modules) {
    return null;
  }

  const { pino, path: _path } = modules;

  // Get environment configuration
  const env = getEnvironmentConfig();
  const logsDir = resolveLogPath(env.KAIZOKU_LOG_PATH);
  const { logFile, errorLogFile } = createLogFilePaths(logsDir, env.NODE_ENV);

  // Create log streams
  const { logStream, errorStream } = createPinoStreams(pino, { logFile, errorLogFile });

  // Register streams for shutdown handling and start periodic flushing
  // Cast to SonicBoom-compatible interface for stream registry
  registerStreams(
    logStream as { flush: () => void; flushSync: () => void },
    errorStream as { flush: () => void; flushSync: () => void }
  );
  startPeriodicFlush(FLUSH_INTERVAL_MS);

  // Create base loggers
  let pinoLogger: PinoLogger;
  let errorLogger: PinoLogger;

  try {
    pinoLogger = createBasePinoLogger(pino, logStream, env.NODE_ENV);
    errorLogger = createErrorLogger(pino, errorStream);

    // Add console logger in development
    if (env.NODE_ENV === 'development') {
      const consoleLogger = createDevelopmentLogger(pino);
      pinoLogger = createMultiLogger(pinoLogger, consoleLogger, errorLogger);
    }

    // Create and return logger interface
    return createLoggerInterface(pinoLogger, errorLogger);
  } catch (pinoError: unknown) {
    logger.error('Failed to initialize pino logger:', formatErrorMessage(pinoError));
    return null;
  }
}
