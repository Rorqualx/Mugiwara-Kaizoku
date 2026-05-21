/**
 * Improvement Tracker Pure Functions Tests
 *
 * Tests for trend analysis and metric calculation functions.
 * These are tested indirectly through the ImprovementTracker class.
 *
 * @module tests/auto-labeling/improvement-tracker/pure-functions
 */

import { ImprovementTracker, resetTracker } from '@/server/services/auto-labeling/improvement-tracker';
import { ErrorCategory } from '@/server/services/auto-labeling/types';

import type { LabelingAttempt, SampledPage } from '@/server/services/auto-labeling/types';

import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_DATA_DIR = '/tmp/auto-labeling-test-data';

function createPage(id = '1'): SampledPage {
  return {
    id,
    title: 'Test Manga',
    anilistId: 1,
    source: 'fandom',
    url: 'https://example.fandom.com/wiki/Test',
    urlType: 'CHAPTERS',
    baseUrl: 'https://example.fandom.com',
  };
}

function createFailedAttempt(errorCategory: ErrorCategory): LabelingAttempt {
  return {
    page: createPage(),
    success: false,
    error: 'Test error',
    errorCategory,
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: 100,
    timestamp: new Date(),
  };
}

function createSuccessfulAttempt(
  metrics?: Partial<LabelingAttempt['metrics']>
): LabelingAttempt {
  return {
    page: createPage(),
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
      ...metrics,
    },
    durationMs: 100,
    timestamp: new Date(),
  };
}

function createIterationFile(
  dir: string,
  iterationNumber: number,
  avgF1: number
): void {
  const timestamp = new Date(Date.now() - (100 - iterationNumber) * 1000).toISOString().replace(/[:.]/g, '-');
  const filename = `iteration-${timestamp}.json`;
  const summary = {
    iterationNumber,
    timestamp: new Date(),
    totalPages: 10,
    successCount: 8,
    successRate: 0.8,
    avgPrecision: avgF1 + 0.05,
    avgRecall: avgF1 - 0.05,
    avgF1,
    topErrors: [],
    durationMs: 1000,
  };
  const data = { summary, result: {} };
  writeFileSync(join(dir, filename), JSON.stringify(data));
}

function setupTestDir(): void {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DATA_DIR, { recursive: true });
}

function cleanupTestDir(): void {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}

// ============================================================================
// Setup/Teardown
// ============================================================================

beforeEach(() => {
  resetTracker();
  setupTestDir();
});

afterEach(() => {
  cleanupTestDir();
});

// ============================================================================
// Trend Direction Tests
// ============================================================================

describe('trend direction calculation', () => {
  it('should detect improving trend', () => {
    // Create increasing F1 scores
    createIterationFile(TEST_DATA_DIR, 1, 0.50);
    createIterationFile(TEST_DATA_DIR, 2, 0.55);
    createIterationFile(TEST_DATA_DIR, 3, 0.60);
    createIterationFile(TEST_DATA_DIR, 4, 0.65);
    createIterationFile(TEST_DATA_DIR, 5, 0.70);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend?.direction).toBe('improving');
    expect(trend?.averageChange).toBeGreaterThan(0);
  });

  it('should detect declining trend', () => {
    // Create decreasing F1 scores
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.65);
    createIterationFile(TEST_DATA_DIR, 3, 0.60);
    createIterationFile(TEST_DATA_DIR, 4, 0.55);
    createIterationFile(TEST_DATA_DIR, 5, 0.50);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend?.direction).toBe('declining');
    expect(trend?.averageChange).toBeLessThan(0);
  });

  it('should detect stable trend', () => {
    // Create stable F1 scores
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.70);
    createIterationFile(TEST_DATA_DIR, 3, 0.71);
    createIterationFile(TEST_DATA_DIR, 4, 0.70);
    createIterationFile(TEST_DATA_DIR, 5, 0.70);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend?.direction).toBe('stable');
    expect(Math.abs(trend?.averageChange ?? 1)).toBeLessThanOrEqual(0.01);
  });

  it('should return null when not enough history', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend).toBeNull();
  });

  it('should return null when no history', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend).toBeNull();
  });
});

// ============================================================================
// Regression Detection Tests
// ============================================================================

describe('regression detection', () => {
  it('should detect regression when F1 drops significantly', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.75);
    createIterationFile(TEST_DATA_DIR, 3, 0.80);
    createIterationFile(TEST_DATA_DIR, 4, 0.70); // Drops from 0.80 to 0.70

    const tracker = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      regressionThreshold: 0.05,
    });
    const trend = tracker.analyzeTrend();

    expect(trend?.isRegression).toBe(true);
    expect(trend?.regressionDetails).toContain('dropped');
  });

  it('should not detect regression for small drops', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.72);
    createIterationFile(TEST_DATA_DIR, 3, 0.71); // Small drop

    const tracker = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      regressionThreshold: 0.05,
    });
    const trend = tracker.analyzeTrend();

    expect(trend?.isRegression).toBe(false);
  });

  it('should respect custom regression threshold', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.75);
    createIterationFile(TEST_DATA_DIR, 3, 0.72); // Drops 0.03

    // With threshold of 0.02, this should be a regression
    const trackerStrict = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      regressionThreshold: 0.02,
    });
    const trendStrict = trackerStrict.analyzeTrend();

    expect(trendStrict?.isRegression).toBe(true);

    // With threshold of 0.05, this should not be a regression
    resetTracker();
    const trackerLenient = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      regressionThreshold: 0.05,
    });
    const trendLenient = trackerLenient.analyzeTrend();

    expect(trendLenient?.isRegression).toBe(false);
  });

  it('should include regression details with percentages', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.80);
    createIterationFile(TEST_DATA_DIR, 3, 0.60); // Big drop

    const tracker = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      regressionThreshold: 0.05,
    });
    const trend = tracker.analyzeTrend();

    expect(trend?.regressionDetails).toContain('80.0%');
    expect(trend?.regressionDetails).toContain('60.0%');
  });
});

// ============================================================================
// Average Change Calculation Tests
// ============================================================================

describe('average change calculation', () => {
  it('should calculate positive average change', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.50);
    createIterationFile(TEST_DATA_DIR, 2, 0.60);
    createIterationFile(TEST_DATA_DIR, 3, 0.70);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    // (0.60 - 0.50) + (0.70 - 0.60) = 0.10 + 0.10 = 0.20 / 2 = 0.10
    expect(trend?.averageChange).toBeCloseTo(0.10, 2);
  });

  it('should calculate negative average change', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.60);
    createIterationFile(TEST_DATA_DIR, 3, 0.50);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    // (0.60 - 0.70) + (0.50 - 0.60) = -0.10 + -0.10 = -0.20 / 2 = -0.10
    expect(trend?.averageChange).toBeCloseTo(-0.10, 2);
  });

  it('should calculate zero average change for constant values', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.70);
    createIterationFile(TEST_DATA_DIR, 2, 0.70);
    createIterationFile(TEST_DATA_DIR, 3, 0.70);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend?.averageChange).toBe(0);
  });

  it('should include recent F1 scores in analysis', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.50);
    createIterationFile(TEST_DATA_DIR, 2, 0.60);
    createIterationFile(TEST_DATA_DIR, 3, 0.70);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend();

    expect(trend?.recentF1Scores).toContain(0.50);
    expect(trend?.recentF1Scores).toContain(0.60);
    expect(trend?.recentF1Scores).toContain(0.70);
  });
});

// ============================================================================
// Impact Estimation Tests
// ============================================================================

describe('impact estimation', () => {
  it('should estimate high impact for 30%+ failures', () => {
    const attempts = [
      createFailedAttempt(ErrorCategory.FETCH_ERROR),
      createFailedAttempt(ErrorCategory.FETCH_ERROR),
      createFailedAttempt(ErrorCategory.FETCH_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createSuccessfulAttempt(),
      createSuccessfulAttempt(),
      createSuccessfulAttempt(),
      createSuccessfulAttempt(),
      createSuccessfulAttempt(),
      createSuccessfulAttempt(),
    ];

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const priorities = tracker.generatePriorities(attempts);

    // FETCH_ERROR is 3/4 = 75% of failures
    const fetchPriority = priorities.find(p => p.category === ErrorCategory.FETCH_ERROR);
    expect(fetchPriority?.estimatedImpact).toBe('high');
  });

  it('should estimate medium impact for 15-29% failures', () => {
    const attempts = [
      createFailedAttempt(ErrorCategory.FETCH_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createFailedAttempt(ErrorCategory.TIMEOUT),
    ];

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const priorities = tracker.generatePriorities(attempts);

    // FETCH_ERROR is 1/5 = 20% of failures
    const fetchPriority = priorities.find(p => p.category === ErrorCategory.FETCH_ERROR);
    expect(fetchPriority?.estimatedImpact).toBe('medium');
  });

  it('should estimate low impact for <15% failures', () => {
    const attempts = [
      createFailedAttempt(ErrorCategory.FETCH_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createFailedAttempt(ErrorCategory.PARSE_ERROR),
      createFailedAttempt(ErrorCategory.TIMEOUT),
      createFailedAttempt(ErrorCategory.TIMEOUT),
      createFailedAttempt(ErrorCategory.TIMEOUT),
      createFailedAttempt(ErrorCategory.TIMEOUT),
    ];

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const priorities = tracker.generatePriorities(attempts);

    // FETCH_ERROR is 1/8 = 12.5% of failures
    const fetchPriority = priorities.find(p => p.category === ErrorCategory.FETCH_ERROR);
    expect(fetchPriority?.estimatedImpact).toBe('low');
  });
});

// ============================================================================
// Window Size Tests
// ============================================================================

describe('trend window size', () => {
  it('should limit analysis to window size', () => {
    // Create 10 iterations
    for (let i = 1; i <= 10; i++) {
      createIterationFile(TEST_DATA_DIR, i, 0.50 + i * 0.02);
    }

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend(3); // Only last 3

    expect(trend?.recentF1Scores.length).toBe(3);
  });

  it('should use all available if less than window size', () => {
    createIterationFile(TEST_DATA_DIR, 1, 0.50);
    createIterationFile(TEST_DATA_DIR, 2, 0.60);

    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const trend = tracker.analyzeTrend(5); // Request 5 but only 2 available

    expect(trend?.recentF1Scores.length).toBe(2);
  });
});
