/**
 * Token Bucket Rate Limiter Module
 *
 * Implements a token bucket algorithm that accumulates tokens at a steady rate
 * and allows for bursts of traffic up to the bucket capacity.
 *
 * Extracted from: rateLimit.ts (lines 458-537)
 */

import { BaseRateLimiter } from '../base-limiter';

import type { RateLimitConfig } from '../types';

// ============================================================================
// Token Bucket Rate Limiter
// ============================================================================

/**
 * Token bucket rate limiter
 * Accumulates tokens at a steady rate and allows for bursts of traffic
 */
export class TokenBucketRateLimiter extends BaseRateLimiter {
  private refillRate: number; // tokens per ms
  private tokens: number;
  private maxTokens: number;
  private lastRefill: number = Date.now();

  constructor(config: RateLimitConfig) {
    super(config);

    // Determine refill rate
    if (config.requestsPerSecond) {
      this.refillRate = config.requestsPerSecond / 1000;
    } else if (config.requestsPerMinute) {
      this.refillRate = config.requestsPerMinute / (60 * 1000);
    } else if (config.requestsPerHour) {
      this.refillRate = config.requestsPerHour / (60 * 60 * 1000);
    } else {
      // Default rate of 1 per second
      this.refillRate = 1 / 1000;
    }

    // Set max tokens (with burst allowance)
    this.maxTokens = config.maxBurst ? this.limit + config.maxBurst : this.limit;
    this.tokens = this.maxTokens;
  }

  async acquire(cost: number = 1): Promise<void> {
    // Refill tokens
    this.refillTokens();

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

    // Check if we have enough tokens
    if (this.tokens < cost) {
      // Calculate time to wait for enough tokens
      const tokensNeeded = cost - this.tokens;
      const waitTime = Math.ceil(tokensNeeded / this.refillRate);

      // Fixed: no-promise-executor-return - wrap setTimeout without return
      await new Promise<void>(resolve => {
        setTimeout(resolve, waitTime);
      });

      // Refill tokens after waiting
      this.refillTokens();
    }

    // Consume tokens
    this.tokens -= cost;
    this.remaining = Math.floor(this.tokens);
    this.activeRequests++;

    // Calculate reset time (when remaining will be back to limit)
    const tokensToFull = this.maxTokens - this.tokens;
    const timeToFull = tokensToFull / this.refillRate;
    this.resetTime = new Date(Date.now() + timeToFull);
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
    this.remaining = Math.floor(this.tokens);
  }

  override updateFromResponse(response: unknown): void {
    super.updateFromResponse(response);
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }
}
