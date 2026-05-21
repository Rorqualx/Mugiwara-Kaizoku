/**
 * Error Type Classification Utilities
 *
 * Modular error type detection functions
 * Extracted to reduce complexity in ErrorHandler
 *
 * @module server/parsers/error/error-type-classifiers
 */

import { ErrorType } from './ErrorHandler';

/**
 * Check if error is a network error
 *
 * @param message - Error message
 * @param name - Error name
 * @returns Whether it's a network error
 */
export function isNetworkError(message: string, name: string): boolean {
  return (
    name.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout')
  );
}

/**
 * Check if error is a timeout error
 *
 * @param message - Error message
 * @param name - Error name
 * @returns Whether it's a timeout error
 */
export function isTimeoutError(message: string, name: string): boolean {
  return name.includes('timeout') || message.includes('timeout');
}

/**
 * Check if error is a rate limit error
 *
 * @param message - Error message
 * @returns Whether it's a rate limit error
 */
export function isRateLimitError(message: string): boolean {
  return (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests')
  );
}

/**
 * Check if error is a parse error
 *
 * @param message - Error message
 * @returns Whether it's a parse error
 */
export function isParseError(message: string): boolean {
  return (
    message.includes('parse') ||
    message.includes('invalid html') ||
    message.includes('unexpected token')
  );
}

/**
 * Check if error is a validation error
 *
 * @param message - Error message
 * @returns Whether it's a validation error
 */
export function isValidationError(message: string): boolean {
  return (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  );
}

/**
 * Check if error is a cache error
 *
 * @param message - Error message
 * @returns Whether it's a cache error
 */
export function isCacheError(message: string): boolean {
  return (
    message.includes('cache') ||
    message.includes('redis') ||
    message.includes('postgres')
  );
}

/**
 * Check if error is a memory error
 *
 * @param message - Error message
 * @param name - Error name
 * @returns Whether it's a memory error
 */
export function isMemoryError(message: string, name: string): boolean {
  return (
    message.includes('heap') ||
    message.includes('memory') ||
    name.includes('rangeerror')
  );
}

/**
 * Check if error is a permission error
 *
 * @param message - Error message
 * @returns Whether it's a permission error
 */
export function isPermissionError(message: string): boolean {
  return (
    message.includes('permission') ||
    message.includes('forbidden') ||
    message.includes('unauthorized')
  );
}

/**
 * Check if error is an adapter error
 *
 * @param message - Error message
 * @returns Whether it's an adapter error
 */
export function isAdapterError(message: string): boolean {
  return message.includes('adapter') || message.includes('api');
}

/**
 * Detect error type from error using modular classifiers
 *
 * @param error - The error to classify
 * @returns The detected error type
 */
export function detectErrorType(error: Error): ErrorType {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const name = (error instanceof Error ? error.name : String(error)).toLowerCase();

  // Check each error type using focused functions
  if (isNetworkError(message, name)) return ErrorType.NETWORK_ERROR;
  if (isTimeoutError(message, name)) return ErrorType.TIMEOUT_ERROR;
  if (isRateLimitError(message)) return ErrorType.RATE_LIMIT_ERROR;
  if (isParseError(message)) return ErrorType.PARSE_ERROR;
  if (isValidationError(message)) return ErrorType.VALIDATION_ERROR;
  if (isCacheError(message)) return ErrorType.CACHE_ERROR;
  if (isMemoryError(message, name)) return ErrorType.MEMORY_ERROR;
  if (isPermissionError(message)) return ErrorType.PERMISSION_ERROR;
  if (isAdapterError(message)) return ErrorType.ADAPTER_ERROR;

  return ErrorType.UNKNOWN_ERROR;
}
