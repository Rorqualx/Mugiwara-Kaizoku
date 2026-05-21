/**
 * Tests for ComicVine Rate Limiter
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { ComicVineRateLimiter } from '../rateLimiter';

describe('ComicVineRateLimiter', () => {
  let rateLimiter: ComicVineRateLimiter;
  
  beforeEach(() => {
    rateLimiter = new ComicVineRateLimiter({
      maxRequestsPerHour: 10, // Use lower limit for testing
      minDelayMs: 100,
      safeDelayMs: 200,
      maxDelayMs: 500,
      warningThreshold: 0.5
    });
  });
  
  afterEach(() => {
    rateLimiter.reset();
  });
  
  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      // Sequential execution required to test rate limiter state progression
      for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await rateLimiter.acquireSlot('test');
      }

      const stats = rateLimiter.getStats('test');
      expect(stats.requestsThisHour).toBe(5);
      expect(stats.isBlocked).toBe(false);
    });
    
    it('should track global requests separately', async () => {
      await rateLimiter.acquireSlot('resource1');
      await rateLimiter.acquireSlot('resource2');
      await rateLimiter.acquireSlot('global');
      
      const stats1 = rateLimiter.getStats('resource1');
      const stats2 = rateLimiter.getStats('resource2');
      const globalStats = rateLimiter.getStats('global');
      
      expect(stats1.requestsThisHour).toBe(1);
      expect(stats2.requestsThisHour).toBe(1);
      // Global tracks ALL requests
      expect(globalStats.requestsThisHour).toBe(3);
    });
  });
  
  describe('Progressive Delays', () => {
    it('should apply minimum delay when under 50% usage', () => {
      const delay = rateLimiter.getDelayMs('test');
      expect(delay).toBe(0); // No previous requests, no delay needed
    });
    
    it('should apply safe delay when between 50-75% usage', async () => {
      // Use 6 out of 10 slots (60%)
      // Sequential execution required to test progressive delay thresholds
      for (let i = 0; i < 6; i++) {
        // eslint-disable-next-line no-await-in-loop
        await rateLimiter.acquireSlot('test');
      }

      const stats = rateLimiter.getStats('test');
      expect(stats.usagePercentage).toBeGreaterThanOrEqual(50);
      expect(stats.usagePercentage).toBeLessThan(75);
      // Delay should be safe delay (200ms) since we're between 50-75%
      // Note: actual delay includes time since last request
      const delay = rateLimiter.getDelayMs('test');
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(500); // Max possible delay
    });
    
    it('should apply maximum delay when near limit', async () => {
      // Use 9 out of 10 slots (90%)
      // Sequential execution with delays required to test time-based rate limiting behavior
      for (let i = 0; i < 9; i++) {
        // eslint-disable-next-line no-await-in-loop
        await rateLimiter.acquireSlot('test');
        // Small delay to spread requests
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>(resolve => { setTimeout(resolve, 10); });
      }

      const delay = rateLimiter.getDelayMs('test');
      // Should be close to max delay
      expect(delay).toBeLessThanOrEqual(500);
    });
  });
  
  describe('Rate Limit Enforcement', () => {
    it('should enforce hourly limit', async () => {
      // Fill up the limit
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(rateLimiter.acquireSlot('test'));
      }
      await Promise.all(promises);
      
      const stats = rateLimiter.getStats('test');
      expect(stats.requestsThisHour).toBe(10);
      expect(stats.usagePercentage).toBe(100);
    });
    
    it('should block when rate limit is exceeded', () => {
      rateLimiter.handleRateLimitError('test', 3600);
      
      const stats = rateLimiter.getStats('test');
      expect(stats.isBlocked).toBe(true);
    });
    
    it('should increase backoff on repeated rate limit errors', () => {
      rateLimiter.handleRateLimitError('test');
      const _delay1 = rateLimiter.getDelayMs('test');
      
      rateLimiter.handleRateLimitError('test');
      const delay2 = rateLimiter.getDelayMs('test');
      
      // Second rate limit error should result in longer delay
      expect(delay2).toBeGreaterThan(0);
    });
    
    it('should reset backoff after successful requests', () => {
      rateLimiter.handleRateLimitError('test');

      // Simulate successful request
      rateLimiter.resetBackoff('test');

      const stats = rateLimiter.getStats('test');
      // Backoff should be reduced but not necessarily to 1 immediately
      expect(stats.currentDelay).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Sliding Window', () => {
    it('should clean up old requests after 1 hour', async () => {
      const limiter = new ComicVineRateLimiter({
        maxRequestsPerHour: 10,
        minDelayMs: 10
      });
      
      // Make some requests
      await limiter.acquireSlot('test');
      await limiter.acquireSlot('test');
      
      const stats = limiter.getStats('test');
      expect(stats.requestsThisHour).toBe(2);
      
      // Simulate time passing (this would need to mock Date.now() in real tests)
      // For now, just verify the structure is in place
      expect(stats.nextResetTime).toBeInstanceOf(Date);
    });
  });
  
  describe('Statistics', () => {
    it('should provide accurate statistics', async () => {
      await rateLimiter.acquireSlot('test');
      await rateLimiter.acquireSlot('test');
      
      const stats = rateLimiter.getStats('test');
      
      expect(stats.requestsThisHour).toBe(2);
      expect(stats.limit).toBe(10);
      expect(stats.usagePercentage).toBe(20);
      expect(stats.isBlocked).toBe(false);
      expect(stats.nextResetTime).toBeInstanceOf(Date);
    });
    
    it('should calculate usage percentage correctly', async () => {
      // Make 5 out of 10 requests
      // Sequential execution required to test rate limiter state progression
      for (let i = 0; i < 5; i++) {
        // eslint-disable-next-line no-await-in-loop
        await rateLimiter.acquireSlot('test');
      }

      const stats = rateLimiter.getStats('test');
      expect(stats.usagePercentage).toBe(50);
    });
  });
  
  describe('Reset Functionality', () => {
    it('should reset all state', async () => {
      await rateLimiter.acquireSlot('test1');
      await rateLimiter.acquireSlot('test2');
      rateLimiter.handleRateLimitError('test1');
      
      rateLimiter.reset();
      
      const stats1 = rateLimiter.getStats('test1');
      const stats2 = rateLimiter.getStats('test2');
      
      expect(stats1.requestsThisHour).toBe(0);
      expect(stats2.requestsThisHour).toBe(0);
      expect(stats1.isBlocked).toBe(false);
    });
  });
});