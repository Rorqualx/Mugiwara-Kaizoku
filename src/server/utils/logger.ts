/**
 * Server-side logging utility module
 * 
 * This module provides a simplified logging interface for server-side operations.
 * It wraps console methods to provide consistent logging functionality across
 * the server codebase. This abstraction allows for future enhancement of logging
 * capabilities (e.g., adding log levels, file output, or external logging services)
 * without modifying the calling code.
 * 
 * @module server-logger
 */

/**
 * Logger interface providing methods for different log levels
 *
 * @property {Function} info - Logs informational messages using console.log
 * @property {Function} warn - Logs warning messages using console.warn
 * @property {Function} error - Logs error messages using console.error
 * @property {Function} debug - Logs debug messages using console.debug
 *
 * @example
 * // Logging an informational message
 * logger.info('Processing request:', requestId);
 *
 * // Logging a warning
 * logger.warn('Deprecated API usage detected');
 *
 * // Logging an error
 * try {
 *   await processData();
 * } catch (error) {
 *   logger.error('Failed to process data:', error);
 * }
 *
 * // Logging debug information
 * logger.debug('Cache hit:', { key, value });
 */
export const logger = {
  /**
   * Logs informational messages
   *
   * @param {...any} args - Arguments to log, will be passed directly to console.log
   */
  // eslint-disable-next-line no-console -- Logger utility wrapper for console methods
  info: console.log, // @quality-check-skip -- logger module intentionally wraps console

  /**
   * Logs warning messages
   *
   * @param {...any} args - Arguments to log, will be passed directly to console.warn
   */
   
  warn: console.warn,

  /**
   * Logs error messages
   *
   * @param {...any} args - Arguments to log, will be passed directly to console.error
   */
  error: console.error,

  /**
   * Logs debug messages
   *
   * @param {...any} args - Arguments to log, will be passed directly to console.debug
   */
  // eslint-disable-next-line no-console -- Logger utility wrapper for console methods
  debug: console.debug, // @quality-check-skip -- logger module intentionally wraps console
};
