/**
 * Adaptive Rate Limiter Strategy Module
 *
 * Implements a dynamic rate limiting strategy that adjusts delay based on
 * success/error patterns. Increases delay on errors and decreases on success.
 *
 * Extracted from: rateLimit.ts (lines 543-646)
 */

import { BaseRateLimiter } from '../base-limiter';

import type { RateLimitConfig } from '../types';

/**
 * Adaptive rate limiter that adjusts delay based on success/error patterns
 */
export class AdaptiveRateLimiter extends BaseRateLimiter {
  private currentDelay: number;
  private minDelay: number;
  private maxDelay: number;
  private successFactor: number;
  private errorFactor: number;
  private lastRequestTime: number = 0;

  constructor(config: RateLimitConfig) {
    super(config);

    const adaptiveFactors = config.adaptiveFactors ?? {
      successDecreaseFactor: 0.9,
      errorIncreaseFactor: 2.0,
      minDelay: 50,
      maxDelay: 5000
    };

    this.minDelay = adaptiveFactors.minDelay;
    this.maxDelay = adaptiveFactors.maxDelay;
    this.successFactor = adaptiveFactors.successDecreaseFactor;
    this.errorFactor = adaptiveFactors.errorIncreaseFactor;

    // Start with a reasonable delay
    this.currentDelay = 200;
  }

  async acquire(_cost: number = 1): Promise<void> {
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

    // Calculate time since last request
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;

    // Wait if necessary - FIXED: no-promise-executor-return
    if (timeSinceLast < this.currentDelay) {
      const waitTime = this.currentDelay - timeSinceLast;
      await new Promise<void>(resolve => {
        setTimeout(resolve, waitTime);
      });
    }

    // Update state
    this.lastRequestTime = Date.now();
    this.activeRequests++;
    this.remaining = 1; // Not really applicable to adaptive limiter
  }

  /**
   * Handle successful request by decreasing delay
   */
  handleSuccess(): void {
    this.currentDelay = Math.max(
      this.minDelay,
      this.currentDelay * this.successFactor
    );
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Handle error by increasing delay
   */
  handleError(retryAfter?: number): void {
    if (retryAfter) {
      // Use retry-after if available
      this.currentDelay = retryAfter * 1000;
    } else {
      // Otherwise increase by error factor
      this.currentDelay = Math.min(
        this.maxDelay,
        this.currentDelay * this.errorFactor
      );
    }
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  override updateFromResponse(response: unknown): void {
    super.updateFromResponse(response);

    // Consider a success if status code is 2xx
    let isSuccess = false;
    if (response && typeof response === 'object' && 'status' in response) {
      const responseObj = response as { status?: unknown };
      const status = responseObj.status;
      if (typeof status === 'number') {
        isSuccess = status >= 200 && status < 300;
      }
    }

    if (isSuccess) {
      this.handleSuccess();
    } else {
      this.handleError();
    }
  }
}
