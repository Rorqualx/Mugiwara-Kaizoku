/**
 * Client-Side Fallback Logger
 *
 * Provides a no-op logger implementation for client-side environments
 * where the server logger is not available.
 *
 * Extracted from: serverLogger.ts (lines 296-308)
 */

import type { LoggerInterface } from './types';

// ============================================================================
// Client-Side No-Op Logger Factory
// ============================================================================

/**
 * Creates a client-side fallback logger with no-op implementations
 *
 * This function returns a logger instance that implements LoggerInterface
 * but performs no actual logging operations. Used when running in browser
 * environments where file-based logging is not available.
 *
 * @returns A LoggerInterface with all methods as no-op functions
 */
export function createClientFallbackLogger(): LoggerInterface {
  // No-op function for all logging methods
  const noop = (): void => {};

  // Return logger with all methods as no-ops
  return {
    log: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    child: (): LoggerInterface => serverLogger
  };
}

// Initialize client fallback logger instance
const serverLogger: LoggerInterface = createClientFallbackLogger();

/**
 * Export the client-side fallback logger instance
 *
 * This is the singleton instance used on client-side environments
 * when the server logger is not available.
 */
export { serverLogger as default };
export const clientFallbackLogger: LoggerInterface = serverLogger;
