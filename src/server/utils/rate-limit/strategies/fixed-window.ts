/**
 * Fixed Window Rate Limiter Strategy
 *
 * Simple counter that resets at fixed intervals.
 * Best for APIs with simple rate limit windows.
 *
 * Extracted from: rateLimit.ts (lines 305-373)
 */

import { BaseRateLimiter } from '../base-limiter';

import type { RateLimitConfig } from '../types';

/**
 * Fixed window rate limiter
 * Simple counter that resets at fixed intervals
 */
export class FixedWindowRateLimiter extends BaseRateLimiter {
  private windowMs: number;
  private requests: number = 0;
  private windowStart: number = Date.now();

  constructor(config: RateLimitConfig) {
    super(config);

    // Determine window size
    if (config.requestsPerSecond) {
      this.windowMs = 1000;
    } else if (config.requestsPerMinute) {
      this.windowMs = 60 * 1000;
    } else if (config.requestsPerHour) {
      this.windowMs = 60 * 60 * 1000;
    } else {
      // Default window of 1 minute
      this.windowMs = 60 * 1000;
    }

    // Set initial reset time
    this.resetTime = new Date(this.windowStart + this.windowMs);
  }

  async acquire(cost: number = 1): Promise<void> {
    // Check if window has expired
    const now = Date.now();
    if (now >= this.windowStart + this.windowMs) {
      // Reset window
      this.windowStart = now;
      this.requests = 0;
      this.resetTime = new Date(this.windowStart + this.windowMs);
    }

    // Check for concurrency limit
    if (this.config.maxConcurrent && this.activeRequests >= this.config.maxConcurrent) {
      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          if (this.activeRequests < (this.config.maxConcurrent ?? 1)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    // Check if rate limit is exceeded
    if (this.requests + cost > this.limit) {
      // Calculate time to wait until next window
      const waitTime = this.windowStart + this.windowMs - now;
      await new Promise<void>(resolve => {
        setTimeout(resolve, waitTime);
      });

      // Reset window
      this.windowStart = Date.now();
      this.requests = 0;
      this.resetTime = new Date(this.windowStart + this.windowMs);
    }

    // Increment counters
    this.requests += cost;
    this.remaining = this.limit - this.requests;
    this.activeRequests++;
  }

  override updateFromResponse(response: unknown): void {
    super.updateFromResponse(response);
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }
}
