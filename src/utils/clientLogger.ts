import { logger } from '../utils/logger';

/**
 * Client-side Logger
 *
 * A lightweight logging utility for browser-side code that provides different log levels
 * and metric tracking. Debug and trace logs are automatically disabled in production.
 *
 * @module clientLogger
 * @example
 * import { clientLogger } from './clientLogger';
 *
 * clientLogger.info('Application started');
 * clientLogger.error('Failed to fetch data', error);
 * clientLogger.metric('page_load_time', 150);
 */
export const clientLogger = {
    /**
     * Logs fatal errors that require immediate attention
     * @param {...unknown[]} args - Values to log
     * @example clientLogger.fatal('Database connection lost', error);
     */
    fatal: (...args: unknown[]): void => logger.error('[FATAL]', ...args),
    /**
     * Logs error messages
     * @param {...unknown[]} args - Values to log
     * @example clientLogger.error('Failed to load resource', error);
     */
    error: (...args: unknown[]): void => logger.error('[ERROR]', ...args),
    /**
     * Logs warning messages
     * @param {...unknown[]} args - Values to log
     * @example clientLogger.warn('API rate limit approaching', remaining);
     */
    warn: (...args: unknown[]): void => logger.warn('[WARN]', ...args),
    /**
     * Logs informational messages
     * @param {...unknown[]} args - Values to log
     * @example clientLogger.info('User preferences updated');
     */
    info: (...args: unknown[]): void => logger.info('[INFO]', ...args),
    /**
     * Logs debug messages (disabled in production)
     * @param {...unknown[]} args - Values to log
     * @example clientLogger.debug('Processing state update', newState);
     */
    debug: (...args: unknown[]): void => {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('[DEBUG]', ...args);
      }
    },
    /**
     * Logs detailed trace messages (disabled in production)
     * @param {...unknown[]} args - Values to log
     * @example clientLogger.trace('Function entry', { params });
     */
    trace: (...args: unknown[]): void => {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('[TRACE]', ...args);
      }
    },
    /**
     * Logs metric data for monitoring and analytics
     * @param {string} key - Metric name/identifier
     * @param {number | string} value - Metric value
     * @example clientLogger.metric('response_time_ms', 150);
     */
    metric: (key: string, value: number | string): void => logger.info('[METRIC]', { key, value })
};
