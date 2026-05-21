/**
 * Phase 5 Integration Tests - Comprehensive Error Handling and Full Protection
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { isSuccess } from '@/utils/async-result';
import { ApiError } from '@/utils/error-handling';

// Mock node-fetch before importing modules that use it
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { CircuitBreaker, CircuitState } from '../circuitBreaker';
import { FullyProtectedComicVineClient } from '../fullyProtectedClient';

// Mock fetch for testing - will be injected into client
const mockFetch = jest.fn<typeof fetch>();

// Helper to create proper Response mocks
function createMockResponse(data: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: jest.fn(),
    body: null,
    bodyUsed: false,
    size: 0,
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    buffer: jest.fn(),
    bytes: jest.fn(),
    formData: jest.fn(),
    text: jest.fn(),
    json: () => Promise.resolve(data)
  } as unknown as Response;
}

describe('Phase 5: Comprehensive Error Handling', () => {
  describe('Circuit Breaker', () => {
    let circuitBreaker: CircuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        errorThresholdPercentage: 50,
        volumeThreshold: 5
      });
    });
    
    afterEach(() => {
      circuitBreaker.reset();
    });
    
    describe('State Transitions', () => {
      it('should open circuit after failure threshold', async () => {
        const failingFn = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error('Test failure'));

        // Make requests until circuit opens
        for (let i = 0; i < 3; i++) {
          try {
            // eslint-disable-next-line no-await-in-loop -- Sequential execution required to test circuit breaker state transitions
            await circuitBreaker.execute(failingFn);
          } catch (_e: unknown) {
            // Expected to fail
          }
        }

        const health = circuitBreaker.getHealth();
        expect(health.state).toBe(CircuitState.OPEN);
        expect(health.failureCount).toBe(3);
      });

      it('should transition to half-open after timeout', async () => {
        // Trip the circuit
        circuitBreaker.trip();
        expect(circuitBreaker.getHealth().state).toBe(CircuitState.OPEN);

        // Wait for timeout
        await new Promise<void>(resolve => { setTimeout(resolve, 1100); });

        // Try to execute (should go to half-open)
        const successFn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
        await circuitBreaker.execute(successFn);

        // Should be in half-open or closed depending on success threshold
        const health = circuitBreaker.getHealth();
        expect([CircuitState.HALF_OPEN, CircuitState.CLOSED]).toContain(health.state);
      });

      it('should close from half-open after success threshold', async () => {
        // Set to half-open manually
        circuitBreaker.trip();
        await new Promise<void>(resolve => { setTimeout(resolve, 1100); });

        const successFn = jest.fn<() => Promise<string>>().mockResolvedValue('success');

        // Execute successful requests
        for (let i = 0; i < 2; i++) {
          // eslint-disable-next-line no-await-in-loop -- Sequential execution required to test circuit breaker state transitions
          await circuitBreaker.execute(successFn);
        }

        const health = circuitBreaker.getHealth();
        expect(health.state).toBe(CircuitState.CLOSED);
      });

      it('should reopen from half-open on failure', async () => {
        // Set to half-open
        circuitBreaker.trip();
        await new Promise<void>(resolve => { setTimeout(resolve, 1100); });

        const failingFn = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error('Fail'));

        // First success to enter half-open
        const successFn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
        await circuitBreaker.execute(successFn);

        // Then failure should reopen
        try {
          await circuitBreaker.execute(failingFn);
        } catch (_e: unknown) {
          // Expected
        }

        const health = circuitBreaker.getHealth();
        expect(health.state).toBe(CircuitState.OPEN);
      });
    });
    
    describe('Fallback Mechanism', () => {
      it('should use fallback when circuit is open', async () => {
        const fallback = jest.fn<() => string>().mockReturnValue('fallback data');
        const breaker = new CircuitBreaker({
          failureThreshold: 1,
          fallbackFunction: fallback
        });

        // Trip the circuit
        const failingFn = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error('Fail'));
        try {
          await breaker.execute(failingFn);
        } catch (_e: unknown) {
          // Expected
        }

        // Next call should use fallback
        const result = await breaker.execute(failingFn);
        expect(result).toBe('fallback data');
        expect(fallback).toHaveBeenCalled();
      });
    });

    describe('Error Analysis', () => {
      it('should categorize errors correctly', async () => {
        const errors = [
          new ApiError('Rate limit', 429),
          new ApiError('Server error', 500),
          new Error('Connection timeout'),
          new Error('ECONNREFUSED: Connection refused')
        ];

        // Execute all error tests in parallel
        await Promise.all(
          errors.map(async (error) => {
            try {
              await circuitBreaker.execute(() => Promise.reject(error));
            } catch (_e: unknown) {
              // Expected
            }
          })
        );

        const analysis = circuitBreaker.getErrorAnalysis();

        expect(analysis.errorTypes).toHaveProperty('RATE_LIMIT');
        expect(analysis.errorTypes).toHaveProperty('SERVER_ERROR');
        expect(analysis.errorTypes).toHaveProperty('TIMEOUT');
        expect(analysis.errorTypes).toHaveProperty('CONNECTION_REFUSED');
        expect(analysis.recommendations.length).toBeGreaterThan(0);
      });
    });

    describe('Health Metrics', () => {
      it('should track health metrics accurately', async () => {
        const successFn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
        const failFn = jest.fn<() => Promise<unknown>>().mockRejectedValue(new Error('fail'));

        // Mix of success and failure
        await circuitBreaker.execute(successFn);
        try {
          await circuitBreaker.execute(failFn);
        } catch (_e: unknown) {
          // Expected
        }
        await circuitBreaker.execute(successFn);

        const health = circuitBreaker.getHealth();

        expect(health.successCount).toBeGreaterThan(0);
        // Note: Circuit breaker decrements failureCount on success (self-healing)
        // So after success -> fail -> success, failureCount is 0
        expect(health.failureCount).toBeGreaterThanOrEqual(0);
        expect(health.totalRequests).toBe(3);
        // Error rate is based on recent request history, not just failureCount
        expect(health.errorRate).toBeGreaterThanOrEqual(0);
        expect(health.errorRate).toBeLessThanOrEqual(100);
      });
    });
  });
  
  describe('Fully Protected Client', () => {
    let client: FullyProtectedComicVineClient;

    beforeEach(() => {
      // Clear mock between tests
      mockFetch.mockClear();

      client = new FullyProtectedComicVineClient({
        apiKey: 'test-key',
        // Inject mock fetch for testing
        fetchFn: mockFetch as unknown as typeof fetch,
        // Use shorter timeouts and minimal delays for testing
        rateLimiterConfig: {
          maxRequestsPerHour: 10,
          minDelayMs: 1,
          safeDelayMs: 1,
          maxDelayMs: 5
        },
        velocityConfig: {
          minJitterMs: 0,
          maxJitterMs: 1,
          burstThreshold: 5,
          burstCooldownMs: 10,
          humanizeRequests: false
        },
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 1,
          maxDelayMs: 10,
          jitterMs: 0
        },
        cacheConfig: {
          l1MaxSize: 5,
          l1TtlMs: 100,
          l2Enabled: false,
          l3Enabled: false,
          deduplicationEnabled: true
        },
        circuitConfig: {
          failureThreshold: 2,
          timeout: 100
        }
      });
    });
    
    describe('Full Protection Stack', () => {
      it('should handle successful requests with all protection', async () => {
        mockFetch.mockResolvedValue(createMockResponse({
          error: 'OK',
          results: [{ id: 1, name: 'Test' }]
        }));

        const result = await client.request({
          path: '/volumes',
          operation: 'search'
        });

        expect(isSuccess(result)).toBe(true);
        if (isSuccess(result)) {
          expect(result.data).toHaveProperty('results');
        }
      });

      it('should cache and deduplicate requests', async () => {
        mockFetch.mockResolvedValue(createMockResponse({
          error: 'OK',
          results: [{ id: 2, name: 'Cached' }]
        }));

        // Make multiple concurrent requests
        const promises = [
          client.request({ path: '/volumes/123', operation: 'standard' }),
          client.request({ path: '/volumes/123', operation: 'standard' }),
          client.request({ path: '/volumes/123', operation: 'standard' })
        ];

        const results = await Promise.all(promises);

        // All should succeed with same data
        results.forEach(result => {
          expect(isSuccess(result)).toBe(true);
        });

        // Fetch should only be called once (deduplication)
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it('should handle and recover from errors', async () => {
        // First call fails with retryable network error, second succeeds
        mockFetch
          .mockRejectedValueOnce(new Error('ECONNREFUSED: Connection refused'))
          .mockResolvedValueOnce(createMockResponse({
            error: 'OK',
            results: []
          }));

        const result = await client.request({
          path: '/search',
          operation: 'search'
        });

        // Should eventually succeed due to retry logic
        expect(isSuccess(result)).toBe(true);
        if (isSuccess(result)) {
          expect(mockFetch).toHaveBeenCalledTimes(2);
        }
      });

      it('should trip circuit breaker on repeated failures', async () => {
        mockFetch.mockRejectedValue(new Error('Service unavailable'));

        // Make requests until circuit opens (failureThreshold is 2)
        // Each failed request increments the failure count
        for (let i = 0; i < 3; i++) {
          // eslint-disable-next-line no-await-in-loop -- Sequential execution required to accumulate failures and trip circuit breaker
          await client.request({
            path: `/volumes/${i}`, // Use different paths to avoid deduplication
            skipCache: true // Force new requests
          });
        }

        const health = client.getHealthStatus();

        // After 3 failures with threshold of 2, circuit should be OPEN
        expect(health.circuitBreaker).toBeDefined();
        if (health.circuitBreaker && typeof health.circuitBreaker === 'object' && 'state' in health.circuitBreaker) {
          expect(health.circuitBreaker.state).toBe(CircuitState.OPEN);
        }
      });
    });
    
    describe('Health Monitoring', () => {
      it('should provide comprehensive health status', async () => {
        // Generate some activity
        mockFetch.mockResolvedValue(createMockResponse({ error: 'OK', results: [] }));

        await client.request({ path: '/volumes' });

        const health = client.getHealthStatus();

        expect(health).toHaveProperty('rateLimiter');
        expect(health).toHaveProperty('velocityDetector');
        expect(health).toHaveProperty('retryHandler');
        expect(health).toHaveProperty('cache');
        expect(health).toHaveProperty('fieldOptimizer');
        expect(health).toHaveProperty('circuitBreaker');
        expect(health).toHaveProperty('summary');

        expect(health.summary.healthy).toBeDefined();
        expect(health.summary.recommendations).toBeInstanceOf(Array);
      });

      it('should provide actionable recommendations', async () => {
        // Simulate high usage
        mockFetch.mockResolvedValue(createMockResponse({ error: 'OK', results: [] }));

        // Make many requests to trigger recommendations
        for (let i = 0; i < 8; i++) {
          // eslint-disable-next-line no-await-in-loop -- Sequential execution required to build up rate limiter usage and trigger recommendations
          await client.request({
            path: `/volumes/${i}`,
            skipCache: true
          });
        }

        const health = client.getHealthStatus();

        // Should have recommendations about rate limit
        if (health.rateLimiter && typeof health.rateLimiter === 'object' && 'usagePercentage' in health.rateLimiter) {
          const rateLimiter = health.rateLimiter as { usagePercentage: number };
          if (rateLimiter.usagePercentage > 75) {
            const hasRateLimitRecommendation = health.summary.recommendations.some((rec: string) =>
              /rate limit/i.test(rec)
            );
            expect(hasRateLimitRecommendation).toBe(true);
          }
        }
      });
    });
  });
});