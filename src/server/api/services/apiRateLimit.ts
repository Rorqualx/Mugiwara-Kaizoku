/**
 * API Rate Limiting Service
 * 
 * Provides rate limiting functionality for API requests
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

// Define rate limit status type
export interface RateLimitStatus {
  exceeded: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: Date;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

/**
 * RateLimiter class
 * 
 * Implements sliding window rate limiting for API requests
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly options: RateLimitOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimitOptions) {
    this.options = options;
    
    // Clean up old entries periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request is allowed under rate limits
   */
  check(key: string): Promise<AsyncResult<RateLimitStatus, Error>> {
    try {
      const now = Date.now();
      const windowStart = now - this.options.windowMs;

      // Get existing requests
      const requests = this.requests.get(key) ?? [];

      // Filter requests within window
      const validRequests = requests.filter(time => time > windowStart);

      // Check if limit exceeded
      if (validRequests.length >= this.options.maxRequests) {
        const oldestRequest = Math.min(...validRequests);
        const retryAfter = Math.ceil((oldestRequest + this.options.windowMs - now) / 1000);

        return Promise.resolve(createSuccessResult({
          exceeded: true,
          limit: this.options.maxRequests,
          remaining: 0,
          retryAfter,
          resetAt: new Date(oldestRequest + this.options.windowMs),
        }));
      }

      // Add current request
      validRequests.push(now);
      this.requests.set(key, validRequests);

      return Promise.resolve(createSuccessResult({
        exceeded: false,
        limit: this.options.maxRequests,
        remaining: this.options.maxRequests - validRequests.length,
        retryAfter: 0,
        resetAt: new Date(now + this.options.windowMs),
      }));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(
        error instanceof Error ? error : new Error('Rate limit check failed')
      ));
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Get current status without incrementing
   */
  getStatus(key: string): Promise<AsyncResult<RateLimitStatus, Error>> {
    try {
      const now = Date.now();
      const windowStart = now - this.options.windowMs;

      // Get existing requests
      const requests = this.requests.get(key) ?? [];

      // Filter requests within window
      const validRequests = requests.filter(time => time > windowStart);

      const remaining = Math.max(0, this.options.maxRequests - validRequests.length);
      const resetAt = validRequests.length > 0
        ? new Date(Math.min(...validRequests) + this.options.windowMs)
        : new Date(now + this.options.windowMs);

      return Promise.resolve(createSuccessResult({
        exceeded: remaining === 0,
        limit: this.options.maxRequests,
        remaining,
        retryAfter: 0,
        resetAt,
      }));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(
        error instanceof Error ? error : new Error('Failed to get rate limit status')
      ));
    }
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > now - this.options.windowMs);
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
}