/**
 * Error Handler Type Definitions
 *
 * Comprehensive type definitions for the unified error handling system.
 * This is the foundation module that all other error handling modules depend on.
 *
 * Extracted from: ErrorHandler.ts (lines 15-73)
 */

// ============================================================================
// Error Type Enums
// ============================================================================

/**
 * Enumeration of all error types supported by the parser
 */
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

/**
 * Error severity levels for prioritization and handling
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Enhanced error interface with metadata and recovery information
 */
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

/**
 * Context information for error generation and handling
 */
export interface ErrorContext {
  url?: string;
  source?: string;
  adapter?: string;
  operation?: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  iterations?: number; // For loop detection
}

/**
 * Recovery strategy definition
 */
export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'cache' | 'default' | 'skip';
  action: () => Promise<unknown>;
  description: string;
}

/**
 * Error statistics and metrics
 */
export interface ErrorStatistics {
  total: number;
  byType: Record<ErrorType, number>;
  bySeverity: Record<ErrorSeverity, number>;
  bySource: Record<string, number>;
  recoverySuccess: number;
  recoveryFailure: number;
  recentErrors: ParserError[];
}
