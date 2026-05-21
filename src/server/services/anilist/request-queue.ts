/**
 * AniList Request Queue
 *
 * A global request queue that serializes AniList API requests to prevent
 * triggering the burst limiter. All requests are processed sequentially
 * with a minimum delay between them.
 *
 * Features:
 * - Serializes all requests (only 1 in flight at a time)
 * - Enforces minimum delay between requests (2 seconds default)
 * - Monitors rate limit headers and slows down when low
 * - Supports request prioritization (higher priority processed first)
 *
 * @module server/services/anilist/request-queue
 */

import { logger } from '@/utils/logger';

/**
 * Priority levels for AniList requests
 */
export const AniListPriority = {
  /** Trending/hero banner - highest priority */
  CRITICAL: 10,
  /** Popular, Top100 - high priority */
  HIGH: 8,
  /** New Series, Light Novels, One Shots */
  MEDIUM: 5,
  /** Genre sections - lowest priority */
  LOW: 1,
} as const;

export type AniListPriorityLevel = (typeof AniListPriority)[keyof typeof AniListPriority];

/**
 * Queued request item
 */
interface QueuedRequest<T = unknown> {
  /** Function that executes the actual request */
  execute: () => Promise<T>;
  /** Resolve promise when request completes */
  resolve: (value: T) => void;
  /** Reject promise on error */
  reject: (error: unknown) => void;
  /** Priority level (higher = processed first) */
  priority: number;
  /** Description for logging */
  description: string | undefined;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * AniList Request Queue
 *
 * Serializes all AniList API requests to prevent burst limiting.
 * When AniList receives too many requests in a short time, it triggers
 * a burst limiter that may return cached/default responses.
 *
 * This queue ensures:
 * - Only 1 request is in flight at a time
 * - Minimum 2 seconds between requests
 * - Higher priority requests are processed first
 * - Additional slowdown when rate limit is running low
 */
class AniListRequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private remainingRequests = 90;
  private lastRequestTime = 0;

  /**
   * Minimum delay between requests (2 seconds)
   * This is conservative to avoid the burst limiter
   */
  private readonly MIN_DELAY_MS = 2000;

  /**
   * Additional delay when rate limit is low
   */
  private readonly LOW_RATE_LIMIT_DELAY_MS = 5000;

  /**
   * Threshold for considering rate limit "low"
   */
  private readonly LOW_RATE_LIMIT_THRESHOLD = 20;

  /**
   * Enqueue a request for processing
   *
   * @param request - Function that executes the actual API request
   * @param priority - Priority level (higher = processed first)
   * @param description - Description for logging
   * @returns Promise that resolves with the request result
   */
  async enqueue<T>(
    request: () => Promise<T>,
    priority: number = AniListPriority.LOW,
    description?: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: request as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        description,
      });

      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority);

      logger.debug(
        `[AniList Queue] Enqueued request: ${description ?? 'unknown'} (priority: ${priority}, queue size: ${this.queue.length})`
      );

      // Start processing if not already running
      void this.processQueue();
    });
  }

  /**
   * Process queued requests sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.debug(`[AniList Queue] Starting queue processing (${this.queue.length} items)`);

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      // Enforce minimum delay between requests
      const elapsed = Date.now() - this.lastRequestTime;
      if (elapsed < this.MIN_DELAY_MS) {
        const waitTime = this.MIN_DELAY_MS - elapsed;
        logger.debug(`[AniList Queue] Waiting ${waitTime}ms before next request`);
        // eslint-disable-next-line no-await-in-loop -- Rate limiting required between API requests to avoid AniList rate limits
        await delay(waitTime);
      }

      // If low on remaining requests, slow down more
      if (this.remainingRequests < this.LOW_RATE_LIMIT_THRESHOLD) {
        logger.warn(
          `[AniList Queue] Rate limit low (${this.remainingRequests}/${90}), applying ${this.LOW_RATE_LIMIT_DELAY_MS}ms cooldown`
        );
        // eslint-disable-next-line no-await-in-loop -- Rate limiting cooldown required when approaching API rate limit
        await delay(this.LOW_RATE_LIMIT_DELAY_MS);
      }

      try {
        logger.debug(
          `[AniList Queue] Executing request: ${item.description ?? 'unknown'} (remaining in queue: ${this.queue.length})`
        );
        this.lastRequestTime = Date.now();
        // eslint-disable-next-line no-await-in-loop -- Sequential queue processing - each request must complete before next to track rate limits
        const result = await item.execute();
        item.resolve(result);
      } catch (error) {
        logger.error(`[AniList Queue] Request failed: ${item.description ?? 'unknown'}`, { error });
        item.reject(error);
      }
    }

    this.isProcessing = false;
    logger.debug('[AniList Queue] Queue processing complete');
  }

  /**
   * Update the remaining rate limit count
   * Called after each request with the value from X-RateLimit-Remaining header
   *
   * @param remaining - Number of requests remaining in the current window
   */
  updateRateLimit(remaining: number): void {
    this.remainingRequests = remaining;
    logger.debug(`[AniList Queue] Rate limit updated: ${remaining}/90 remaining`);
  }

  /**
   * Get the current queue size
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Get the current remaining rate limit
   */
  get rateLimitRemaining(): number {
    return this.remainingRequests;
  }

  /**
   * Check if the queue is currently processing
   */
  get processing(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear all pending requests (for testing/cleanup)
   */
  clear(): void {
    const count = this.queue.length;
    this.queue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    logger.debug(`[AniList Queue] Cleared ${count} pending requests`);
  }
}

/**
 * Singleton instance of the AniList request queue
 */
export const anilistRequestQueue = new AniListRequestQueue();
