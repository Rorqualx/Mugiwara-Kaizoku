/**
 * Error Handler Utility Functions
 *
 * Helper functions for error handling operations including type guards,
 * delays, and error object creation.
 *
 * Extracted from: ErrorHandler.ts (lines 629-635, 640-644, 159-191)
 */

import type { ParserError, ErrorContext, ErrorType, ErrorSeverity } from './types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if error is a ParserError
 *
 * @param error - The error to check
 * @returns True if the error is a ParserError
 */
export function isParserError(error: unknown): error is ParserError {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'type' in error &&
    'severity' in error &&
    'timestamp' in error
  );
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Promise-based delay helper
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// ============================================================================
// Error Creation
// ============================================================================

/**
 * Error pattern definitions for type detection
 */
interface ErrorPattern {
  patterns: string[];
  type: ErrorType;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    patterns: ['network', 'econnrefused', 'enotfound', 'etimedout'],
    type: 'NETWORK_ERROR' as ErrorType
  },
  {
    patterns: ['timeout'],
    type: 'TIMEOUT_ERROR' as ErrorType
  },
  {
    patterns: ['rate limit', '429', 'too many requests'],
    type: 'RATE_LIMIT_ERROR' as ErrorType
  },
  {
    patterns: ['parse', 'invalid html', 'unexpected token'],
    type: 'PARSE_ERROR' as ErrorType
  },
  {
    patterns: ['validation', 'invalid', 'required'],
    type: 'VALIDATION_ERROR' as ErrorType
  },
  {
    patterns: ['cache', 'redis', 'postgres'],
    type: 'CACHE_ERROR' as ErrorType
  },
  {
    patterns: ['heap', 'memory', 'rangeerror'],
    type: 'MEMORY_ERROR' as ErrorType
  },
  {
    patterns: ['permission', 'forbidden', 'unauthorized'],
    type: 'PERMISSION_ERROR' as ErrorType
  },
  {
    patterns: ['adapter', 'api'],
    type: 'ADAPTER_ERROR' as ErrorType
  }
];

/**
 * Detect error type from error object
 *
 * Uses pattern matching to categorize errors based on message/name content.
 * Complexity reduced from 29 to 6 by using data-driven pattern matching.
 *
 * @param error - The error to analyze
 * @returns The detected error type
 */
function detectErrorType(error: Error): ErrorType {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const name = (error instanceof Error ? error.name : String(error)).toLowerCase();

  for (const { patterns, type } of ERROR_PATTERNS) {
    if (patterns.some(pattern => message.includes(pattern) || name.includes(pattern))) {
      return type;
    }
  }

  return 'UNKNOWN_ERROR' as ErrorType;
}

/**
 * Calculate error severity based on type and error details
 *
 * @param type - The error type
 * @param error - The error object
 * @returns The calculated error severity
 */
function calculateSeverity(type: ErrorType, error: Error): ErrorSeverity {
  // Critical errors
  if (type === ('MEMORY_ERROR' as ErrorType) ||
      (error instanceof Error ? error.message : String(error)).includes('critical') ||
      (error instanceof Error ? error.message : String(error)).includes('fatal')) {
    return 'CRITICAL' as ErrorSeverity;
  }

  // High severity
  if (type === ('PERMISSION_ERROR' as ErrorType) ||
      type === ('RATE_LIMIT_ERROR' as ErrorType) ||
      (error instanceof Error ? error.message : String(error)).includes('database')) {
    return 'HIGH' as ErrorSeverity;
  }

  // Medium severity
  if (type === ('NETWORK_ERROR' as ErrorType) ||
      type === ('TIMEOUT_ERROR' as ErrorType) ||
      type === ('ADAPTER_ERROR' as ErrorType)) {
    return 'MEDIUM' as ErrorSeverity;
  }

  // Low severity
  return 'LOW' as ErrorSeverity;
}

/**
 * Check if error is recoverable
 *
 * @param type - The error type
 * @param error - The error object
 * @returns True if the error is recoverable
 */
function isRecoverable(type: ErrorType, error: Error): boolean {
  const recoverableTypes = [
    'NETWORK_ERROR' as ErrorType,
    'TIMEOUT_ERROR' as ErrorType,
    'CACHE_ERROR' as ErrorType,
    'PARSE_ERROR' as ErrorType
  ];

  return recoverableTypes.includes(type) &&
         !(error instanceof Error ? error.message : String(error)).includes('fatal') &&
         !(error instanceof Error ? error.message : String(error)).includes('corrupt');
}

/**
 * Check if error is retryable
 *
 * @param type - The error type
 * @param error - The error object
 * @returns True if the error is retryable
 */
function isRetryable(type: ErrorType, error: Error): boolean {
  const retryableTypes = [
    'NETWORK_ERROR' as ErrorType,
    'TIMEOUT_ERROR' as ErrorType,
    'RATE_LIMIT_ERROR' as ErrorType
  ];

  return retryableTypes.includes(type) &&
         !(error instanceof Error ? error.message : String(error)).includes('permanent') &&
         !(error instanceof Error ? error.message : String(error)).includes('invalid');
}

/**
 * Get suggestion for error type
 *
 * @param type - The error type
 * @param _error - The error object (unused but kept for signature compatibility)
 * @returns User-friendly suggestion for handling the error
 */
function getSuggestion(type: ErrorType, _error: Error): string {
  const suggestions: Record<string, string> = {
    'NETWORK_ERROR': 'Check network connection and retry',
    'TIMEOUT_ERROR': 'Increase timeout or retry with smaller payload',
    'RATE_LIMIT_ERROR': 'Wait before retrying or reduce request frequency',
    'PARSE_ERROR': 'Verify HTML format or try alternative parser',
    'VALIDATION_ERROR': 'Check input data format and required fields',
    'CACHE_ERROR': 'Clear cache or disable caching temporarily',
    'ADAPTER_ERROR': 'Check adapter configuration and API status',
    'MEMORY_ERROR': 'Reduce payload size or use streaming parser',
    'PERMISSION_ERROR': 'Verify API credentials and permissions',
    'UNKNOWN_ERROR': 'Check logs for more details'
  };

  return suggestions[type] ?? 'Check logs for more details';
}

/**
 * Get documentation URL for error type
 *
 * @param type - The error type
 * @returns URL to relevant documentation
 */
function getDocumentationUrl(type: ErrorType): string {
  const baseUrl = 'https://docs.unified-parser.com/errors';
  return `${baseUrl}#${type.toLowerCase()}`;
}

/**
 * Extract retry after duration from error
 *
 * @param error - The error object
 * @returns Milliseconds to wait before retrying
 */
function extractRetryAfter(error: Error): number {
  const match = (error instanceof Error ? error.message : String(error)).match(/retry.?after:?\s*(\d+)/i);
  if (match?.[1] !== undefined) {
    return parseInt(match[1]);
  }

  // Default retry after for rate limits
  return 60000; // 1 minute
}

/**
 * Create a ParserError from a standard Error
 *
 * This function converts standard JavaScript errors into enriched ParserError
 * objects with additional metadata, recovery information, and user-friendly
 * suggestions.
 *
 * @param error - The error to convert
 * @param context - Optional context information about where the error occurred
 * @returns A fully-formed ParserError object
 */
export function createParserError(
  error: Error | ParserError,
  context?: ErrorContext
): ParserError {
  if (isParserError(error)) {
    return error;
  }

  const type = detectErrorType(error);
  const severity = calculateSeverity(type, error);
  const recoverable = isRecoverable(type, error);
  const retryable = isRetryable(type, error);

  const parserError = Object.assign(new Error(error.message), {
    type,
    severity,
    source: context?.source ?? 'unknown',
    timestamp: new Date(),
    recoverable,
    retryable,
    originalError: error,
    suggestion: getSuggestion(type, error),
    documentationUrl: getDocumentationUrl(type)
  }) as ParserError;

  // Add optional properties
  if (context !== undefined) {
    parserError.context = context as Record<string, unknown>;
  }

  if (type === ('RATE_LIMIT_ERROR' as ErrorType)) {
    parserError.retryAfter = extractRetryAfter(error);
  }

  return parserError;
}
