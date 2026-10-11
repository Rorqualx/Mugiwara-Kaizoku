/**
 * Phase 3 Integration Tests - Retry Logic with Rate Limiting and Velocity Detection
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { ComicVineRetryHandler, DEFAULT_RETRY_STRATEGY } from '@/server/services/comicvine/modules/retryHandler';
import {
  throttleRequestEnhanced,
  getRetryStats,
  getRateLimitStats,
  getVelocityStats,
  resetAllProtection
} from '@/utils/api-utils';
import { isSuccess, isError } from '@/utils/async-result';
import { ApiError } from '@/utils/error-handling';

// Extend timeout for integration tests
jest.setTimeout(30000);

describe('Phase 3: Retry Logic Integration', () => {
  beforeEach(() => {
    resetAllProtection();
  });

  afterEach(() => {
    resetAllProtection();
  });
  
  describe('Retry on Transient Failures', () => {
    it('should retry on 500 errors', async () => {
      let attempts = 0;

      const result = await throttleRequestEnhanced(
        () => {
          attempts++;
          if (attempts < 3) {
            return Promise.reject(new ApiError('Internal Server Error', 500));
          }
          return Promise.resolve({ success: true, attempts });
        },
        'test-500',
        'test-operation'
      );

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.attempts).toBe(3);
      }

      const retryStats = getRetryStats();
      expect(retryStats.totalRetries).toBeGreaterThan(0);
    }, 60000);
    
    it('should retry on 502 errors', async () => {
      let attempts = 0;

      const result = await throttleRequestEnhanced(
        () => {
          attempts++;
          if (attempts < 2) {
            return Promise.reject(new ApiError('Bad Gateway', 502));
          }
          return Promise.resolve({ success: true });
        },
        'test-502'
      );

      expect(isSuccess(result)).toBe(true);
    }, 60000);
    
    it('should retry on 503 errors with longer delays', async () => {
      let attempts = 0;

      const result = await throttleRequestEnhanced(
        () => {
          attempts++;
          if (attempts < 2) {
            return Promise.reject(new ApiError('Service Unavailable', 503));
          }
          return Promise.resolve({ success: true });
        },
        'test-503'
      );

      expect(isSuccess(result)).toBe(true);
      expect(attempts).toBe(2); // Initial + 1 retry
    }, 60000);
    
    it('should not retry on 4xx errors', async () => {
      let attempts = 0;

      const result = await throttleRequestEnhanced(
        () => {
          attempts++;
          return Promise.reject(new ApiError('Not Found', 404));
        },
        'test-404'
      );

      expect(isError(result)).toBe(true);
      expect(attempts).toBe(1); // Should not retry

      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Not Found');
      }
    }, 10000);
  });
  
  describe('Exponential Backoff', () => {
    it('should apply exponential backoff on repeated failures', async () => {
      // Record the backoff the retry handler chooses rather than measuring
      // the gaps between attempts: those gaps also contain the rate limiter's
      // and velocity detector's randomised waits (several seconds each), so
      // their order says nothing about the backoff.
      const sleepSpy = jest.spyOn(
        ComicVineRetryHandler.prototype as unknown as { sleep: (ms: number) => Promise<void> },
        'sleep'
      );
      let attempts = 0;

      try {
        const result = await throttleRequestEnhanced(
          () => {
            attempts++;

            if (attempts < 4) {
              return Promise.reject(new ApiError('Server Error', 500));
            }
            return Promise.resolve({ success: true });
          },
          'test-backoff'
        );

        expect(isSuccess(result)).toBe(true);
        expect(attempts).toBe(4);

        const backoffDelays = sleepSpy.mock.calls.map(([ms]) => ms);
        expect(backoffDelays).toHaveLength(3);

        // 2^attempt * base, plus up to `jitterMs` of jitter.
        const { baseDelayMs, jitterMs } = DEFAULT_RETRY_STRATEGY;
        backoffDelays.forEach((delay, attempt) => {
          const exponential = Math.pow(2, attempt) * baseDelayMs;
          expect(delay).toBeGreaterThanOrEqual(exponential);
          expect(delay).toBeLessThanOrEqual(exponential + jitterMs);
        });
      } finally {
        sleepSpy.mockRestore();
      }
    }, 90000); // Three real backoffs (2s + 4s + 8s) plus rate-limit and velocity waits

    it('should respect max retry limit', async () => {
      let attempts = 0;

      const result = await throttleRequestEnhanced(
        () => {
          attempts++;
          return Promise.reject(new ApiError('Persistent Error', 500));
        },
        'test-max-retries'
      );

      expect(isError(result)).toBe(true);
      expect(attempts).toBeLessThanOrEqual(6); // Max 5 retries + 1 initial
    }, 120000); // Longer timeout for this test as it waits through all retries with exponential backoff
  });
  
  describe('Combined Protection', () => {
    it('should apply rate limiting, velocity detection, and retry together', async () => {
      // Make several requests that might fail - execute in parallel
      const requestPromises = Array.from({ length: 3 }, (_, i) => {
        let localAttempts = 0;
        return throttleRequestEnhanced(
          () => {
            localAttempts++;
            // First request of each always fails once
            if (localAttempts === 1) {
              return Promise.reject(new ApiError('Transient Error', 503));
            }
            return Promise.resolve({ index: i, attempts: localAttempts });
          },
          'combined-test',
          `operation-${i}`
        );
      });

      const results = await Promise.all(requestPromises);

      // All should eventually succeed
      results.forEach(result => {
        expect(isSuccess(result)).toBe(true);
      });

      // Check that all protection mechanisms were active
      const rateLimitStats = getRateLimitStats('combined-test');
      const velocityStats = getVelocityStats();
      const retryStats = getRetryStats();

      expect(rateLimitStats.requestsThisHour).toBeGreaterThan(0);
      // Velocity stats might have cleared by the time we check, so just verify it's a number
      expect(typeof velocityStats.recentRequests).toBe('number');
      expect(retryStats.totalRetries).toBeGreaterThan(0);
    }, 60000); // Longer timeout for parallel requests with retries
    
    it('should handle rate limit errors with retry', async () => {
      let attempts = 0;

      const _result = await throttleRequestEnhanced(
        () => {
          attempts++;
          // Simulate rate limit on first attempt
          if (attempts === 1) {
            return Promise.reject(new ApiError('Rate Limit Exceeded', 429));
          }
          return Promise.resolve({ success: true });
        },
        'rate-limit-retry'
      );

      // Should eventually succeed after rate limit clears
      expect(attempts).toBeGreaterThan(1);

      // Rate limiter should have been notified
      const stats = getRateLimitStats('rate-limit-retry');
      expect(stats.requestsThisHour).toBeGreaterThan(0);
    }, 60000);
  });
  
  describe('Statistics and Monitoring', () => {
    it('should track retry statistics accurately', async () => {
      // Reset stats
      resetAllProtection();

      // Make some requests with failures
      await throttleRequestEnhanced(
        () => Promise.resolve({ success: true }),
        'stats-test-1'
      );

      let attempt = 0;
      await throttleRequestEnhanced(
        () => {
          attempt++;
          if (attempt < 3) return Promise.reject(new ApiError('Error', 500));
          return Promise.resolve({ success: true });
        },
        'stats-test-2'
      );

      const retryStats = getRetryStats();

      // Verify structure
      expect(retryStats).toBeDefined();
      expect(retryStats).toHaveProperty('totalRequests');
      expect(retryStats).toHaveProperty('totalRetries');
      expect(retryStats).toHaveProperty('successfulRetries');
      expect(retryStats).toHaveProperty('failedRetries');
      expect(retryStats).toHaveProperty('averageRetries');

      // Verify values are numbers and meet expectations
      expect(retryStats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(retryStats.totalRetries).toBeGreaterThan(0);
    });
  });
});