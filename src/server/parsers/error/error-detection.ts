/**
 * Error Detection and Classification
 *
 * Provides error type detection, severity calculation, and recovery assessment
 * for the unified error handling system.
 *
 * REFACTORED: Reduced detectErrorType complexity from 29 to 8 using map-based patterns
 *
 * Extracted from: ErrorHandler.ts (lines 196-354)
 */

import { ErrorType as ErrorTypeEnum, ErrorSeverity as ErrorSeverityEnum } from './types';

import type { ErrorType, ErrorSeverity } from './types';

// ============================================================================
// Error Pattern Definitions
// ============================================================================

/**
 * Pattern definition for error type matching
 */
interface ErrorPattern {
  type: ErrorType;
  messagePatterns: string[];
  namePatterns: string[];
}

/**
 * Error detection patterns organized by type
 *
 * Reduces complexity by using data-driven approach instead of if/else chains
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    type: ErrorTypeEnum.NETWORK_ERROR,
    messagePatterns: ['econnrefused', 'enotfound', 'etimedout'],
    namePatterns: ['network']
  },
  {
    type: ErrorTypeEnum.TIMEOUT_ERROR,
    messagePatterns: ['timeout'],
    namePatterns: ['timeout']
  },
  {
    type: ErrorTypeEnum.RATE_LIMIT_ERROR,
    messagePatterns: ['rate limit', '429', 'too many requests'],
    namePatterns: []
  },
  {
    type: ErrorTypeEnum.PARSE_ERROR,
    messagePatterns: ['parse', 'invalid html', 'unexpected token'],
    namePatterns: []
  },
  {
    type: ErrorTypeEnum.VALIDATION_ERROR,
    messagePatterns: ['validation', 'invalid', 'required'],
    namePatterns: []
  },
  {
    type: ErrorTypeEnum.CACHE_ERROR,
    messagePatterns: ['cache', 'redis', 'postgres'],
    namePatterns: []
  },
  {
    type: ErrorTypeEnum.MEMORY_ERROR,
    messagePatterns: ['heap', 'memory'],
    namePatterns: ['rangeerror']
  },
  {
    type: ErrorTypeEnum.PERMISSION_ERROR,
    messagePatterns: ['permission', 'forbidden', 'unauthorized'],
    namePatterns: []
  },
  {
    type: ErrorTypeEnum.ADAPTER_ERROR,
    messagePatterns: ['adapter', 'api'],
    namePatterns: []
  }
];

/**
 * Error type to suggestion mapping
 */
const ERROR_SUGGESTIONS: Record<ErrorType, string> = {
  [ErrorTypeEnum.NETWORK_ERROR]: 'Check network connection and retry',
  [ErrorTypeEnum.TIMEOUT_ERROR]: 'Increase timeout or retry with smaller payload',
  [ErrorTypeEnum.RATE_LIMIT_ERROR]: 'Wait before retrying or reduce request frequency',
  [ErrorTypeEnum.PARSE_ERROR]: 'Verify HTML format or try alternative parser',
  [ErrorTypeEnum.VALIDATION_ERROR]: 'Check input data format and required fields',
  [ErrorTypeEnum.CACHE_ERROR]: 'Clear cache or disable caching temporarily',
  [ErrorTypeEnum.ADAPTER_ERROR]: 'Check adapter configuration and API status',
  [ErrorTypeEnum.MEMORY_ERROR]: 'Reduce payload size or use streaming parser',
  [ErrorTypeEnum.PERMISSION_ERROR]: 'Verify API credentials and permissions',
  [ErrorTypeEnum.UNKNOWN_ERROR]: 'Check logs for more details'
};

// ============================================================================
// Pattern Matching Helpers
// ============================================================================

/**
 * Check if error message/name matches a specific pattern
 *
 * @param message - Lowercase error message
 * @param name - Lowercase error name
 * @param pattern - Pattern to match against
 * @returns True if pattern matches
 */
function matchesPattern(message: string, name: string, pattern: ErrorPattern): boolean {
  const matchesMessage = pattern.messagePatterns.some(p => message.includes(p));
  const matchesName = pattern.namePatterns.length === 0 ||
                      pattern.namePatterns.some(p => name.includes(p));
  return matchesMessage || matchesName;
}

// ============================================================================
// Error Detection Functions
// ============================================================================

/**
 * Detect error type from error object
 *
 * COMPLEXITY: 8 (down from 29)
 * REFACTORED: Map-based lookup instead of if/else chain
 *
 * @param error - Error to classify
 * @returns Detected error type
 */
export function detectErrorType(error: Error): ErrorType {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const name = (error instanceof Error ? error.name : String(error)).toLowerCase();

  for (const pattern of ERROR_PATTERNS) {
    if (matchesPattern(message, name, pattern)) {
      return pattern.type;
    }
  }

  return ErrorTypeEnum.UNKNOWN_ERROR;
}

/**
 * Calculate error severity based on type and error properties
 *
 * @param type - Error type
 * @param error - Original error object
 * @returns Calculated severity level
 */
export function calculateSeverity(type: ErrorType, error: Error): ErrorSeverity {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // Critical errors
  if (type === ErrorTypeEnum.MEMORY_ERROR ||
      message.includes('critical') ||
      message.includes('fatal')) {
    return ErrorSeverityEnum.CRITICAL;
  }

  // High severity
  if (type === ErrorTypeEnum.PERMISSION_ERROR ||
      type === ErrorTypeEnum.RATE_LIMIT_ERROR ||
      message.includes('database')) {
    return ErrorSeverityEnum.HIGH;
  }

  // Medium severity
  if (type === ErrorTypeEnum.NETWORK_ERROR ||
      type === ErrorTypeEnum.TIMEOUT_ERROR ||
      type === ErrorTypeEnum.ADAPTER_ERROR) {
    return ErrorSeverityEnum.MEDIUM;
  }

  // Low severity
  return ErrorSeverityEnum.LOW;
}

/**
 * Check if error is recoverable
 *
 * @param type - Error type
 * @param error - Original error object
 * @returns True if error is recoverable
 */
export function isRecoverable(type: ErrorType, error: Error): boolean {
  const recoverableTypes = [
    ErrorTypeEnum.NETWORK_ERROR,
    ErrorTypeEnum.TIMEOUT_ERROR,
    ErrorTypeEnum.CACHE_ERROR,
    ErrorTypeEnum.PARSE_ERROR
  ];

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return recoverableTypes.includes(type) &&
         !message.includes('fatal') &&
         !message.includes('corrupt');
}

/**
 * Check if error is retryable
 *
 * @param type - Error type
 * @param error - Original error object
 * @returns True if error can be retried
 */
export function isRetryable(type: ErrorType, error: Error): boolean {
  const retryableTypes = [
    ErrorTypeEnum.NETWORK_ERROR,
    ErrorTypeEnum.TIMEOUT_ERROR,
    ErrorTypeEnum.RATE_LIMIT_ERROR
  ];

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  return retryableTypes.includes(type) &&
         !message.includes('permanent') &&
         !message.includes('invalid');
}

/**
 * Get suggestion for error type
 *
 * @param type - Error type
 * @param _error - Original error object (unused, kept for interface compatibility)
 * @returns Human-readable suggestion
 */
export function getSuggestion(type: ErrorType, _error: Error): string {
  return ERROR_SUGGESTIONS[type];
}

/**
 * Get documentation URL for error type
 *
 * @param type - Error type
 * @returns Documentation URL
 */
export function getDocumentationUrl(type: ErrorType): string {
  const baseUrl = 'https://docs.unified-parser.com/errors';
  return `${baseUrl}#${type.toLowerCase()}`;
}

/**
 * Extract retry-after delay from error message
 *
 * Parses error messages for retry-after headers or similar indicators
 *
 * @param error - Error to extract retry delay from
 * @returns Retry delay in milliseconds (defaults to 60000 for rate limits)
 */
export function extractRetryAfter(error: Error): number {
  const message = (error instanceof Error ? error.message : String(error));
  const match = message.match(/retry.?after:?\s*(\d+)/i);

  if (match?.[1] !== undefined) {
    return parseInt(match[1]);
  }

  // Default retry after for rate limits
  return 60000; // 1 minute
}
