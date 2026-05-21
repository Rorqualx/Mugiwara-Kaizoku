/**
 * Rate limiter extracted from the original client.ts
 * Reusable across all providers
 */

export interface RateLimitConfig {
  maxRequests: number;
  perMilliseconds: number;
}

export class RateLimiter {
  private requestTimestamps: number[] = [];

  constructor(
    private readonly maxRequests: number,
    private readonly perMilliseconds: number
  ) {}

  /**
   * Wait if rate limit would be exceeded
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.perMilliseconds
    );

    // Check if we've reached the limit
    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.requestTimestamps[0]!;
      const waitTime = this.perMilliseconds - (now - oldestTimestamp);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Clean up again after waiting
      this.requestTimestamps = this.requestTimestamps.filter(
        (timestamp) => Date.now() - timestamp < this.perMilliseconds
      );
    }

    // Add current timestamp
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Get time until next request is allowed (0 if immediate)
   */
  getWaitTime(): number {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.perMilliseconds
    );

    if (this.requestTimestamps.length < this.maxRequests) {
      return 0;
    }

    const oldestTimestamp = this.requestTimestamps[0]!;
    return Math.max(0, this.perMilliseconds - (now - oldestTimestamp));
  }
}
