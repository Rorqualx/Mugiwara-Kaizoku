import { logger } from '../utils/logger';

/**
 * @module utils/admin-debug
 * @description Debug utility for troubleshooting admin creation and management
 * Provides structured logging, performance tracking, and server-side log aggregation
 *
 * @example
 * ```ts
 * // Log form submission
 * logFormInfo('Admin form submitted', formData);
 *
 * // Track API performance
 * startTiming('createAdmin');
 * await createAdminUser();
 * endTiming('createAdmin');
 * ```
 */
// Enable debug mode - configurable via environment
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production' ||
                      process.env['ENABLE_DEBUG'] === 'true';
/**
 * Log severity levels
 * @type {string}
 */
type LogType = 'INFO' | 'error' | 'WARN' | 'DEBUG';
/**
 * Log source contexts
 * @type {string}
 */
type LogContext = 'FORM' | 'API' | 'SERVER' | 'DATABASE';
/**
 * Core logging function that handles message formatting and output
 *
 * @param {LogType} type - Severity level of the log
 * @param {LogContext} context - Source context of the log
 * @param {string} message - Log message
 * @param {any} [data] - Optional data to include in log
 *
 * @example
 * ```ts
 * debugLog('error', 'API', 'Failed to create admin', { error });
 * ```
 */
export function debugLog(type: LogType, context: LogContext, message: string, data?: unknown): void {
  if (!DEBUG_ENABLED && type !== 'error') {
    return;
  }
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${type}] [${context}] ${message}`;
  const safeData = data ? sanitizeData(data) : undefined;
  switch (type) {
    case 'error':
      logger.error(formattedMessage, safeData ?? '');
      break;
    case 'WARN':
      logger.warn(formattedMessage, safeData ?? '');
      break;
    case 'INFO':
      logger.info(formattedMessage, safeData ?? '');
      break;
    case 'DEBUG':
      logger.debug(formattedMessage, safeData ?? '');
      break;
    default:
      logger.info(formattedMessage, safeData ?? '');
      break;
  }
}
/**
 * Form-related logging functions
 * Use these for tracking form interactions and validation
 */
export const logFormDebug = (message: string, data?: unknown): void => debugLog('DEBUG', 'FORM', message, data);
export const logFormInfo = (message: string, data?: unknown): void => debugLog('INFO', 'FORM', message, data);
export const logFormError = (message: string, data?: unknown): void => debugLog('error', 'FORM', message, data);
export const logApiDebug = (message: string, data?: unknown): void => debugLog('DEBUG', 'API', message, data);
export const logApiInfo = (message: string, data?: unknown): void => debugLog('INFO', 'API', message, data);
export const logApiError = (message: string, data?: unknown): void => debugLog('error', 'API', message, data);
export const logServerDebug = (message: string, data?: unknown): void => debugLog('DEBUG', 'SERVER', message, data);
export const logServerInfo = (message: string, data?: unknown): void => debugLog('INFO', 'SERVER', message, data);
export const logServerError = (message: string, data?: unknown): void => debugLog('error', 'SERVER', message, data);
export const logDbDebug = (message: string, data?: unknown): void => debugLog('DEBUG', 'DATABASE', message, data);
export const logDbInfo = (message: string, data?: unknown): void => debugLog('INFO', 'DATABASE', message, data);
export const logDbError = (message: string, data?: unknown): void => debugLog('error', 'DATABASE', message, data);
/**
 * Sanitizes data by removing sensitive information
 * Recursively processes objects to mask passwords, tokens, and secrets
 *
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data safe for logging
 *
 * @example
 * ```ts
 * const safe = sanitizeData({ password: '123', name: 'admin' });
 * // Returns { password: '******', name: 'admin' }
 * ```
 */
function sanitizeData(data: unknown): unknown {
  if (!data)
  return data;
  try {
    // Clone the data to avoid modifying the original
    // Type as unknown to avoid unsafe any type from JSON.parse
    const sanitized: unknown = JSON.parse(JSON.stringify(data));
    // Sanitize password fields
    if (typeof sanitized === 'object' && sanitized !== null) {
      // Type as Record<string, unknown> for safe iteration and property access
      const obj = sanitized as Record<string, unknown>;
      Object.keys(obj).forEach((key) => {
        const value = obj[key];
        if (key && (key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token'))) {
          obj[key] = '******';
        } else
        if (value && typeof value === 'object') {
          obj[key] = sanitizeData(value);
        }
      });
    }
    return sanitized;
  }
  catch (_e: unknown) {
    // If we can't stringify/parse (e.g., circular references), return a simple representation
    return typeof data === 'object' ? { toString: String(data) } : data;
  }
}
// Performance tracking
const performanceMarks: Record<string, number> = {};
/**
 * Start timing an operation
 * Use with endTiming() to measure performance
 *
 * @param {string} name - Identifier for the timing operation
 *
 * @example
 * ```ts
 * startTiming('adminCreation');
 * await createAdmin();
 * endTiming('adminCreation');
 * ```
 */
export function startTiming(name: string): void {
  performanceMarks[name] = Date.now();
  logFormDebug(`⏱️ Started timing: ${name}`);
}
/**
 * End timing an operation and log the duration
 * Must be called after startTiming() with the same name
 *
 * @param {string} name - Identifier matching a previous startTiming() call
 *
 * @example
 * ```ts
 * startTiming('adminCreation');
 * await createAdmin();
 * endTiming('adminCreation'); // Logs duration
 * ```
 */
export function endTiming(name: string): void {
  const startTime = performanceMarks[name];
  if (startTime) {
    const duration = Date.now() - startTime;
    logFormDebug(`⏱️ ${name} took ${duration}ms`);
    delete performanceMarks[name];
  } else
  {
    logFormDebug(`⏱️ Cannot end timing for ${name}: no start time found`);
  }
}