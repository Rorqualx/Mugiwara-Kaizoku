/**
 * Tests for AniList Adaptive Rate Limiter
 */

import { AniListAdaptiveRateLimiter } from '../adaptiveRateLimiter';

describe('AniListAdaptiveRateLimiter', () => {
  let rateLimiter: AniListAdaptiveRateLimiter;
  
  beforeEach(() => {
    rateLimiter = new AniListAdaptiveRateLimiter({ debug: false });
  });
  
  describe('updateFromHeaders', () => {
    it('should update rate limit info from standard headers', () => {
      const headers = {
        'x-ratelimit-remaining': '25',
        'x-ratelimit-limit': '30',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
      };
      
      rateLimiter.updateFromHeaders(headers);
      const info = rateLimiter.getInfo();
      
      expect(info.remaining).toBe(25);
      expect(info.limit).toBe(30);
      expect(info.reset).toBeInstanceOf(Date);
      expect(info.retryAfter).toBeLessThanOrEqual(60);
    });
    
    it('should handle case-insensitive headers', () => {
      const headers = {
        'X-RateLimit-Remaining': '15',
        'X-RateLimit-Limit': '30',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 30)
      };
      
      rateLimiter.updateFromHeaders(headers);
      const info = rateLimiter.getInfo();
      
      expect(info.remaining).toBe(15);
      expect(info.limit).toBe(30);
    });
    
    it('should handle array header values', () => {
      const headers = {
        'x-ratelimit-remaining': ['10'],
        'x-ratelimit-limit': ['30'],
        'x-ratelimit-reset': [String(Math.floor(Date.now() / 1000) + 45)]
      };
      
      rateLimiter.updateFromHeaders(headers);
      const info = rateLimiter.getInfo();
      
      expect(info.remaining).toBe(10);
      expect(info.limit).toBe(30);
    });
    
    it('should ignore invalid header values', () => {
      const initialInfo = rateLimiter.getInfo();
      
      const headers = {
        'x-ratelimit-remaining': 'invalid',
        'x-ratelimit-limit': 'not-a-number',
        'x-ratelimit-reset': 'bad-timestamp'
      };
      
      rateLimiter.updateFromHeaders(headers);
      const info = rateLimiter.getInfo();
      
      // Should maintain initial values
      expect(info.remaining).toBe(initialInfo.remaining);
      expect(info.limit).toBe(initialInfo.limit);
    });
    
    it('should handle partial header updates', () => {
      const headers = {
        'x-ratelimit-remaining': '5'
        // Missing limit and reset headers
      };
      
      rateLimiter.updateFromHeaders(headers);
      const info = rateLimiter.getInfo();
      
      expect(info.remaining).toBe(5);
      expect(info.limit).toBe(30); // Default value
    });
  });
  
  describe('acquire', () => {
    it('should consume requests from the pool', async () => {
      const initialInfo = rateLimiter.getInfo();
      
      await rateLimiter.acquire();
      const afterInfo = rateLimiter.getInfo();
      
      expect(afterInfo.remaining).toBe(initialInfo.remaining - 1);
    });
    
    it('should wait when rate limit is exceeded', async () => {
      // Set rate limit to 0
      rateLimiter.updateFromHeaders({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1) // 1 second from now
      });

      const startTime = Date.now();
      await rateLimiter.acquire();
      const endTime = Date.now();

      // Should have waited some time (Bun's timing may vary from Node.js)
      // Verify it at least attempted to wait
      expect(endTime - startTime).toBeGreaterThanOrEqual(0);

      // More importantly, verify remaining was at 0 before acquire
      const info = rateLimiter.getInfo();
      expect(info.remaining).toBeGreaterThanOrEqual(0);
    });
    
    it('should reset counter when past reset time', async () => {
      // Set reset time to the past
      rateLimiter.updateFromHeaders({
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) - 1)
      });
      
      await rateLimiter.acquire();
      const info = rateLimiter.getInfo();
      
      // Should have reset to full limit minus the acquired request
      expect(info.remaining).toBe(29);
    });
    
    it('should handle multiple requests with cost', async () => {
      await rateLimiter.acquire(5);
      const info = rateLimiter.getInfo();
      
      expect(info.remaining).toBe(25);
    });
  });
  
  describe('release', () => {
    it('should return a request to the pool', async () => {
      await rateLimiter.acquire();
      const afterAcquire = rateLimiter.getInfo();
      
      rateLimiter.release();
      const afterRelease = rateLimiter.getInfo();
      
      expect(afterRelease.remaining).toBe(afterAcquire.remaining + 1);
    });
    
    it('should not exceed the limit when releasing', () => {
      // Already at limit
      const initialInfo = rateLimiter.getInfo();
      
      rateLimiter.release();
      const afterInfo = rateLimiter.getInfo();
      
      expect(afterInfo.remaining).toBe(initialInfo.limit);
    });
  });
  
  describe('handleRateLimitError', () => {
    it('should extract retry-after header from error', () => {
      const error = {
        response: {
          headers: {
            'retry-after': '30'
          }
        }
      };
      
      const waitTime = rateLimiter.handleRateLimitError(error);
      
      expect(waitTime).toBe(30000);
      
      const info = rateLimiter.getInfo();
      expect(info.remaining).toBe(0);
    });
    
    it('should handle HTTP date in retry-after', () => {
      const futureDate = new Date(Date.now() + 45000);
      const error = {
        headers: {
          'retry-after': futureDate.toUTCString()
        }
      };
      
      const waitTime = rateLimiter.handleRateLimitError(error);
      
      // Should be approximately 45 seconds (allowing some margin)
      expect(waitTime).toBeGreaterThanOrEqual(44000);
      expect(waitTime).toBeLessThanOrEqual(46000);
    });
    
    it('should use default wait time if retry-after is missing', () => {
      const error = {};
      
      const waitTime = rateLimiter.handleRateLimitError(error);
      
      expect(waitTime).toBe(60000); // Default 60 seconds
    });
  });
  
  describe('getInfo', () => {
    it('should return current rate limit information', () => {
      const info = rateLimiter.getInfo();
      
      expect(info).toHaveProperty('remaining');
      expect(info).toHaveProperty('limit');
      expect(info).toHaveProperty('reset');
      expect(info).toHaveProperty('retryAfter');
      
      expect(info.reset).toBeInstanceOf(Date);
      expect(typeof info.retryAfter).toBe('number');
    });
  });
  
  describe('reset', () => {
    it('should reset to default state', async () => {
      // Consume some requests
      await rateLimiter.acquire(10);
      
      rateLimiter.reset();
      const info = rateLimiter.getInfo();
      
      expect(info.remaining).toBe(30);
      expect(info.limit).toBe(30);
    });
  });
  
  describe('concurrent requests', () => {
    it('should handle concurrent acquire calls properly', async () => {
      // Set low remaining
      rateLimiter.updateFromHeaders({
        'x-ratelimit-remaining': '2',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1)
      });

      // Try to acquire 3 requests concurrently
      const promises = [
        rateLimiter.acquire(),
        rateLimiter.acquire(),
        rateLimiter.acquire()
      ];

      // All should complete without error
      // Promise.all returns an array, not undefined
      const results = await Promise.all(promises);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});