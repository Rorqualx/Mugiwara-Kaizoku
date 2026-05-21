/**
 * Rate Limiting Types Module
 *
 * Core type definitions for rate limiting utilities.
 * All rate limit modules import their types from here.
 *
 * Extracted from: rateLimit.ts (lines 1-105)
 */

/**
 * Rate limiting strategies
 */
export type RateLimitStrategy = 'fixed' | 'sliding' | 'token' | 'adaptive';

/**
 * Backoff strategy types
 */
export enum BackoffStrategy {
  NONE = 'none',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  JITTER = 'jitter'
}

/**
 * Request priority levels
 */
export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Configuration for rate limiter
 */
export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  name?: string;
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  maxConcurrent?: number;
  maxBurst?: number;
  delayAfterExceed?: number;
  adaptiveFactors?: {
    successDecreaseFactor: number;
    errorIncreaseFactor: number;
    minDelay: number;
    maxDelay: number;
  };
  // Extended configuration from unified version
  windowMs?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  baseDelayMs?: number;
  bucketSize?: number;
  refillRate?: number;
  backoffStrategy?: BackoffStrategy;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  adaptiveHeaders?: {
    limit?: string;
    remaining?: string;
    reset?: string;
  };
  priorityQueuing?: boolean;
  warningThreshold?: number;
  errorThreshold?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  remaining: number;
  reset: Date | null;
  limit: number;
  retryAfter?: number;
  canProceed?: boolean;
  waitMs?: number;
  strategy?: RateLimitStrategy;
}

/**
 * Request options for rate limiting
 */
export interface RateLimitRequestOptions {
  priority?: RequestPriority;
  weight?: number;
  bypassLimit?: boolean;
  metadata?: Record<string, unknown>;
}
