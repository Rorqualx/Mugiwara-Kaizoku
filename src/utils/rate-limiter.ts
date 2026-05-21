// import { logger } from '../utils/logger';

/**
 * Rate Limiter for Provider APIs
 *
 * Manages API rate limits for different metadata providers to prevent
 * hitting rate limits and ensure smooth operation.
 */
interface RateLimitConfig {
  maxRequests: number;
  perInterval: number; // in milliseconds
  burstAllowance?: number; // Allow burst requests
}
interface QueuedRequest {
  id: string;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  priority?: number;
  timestamp: number;
}
export class ProviderRateLimiter {
  private static instance: ProviderRateLimiter | undefined;
  // Provider-specific configurations
  private readonly configs: Record<string, RateLimitConfig> = {
    fandom: {
      maxRequests: 5,
      perInterval: 1000, // 5 requests per second
      burstAllowance: 2
    },
    comicvine: {
      maxRequests: 200,
      perInterval: 3600000, // 200 requests per hour (API limit)
      burstAllowance: 5
    },
    anilist: {
      maxRequests: 90,
      perInterval: 60000, // 90 requests per minute
      burstAllowance: 10
    },
    wikipedia: {
      maxRequests: 10,
      perInterval: 1000, // 10 requests per second
      burstAllowance: 3
    }
  };
  // Tracking for each provider
  private requestCounts: Map<string, number> = new Map();
  private windowStarts: Map<string, number> = new Map();
  private queues: Map<string, QueuedRequest[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  // Metrics tracking
  private metrics: Map<string, {
    totalRequests: number;
    throttledRequests: number;
    averageWaitTime: number;
    lastError?: string;
  }> = new Map();
  private constructor() {
    // Initialize provider tracking
    for (const provider of Object.keys(this.configs)) {
      this.requestCounts.set(provider, 0);
      this.windowStarts.set(provider, Date.now());
      this.queues.set(provider, []);
      this.processing.set(provider, false);
      this.metrics.set(provider, {
        totalRequests: 0,
        throttledRequests: 0,
        averageWaitTime: 0
      });
    }
  }
  /**
   * Get singleton instance
   */
  static getInstance(): ProviderRateLimiter {
    ProviderRateLimiter.instance ??= new ProviderRateLimiter();
    return ProviderRateLimiter.instance;
  }
  /**
   * Execute a request with rate limiting
   */
  async execute<T>(provider: string, request: () => Promise<T>, options: {
    priority?: number;
    id?: string;
  } = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: options.id ?? `${provider}-${Date.now()}-${Math.random()}`,
        execute: request,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority: options.priority ?? 0,
        timestamp: Date.now()
      };
      // Add to queue
      this.enqueue(provider, queuedRequest);
      // Process queue
      void this.processQueue(provider);
    });
  }
  /**
   * Check if we can make a request now
   */
  canMakeRequest(provider: string): boolean {
    const config = this.configs[provider];
    if (!config)
    return true; // Unknown provider, allow
    const now = Date.now();
    const windowStart = this.windowStarts.get(provider) ?? now;
    const timeSinceWindowStart = now - windowStart;
    // Reset window if interval passed
    if (timeSinceWindowStart >= config.perInterval) {
      this.requestCounts.set(provider, 0);
      this.windowStarts.set(provider, now);
      return true;
    }
    const requestCount = this.requestCounts.get(provider) ?? 0;
    const maxWithBurst = config.maxRequests + (config.burstAllowance ?? 0);
    return requestCount < maxWithBurst;
  }
  /**
   * Get wait time until next request can be made
   */
  getWaitTime(provider: string): number {
    if (this.canMakeRequest(provider))
    return 0;
    const config = this.configs[provider];
    if (!config)
    return 0;
    const windowStart = this.windowStarts.get(provider) ?? Date.now();
    const timeSinceWindowStart = Date.now() - windowStart;
    const remainingTime = config.perInterval - timeSinceWindowStart;
    return Math.max(0, remainingTime);
  }
  /**
   * Get queue size for a provider
   */
  getQueueSize(provider: string): number {
    return this.queues.get(provider)?.length ?? 0;
  }
  /**
   * Get metrics for a provider
   */
  getMetrics(provider?: string): unknown {
    if (provider) {
      return this.metrics.get(provider);
    }
    // Return all metrics
    const allMetrics: Record<string, unknown> = {};
    for (const [p, m] of this.metrics.entries()) {
      allMetrics[p] = {
        ...m,
        queueSize: this.getQueueSize(p),
        currentRequestCount: this.requestCounts.get(p) ?? 0
      };
    }
    return allMetrics;
  }
  /**
   * Clear queue for a provider
   */
  clearQueue(provider: string): void {
    const queue = this.queues.get(provider);
    if (queue) {
      // Reject all queued requests
      for (const request of queue) {
        request.reject(new Error('Queue cleared'));
      }
      this.queues.set(provider, []);
    }
  }
  /**
   * Update configuration for a provider
   */
  updateConfig(provider: string, config: Partial<RateLimitConfig>): void {
    const existing = this.configs[provider] ?? {
      maxRequests: 10,
      perInterval: 1000
    };
    this.configs[provider] = {
      ...existing,
      ...config
    };
  }
  // Private methods
  private enqueue(provider: string, request: QueuedRequest): void {
    const queue = this.queues.get(provider) ?? [];
    // Add to queue based on priority
    const insertIndex = queue.findIndex((r) => (r.priority ?? 0) < (request.priority ?? 0));
    if (insertIndex === -1) {
      queue.push(request);
    } else
    {
      queue.splice(insertIndex, 0, request);
    }
    this.queues.set(provider, queue);
    // Update metrics
    const metrics = this.metrics.get(provider);
    if (metrics) {
      metrics.throttledRequests++;
    }
  }
  private async processQueue(provider: string): Promise<void> {
    // Prevent concurrent processing
    if (this.processing.get(provider))
    return;
    this.processing.set(provider, true);
    try {
      const queue = this.queues.get(provider) ?? [];
      while (queue.length > 0) {
        // Check if we can make a request
        if (!this.canMakeRequest(provider)) {
          // Wait until we can
          const waitTime = this.getWaitTime(provider);
          if (waitTime > 0) {
            // eslint-disable-next-line no-await-in-loop -- Sequential processing required: must wait for rate limit window before processing next request
            await this.sleep(waitTime);
          }
          continue;
        }
        // Get next request
        const request = queue.shift();
        if (!request)
        continue;
        // Update tracking
        const requestCount = this.requestCounts.get(provider) ?? 0;
        this.requestCounts.set(provider, requestCount + 1);
        // Update metrics
        const metrics = this.metrics.get(provider);
        if (metrics) {
          metrics.totalRequests++;
          const waitTime = Date.now() - request.timestamp;
          metrics.averageWaitTime =
          (metrics.averageWaitTime * (metrics.totalRequests - 1) + waitTime) /
          metrics.totalRequests;
        }
        // Execute request
        try {
          // eslint-disable-next-line no-await-in-loop -- Sequential processing required: requests must execute one at a time to respect rate limits
          const result = await request.execute();
          request.resolve(result);
        }
        catch (error: unknown) {
          request.reject(error);
          // Update error metrics
          if (metrics) {
            metrics.lastError = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
          }
          // Check if this is a rate limit error
          if (this.isRateLimitError(error)) {
            // Back off exponentially
            const backoffTime = this.calculateBackoff(provider);
            // eslint-disable-next-line no-await-in-loop -- Sequential processing required: must backoff after rate limit error before processing next request
            await this.sleep(backoffTime);
          }
        }
        // Small delay between requests to be nice to APIs
        // eslint-disable-next-line no-await-in-loop -- Sequential processing required: intentional delay between requests to prevent API abuse
        await this.sleep(50);
      }
    } finally
    {
      this.processing.set(provider, false);
    }
  }
  private isRateLimitError(error: unknown): boolean {
    if (!error)
    return false;

    // Type guard for error-like objects
    interface ErrorWithResponse {
      message?: string;
      response?: {
        status?: number;
      };
      statusCode?: number;
    }

    function isErrorLike(err: unknown): err is ErrorWithResponse {
      return typeof err === 'object' && err !== null;
    }

    if (!isErrorLike(error)) {
      return false;
    }

    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    const statusCode = error.response?.status ?? error.statusCode;

    return statusCode === 429 || // Too Many Requests
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('throttle');
  }
  private calculateBackoff(provider: string): number {
    const metrics = this.metrics.get(provider);
    const attemptCount = metrics?.throttledRequests ?? 1;
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptCount - 1), maxDelay);
    const jitter = Math.random() * 1000; // 0-1 second jitter
    return exponentialDelay + jitter;
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
// Export singleton instance
export const rateLimiter = ProviderRateLimiter.getInstance();
// Export types
export type { RateLimitConfig, QueuedRequest };