/**
 * Error Statistics and Pattern Detection
 *
 * Provides error tracking, pattern detection, and statistical analysis
 * for the unified error handling system.
 *
 * Extracted from: ErrorHandler.ts (lines 474-726)
 */

import { ErrorType, ErrorSeverity } from './types';

import type { ParserError, ErrorStatistics } from './types';
import type { EventEmitter } from 'events';


// ============================================================================
// Error Recording
// ============================================================================

/**
 * Record error in history
 */
export function recordError(
  error: ParserError,
  errors: ParserError[],
  errorPatterns: Map<string, number>,
  maxHistory: number
): void {
  errors.push(error);

  // Maintain max history
  if (errors.length > maxHistory) {
    errors.shift();
  }

  // Track error patterns
  const pattern = `${error.type}-${error.source ?? 'unknown'}`;
  errorPatterns.set(pattern, (errorPatterns.get(pattern) ?? 0) + 1);
}

// ============================================================================
// Threshold Checking
// ============================================================================

/**
 * Check if error thresholds exceeded
 */
export function checkErrorThresholds(
  error: ParserError,
  errors: ParserError[],
  errorThresholds: Map<ErrorType, number>,
  emitter: EventEmitter
): void {
  const count = getErrorCount(errors, error.type, 300000); // Last 5 minutes
  const threshold = errorThresholds.get(error.type) ?? 10;

  if (count > threshold) {
    emitter.emit('threshold-exceeded', {
      type: error.type,
      count,
      threshold
    });

    // Trigger circuit breaker or other protective measures
    if (error.severity === ErrorSeverity.CRITICAL) {
      emitter.emit('critical-threshold', error);
    }
  }
}

// ============================================================================
// Error Suppression
// ============================================================================

/**
 * Determine if error should be suppressed
 */
export function shouldSuppressError(
  error: ParserError,
  errors: ParserError[],
  suppressedErrors: Set<string>
): boolean {
  // Suppress if explicitly marked
  const key = `${error.type}-${error.message}`;
  if (suppressedErrors.has(key)) {
    return true;
  }

  // Suppress low severity validation errors after threshold
  if (error.type === ErrorType.VALIDATION_ERROR &&
      error.severity === ErrorSeverity.LOW) {
    const count = getErrorCount(errors, error.type, 60000); // Last minute
    return count > 10;
  }

  return false;
}

// ============================================================================
// Error Counting
// ============================================================================

/**
 * Get error count within time window
 */
export function getErrorCount(
  errors: ParserError[],
  type: ErrorType,
  windowMs: number
): number {
  const since = Date.now() - windowMs;
  return errors.filter(e =>
    e.type === type &&
    e.timestamp.getTime() > since
  ).length;
}

// ============================================================================
// Threshold Initialization
// ============================================================================

/**
 * Initialize error thresholds
 */
export function initializeThresholds(): Map<ErrorType, number> {
  const thresholds = new Map<ErrorType, number>();

  thresholds.set(ErrorType.NETWORK_ERROR, 20);
  thresholds.set(ErrorType.TIMEOUT_ERROR, 15);
  thresholds.set(ErrorType.RATE_LIMIT_ERROR, 5);
  thresholds.set(ErrorType.PARSE_ERROR, 30);
  thresholds.set(ErrorType.VALIDATION_ERROR, 50);
  thresholds.set(ErrorType.CACHE_ERROR, 10);
  thresholds.set(ErrorType.ADAPTER_ERROR, 15);
  thresholds.set(ErrorType.MEMORY_ERROR, 3);
  thresholds.set(ErrorType.PERMISSION_ERROR, 5);
  thresholds.set(ErrorType.UNKNOWN_ERROR, 25);

  return thresholds;
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Start pattern detection interval
 */
export function startPatternDetection(
  errors: ParserError[],
  emitter: EventEmitter
): NodeJS.Timeout {
  return setInterval(() => {
    detectErrorPatterns(errors, emitter);
  }, 60000); // Every minute
}

/**
 * Detect recurring error patterns
 */
export function detectErrorPatterns(
  errors: ParserError[],
  emitter: EventEmitter
): void {
  const recentErrors = errors.filter(e =>
    e.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
  );

  // Detect repeated errors
  const errorGroups = new Map<string, ParserError[]>();
  recentErrors.forEach(error => {
    const key = `${error.type}-${error.source ?? 'unknown'}`;
    if (!errorGroups.has(key)) {
      errorGroups.set(key, []);
    }
    const group = errorGroups.get(key);
    if (group !== undefined) {
      group.push(error);
    }
  });

  // Check for patterns
  errorGroups.forEach((groupErrors, key) => {
    if (groupErrors.length > 5) {
      emitter.emit('error-pattern', {
        pattern: key,
        count: groupErrors.length,
        errors: groupErrors.slice(0, 5)
      });
    }
  });
}

// ============================================================================
// Statistics Generation
// ============================================================================

/**
 * Get comprehensive error statistics
 */
export function getStatistics(errors: ParserError[]): ErrorStatistics {
  const stats: ErrorStatistics = {
    total: errors.length,
    byType: {} as Record<ErrorType, number>,
    bySeverity: {} as Record<ErrorSeverity, number>,
    bySource: {} as Record<string, number>,
    recoverySuccess: 0,
    recoveryFailure: 0,
    recentErrors: errors.slice(-10)
  };

  // Count by type
  Object.values(ErrorType).forEach(type => {
    stats.byType[type] = errors.filter(e => e.type === type).length;
  });

  // Count by severity
  Object.values(ErrorSeverity).forEach(severity => {
    stats.bySeverity[severity] = errors.filter(e => e.severity === severity).length;
  });

  // Count by source
  errors.forEach(error => {
    const source = error.source ?? 'unknown';
    stats.bySource[source] = (stats.bySource[source] ?? 0) + 1;
  });

  return stats;
}

// ============================================================================
// History Management
// ============================================================================

/**
 * Clear error history
 */
export function clearHistory(
  errorPatterns: Map<string, number>
): ParserError[] {
  errorPatterns.clear();
  return [];
}

// ============================================================================
// Error Export
// ============================================================================

/**
 * Export errors as JSON or CSV
 */
export function exportErrors(
  errors: ParserError[],
  format: 'json' | 'csv' = 'json'
): string {
  if (format === 'csv') {
    const headers = 'timestamp,type,severity,source,message,recoverable,retryable';
    const rows = errors.map(e =>
      `${e.timestamp.toISOString()},${e.type},${e.severity},${e.source ?? 'unknown'},` +
      `"${e.message}",${e.recoverable},${e.retryable}`
    );
    return [headers, ...rows].join('\n');
  }

  return JSON.stringify(errors, null, 2);
}
