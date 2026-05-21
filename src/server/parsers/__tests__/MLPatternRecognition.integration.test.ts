/**
 * ML Pattern Recognition Integration Tests
 *
 * Tests the ML pattern recognition system with TensorFlow.js backend,
 * including model loading, pattern recognition, and active learning.
 *
 * @jest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import type { RecognitionRequest } from '@/server/parsers/pattern-recognition/types';

import { PatternRecognitionEngine } from '../pattern-recognition/core/PatternRecognitionEngine';

/* -------------------------------------------------------------------------- */
/*                                    TESTS                                   */
/* -------------------------------------------------------------------------- */

describe('ML Pattern Recognition Integration', () => {
  let engine: PatternRecognitionEngine;

  beforeAll(async () => {
    // Initialize engine with test configuration
    engine = new PatternRecognitionEngine({
      enableLearning: true,
      enableEvolution: false, // Disable evolution for tests
      enableCaching: true,
      mlConfig: {
        minConfidence: 0.7,
        maxInferenceTime: 50,
        modelUpdateFrequency: 100,
        activeLearningThreshold: 0.5,
        ensembleSize: 3
      }
    });

    await engine.initialize();
  });

  afterAll(async () => {
    await engine.shutdown();
  });

  describe('Pattern Recognition Engine', () => {
    it('should initialize successfully with ML features enabled', () => {
      const metrics = engine.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('patterns');
      expect(metrics.patterns).toHaveProperty('total');
      expect(typeof metrics.patterns.total).toBe('number');
    });

    it('should recognize patterns in HTML content', async () => {
      const sampleHTML = `
        <div class="manga-card">
          <h2 class="title">One Piece</h2>
          <span class="author">Eiichiro Oda</span>
          <div class="rating">9.5</div>
        </div>
      `;

      const request: RecognitionRequest = {
        html: sampleHTML,
        url: 'https://example.com/manga/one-piece',
        targetType: 'metadata',
        options: {
          useCache: true,
          learnFromResult: false
        }
      };

      const response = await engine.recognize(request);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.matches).toBeDefined();
      expect(Array.isArray(response.matches)).toBe(true);
    });

    it('should extract structured data from recognized patterns', async () => {
      const sampleHTML = `
        <article>
          <h1 itemprop="name">Attack on Titan</h1>
          <div itemprop="author">Hajime Isayama</div>
          <meta itemprop="ratingValue" content="9.0">
        </article>
      `;

      const request: RecognitionRequest = {
        html: sampleHTML,
        url: 'https://example.com/manga/attack-on-titan',
        targetType: 'metadata',
        options: {
          useCache: true,
          learnFromResult: false
        }
      };

      const response = await engine.recognize(request);

      expect(response).toBeDefined();
      expect(response.success).toBe(true);

      if (response.matches.length > 0) {
        const match = response.matches[0];
        expect(match).toBeDefined();
        if (match) {
          expect(match).toHaveProperty('confidence');
          expect(match).toHaveProperty('extractedData');
          expect(typeof match.confidence).toBe('number');
        }
      }
    });
  });

  describe('Active Learning System', () => {
    it('should accept user feedback for pattern improvement', async () => {
      const sampleHTML = `<div class="test">Test Content</div>`;

      const request: RecognitionRequest = {
        html: sampleHTML,
        url: 'https://example.com/test',
        targetType: 'metadata',
        options: {
          useCache: false,
          learnFromResult: true
        }
      };

      const response = await engine.recognize(request);

      // Test that feedback can be provided without throwing
      // Using try/catch instead of toThrow() due to Bun compatibility issues
      let feedbackError: Error | null = null;
      try {
        if (response.matches.length > 0) {
          const matchId = response.matches[0]?.pattern.id ?? 'test-match-id';
          await engine.provideFeedback(matchId, {
            correct: true,
            confidence: 0.9
          });
        } else {
          // If no matches, test that feedback doesn't throw
          await engine.provideFeedback('test-match-id', {
            correct: false,
            confidence: 0.5
          });
        }
      } catch (error) {
        feedbackError = error as Error;
      }

      expect(feedbackError).toBeNull();
    });

    it('should track learning metrics', () => {
      const metrics = engine.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('patterns');
      expect(metrics).toHaveProperty('learning');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('models');

      // Verify patterns metrics
      expect(metrics.patterns).toHaveProperty('total');
      expect(typeof metrics.patterns.total).toBe('number');

      // Verify learning metrics
      expect(metrics.learning).toHaveProperty('accuracy');
      expect(typeof metrics.learning.accuracy).toBe('number');

      // Verify performance metrics
      expect(metrics.performance).toHaveProperty('averageInferenceTime');
      expect(typeof metrics.performance.averageInferenceTime).toBe('number');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete pattern recognition within reasonable time', async () => {
      const sampleHTML = `
        <div class="manga-info">
          <h1>Naruto</h1>
          <p class="description">A ninja story</p>
          <span class="status">Completed</span>
        </div>
      `;

      const request: RecognitionRequest = {
        html: sampleHTML,
        url: 'https://example.com/manga/naruto',
        targetType: 'metadata',
        options: {
          useCache: false,
          learnFromResult: false
        }
      };

      const startTime = Date.now();
      await engine.recognize(request);
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds (generous threshold for CI)
      expect(duration).toBeLessThan(5000);
    }, 10000); // 10 second timeout for this test
  });
});
