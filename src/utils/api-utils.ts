/**
 * API Utilities
 *
 * This module provides shared utilities for API clients and adapters.
 */
import { ComicVineRateLimiter } from '../server/services/comicvine/modules/rateLimiter';
import { ComicVineRetryHandler } from '../server/services/comicvine/modules/retryHandler';
import { VelocityDetector } from '../server/services/comicvine/modules/velocityDetector';
import { createSuccessResult, createErrorResult } from '../utils/async-result';
import { ApiError } from '../utils/error-handling';
import { logger } from '../utils/logger';

import type { AsyncResult} from '../utils/async-result';
// Create singleton instances
let globalRateLimiter: ComicVineRateLimiter | null = null;
let globalVelocityDetector: VelocityDetector | null = null;
let globalRetryHandler: ComicVineRetryHandler | null = null;
/**
 * Get or create the global rate limiter instance
 */
function getRateLimiter(): ComicVineRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new ComicVineRateLimiter({
      maxRequestsPerHour: 200,
      minDelayMs: 1000,
      safeDelayMs: 2000,
      maxDelayMs: 5000,
      warningThreshold: 0.75
    });
    logger.info('Global ComicVine rate limiter initialized');
  }
  return globalRateLimiter;
}
/**
 * Get or create the global velocity detector instance
 */
function getVelocityDetector(): VelocityDetector {
  if (!globalVelocityDetector) {
    globalVelocityDetector = new VelocityDetector({
      minJitterMs: 100,
      maxJitterMs: 500,
      burstThreshold: 5,
      burstCooldownMs: 10000,
      humanizeRequests: true
    });
    logger.info('Global velocity detector initialized');
  }
  return globalVelocityDetector;
}
/**
 * Get or create the global retry handler instance
 */
function getRetryHandler(): ComicVineRetryHandler {
  if (!globalRetryHandler) {
    globalRetryHandler = new ComicVineRetryHandler({
      maxRetries: 5,
      baseDelayMs: 2000,
      maxDelayMs: 64000,
      jitterMs: 500
    });
    logger.info('Global retry handler initialized');
  }
  return globalRetryHandler;
}
/**
 * Enhanced throttle request with full protection
 *
 * Includes:
 * - Rate limiting (200 requests/hour)
 * - Velocity detection prevention
 * - Retry logic with exponential backoff
 * - Proper error handling
 *
 * @param requestFn The function to execute
 * @param resource The resource type for rate limiting (e.g., 'volumes', 'issues')
 * @param operation Optional operation name for logging
 * @returns The result of the request function
 */
export async function throttleRequestEnhanced<T>(requestFn: () => Promise<T>, resource: string = 'global', operation?: string): Promise<AsyncResult<T>> {
  const rateLimiter = getRateLimiter();
  const velocityDetector = getVelocityDetector();
  const retryHandler = getRetryHandler();
  // Create a wrapped function that includes rate limiting and velocity detection
  const rateLimitedRequest = async (): Promise<T> => {
    // Log current rate limit status
    const stats = rateLimiter.getStats(resource);
    if (stats.usagePercentage > 50) {
      logger.warn('ComicVine API usage above 50%', {
        resource,
        operation,
        requestsThisHour: stats.requestsThisHour,
        limit: stats.limit,
        usagePercentage: stats.usagePercentage.toFixed(1) + '%'
      });
    }
    // Check velocity detection stats
    const velocityStats = velocityDetector.getStats();
    if (velocityStats.velocityScore > 0.5) {
      logger.warn('High velocity detected', {
        score: velocityStats.velocityScore.toFixed(2),
        recommendation: velocityStats.recommendation,
        operation
      });
    }
    // Acquire rate limit slot (will wait if necessary)
    await rateLimiter.acquireSlot(resource);
    // Calculate and apply additional velocity prevention delay
    const baseDelay = rateLimiter.getDelayMs(resource);
    const additionalDelay = velocityDetector.calculateAdditionalDelay(baseDelay, resource);
    if (additionalDelay > 0) {
      logger.debug('Applying velocity prevention delay', {
        resource,
        operation,
        baseDelayMs: baseDelay,
        additionalDelayMs: additionalDelay,
        totalDelayMs: baseDelay + additionalDelay
      });
      await new Promise((resolve) => {
        setTimeout(resolve, additionalDelay);
      });
    }
    // Execute the actual request
    const result = await requestFn();
    // Reset backoff on success
    rateLimiter.resetBackoff(resource);
    return result;
  };
  try {
    // Execute with retry logic
    const retryOptions: { resource: string; operation?: string } = {
      resource,
      ...(operation !== undefined ? { operation } : {})
    };
    const result = await retryHandler.executeWithRetry(rateLimitedRequest, retryOptions);
    return createSuccessResult<T>(result);
  }
  catch (error: unknown) {
    // Handle rate limit errors specifically
    if (error instanceof ApiError) {
      if (error.statusCode === 429) {
        logger.error('Rate limit exceeded after retries', {
          resource,
          operation,
          error: (error instanceof Error ? error.message : String(error))
        });
        rateLimiter.handleRateLimitError(resource);
      } else
      if (error.statusCode && error.statusCode >= 500) {
        logger.error('Server error after retries', {
          resource,
          operation,
          statusCode: error.statusCode,
          error: (error instanceof Error ? error.message : String(error))
        });
      }
    }
    return createErrorResult(error instanceof Error ?
    error :
    new Error('Unknown error during throttled request'));
  }
}
/**
 * Throttles a request to prevent rate limiting
 * This now includes retry logic by default for backward compatibility
 *
 * @param requestFn The function to execute
 * @param delay The delay between requests in milliseconds (deprecated parameter, kept for compatibility)
 * @param resource The resource type for rate limiting (e.g., 'volumes', 'issues')
 * @returns The result of the request function
 */
export async function throttleRequest<T>(requestFn: () => Promise<T>, _delay: number = 1000, // Deprecated parameter, kept for compatibility
resource: string = 'global'): Promise<AsyncResult<T>> {
  return throttleRequestEnhanced(requestFn, resource);
}
/**
 * Get current rate limit statistics
 *
 * @param resource The resource to check (optional)
 * @returns Current usage statistics
 */
export function getRateLimitStats(resource?: string): ReturnType<ComicVineRateLimiter['getStats']> {
  const rateLimiter = getRateLimiter();
  return rateLimiter.getStats(resource);
}
/**
 * Get current velocity detection statistics
 *
 * @returns Current velocity statistics
 */
export function getVelocityStats(): ReturnType<VelocityDetector['getStats']> {
  const velocityDetector = getVelocityDetector();
  return velocityDetector.getStats();
}
/**
 * Get current retry handler statistics
 *
 * @returns Current retry statistics
 */
export function getRetryStats(): ReturnType<ComicVineRetryHandler['getStats']> {
  const retryHandler = getRetryHandler();
  return retryHandler.getStats();
}
/**
 * Reset rate limiter and velocity detector (useful for testing)
 */
export function resetRateLimiter(): void {
  const rateLimiter = getRateLimiter();
  const velocityDetector = getVelocityDetector();
  rateLimiter.reset();
  velocityDetector.reset();
  logger.info('Rate limiter and velocity detector reset');
}
/**
 * Reset all protection mechanisms (useful for testing)
 */
export function resetAllProtection(): void {
  const rateLimiter = getRateLimiter();
  const velocityDetector = getVelocityDetector();
  const retryHandler = getRetryHandler();
  rateLimiter.reset();
  velocityDetector.reset();
  retryHandler.reset();
  logger.info('All protection mechanisms reset');
}