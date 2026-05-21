/**
 * Base Rate Limiter Module
 *
 * Abstract base class that all rate limiting strategies extend.
 * Provides common functionality for rate limit tracking and response parsing.
 *
 * Extracted from: rateLimit.ts (lines 110-299)
 */

import { EventEmitter } from 'events';

import type { RateLimitConfig, RateLimitInfo } from './types';

// ============================================================================
// Helper Functions (extracted to reduce complexity)
// ============================================================================

/**
 * Extracts a header value from multiple possible header names
 */
function extractHeaderValue(
  headers: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (headers[key] !== undefined && headers[key] !== null) {
      return headers[key];
    }
  }
  return undefined;
}

/**
 * Parses a header value as an integer
 */
function parseIntHeader(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = parseInt(String(value), 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parses a reset time value into a Date
 */
function parseResetTime(resetValue: number): Date {
  // If it's a Unix timestamp (usually > 1000000000)
  if (resetValue > 1000000000) {
    return new Date(resetValue * 1000);
  }
  // It's seconds from now
  return new Date(Date.now() + (resetValue * 1000));
}

/**
 * Parses a Retry-After header value
 */
function parseRetryAfter(retryAfterValue: string): number | undefined {
  // Retry-After could be seconds or a HTTP date
  if (/^\d+$/.test(retryAfterValue)) {
    const retryValue = parseInt(retryAfterValue, 10);
    return isNaN(retryValue) ? undefined : retryValue;
  }
  // It's a HTTP date
  const retryDate = new Date(retryAfterValue);
  const retryMs = retryDate.getTime() - Date.now();
  return isNaN(retryMs) ? undefined : Math.ceil(retryMs / 1000);
}

/**
 * Parses retry-after from an error object
 */
function parseErrorRetryAfter(retryAfter: unknown): number {
  let waitTime = 0;
  
  // If it's a number, use it directly
  if (typeof retryAfter === 'number') {
    waitTime = retryAfter * 1000; // Convert to ms
  }
  // If it's a string, try to parse it
  else if (typeof retryAfter === 'string') {
    // If it's a number as string, parse it
    if (/^\d+$/.test(retryAfter)) {
      waitTime = parseInt(retryAfter, 10) * 1000;
    }
    // If it's a HTTP date
    else {
      const retryDate = new Date(retryAfter);
      waitTime = retryDate.getTime() - Date.now();
    }
  }
  
  // Ensure wait time is reasonable (between 1s and 1h)
  return Math.max(1000, Math.min(waitTime, 3600000));
}

// ============================================================================
// Base Rate Limiter
// ============================================================================

/**
 * Base rate limiter class that all strategies extend
 */
export abstract class BaseRateLimiter extends EventEmitter {
  protected config: RateLimitConfig;
  protected limit: number;
  protected remaining: number;
  protected resetTime: Date | null = null;
  protected retryAfter: number | undefined;
  protected activeRequests: number = 0;
  
  constructor(config: RateLimitConfig) {
    super();
    this.config = config;
    
    // Determine rate limit from config
    if (config.requestsPerSecond) {
      this.limit = config.requestsPerSecond;
    } else if (config.requestsPerMinute) {
      this.limit = config.requestsPerMinute;
    } else if (config.requestsPerHour) {
      this.limit = config.requestsPerHour;
    } else {
      // Default limit of 60 requests per minute
      this.limit = 60;
    }
    
    this.remaining = this.limit;
  }
  
  /**
   * Abstract method to acquire permission to make a request
   */
  abstract acquire(cost?: number): Promise<void>;
  
  /**
   * Gets current rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    return {
      remaining: this.remaining,
      reset: this.resetTime,
      limit: this.limit,
      ...(this.retryAfter !== undefined ? { retryAfter: this.retryAfter } : {})
    };
  }
  
  /**
   * Updates rate limiter state based on response headers
   * 
   * Refactored to use helper functions to reduce complexity (was 27, now ~10)
   */
  updateFromResponse(response: unknown): void {
    if (!response || typeof response !== 'object' || !('headers' in response)) {
      return;
    }

    const responseObj = response as { headers?: Record<string, unknown> };
    const headers = responseObj.headers;

    if (!headers || typeof headers !== 'object') {
      return;
    }

    // Extract and parse limit header
    const limitValue = parseIntHeader(
      extractHeaderValue(headers, 'x-ratelimit-limit', 'x-rate-limit-limit', 'ratelimit-limit')
    );
    if (limitValue !== undefined) {
      this.limit = limitValue;
    }

    // Extract and parse remaining header
    const remainingValue = parseIntHeader(
      extractHeaderValue(headers, 'x-ratelimit-remaining', 'x-rate-limit-remaining', 'ratelimit-remaining')
    );
    if (remainingValue !== undefined) {
      this.remaining = remainingValue;
    }

    // Extract and parse reset header
    const resetValue = parseIntHeader(
      extractHeaderValue(headers, 'x-ratelimit-reset', 'x-rate-limit-reset', 'ratelimit-reset')
    );
    if (resetValue !== undefined) {
      this.resetTime = parseResetTime(resetValue);
    }

    // Extract and parse retry-after header
    const retryAfterHeader = extractHeaderValue(headers, 'retry-after');
    if (retryAfterHeader !== undefined && retryAfterHeader !== null) {
      const retryAfterSeconds = parseRetryAfter(String(retryAfterHeader));
      if (retryAfterSeconds !== undefined) {
        this.retryAfter = retryAfterSeconds;
      }
    }
  }
  
  /**
   * Handles rate limit errors and returns wait time in milliseconds
   */
  handleRateLimitError(error: unknown): number {
    let retryAfter: unknown = 60; // Default 60 seconds
    
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;
      const response = err['response'];
      let retryAfterValue = err['retryAfter'];

      if (response && typeof response === 'object') {
        const responseObj = response as Record<string, unknown>;
        const headers = responseObj['headers'];
        if (headers && typeof headers === 'object') {
          const headersObj = headers as Record<string, unknown>;
          retryAfterValue = headersObj['retry-after'];
        }
      }

      retryAfter = retryAfterValue ?? 60;
    }

    const waitTime = parseErrorRetryAfter(retryAfter);
    
    this.retryAfter = Math.ceil(waitTime / 1000);
    this.resetTime = new Date(Date.now() + waitTime);
    this.remaining = 0;
    
    return waitTime;
  }
  
  /**
   * Resets the rate limiter state
   */
  reset(): void {
    this.remaining = this.limit;
    this.resetTime = null;
    this.retryAfter = undefined;
    this.activeRequests = 0;
  }
}
