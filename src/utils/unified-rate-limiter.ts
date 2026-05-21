// import { logger } from '../utils/logger';

/**
 * Unified Rate Limiter
 * Centralized rate limiting for all API clients
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}
export interface RateLimiterOptions {
  maxRequests?: number;
  perMilliseconds?: number;
  minTime?: number;
  maxConcurrent?: number;
  reservoir?: number;
  reservoirRefreshAmount?: number;
  reservoirRefreshInterval?: number;
}
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  private lastRunTime = 0;
  private tokens: number;
  private lastRefill: number = Date.now();
  private readonly options: Required<RateLimiterOptions>;
  constructor(options: RateLimiterOptions = {}) {
    this.options = {
      maxRequests: options.maxRequests ?? 10,
      perMilliseconds: options.perMilliseconds ?? 1000,
      minTime: options.minTime ?? 0,
      maxConcurrent: options.maxConcurrent ?? Infinity,
      reservoir: options.reservoir ?? options.maxRequests ?? 10,
      reservoirRefreshAmount: options.reservoirRefreshAmount ?? options.maxRequests ?? 10,
      reservoirRefreshInterval: options.reservoirRefreshInterval ?? options.perMilliseconds ?? 1000
    };
    this.tokens = this.options.reservoir;
  }
  /**
   * Schedule a function to run with rate limiting
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async (): Promise<void> => {
        try {
          const result = await fn();
          resolve(result);
        }
        catch (error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        } finally
        {
          this.running--;
          this.processQueue();
        }
      };
      this.queue.push(() => {
        this.running++;
        void execute();
      });
      this.processQueue();
    });
  }
  /**
   * Process the queue of waiting functions
   */
  private processQueue(): void {
    this.refillTokens();
    while (this.queue.length > 0 &&
    this.running < this.options.maxConcurrent &&
    this.tokens > 0 &&
    Date.now() - this.lastRunTime >= this.options.minTime) {
      const fn = this.queue.shift();
      if (fn !== undefined) {
        this.tokens--;
        this.lastRunTime = Date.now();
        fn();
      }
    }
  }
  /**
   * Refill tokens based on time elapsed
   */
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    if (timePassed >= this.options.reservoirRefreshInterval) {
      const refills = Math.floor(timePassed / this.options.reservoirRefreshInterval);
      this.tokens = Math.min(this.options.reservoir, this.tokens + refills * this.options.reservoirRefreshAmount);
      this.lastRefill = now;
    }
  }
  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(headers: Record<string, string>): RateLimitInfo | null {
    const info: Partial<RateLimitInfo> = {};
    // Standard rate limit headers
    if (headers['x-ratelimit-limit']) {
      info.limit = parseInt(headers['x-ratelimit-limit'], 10);
    }
    if (headers['x-ratelimit-remaining']) {
      info.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      info.reset = parseInt(headers['x-ratelimit-reset'], 10) * 1000; // Convert to milliseconds
    }
    if (headers['retry-after']) {
      info.retryAfter = parseInt(headers['retry-after'], 10) * 1000; // Convert to milliseconds
    }
    // GitHub style headers
    if (headers['x-ratelimit-limit']) {
      info.limit = parseInt(headers['x-ratelimit-limit'], 10);
    }
    if (headers['x-ratelimit-remaining']) {
      info.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    }
    if (headers['x-ratelimit-reset']) {
      info.reset = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
    }
    // Update internal state if we have rate limit info
    if (info.remaining !== undefined) {
      this.tokens = Math.min(this.tokens, info.remaining);
    }
    return info.limit !== undefined ? info as RateLimitInfo : null;
  }
  /**
   * Get current rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return {
      limit: this.options.reservoir,
      remaining: this.tokens,
      reset: this.lastRefill + this.options.reservoirRefreshInterval,
      retryAfter: this.options.minTime
    };
  }
  /**
   * Wait until rate limit resets
   */
  async waitForReset(retryAfter?: number): Promise<void> {
    const waitTime = retryAfter ?? this.options.reservoirRefreshInterval;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitTime);
    });
    this.tokens = this.options.reservoir;
    this.lastRefill = Date.now();
  }
  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }
  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
  /**
   * Get number of running tasks
   */
  getRunning(): number {
    return this.running;
  }
}
/**
 * Create a rate limiter instance with preset configurations
 */
export function createRateLimiter(preset?: 'strict' | 'normal' | 'relaxed', custom?: RateLimiterOptions): RateLimiter {
  const presets: Record<string, RateLimiterOptions> = {
    strict: {
      maxRequests: 1,
      perMilliseconds: 2000,
      minTime: 1000,
      maxConcurrent: 1
    },
    normal: {
      maxRequests: 10,
      perMilliseconds: 1000,
      minTime: 100,
      maxConcurrent: 3
    },
    relaxed: {
      maxRequests: 100,
      perMilliseconds: 1000,
      minTime: 0,
      maxConcurrent: 10
    }
  };
  const options = preset ? { ...presets[preset], ...custom } : custom ?? presets["normal"];
  return new RateLimiter(options);
}
/**
 * Global rate limiter instances for different services
 */
const rateLimiters = new Map<string, RateLimiter>();
/**
 * Get or create a rate limiter for a specific service
 */
export function getRateLimiter(service: string, options?: RateLimiterOptions): RateLimiter {
  const existing = rateLimiters.get(service);
  if (existing === undefined) {
    const newLimiter = new RateLimiter(options);
    rateLimiters.set(service, newLimiter);
    return newLimiter;
  }
  return existing;
}
/**
 * Clear all rate limiters
 */
export function clearAllRateLimiters(): void {
  rateLimiters.clear();
}
// Export default instance for backward compatibility
export const defaultRateLimiter = new RateLimiter();
export default {
  RateLimiter,
  createRateLimiter,
  getRateLimiter,
  clearAllRateLimiters,
  defaultRateLimiter
};