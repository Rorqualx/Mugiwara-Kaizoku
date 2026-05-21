/**
 * Rate Limiter Facade
 *
 * Main RateLimiter class that delegates to strategy-specific implementations.
 * Provides unified API for all rate limiting strategies.
 *
 * Extracted from: rateLimit.ts (lines 651-784)
 */

import { EventEmitter } from 'events';

import { BaseRateLimiter } from './base-limiter';
import { AdaptiveRateLimiter } from './strategies/adaptive';
import { FixedWindowRateLimiter } from './strategies/fixed-window';
import { SlidingWindowRateLimiter } from './strategies/sliding-window';
import { TokenBucketRateLimiter } from './strategies/token-bucket';
import { RequestPriority } from './types';

import type { RateLimitConfig, RateLimitInfo, RateLimitRequestOptions } from './types';

/**
 * Metrics tracked by the rate limiter
 */
export interface RateLimiterMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  queuedRequests: number;
  averageWaitTime: number;
}

/**
 * Main RateLimiter class that delegates to strategy-specific implementations
 */
export class RateLimiter extends EventEmitter {
  private limiter: BaseRateLimiter;
  private requestQueue: Array<{
    resolve: () => void;
    priority: RequestPriority;
    timestamp: number;
  }> = [];
  private metrics: RateLimiterMetrics = {
    totalRequests: 0,
    allowedRequests: 0,
    blockedRequests: 0,
    queuedRequests: 0,
    averageWaitTime: 0
  };

  constructor(config: RateLimitConfig) {
    super();
    // Create the appropriate limiter based on strategy
    switch (config.strategy) {
      case 'fixed':
        this.limiter = new FixedWindowRateLimiter(config);
        break;
      case 'sliding':
        this.limiter = new SlidingWindowRateLimiter(config);
        break;
      case 'token':
        this.limiter = new TokenBucketRateLimiter(config);
        break;
      case 'adaptive':
        this.limiter = new AdaptiveRateLimiter(config);
        break;
      default:
        // Default to sliding window
        this.limiter = new SlidingWindowRateLimiter(config);
    }

    // Forward events from limiter
    this.limiter.on('warning', (data) => this.emit('warning', data));
    this.limiter.on('error', (data) => this.emit('error', data));
  }

  /**
   * Acquires permission to make a request
   * @param cost The cost of the request (default: 1)
   * @returns A promise that resolves when the request can proceed
   */
  async acquire(cost: number = 1): Promise<void> {
    return this.limiter.acquire(cost);
  }

  /**
   * Updates rate limiter state based on response
   * @param response The HTTP response with rate limit headers
   */
  updateFromResponse(response: unknown): void {
    this.limiter.updateFromResponse(response);
  }

  /**
   * Handles rate limit errors
   * @param error The rate limit error
   * @returns Time to wait in ms
   */
  handleRateLimitError(error: unknown): number {
    return this.limiter.handleRateLimitError(error);
  }

  /**
   * Gets current rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.limiter.getRateLimitInfo();
  }

  /**
   * Resets the rate limiter state
   */
  reset(): void {
    this.limiter.reset();
    this.requestQueue = [];
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0
    };
  }

  /**
   * Wait for rate limit if needed (extended functionality)
   */
  async waitIfNeeded(options: RateLimitRequestOptions = {}): Promise<void> {
    const cost = options.weight ?? 1;
    if (options.bypassLimit && options.priority === RequestPriority.CRITICAL) {
      return;
    }
    return this.acquire(cost);
  }

  /**
   * Get current metrics
   */
  getMetrics(): RateLimiterMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if a request can proceed without waiting
   */
  checkLimit(options: RateLimitRequestOptions = {}): RateLimitInfo {
    const info = this.getRateLimitInfo();
    info.canProceed = info.remaining > (options.weight ?? 1);
    info.waitMs = info.canProceed ? 0 : (info.retryAfter ?? 1000);
    return info;
  }

  /**
   * Mark request as complete (for concurrency tracking)
   */
  requestComplete(): void {
    // Update activeRequests in limiter if applicable
    if ('activeRequests' in this.limiter) {
      const limiterWithRequests = this.limiter as BaseRateLimiter & { activeRequests: number };
      limiterWithRequests.activeRequests = Math.max(0, limiterWithRequests.activeRequests - 1);
    }
  }
}
