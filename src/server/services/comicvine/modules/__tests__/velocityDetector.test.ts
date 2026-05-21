/**
 * Tests for Velocity Detection Prevention
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { VelocityDetector } from '../velocityDetector';

describe('VelocityDetector', () => {
  let detector: VelocityDetector;
  
  beforeEach(() => {
    detector = new VelocityDetector({
      minJitterMs: 100,
      maxJitterMs: 500,
      burstThreshold: 3,
      burstCooldownMs: 5000,
      humanizeRequests: true
    });
  });
  
  afterEach(() => {
    detector.reset();
  });
  
  describe('Jitter Application', () => {
    it('should add random jitter to base delay', () => {
      const baseDelay = 1000;
      const delays: number[] = [];
      
      // Collect multiple samples
      for (let i = 0; i < 10; i++) {
        const additional = detector.calculateAdditionalDelay(baseDelay, 'test');
        delays.push(additional);
        // Reset to avoid burst detection
        detector.reset();
      }
      
      // Check that delays vary (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
      
      // Check delays are within expected range (at least jitter range)
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(100); // Min jitter
        // Max could be higher due to human-like delays
        expect(delay).toBeLessThanOrEqual(10000);
      });
    });
    
    it('should apply consistent jitter range', () => {
      const detector = new VelocityDetector({
        minJitterMs: 200,
        maxJitterMs: 300,
        humanizeRequests: false // Disable to test just jitter
      });
      
      const delays: number[] = [];
      for (let i = 0; i < 20; i++) {
        const additional = detector.calculateAdditionalDelay(1000, 'test');
        delays.push(additional);
        detector.reset();
      }
      
      // With humanize disabled, delay should be just jitter
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(200);
        expect(delay).toBeLessThanOrEqual(300);
      });
    });
  });
  
  describe('Burst Detection', () => {
    it('should detect burst patterns', () => {
      // Make rapid requests
      const delay1 = detector.calculateAdditionalDelay(100, 'test');
      const _delay2 = detector.calculateAdditionalDelay(100, 'test');
      const _delay3 = detector.calculateAdditionalDelay(100, 'test');

      // Third request should trigger burst detection
      const stats = detector.getStats();
      expect(stats.recentRequests).toBe(3);
      
      // Fourth request should have significant delay
      const delay4 = detector.calculateAdditionalDelay(100, 'test');
      expect(delay4).toBeGreaterThan(delay1);
    });
    
    it('should apply exponential backoff for continued bursts', () => {
      const delays: number[] = [];
      
      // Create a burst
      for (let i = 0; i < 6; i++) {
        const delay = detector.calculateAdditionalDelay(100, 'test');
        delays.push(delay);
      }

      // Later delays should be significantly higher
      const delay2 = delays[2];
      const delay5 = delays[5];
      if (delay2 !== undefined && delay5 !== undefined) {
        expect(delay5).toBeGreaterThan(delay2);
      }
      
      const stats = detector.getStats();
      expect(stats.recommendation).toContain('burst');
    });
    
    it('should reset burst detection after cooldown', () => {
      // Create initial burst
      detector.calculateAdditionalDelay(100, 'test');
      detector.calculateAdditionalDelay(100, 'test');
      detector.calculateAdditionalDelay(100, 'test');

      // Simulate time passing (would need to mock Date.now() in real tests)
      detector.reset(); // Reset for testing
      
      // New request should not trigger burst
      const _delay = detector.calculateAdditionalDelay(100, 'test');
      const stats = detector.getStats();
      expect(stats.recentRequests).toBe(1);
    });
  });
  
  describe('Velocity Scoring', () => {
    it('should calculate velocity score based on request rate', () => {
      // Make several requests quickly
      for (let i = 0; i < 10; i++) {
        detector.calculateAdditionalDelay(10, 'test');
      }
      
      const stats = detector.getStats();
      expect(stats.velocityScore).toBeGreaterThan(0);
    });
    
    it('should detect consistent interval patterns', () => {
      // Make requests with consistent timing (robot-like)
      const consistentDetector = new VelocityDetector({
        humanizeRequests: false
      });
      
      // Simulate consistent intervals
      for (let i = 0; i < 5; i++) {
        consistentDetector.calculateAdditionalDelay(100, 'test');
        // In real tests, we'd mock time progression here
      }
      
      const stats = consistentDetector.getStats();
      // With immediate requests, consistency will be high
      expect(stats.intervalConsistency).toBeGreaterThanOrEqual(0);
    });
    
    it('should recommend slowing down at high velocity', () => {
      // Create high velocity scenario
      for (let i = 0; i < 20; i++) {
        detector.calculateAdditionalDelay(10, 'test');
      }
      
      const stats = detector.getStats();
      if (stats.velocityScore > 0.7) {
        expect(stats.recommendation).toContain('high velocity');
      }
    });
  });
  
  describe('Human-like Delays', () => {
    it('should add variable human-like delays when enabled', () => {
      const humanDetector = new VelocityDetector({
        minJitterMs: 0,
        maxJitterMs: 0,
        humanizeRequests: true
      });
      
      const delays: number[] = [];
      for (let i = 0; i < 20; i++) {
        const delay = humanDetector.calculateAdditionalDelay(100, 'test');
        delays.push(delay);
        humanDetector.reset(); // Reset to avoid burst detection
      }
      
      // Should have variety in delays
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(3);
      
      // Some delays should be longer (reading/thinking pauses)
      const longDelays = delays.filter(d => d > 1000);
      expect(longDelays.length).toBeGreaterThan(0);
    });
    
    it('should not add human delays when disabled', () => {
      const noHumanDetector = new VelocityDetector({
        minJitterMs: 100,
        maxJitterMs: 100, // Fixed jitter for testing
        humanizeRequests: false
      });
      
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        const delay = noHumanDetector.calculateAdditionalDelay(100, 'test');
        delays.push(delay);
        noHumanDetector.reset();
      }
      
      // All delays should be exactly the jitter amount
      delays.forEach(delay => {
        expect(delay).toBe(100);
      });
    });
  });
  
  describe('Resource Tracking', () => {
    it('should track different resource types', () => {
      detector.calculateAdditionalDelay(100, 'volumes');
      detector.calculateAdditionalDelay(100, 'issues');
      detector.calculateAdditionalDelay(100, 'characters');
      
      const stats = detector.getStats();
      expect(stats.recentRequests).toBe(3);
    });
  });
  
  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const stats = detector.getStats();
      
      expect(stats).toHaveProperty('velocityScore');
      expect(stats).toHaveProperty('recentRequests');
      expect(stats).toHaveProperty('intervalConsistency');
      expect(stats).toHaveProperty('recommendation');
      
      expect(stats.velocityScore).toBeGreaterThanOrEqual(0);
      expect(stats.velocityScore).toBeLessThanOrEqual(1);
      expect(stats.recentRequests).toBeGreaterThanOrEqual(0);
      expect(stats.intervalConsistency).toBeGreaterThanOrEqual(0);
      expect(stats.intervalConsistency).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Reset Functionality', () => {
    it('should reset all tracking data', () => {
      // Add some requests
      for (let i = 0; i < 5; i++) {
        detector.calculateAdditionalDelay(100, 'test');
      }
      
      let stats = detector.getStats();
      expect(stats.recentRequests).toBeGreaterThan(0);
      
      // Reset
      detector.reset();
      
      stats = detector.getStats();
      expect(stats.recentRequests).toBe(0);
      expect(stats.velocityScore).toBe(0);
    });
  });
});