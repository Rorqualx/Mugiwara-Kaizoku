import { logger } from '@/utils/logger';

/**
 * Server-side logger configuration for Next.js
 *
 * This module provides server-side logging functionality that is properly
 * bundled by Next.js. It serves as a fallback when the main logging
 * system cannot be initialized.
 */

// Default logger implementation using console
const serverLogger = {
  info: (...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'test') {
      logger.info('[Server]', ...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn('[Server]', ...args);
    }
  },
  error: (...args: unknown[]): void => {
    logger.error('[Server]', ...args);
  },
  debug: (...args: unknown[]): void => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[Server]', ...args);
    }
  },
};

// Export as default for dynamic imports
export default serverLogger;

// Also export named exports
export const { info, warn, error, debug } = serverLogger;
