/**
 * Error Analysis Tests
 *
 * Tests for analyzeFailures and related batch analysis functions.
 *
 * @module tests/auto-labeling/error-classifier/analysis
 */

import { analyzeFailures } from '@/server/services/auto-labeling/error-classifier';
import { ErrorCategory } from '@/server/services/auto-labeling/types';

import type { LabelingAttempt, SampledPage } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createPage(overrides?: Partial<SampledPage>): SampledPage {
  return {
    id: '1',
    title: 'Test Manga',
    anilistId: 1,
    source: 'fandom',
    url: 'https://example.fandom.com/wiki/Test',
    urlType: 'CHAPTERS',
    baseUrl: 'https://example.fandom.com',
    ...overrides,
  };
}

function createFailedAttempt(
  errorCategory: ErrorCategory,
  pageOverrides?: Partial<SampledPage>
): LabelingAttempt {
  return {
    page: createPage(pageOverrides),
    success: false,
    error: `Error: ${errorCategory}`,
    errorCategory,
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: 100,
    timestamp: new Date(),
  };
}

function createSuccessfulAttempt(pageOverrides?: Partial<SampledPage>): LabelingAttempt {
  return {
    page: createPage(pageOverrides),
    success: true,
    extractedEntities: [],
    expectedEntities: [],
    metrics: {
      truePositives: 5,
      falsePositives: 1,
      falseNegatives: 2,
      precision: 0.83,
      recall: 0.71,
      f1: 0.77,
      byEntityType: {},
      matches: [],
      unmatchedExtracted: [],
      unmatchedExpected: [],
    },
    durationMs: 100,
    timestamp: new Date(),
  };
}

// ============================================================================
// analyzeFailures Tests
// ============================================================================

describe('analyzeFailures', () => {
  describe('byCategory counting', () => {
    it('should count failures by category', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createFailedAttempt(ErrorCategory.TIMEOUT),
      ];

      const result = analyzeFailures(attempts);

      expect(result.byCategory[ErrorCategory.FETCH_ERROR]).toBe(2);
      expect(result.byCategory[ErrorCategory.PARSE_ERROR]).toBe(1);
      expect(result.byCategory[ErrorCategory.TIMEOUT]).toBe(1);
    });

    it('should initialize all categories with zero', () => {
      const result = analyzeFailures([]);

      Object.values(ErrorCategory).forEach(category => {
        expect(result.byCategory[category]).toBe(0);
      });
    });

    it('should handle attempts without errorCategory as UNKNOWN', () => {
      const attempt: LabelingAttempt = {
        page: createPage(),
        success: false,
        error: 'Some error',
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 100,
        timestamp: new Date(),
      };

      const result = analyzeFailures([attempt]);

      expect(result.byCategory[ErrorCategory.UNKNOWN]).toBe(1);
    });

    it('should only count failed attempts', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createSuccessfulAttempt(),
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
      ];

      const result = analyzeFailures(attempts);

      expect(result.byCategory[ErrorCategory.FETCH_ERROR]).toBe(2);
      const totalFailures = Object.values(result.byCategory).reduce((sum, count) => sum + count, 0);
      expect(totalFailures).toBe(2);
    });

    it('should count all 11 error categories correctly', () => {
      const attempts = Object.values(ErrorCategory).map(category =>
        createFailedAttempt(category)
      );

      const result = analyzeFailures(attempts);

      Object.values(ErrorCategory).forEach(category => {
        expect(result.byCategory[category]).toBe(1);
      });
    });
  });

  describe('topPatterns detection', () => {
    it('should identify top failure patterns', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'fandom', urlType: 'CHAPTERS' }),
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'fandom', urlType: 'CHAPTERS' }),
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'fandom', urlType: 'CHAPTERS' }),
        createFailedAttempt(ErrorCategory.PARSE_ERROR, { source: 'wikipedia', urlType: 'VOLUMES' }),
      ];

      const result = analyzeFailures(attempts);

      expect(result.topPatterns.length).toBeGreaterThan(0);
      expect(result.topPatterns[0]?.pattern).toContain('FETCH_ERROR');
      expect(result.topPatterns[0]?.count).toBe(3);
    });

    it('should limit to top 5 patterns', () => {
      const attempts: LabelingAttempt[] = [];
      // Create 10 different patterns
      Object.values(ErrorCategory).forEach((category, i) => {
        for (let j = 0; j < i + 1; j++) {
          attempts.push(
            createFailedAttempt(category, { source: 'fandom', urlType: 'CHAPTERS', id: `${i}-${j}` })
          );
        }
      });

      const result = analyzeFailures(attempts);

      expect(result.topPatterns.length).toBeLessThanOrEqual(5);
    });

    it('should sort patterns by count descending', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createFailedAttempt(ErrorCategory.TIMEOUT),
        createFailedAttempt(ErrorCategory.TIMEOUT),
      ];

      const result = analyzeFailures(attempts);

      expect(result.topPatterns[0]?.count).toBeGreaterThanOrEqual(result.topPatterns[1]?.count ?? 0);
    });

    it('should include source and urlType in pattern key', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'fandom', urlType: 'CHAPTERS' }),
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'wikipedia', urlType: 'CHAPTERS' }),
      ];

      const result = analyzeFailures(attempts);

      // Should be two different patterns due to different sources
      expect(result.topPatterns.length).toBe(2);
      expect(result.topPatterns.some(p => p.pattern.includes('fandom'))).toBe(true);
      expect(result.topPatterns.some(p => p.pattern.includes('wikipedia'))).toBe(true);
    });

    it('should return empty array when no failures', () => {
      const result = analyzeFailures([]);

      expect(result.topPatterns).toEqual([]);
    });
  });

  describe('suggestions generation', () => {
    it('should generate suggestions for each error category', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
      ];

      const result = analyzeFailures(attempts);

      expect(result.suggestions.length).toBe(2);
    });

    it('should include error count in suggestion', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
      ];

      const result = analyzeFailures(attempts);

      expect(result.suggestions.some(s => s.includes('[3 errors]'))).toBe(true);
    });

    it('should include category name in suggestion', () => {
      const attempts = [createFailedAttempt(ErrorCategory.TIMEOUT)];

      const result = analyzeFailures(attempts);

      expect(result.suggestions.some(s => s.includes('TIMEOUT'))).toBe(true);
    });

    it('should sort suggestions by error count descending', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
      ];

      const result = analyzeFailures(attempts);

      // First suggestion should be for PARSE_ERROR (3 errors)
      expect(result.suggestions[0]).toContain('PARSE_ERROR');
      expect(result.suggestions[0]).toContain('[3 errors]');
    });

    it('should not include suggestions for categories with 0 errors', () => {
      const attempts = [createFailedAttempt(ErrorCategory.FETCH_ERROR)];

      const result = analyzeFailures(attempts);

      // Should only have one suggestion
      expect(result.suggestions.length).toBe(1);
      expect(result.suggestions[0]).toContain('FETCH_ERROR');
    });

    it('should return empty suggestions for no failures', () => {
      const result = analyzeFailures([]);

      expect(result.suggestions).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty attempts array', () => {
      const result = analyzeFailures([]);

      expect(result.byCategory[ErrorCategory.FETCH_ERROR]).toBe(0);
      expect(result.topPatterns).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it('should handle all successful attempts', () => {
      const attempts = [
        createSuccessfulAttempt(),
        createSuccessfulAttempt(),
      ];

      const result = analyzeFailures(attempts);

      const totalFailures = Object.values(result.byCategory).reduce((sum, count) => sum + count, 0);
      expect(totalFailures).toBe(0);
      expect(result.topPatterns).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it('should handle single failed attempt', () => {
      const attempts = [createFailedAttempt(ErrorCategory.FETCH_ERROR)];

      const result = analyzeFailures(attempts);

      expect(result.byCategory[ErrorCategory.FETCH_ERROR]).toBe(1);
      expect(result.topPatterns.length).toBe(1);
      expect(result.suggestions.length).toBe(1);
    });

    it('should handle large number of attempts', () => {
      const attempts: LabelingAttempt[] = [];
      for (let i = 0; i < 1000; i++) {
        const categories = Object.values(ErrorCategory);
        const category = categories[i % categories.length];
        attempts.push(createFailedAttempt(category as ErrorCategory));
      }

      const result = analyzeFailures(attempts);

      const totalFailures = Object.values(result.byCategory).reduce((sum, count) => sum + count, 0);
      expect(totalFailures).toBe(1000);
    });

    it('should handle mixed successful and failed attempts', () => {
      const attempts = [
        createSuccessfulAttempt(),
        createFailedAttempt(ErrorCategory.FETCH_ERROR),
        createSuccessfulAttempt(),
        createFailedAttempt(ErrorCategory.PARSE_ERROR),
        createSuccessfulAttempt(),
      ];

      const result = analyzeFailures(attempts);

      expect(result.byCategory[ErrorCategory.FETCH_ERROR]).toBe(1);
      expect(result.byCategory[ErrorCategory.PARSE_ERROR]).toBe(1);
      expect(result.suggestions.length).toBe(2);
    });
  });

  describe('pattern key format', () => {
    it('should create pattern key with category:source:urlType format', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR, {
          source: 'fandom',
          urlType: 'CHAPTERS',
        }),
      ];

      const result = analyzeFailures(attempts);

      expect(result.topPatterns[0]?.pattern).toBe('FETCH_ERROR:fandom:CHAPTERS');
    });

    it('should distinguish patterns by source', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'fandom' }),
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { source: 'wikipedia' }),
      ];

      const result = analyzeFailures(attempts);

      const patterns = result.topPatterns.map(p => p.pattern);
      expect(patterns).toContain('FETCH_ERROR:fandom:CHAPTERS');
      expect(patterns).toContain('FETCH_ERROR:wikipedia:CHAPTERS');
    });

    it('should distinguish patterns by urlType', () => {
      const attempts = [
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { urlType: 'CHAPTERS' }),
        createFailedAttempt(ErrorCategory.FETCH_ERROR, { urlType: 'VOLUMES' }),
      ];

      const result = analyzeFailures(attempts);

      const patterns = result.topPatterns.map(p => p.pattern);
      expect(patterns.some(p => p.includes('CHAPTERS'))).toBe(true);
      expect(patterns.some(p => p.includes('VOLUMES'))).toBe(true);
    });
  });
});
