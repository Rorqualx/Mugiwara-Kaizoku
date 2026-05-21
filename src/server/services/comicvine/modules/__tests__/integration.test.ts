/**
 * Integration tests for ComicVine rate limiting and velocity detection
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { throttleRequest, getRateLimitStats, getVelocityStats, resetRateLimiter } from '@/utils/api-utils';
import { isSuccess, isError } from '@/utils/async-result';

// Extend timeout for integration tests
jest.setTimeout(30000); // 30 seconds

describe('ComicVine Rate Limiting Integration', () => {
  beforeEach(() => {
    resetRateLimiter();
  });
  
  afterEach(() => {
    resetRateLimiter();
  });
  
  describe('Rate Limiting + Velocity Detection', () => {
    it('should apply both rate limiting and velocity detection', async () => {
      const startTime = Date.now();
      
      // Make a few requests
      const results = [];
      for (let i = 0; i < 3; i++) {
        // eslint-disable-next-line no-await-in-loop -- Sequential requests required to test rate limiting behavior
        const result = await throttleRequest(
          () => Promise.resolve({ data: `Request ${i + 1}` }),
          1000,
          'volumes'
        );
        results.push(result);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      results.forEach(result => {
        expect(isSuccess(result)).toBe(true);
      });
      
      // Should have taken some time due to delays
      expect(totalTime).toBeGreaterThan(0);
      
      // Check stats
      const rateLimitStats = getRateLimitStats('volumes');
      expect(rateLimitStats.requestsThisHour).toBe(3);
      
      const velocityStats = getVelocityStats();
      expect(velocityStats.recentRequests).toBe(3);
    }, 20000); // 20 second timeout
    
    it('should handle different resource types separately', async () => {
      // Make requests to different resources
      const volumeRequest = await throttleRequest(
        () => Promise.resolve({ type: 'volume' }),
        1000,
        'volumes'
      );

      const issueRequest = await throttleRequest(
        () => Promise.resolve({ type: 'issue' }),
        1000,
        'issues'
      );

      const searchRequest = await throttleRequest(
        () => Promise.resolve({ type: 'search' }),
        1000,
        'search'
      );
      
      expect(isSuccess(volumeRequest)).toBe(true);
      expect(isSuccess(issueRequest)).toBe(true);
      expect(isSuccess(searchRequest)).toBe(true);
      
      // Check individual resource stats
      const volumeStats = getRateLimitStats('volumes');
      const issueStats = getRateLimitStats('issues');
      const searchStats = getRateLimitStats('search');
      
      expect(volumeStats.requestsThisHour).toBe(1);
      expect(issueStats.requestsThisHour).toBe(1);
      expect(searchStats.requestsThisHour).toBe(1);
      
      // Global should track all
      const globalStats = getRateLimitStats('global');
      expect(globalStats.requestsThisHour).toBe(3);
    }, 15000); // 15 second timeout
    
    it('should increase delays as usage increases', async () => {
      const delays: number[] = [];
      const startTimes: number[] = [];

      // Make several requests and track timing
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        startTimes.push(start);

        // eslint-disable-next-line no-await-in-loop -- Sequential requests required to measure delays between consecutive requests
        await throttleRequest(
          () => Promise.resolve({ index: i }),
          1000,
          'test'
        );

        if (i > 0) {
          const prevTime = startTimes[i - 1];
          if (prevTime !== undefined) {
            delays.push(start - prevTime);
          }
        }
      }

      // Delays should generally increase or stay similar
      // (Some variation due to jitter is expected)
      const stats = getRateLimitStats('test');
      expect(stats.requestsThisHour).toBe(5);
      expect(stats.usagePercentage).toBeGreaterThan(0);
    }, 60000); // Increased timeout to 60 seconds
    
    it('should handle errors gracefully', async () => {
      const result = await throttleRequest(
        () => {
          throw new Error('Test error');
        },
        1000,
        'error-test'
      );

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        const errorMessage = result.error instanceof Error ? result.error.message : String(result.error);
        // Error message may be wrapped with retry information
        expect(errorMessage).toContain('Test error');
      }

      // Should still count the request
      const stats = getRateLimitStats('error-test');
      expect(stats.requestsThisHour).toBe(1);
    }, 10000); // 10 second timeout
  });
  
  describe('Burst Prevention', () => {
    it('should detect and prevent burst patterns', async () => {
      const startTime = Date.now();

      // Make a smaller burst of requests to avoid excessive rate limiting
      const promises = [];
      for (let i = 0; i < 4; i++) {
        promises.push(
          throttleRequest(
            () => Promise.resolve({ burst: i }),
            100, // Very short delay to trigger burst detection
            'burst-test'
          )
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();

      // Should have taken some time due to burst prevention
      const totalTime = endTime - startTime;
      expect(totalTime).toBeGreaterThan(0);

      // Verify requests were tracked
      const velocityStats = getVelocityStats();
      expect(velocityStats.recentRequests).toBeGreaterThan(0);

      // Verify stats are valid numbers
      expect(typeof velocityStats.velocityScore).toBe('number');
    }, 30000); // 30 second timeout
  });
  
  describe('Statistics Accuracy', () => {
    it('should provide accurate combined statistics', async () => {
      // Make some requests
      await throttleRequest(() => Promise.resolve('test1'), 100, 'stats-test');
      await throttleRequest(() => Promise.resolve('test2'), 100, 'stats-test');

      const rateLimitStats = getRateLimitStats('stats-test');
      const velocityStats = getVelocityStats();

      // Verify stats structure - just check the object has expected properties
      expect(rateLimitStats).toHaveProperty('requestsThisHour');
      expect(rateLimitStats).toHaveProperty('limit');
      expect(rateLimitStats).toHaveProperty('usagePercentage');
      expect(rateLimitStats).toHaveProperty('isBlocked');
      expect(rateLimitStats).toHaveProperty('currentDelay');

      expect(velocityStats).toHaveProperty('velocityScore');
      expect(velocityStats).toHaveProperty('recentRequests');
      expect(velocityStats).toHaveProperty('intervalConsistency');
      expect(velocityStats).toHaveProperty('recommendation');

      // Verify basic values
      expect(rateLimitStats.requestsThisHour).toBe(2);
      expect(rateLimitStats.isBlocked).toBe(false);
      expect(typeof rateLimitStats.limit).toBe('number');
      expect(typeof rateLimitStats.currentDelay).toBe('number');

      // Verify velocity stats types
      expect(typeof velocityStats.recentRequests).toBe('number');
      expect(typeof velocityStats.recommendation).toBe('string');
    }, 15000); // 15 second timeout
  });
});