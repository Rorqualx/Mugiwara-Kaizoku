/**
 * Server Logger Type Definitions
 *
 * Type definitions and interfaces for the server-side logger.
 * Foundation module used by all other serverLogger modules.
 *
 * Extracted from: serverLogger.ts (lines 10-63)
 */

// ============================================================================
// Core Logger Interface
// ============================================================================

/**
 * Logger interface contract for all logger implementations
 *
 * Defines the standard logging methods that all loggers must implement,
 * including level-based logging and child logger creation.
 */
export interface LoggerInterface {
  log: (message: string, ...args: unknown[]) => void;
  error: (message: string, error?: unknown, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => LoggerInterface;
}

// ============================================================================
// Pino Logger Interfaces
// ============================================================================

/**
 * Pino logger interface for type safety
 *
 * Defines the Pino logger instance methods and properties.
 * Includes all standard log levels and child logger creation.
 */
export interface PinoLogger {
  trace: (obj: unknown, msg?: string) => void;
  debug: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
  fatal: (obj: unknown, msg?: string) => void;
  child: (bindings: unknown) => PinoLogger;
  [key: string]: unknown;
}

/**
 * Pino static methods interface
 *
 * Defines the Pino library's static methods for logger creation
 * and configuration, including destination, time functions, and serializers.
 */
export interface PinoStatic {
  (options?: unknown, stream?: unknown): PinoLogger;
  destination: (options: {
    dest: string;
    sync: boolean;
    mkdir: boolean;
    minLength?: number;
  }) => SonicBoom;
  stdTimeFunctions: {
    isoTime: unknown;
  };
  stdSerializers: {
    err: unknown;
    req: unknown;
    res: unknown;
  };
}

/**
 * SonicBoom stream interface for Pino log destinations
 *
 * SonicBoom is the underlying stream library used by Pino for
 * efficient file writing with buffering and async operations.
 */
export interface SonicBoom {
  /** Async flush - queues a flush operation */
  flush: (callback?: () => void) => void;
  /** Sync flush - blocks until buffer is written to disk */
  flushSync: () => void;
  /** Write data to the stream */
  write: (data: string) => boolean;
  /** End the stream */
  end: () => void;
  /** Destroy the stream */
  destroy: () => void;
  /** Register event handlers */
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

// ============================================================================
// Node.js Module Interfaces
// ============================================================================

/**
 * Node.js path module interface
 *
 * Defines the path module methods used by the logger for
 * file path operations.
 */
export interface PathModule {
  join: (...paths: string[]) => string;
  isAbsolute: (path: string) => boolean;
  resolve: (...paths: string[]) => string;
}

/**
 * Node.js fs module interface
 *
 * Defines the file system module methods used by the logger
 * for directory and file operations.
 */
export interface FsModule {
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
}

/**
 * Environment module interface
 *
 * Defines the process.env interface with logger-specific
 * environment variables.
 */
export interface EnvModule {
  env?: {
    KAIZOKU_LOG_PATH?: string;
    NODE_ENV?: string;
  };
}
