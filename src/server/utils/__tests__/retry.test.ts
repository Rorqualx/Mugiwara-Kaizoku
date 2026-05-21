/**
 * Tests for Retry Utilities with Exponential Backoff
 */

import { retryWithBackoff, createRetryFunction, CircuitBreaker, withCircuitBreaker } from '../retry';

describe('Retry Utilities', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on failure and eventually succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10,
        debug: false
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should throw error after max retries', async () => {
      const error = new Error('Persistent failure');
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelay: 10
        })
      ).rejects.toThrow('Persistent failure');
      
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
    
    it('should respect retryable status codes', async () => {
      const retryableError = { status: 503, message: 'Service Unavailable' };
      const nonRetryableError = { status: 400, message: 'Bad Request' };
      
      const fn = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(nonRetryableError);
      
      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          initialDelay: 10,
          retryableStatuses: [503]
        })
      ).rejects.toMatchObject(nonRetryableError);
      
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('should handle GraphQL error codes', async () => {
      const rateLimitError = {
        extensions: { code: 'RATE_LIMITED' }
      };
      
      const fn = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 10,
        retryableErrorCodes: ['RATE_LIMITED']
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('should use exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 2,
        initialDelay: 100,
        backoffFactor: 2,
        useJitter: false
      });
      
      const duration = Date.now() - startTime;
      
      expect(result).toBe('success');
      // Should wait 100ms for first retry + 200ms for second retry = 300ms minimum
      // Allow ~10ms slack for setTimeout drift under heavy CI load
      expect(duration).toBeGreaterThanOrEqual(290);
    });
    
    it('should respect Retry-After header', async () => {
      const errorWithRetryAfter = {
        status: 429,
        headers: { 'retry-after': '1' } // 1 second
      };
      
      const fn = jest.fn()
        .mockRejectedValueOnce(errorWithRetryAfter)
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 1,
        initialDelay: 100 // Would normally use this
      });
      
      const duration = Date.now() - startTime;
      
      expect(result).toBe('success');
      // Should wait 1000ms from Retry-After header
      // Allow ~10ms slack for setTimeout drift under heavy CI load
      expect(duration).toBeGreaterThanOrEqual(990);
    });
    
    it('should apply jitter when configured', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');
      
      const delays: number[] = [];
      
      await retryWithBackoff(fn, {
        maxRetries: 1,
        initialDelay: 100,
        useJitter: true,
        maxJitterFactor: 0.5,
        onRetry: (_, __, delay) => delays.push(delay)
      });
      
      expect(delays).toHaveLength(1);
      // With jitter, delay should be between 100ms and 150ms
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThanOrEqual(150);
    });
    
    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const error = { status: 503 };
      
      const fn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');
      
      await retryWithBackoff(fn, {
        maxRetries: 1,
        initialDelay: 10,
        onRetry
      });
      
      expect(onRetry).toHaveBeenCalledWith(1, error, expect.any(Number));
    });
    
    it('should respect shouldRetry callback', async () => {
      const shouldRetry = jest.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      
      const fn = jest.fn()
        .mockRejectedValue(new Error('Error'));
      
      await expect(
        retryWithBackoff(fn, {
          maxRetries: 5,
          initialDelay: 10,
          shouldRetry
        })
      ).rejects.toThrow('Error');
      
      expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry (shouldRetry returned false on second)
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });
    
    it('should handle network errors', async () => {
      const networkError = { code: 'ECONNRESET' };
      
      const fn = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      const result = await retryWithBackoff(fn, {
        maxRetries: 1,
        initialDelay: 10
      });
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('createRetryFunction', () => {
    it('should create a retry function with preset config', async () => {
      const retryFn = createRetryFunction({
        maxRetries: 2,
        initialDelay: 50
      });
      
      const fn = jest.fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');
      
      const result = await retryFn(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('should allow config override', async () => {
      const retryFn = createRetryFunction({
        maxRetries: 5,
        initialDelay: 100
      });
      
      const fn = jest.fn()
        .mockRejectedValue(new Error('Persistent'));
      
      await expect(
        retryFn(fn, { maxRetries: 1, initialDelay: 10 })
      ).rejects.toThrow('Persistent');
      
      expect(fn).toHaveBeenCalledTimes(2); // Override maxRetries to 1
    });
  });
  
  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(3, 1000);
    });
    
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.shouldAllowRequest()).toBe(true);
    });
    
    it('should open after threshold failures', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.getState()).toBe('OPEN');
      expect(circuitBreaker.shouldAllowRequest()).toBe(false);
    });
    
    it('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise<void>(resolve => { setTimeout(resolve, 1100); });

      expect(circuitBreaker.shouldAllowRequest()).toBe(true);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });
    
    it('should close from HALF_OPEN on success', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      // Wait for timeout
      await new Promise<void>(resolve => { setTimeout(resolve, 1100); });

      circuitBreaker.shouldAllowRequest(); // Transition to HALF_OPEN
      circuitBreaker.recordSuccess();

      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should call state change callback', () => {
      const onStateChange = jest.fn();
      const cb = new CircuitBreaker(2, 100, onStateChange);
      
      cb.recordFailure();
      cb.recordFailure();
      
      expect(onStateChange).toHaveBeenCalledWith('OPEN');
    });
    
    it('should reset properly', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.shouldAllowRequest()).toBe(true);
    });
  });
  
  describe('withCircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    
    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(2, 100);
    });
    
    it('should allow requests when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      const result = await withCircuitBreaker(fn, circuitBreaker);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });
    
    it('should reject when circuit is open', async () => {
      // Open the circuit
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      
      const fn = jest.fn().mockResolvedValue('success');
      
      await expect(
        withCircuitBreaker(fn, circuitBreaker)
      ).rejects.toThrow('Circuit breaker is OPEN');
      
      expect(fn).not.toHaveBeenCalled();
    });
    
    it('should record success on successful call', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      
      await withCircuitBreaker(fn, circuitBreaker);
      
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
    
    it('should record failure on failed call', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Failed'));
      
      await expect(
        withCircuitBreaker(fn, circuitBreaker)
      ).rejects.toThrow('Failed');
      
      // One failure recorded
      expect(circuitBreaker.getState()).toBe('CLOSED');
      
      // Second failure opens the circuit
      await expect(
        withCircuitBreaker(fn, circuitBreaker)
      ).rejects.toThrow('Failed');
      
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });
});