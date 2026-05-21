/**
 * Comprehensive Error Handler for Unified Parser
 * 
 * Provides advanced error handling, recovery strategies, and diagnostics
 */

import { EventEmitter } from 'events';

import type { MetricsCollector } from '../monitoring/MetricsCollector';

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorType {
  PARSE_ERROR = 'PARSE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ParserError extends Error {
  type: ErrorType;
  severity: ErrorSeverity;
  source?: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
  retryAfter?: number;
  originalError?: Error;
  suggestion?: string;
  documentationUrl?: string;
}

export interface ErrorContext {
  url?: string;
  source?: string;
  adapter?: string;
  operation?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  iterations?: number; // For loop detection
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'cache' | 'default' | 'skip';
  action: () => Promise<unknown>;
  description: string;
}

export interface ErrorStatistics {
  total: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  bySource: Record<string, number>;
  recoverySuccess: number;
  recoveryFailure: number;
  recentErrors: ParserError[];
}

// ============================================================================
// Error Handler Implementation
// ============================================================================

export class ErrorHandler extends EventEmitter {
  private errors: ParserError[] = [];
  private errorPatterns: Map<string, number> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();
  private metrics?: MetricsCollector;
  private maxErrorHistory: number = 1000;
  private errorThresholds: Map<ErrorType, number> = new Map();
  private suppressedErrors: Set<string> = new Set();

  constructor(options: {
    metrics?: MetricsCollector;
    maxErrorHistory?: number;
    enableAutoRecovery?: boolean;
  } = {}) {
    super();

    if (options.metrics !== undefined) {
      this.metrics = options.metrics;
    }
    this.maxErrorHistory = options.maxErrorHistory ?? 1000;
    
    // Initialize error thresholds
    this.initializeThresholds();
    
    // Setup default recovery strategies
    this.setupDefaultRecoveryStrategies();
    
    // Start error pattern detection
    if (options.enableAutoRecovery !== false) {
      this.startPatternDetection();
    }
  }

  /**
   * Handle an error with recovery
   */
  async handleError(
    error: Error | ParserError,
    context?: ErrorContext
  ): Promise<{ recovered: boolean; result?: unknown }> {
    // Create parser error
    const parserError = this.createParserError(error, context);
    
    // Record error
    this.recordError(parserError);
    
    // Check if error should be suppressed
    if (this.shouldSuppressError(parserError)) {
      return { recovered: true };
    }
    
    // Emit error event
    this.emit('error', parserError);
    
    // Record metrics
    if (this.metrics) {
      this.metrics.increment('parser.error', 1, {
        type: parserError.type,
        severity: parserError.severity,
        source: parserError["source"] ?? ''
      });
    }
    
    // Check thresholds
    this.checkErrorThresholds(parserError);
    
    // Attempt recovery if possible
    if (parserError.recoverable) {
      const recoveryResult = await this.attemptRecovery(parserError);
      if (recoveryResult.success) {
        return { recovered: true, result: recoveryResult.result };
      }
    }
    
    return { recovered: false };
  }

  /**
   * Create a parser error from a standard error
   */
  createParserError(error: Error | ParserError, context?: ErrorContext): ParserError {
    if (this.isParserError(error)) {
      return error;
    }
    
    const type = this.detectErrorType(error);
    const severity = this.calculateSeverity(type, error);
    const recoverable = this.isRecoverable(type, error);
    const retryable = this.isRetryable(type, error);
    
    const parserError = Object.assign(new Error((error instanceof Error ? error.message : String(error))), {
      type,
      severity,
      source: context?.source ?? 'unknown',
      timestamp: new Date(),
      recoverable,
      retryable,
      originalError: error,
      suggestion: this.getSuggestion(type, error),
      documentationUrl: this.getDocumentationUrl(type)
    }) as ParserError;

    // Add optional properties conditionally
    if (context !== undefined) {
      parserError.context = context as Record<string, unknown>;
    }

    if (type === ErrorType.RATE_LIMIT_ERROR) {
      parserError.retryAfter = this.extractRetryAfter(error);
    }

    return parserError;
  }

  /**
   * Error type detection patterns - maps keywords to error types
   */
  private static readonly ERROR_PATTERNS: Array<{ keywords: string[]; type: ErrorType }> = [
    { keywords: ['network', 'fetch', 'econnrefused'], type: ErrorType.NETWORK_ERROR },
    { keywords: ['timeout', 'timed out'], type: ErrorType.TIMEOUT_ERROR },
    { keywords: ['rate limit', 'too many requests'], type: ErrorType.RATE_LIMIT_ERROR },
    { keywords: ['parse', 'invalid html', 'syntax'], type: ErrorType.PARSE_ERROR },
    { keywords: ['validation', 'invalid', 'required'], type: ErrorType.VALIDATION_ERROR },
    { keywords: ['cache'], type: ErrorType.CACHE_ERROR },
    { keywords: ['adapter', 'provider'], type: ErrorType.ADAPTER_ERROR },
    { keywords: ['memory', 'heap', 'out of memory'], type: ErrorType.MEMORY_ERROR },
    { keywords: ['permission', 'unauthorized', 'forbidden'], type: ErrorType.PERMISSION_ERROR }
  ];

  /**
   * Detect error type from error using pattern matching
   */
  private detectErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    for (const pattern of ErrorHandler.ERROR_PATTERNS) {
      if (pattern.keywords.some(keyword => message.includes(keyword))) {
        return pattern.type;
      }
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Calculate error severity
   */
  private calculateSeverity(type: ErrorType, error: Error): ErrorSeverity {
    // Critical errors
    if (type === ErrorType.MEMORY_ERROR || 
        (error instanceof Error ? error.message : String(error)).includes('critical') ||
        (error instanceof Error ? error.message : String(error)).includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity
    if (type === ErrorType.PERMISSION_ERROR ||
        type === ErrorType.RATE_LIMIT_ERROR ||
        (error instanceof Error ? error.message : String(error)).includes('database')) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity
    if (type === ErrorType.NETWORK_ERROR ||
        type === ErrorType.TIMEOUT_ERROR ||
        type === ErrorType.ADAPTER_ERROR) {
      return ErrorSeverity.MEDIUM;
    }
    
    // Low severity
    return ErrorSeverity.LOW;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(type: ErrorType, error: Error): boolean {
    const recoverableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.CACHE_ERROR,
      ErrorType.PARSE_ERROR
    ];
    
    return recoverableTypes.includes(type) && 
           !(error instanceof Error ? error.message : String(error)).includes('fatal') &&
           !(error instanceof Error ? error.message : String(error)).includes('corrupt');
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(type: ErrorType, error: Error): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.RATE_LIMIT_ERROR
    ];
    
    return retryableTypes.includes(type) &&
           !(error instanceof Error ? error.message : String(error)).includes('permanent') &&
           !(error instanceof Error ? error.message : String(error)).includes('invalid');
  }

  /**
   * Get suggestion for error
   */
  private getSuggestion(type: ErrorType, _error: Error): string {
    const suggestions: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: 'Check network connection and retry',
      [ErrorType.TIMEOUT_ERROR]: 'Increase timeout or retry with smaller payload',
      [ErrorType.RATE_LIMIT_ERROR]: 'Wait before retrying or reduce request frequency',
      [ErrorType.PARSE_ERROR]: 'Verify HTML format or try alternative parser',
      [ErrorType.VALIDATION_ERROR]: 'Check input data format and required fields',
      [ErrorType.CACHE_ERROR]: 'Clear cache or disable caching temporarily',
      [ErrorType.ADAPTER_ERROR]: 'Check adapter configuration and API status',
      [ErrorType.MEMORY_ERROR]: 'Reduce payload size or use streaming parser',
      [ErrorType.PERMISSION_ERROR]: 'Verify API credentials and permissions',
      [ErrorType.UNKNOWN_ERROR]: 'Check logs for more details'
    };

    return suggestions[type];
  }

  /**
   * Get documentation URL for error type
   */
  private getDocumentationUrl(type: ErrorType): string {
    const baseUrl = 'https://docs.unified-parser.com/errors';
    return `${baseUrl}#${type.toLowerCase()}`;
  }

  /**
   * Extract retry after from error
   */
  private extractRetryAfter(error: Error): number {
    const match = (error instanceof Error ? error.message : String(error)).match(/retry.?after:?\s*(\d+)/i);
    if (match?.[1] !== undefined) {
      return parseInt(match[1]);
    }

    // Default retry after for rate limits
    return 60000; // 1 minute
  }

  /**
   * Attempt recovery from error
   */
  private async attemptRecovery(error: ParserError): Promise<{
    success: boolean;
    result?: unknown;
  }> {
    const strategies = this.getRecoveryStrategies(error);

    // Sequential processing required: recovery strategies must be tried in priority order
    // Each strategy depends on the failure of previous strategies before attempting
    for (const strategy of strategies) {
      try {
        this.emit('recovery-attempt', { error, strategy: strategy.type });

        // eslint-disable-next-line no-await-in-loop -- Sequential execution required: strategies must be tried in order until one succeeds
        const result = await strategy.action();

        this.emit('recovery-success', { error, strategy: strategy.type, result });

        if (this.metrics) {
          this.metrics.increment('parser.recovery.success', 1, {
            type: error.type,
            strategy: strategy.type
          });
        }
        
        return { success: true, result };
      } catch (recoveryError: unknown) {const errorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
this.emit('recovery-failure', { 
          error, 
          strategy: strategy.type, 
          errorMessage 
        });
        
        if (this.metrics) {
          this.metrics.increment('parser.recovery.failure', 1, {
            type: error.type,
            strategy: strategy.type
          });
        }
      }
    }
    
    return { success: false };
  }

  /**
   * Get recovery strategies for error
   */
  private getRecoveryStrategies(error: ParserError): RecoveryStrategy[] {
    const key = `${error.type}-${error["source"]}`;
    const customStrategies = this.recoveryStrategies.get(key) ?? [];
    const defaultStrategies = this.getDefaultStrategies(error);
    
    return [...customStrategies, ...defaultStrategies];
  }

  /**
   * Get default recovery strategies
   */
  private getDefaultStrategies(error: ParserError): RecoveryStrategy[] {
    const strategies: RecoveryStrategy[] = [];
    
    switch (error.type) {
      case ErrorType.NETWORK_ERROR:
        strategies.push({
          type: 'retry',
          action: async () => {
            await this.delay(1000);
            return 'retry';
          },
          description: 'Retry after delay'
        });
        break;
        
      case ErrorType.CACHE_ERROR:
        strategies.push({
          type: 'fallback',
          action: () => Promise.resolve('bypass-cache'),
          description: 'Bypass cache and fetch directly'
        });
        break;
        
      case ErrorType.PARSE_ERROR:
        strategies.push({
          type: 'fallback',
          action: () => Promise.resolve('alternative-parser'),
          description: 'Use alternative parsing strategy'
        });
        break;
        
      case ErrorType.RATE_LIMIT_ERROR:
        strategies.push({
          type: 'retry',
          action: async () => {
            await this.delay(error.retryAfter ?? 60000);
            return 'retry';
          },
          description: 'Wait for rate limit reset'
        });
        break;

      default:
        // No specific recovery strategy for this error type
        break;
    }

    // Always add skip as last resort
    strategies.push({
      type: 'skip',
      action: () => Promise.resolve(null),
      description: 'Skip this operation'
    });
    
    return strategies;
  }

  /**
   * Record error
   */
  private recordError(error: ParserError): void {
    this.errors.push(error);
    
    // Maintain max history
    if (this.errors.length > this.maxErrorHistory) {
      this.errors.shift();
    }
    
    // Track error patterns
    const pattern = `${error.type}-${error["source"]}`;
    this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) ?? 0) + 1);
  }

  /**
   * Check error thresholds
   */
  private checkErrorThresholds(error: ParserError): void {
    const count = this.getErrorCount(error.type, 300000); // Last 5 minutes
    const threshold = this.errorThresholds.get(error.type) ?? 10;
    
    if (count > threshold) {
      this.emit('threshold-exceeded', {
        type: error.type,
        count,
        threshold
      });
      
      // Trigger circuit breaker or other protective measures
      if (error.severity === ErrorSeverity.CRITICAL) {
        this.emit('critical-threshold', error);
      }
    }
  }

  /**
   * Should suppress error
   */
  private shouldSuppressError(error: ParserError): boolean {
    // Suppress if explicitly marked
    const key = `${error.type}-${(error instanceof Error ? error.message : String(error))}`;
    if (this.suppressedErrors.has(key)) {
      return true;
    }
    
    // Suppress low severity validation errors after threshold
    if (error.type === ErrorType.VALIDATION_ERROR && 
        error.severity === ErrorSeverity.LOW) {
      const count = this.getErrorCount(error.type, 60000); // Last minute
      return count > 10;
    }
    
    return false;
  }

  /**
   * Get error count
   */
  private getErrorCount(type: ErrorType, windowMs: number): number {
    const since = Date.now() - windowMs;
    return this.errors.filter(e => 
      e.type === type && 
      e.timestamp.getTime() > since
    ).length;
  }

  /**
   * Setup default recovery strategies
   */
  private setupDefaultRecoveryStrategies(): void {
    // Network error recovery
    this.addRecoveryStrategy('NETWORK_ERROR-*', {
      type: 'retry',
      action: async () => {
        await this.delay(2000);
        return 'retry-with-backoff';
      },
      description: 'Retry with exponential backoff'
    });
    
    // Cache error recovery
    this.addRecoveryStrategy('CACHE_ERROR-*', {
      type: 'fallback',
      action: () => Promise.resolve('bypass-cache'),
      description: 'Bypass cache layer'
    });
    
    // Memory error recovery
    this.addRecoveryStrategy('MEMORY_ERROR-*', {
      type: 'fallback',
      action: () => Promise.resolve('use-streaming'),
      description: 'Switch to streaming parser'
    });
  }

  /**
   * Initialize error thresholds
   */
  private initializeThresholds(): void {
    this.errorThresholds.set(ErrorType.NETWORK_ERROR, 20);
    this.errorThresholds.set(ErrorType.TIMEOUT_ERROR, 15);
    this.errorThresholds.set(ErrorType.RATE_LIMIT_ERROR, 5);
    this.errorThresholds.set(ErrorType.PARSE_ERROR, 30);
    this.errorThresholds.set(ErrorType.VALIDATION_ERROR, 50);
    this.errorThresholds.set(ErrorType.CACHE_ERROR, 10);
    this.errorThresholds.set(ErrorType.ADAPTER_ERROR, 15);
    this.errorThresholds.set(ErrorType.MEMORY_ERROR, 3);
    this.errorThresholds.set(ErrorType.PERMISSION_ERROR, 5);
    this.errorThresholds.set(ErrorType.UNKNOWN_ERROR, 25);
  }

  /**
   * Start pattern detection
   */
  private startPatternDetection(): void {
    setInterval(() => {
      this.detectErrorPatterns();
    }, 60000); // Every minute
  }

  /**
   * Detect error patterns
   */
  private detectErrorPatterns(): void {
    const recentErrors = this.errors.filter(e => 
      e.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
    );
    
    // Detect repeated errors
    const errorGroups = new Map<string, ParserError[]>();
    recentErrors.forEach(error => {
      const key = `${error.type}-${error["source"]}`;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      const group = errorGroups.get(key);
      if (group) {
        group.push(error);
      }
    });
    
    // Check for patterns
    errorGroups.forEach((errors, key) => {
      if (errors.length > 5) {
        this.emit('error-pattern', {
          pattern: key,
          count: errors.length,
          errors: errors.slice(0, 5)
        });
      }
    });
  }

  /**
   * Check if error is parser error
   */
  private isParserError(error: unknown): error is ParserError {
    return Boolean(error &&
           typeof error === 'object' &&
           'type' in error &&
           'severity' in error &&
           'timestamp' in error);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(pattern: string, strategy: RecoveryStrategy): void {
    if (!this.recoveryStrategies.has(pattern)) {
      this.recoveryStrategies.set(pattern, []);
    }
    const strategies = this.recoveryStrategies.get(pattern);
    if (strategies) {
      strategies.push(strategy);
    }
  }

  /**
   * Suppress specific errors
   */
  suppressError(type: ErrorType, message?: string): void {
    const key = message ? `${type}-${message}` : type;
    this.suppressedErrors.add(key);
  }

  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      total: this.errors.length,
      byType: {} as Record<ErrorType, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      bySource: {} as Record<string, number>,
      recoverySuccess: 0,
      recoveryFailure: 0,
      recentErrors: this.errors.slice(-10)
    };
    
    // Count by type
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = this.errors.filter(e => e.type === type).length;
    });
    
    // Count by severity
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = this.errors.filter(e => e.severity === severity).length;
    });
    
    // Count by source
    this.errors.forEach(error => {
      const source = error["source"] ?? 'unknown';
      stats.bySource[source] = (stats.bySource[source] ?? 0) + 1;
    });
    
    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errors = [];
    this.errorPatterns.clear();
  }

  /**
   * Export errors for analysis
   */
  exportErrors(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = 'timestamp,type,severity,source,message,recoverable,retryable';
      const rows = this.errors.map(e => 
        `${e.timestamp.toISOString()},${e.type},${e.severity},${e["source"]},` +
        `"${e.message}",${e.recoverable},${e.retryable}`
      );
      return [headers, ...rows].join('\n');
    }
    
    return JSON.stringify(this.errors, null, 2);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createErrorHandler(options?: {
  metrics?: MetricsCollector;
  maxErrorHistory?: number;
  enableAutoRecovery?: boolean;
}): ErrorHandler {
  return new ErrorHandler(options);
}

/**
 * Wrap function with error handling
 */
export function withErrorHandling<T>(
  fn: (...args: unknown[]) => Promise<T>,
  handler: ErrorHandler,
  context?: ErrorContext
): (...args: unknown[]) => Promise<T> {
  return async (...args: unknown[]): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
const result = await handler.handleError(errorMessage as unknown as Error, context);
      if (result.recovered && result.result !== undefined) {
        return result.result as T;
      }
      throw error;
    }
  };
}