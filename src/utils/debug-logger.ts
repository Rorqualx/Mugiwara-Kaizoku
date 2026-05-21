import { logger } from '../utils/logger';

/**
 * Debug Logger Utility
 *
 * This utility provides enhanced logging capabilities for debugging the admin creation process.
 * It includes functions for logging at different levels, with timestamps and context information.
 */
// Enable debug mode - set to true to see detailed logs
export const DEBUG_ENABLED = true;
// Log levels
export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'error',
  DEBUG = 'DEBUG',
}
// Log contexts to categorize logs
export enum LogContext {
  CLIENT = 'CLIENT',
  API = 'API',
  SERVER_ACTION = 'SERVER_ACTION',
  DATABASE = 'DATABASE',
  FORM = 'FORM',
  NETWORK = 'NETWORK',
}
// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  message: string;
  data?: unknown;
}
// Array to store logs in memory
const logStore: LogEntry[] = [];
/**
 * Main logging function
 */
export function log(level: LogLevel, context: LogContext, message: string, data?: unknown): void {
  // Create log entry
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    data: data ? sanitizeData(data) : undefined
  };
  // Store log
  logStore.push(entry);
  // Output to console with formatting
  const formattedMessage = `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;
  switch (level) {
    case LogLevel.ERROR:
      logger.error(formattedMessage, entry.data ?? '');
      break;
    case LogLevel.WARN:
      logger.warn(formattedMessage, entry.data ?? '');
      break;
    case LogLevel.INFO:
      logger.info(formattedMessage, entry.data ?? '');
      break;
    case LogLevel.DEBUG:
      logger.debug(formattedMessage, entry.data ?? '');
      break;
    default:
      // Handle unexpected log levels by logging at info level
      logger.info(formattedMessage, entry.data ?? '');
      break;
  }
}
/**
 * Convenience logging functions
 */
export const logInfo = (context: LogContext, message: string, data?: unknown): void => log(LogLevel.INFO, context, message, data);
export const logWarn = (context: LogContext, message: string, data?: unknown): void => log(LogLevel.WARN, context, message, data);
export const logError = (context: LogContext, message: string, data?: unknown): void => log(LogLevel.ERROR, context, message, data);
export const logDebug = (context: LogContext, message: string, data?: unknown): void => log(LogLevel.DEBUG, context, message, data);
/**
 * Get all stored logs
 */
export function getAllLogs(): LogEntry[] {
  return [...logStore];
}
/**
 * Clear all stored logs
 */
export function clearLogs(): void {
  logStore.length = 0;
}
/**
 * Sanitize sensitive data before logging
 */
function sanitizeData(data: unknown): unknown {
  if (!data) {
    return data;
  }
  try {
    // Clone the data to avoid modifying the original
    const parsed: unknown = JSON.parse(JSON.stringify(data));

    // Type guard: ensure parsed is an object with string keys
    if (typeof parsed !== 'object' || parsed === null) {
      return parsed;
    }

    // Type-safe assignment with proper narrowing
    const sanitized = parsed as Record<string, unknown>;

    // Sanitize password fields
    Object.keys(sanitized).forEach((key) => {
      const value = sanitized[key];

      if (key && (key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('token'))) {
        sanitized[key] = '******';
      } else if (value && typeof value === 'object') {
        // Type-safe recursive call
        sanitized[key] = sanitizeData(value);
      }
    });

    return sanitized;
  } catch (_e: unknown) {
    // If we can't stringify/parse (e.g., circular references), return a simple representation
    return typeof data === 'object' ? { toString: String(data) } : data;
  }
}
// Performance measurement utilities
const performanceMarks: Record<string, number> = {};
export function startMeasure(name: string): void {
  performanceMarks[name] = Date.now();
  logDebug(LogContext.CLIENT, `⏱️ Started measuring: ${name}`);
}
export function endMeasure(name: string): void {
  if (performanceMarks[name]) {
    // Use nullish coalescing operator instead of non-null assertion
    const duration = Date.now() - (performanceMarks[name] ?? 0);
    logDebug(LogContext.CLIENT, `⏱️ ${name} took ${duration}ms`);
    delete performanceMarks[name];
  }
}