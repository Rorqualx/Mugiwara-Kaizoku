/**
 * Logger System
 * 
 * Provides a unified logging interface that works in both server and browser environments.
 * Automatically selects the appropriate logger implementation based on the environment.
 */

import type { Logger } from './base-logger';
import type { LoggerConfig } from './types';

// Export types
export type { LogLevel, LogEntry, LoggerConfig, LogContext } from './types';
export { Logger } from './base-logger';
export type { Logger as LoggerType } from './base-logger';

// Singleton instance
let loggerInstance: Logger | null = null;

/**
 * Create a new logger instance
 */
export function createLogger(config?: LoggerConfig): Logger {
  // Dynamic import based on environment
  if (typeof window === 'undefined') {
    // Server environment
    // eslint-disable-next-line no-undef
    const { ServerLogger } = require('./server-logger') as { ServerLogger: new (config?: LoggerConfig) => Logger };
    return new ServerLogger(config);
  } else {
    // Browser environment
    // eslint-disable-next-line no-undef
    const { BrowserLogger } = require('./browser-logger') as { BrowserLogger: new (config?: LoggerConfig) => Logger };
    return new BrowserLogger(config);
  }
}

/**
 * Get the singleton logger instance
 */
export function getLogger(): Logger {
  loggerInstance ??= createLogger();
  return loggerInstance;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return getLogger().child(context);
}

/**
 * Default logger export for easy import
 */
export const logger = getLogger();