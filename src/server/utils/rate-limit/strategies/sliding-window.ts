/**
 * Sliding Window Rate Limiter Strategy
 *
 * Distributes requests more evenly by tracking requests over a sliding window.
 * Better than fixed window for sustained traffic.
 *
 * Extracted from: rateLimit.ts (lines 379-452)
 */

import { BaseRateLimiter } from '../base-limiter';

import type { RateLimitConfig } from '../types';

/**
 * Sliding window rate limiter
 * Distributes requests more evenly by tracking requests over a sliding window
 */
export class SlidingWindowRateLimiter extends BaseRateLimiter {
  private windowMs: number;
  private requestTimestamps: number[] = [];

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
  }

  async acquire(cost: number = 1): Promise<void> {
    // Remove expired timestamps
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > cutoff
    );

    // Check for concurrency limit
    if (
      this.config.maxConcurrent &&
      this.activeRequests >= this.config.maxConcurrent
    ) {
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.activeRequests < (this.config.maxConcurrent ?? 1)) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    // Check if rate limit is exceeded
    if (this.requestTimestamps.length + cost > this.limit) {
      // Wait until enough requests expire
      const oldestRequest = this.requestTimestamps[0];
      if (!oldestRequest) return; // Safety check
      const waitTime = oldestRequest + this.windowMs - now;

      // FIX: Use void Promise to avoid no-promise-executor-return ESLint error
      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitTime);
      });

      // Recalculate timestamps after waiting
      return this.acquire(cost);
    }

    // Add timestamps for this request
    for (let i = 0; i < cost; i++) {
      this.requestTimestamps.push(now);
    }

    // Update state
    this.remaining = this.limit - this.requestTimestamps.length;
    this.activeRequests++;

    // Set reset time to when the oldest request expires
    if (this.requestTimestamps.length > 0) {
      const firstTimestamp = this.requestTimestamps[0];
      if (firstTimestamp !== undefined) {
        this.resetTime = new Date(firstTimestamp + this.windowMs);
      }
    }
  }

  override updateFromResponse(response: unknown): void {
    super.updateFromResponse(response);
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }
}
