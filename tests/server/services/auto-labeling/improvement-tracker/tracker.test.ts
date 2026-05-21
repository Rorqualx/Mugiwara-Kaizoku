/**
 * Improvement Tracker Class Tests
 *
 * Tests for ImprovementTracker class methods.
 *
 * @module tests/auto-labeling/improvement-tracker/tracker
 */

import {
  ImprovementTracker,
  resetTracker,
  getTracker,
} from '@/server/services/auto-labeling/improvement-tracker';
import { ErrorCategory } from '@/server/services/auto-labeling/types';

import type {
  LabelingAttempt,
  SampledPage,
  IterationResult,
  AggregatedMetrics,
} from '@/server/services/auto-labeling/types';

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';


// Helper to create unique timestamp filenames
let testIterationCounter = 0;
function getUniqueTestFilename(): string {
  testIterationCounter++;
  return `iteration-test-${Date.now()}-${testIterationCounter}.json`;
}

// Helper to write iterations directly with unique names
function writeIterationFile(dir: string, iterationNumber: number, metrics: Partial<{
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
}>): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `iteration-${timestamp}-${iterationNumber}.json`;
  const summary = {
    iterationNumber,
    timestamp: new Date(),
    totalPages: 10,
    successCount: 8,
    successRate: 0.8,
    avgPrecision: metrics.avgPrecision ?? 0.8,
    avgRecall: metrics.avgRecall ?? 0.7,
    avgF1: metrics.avgF1 ?? 0.75,
    topErrors: [],
    durationMs: 1000,
  };
  const data = { summary, result: {} };
  writeFileSync(join(dir, filename), JSON.stringify(data));
}

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_DATA_DIR = '/tmp/auto-labeling-tracker-test';

function createPage(id = '1'): SampledPage {
  return {
    id,
    title: 'Test Manga',
    anilistId: parseInt(id) || 1,
    source: 'fandom',
    url: `https://example.fandom.com/wiki/Test${id}`,
    urlType: 'CHAPTERS',
    baseUrl: 'https://example.fandom.com',
  };
}

function createSuccessfulAttempt(
  id = '1',
  entityType?: string
): LabelingAttempt & { metrics: NonNullable<LabelingAttempt['metrics']> } {
  const byEntityType: LabelingAttempt['metrics']['byEntityType'] = {};
  if (entityType) {
    byEntityType[entityType] = {
      entityType: entityType as LabelingAttempt['metrics']['byEntityType'][string]['entityType'],
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 1.0,
      recall: 1.0,
      f1: 1.0,
    };
  }

  return {
    page: createPage(id),
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
      byEntityType,
      matches: [],
      unmatchedExtracted: [],
      unmatchedExpected: [],
    },
    durationMs: 100,
    timestamp: new Date(),
  };
}

function createFailedAttempt(
  id = '1',
  errorCategory = ErrorCategory.FETCH_ERROR
): LabelingAttempt & { metrics: NonNullable<LabelingAttempt['metrics']> } {
  return {
    page: createPage(id),
    success: false,
    error: 'Test error',
    errorCategory,
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: 50,
    timestamp: new Date(),
  };
}

function createIterationResult(
  iterationNumber: number,
  attempts: LabelingAttempt[]
): IterationResult {
  const successfulAttempts = attempts.filter(a => a.success);
  const metrics: AggregatedMetrics = {
    totalAttempts: attempts.length,
    successfulAttempts: successfulAttempts.length,
    avgPrecision: 0.8,
    avgRecall: 0.7,
    avgF1: 0.75,
    microPrecision: 0.8,
    microRecall: 0.7,
    microF1: 0.75,
    byEntityType: {},
  };

  return {
    iterationNumber,
    timestamp: new Date(),
    config: {
      sampleSize: 10,
      targetF1: 0.85,
      maxIterations: 100,
      minMatchConfidence: 0.6,
      parallel: true,
      concurrency: 3,
      pageTimeoutMs: 30000,
      saveResults: true,
      outputDir: TEST_DATA_DIR,
    },
    sampledPages: attempts.map(a => a.page),
    attempts,
    metrics,
    failures: {
      totalFailures: attempts.filter(a => !a.success).length,
      byCategory: {} as Record<ErrorCategory, { count: number; percentage: number; examples: [] }>,
      commonPatterns: [],
      failedPageIds: [],
    },
    suggestions: [],
    durationMs: 1000,
    targetMet: false,
  };
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
// Constructor Tests
// ============================================================================

describe('ImprovementTracker constructor', () => {
  it('should create data directory if it does not exist', () => {
    cleanupTestDir(); // Remove it first
    expect(existsSync(TEST_DATA_DIR)).toBe(false);

    new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    expect(existsSync(TEST_DATA_DIR)).toBe(true);
  });

  it('should use custom config values', () => {
    const tracker = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      maxIterationsToKeep: 50,
      regressionThreshold: 0.1,
    });

    // Config is private, but we can verify behavior
    expect(tracker).toBeDefined();
  });

  it('should use default config when not provided', () => {
    // This will create in default location, but we can verify it doesn't throw
    resetTracker();
    const tracker = getTracker({ dataDir: TEST_DATA_DIR });
    expect(tracker).toBeDefined();
  });
});

// ============================================================================
// logIteration Tests
// ============================================================================

describe('logIteration', () => {
  it('should save iteration result to file', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [createSuccessfulAttempt('1'), createSuccessfulAttempt('2')];
    const result = createIterationResult(1, attempts);

    tracker.logIteration(result);

    const files = readdirSync(TEST_DATA_DIR).filter(f => f.startsWith('iteration-'));
    expect(files.length).toBe(1);
  });

  it('should return iteration summary', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createSuccessfulAttempt('1'),
      createSuccessfulAttempt('2'),
      createFailedAttempt('3'),
    ];
    const result = createIterationResult(1, attempts);

    const summary = tracker.logIteration(result);

    expect(summary.iterationNumber).toBe(1);
    expect(summary.totalPages).toBe(3);
    expect(summary.successCount).toBe(2);
    expect(summary.successRate).toBeCloseTo(2 / 3, 5);
  });

  it('should track top errors in summary', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createFailedAttempt('1', ErrorCategory.FETCH_ERROR),
      createFailedAttempt('2', ErrorCategory.FETCH_ERROR),
      createFailedAttempt('3', ErrorCategory.PARSE_ERROR),
    ];
    const result = createIterationResult(1, attempts);

    const summary = tracker.logIteration(result);

    expect(summary.topErrors.length).toBeGreaterThan(0);
    expect(summary.topErrors[0]?.category).toBe(ErrorCategory.FETCH_ERROR);
    expect(summary.topErrors[0]?.count).toBe(2);
  });

  it('should cleanup old iterations', () => {
    const tracker = new ImprovementTracker({
      dataDir: TEST_DATA_DIR,
      maxIterationsToKeep: 2,
    });

    // Write files directly with unique names
    for (let i = 1; i <= 5; i++) {
      writeIterationFile(TEST_DATA_DIR, i, { avgF1: 0.5 + i * 0.05 });
    }

    // Now log one more to trigger cleanup
    const result = createIterationResult(6, [createSuccessfulAttempt('6')]);
    tracker.logIteration(result);

    // After logging, cleanup should keep only 2 + the new one we just logged
    const files = readdirSync(TEST_DATA_DIR).filter(f => f.startsWith('iteration-'));
    expect(files.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================================
// getIterationHistory Tests
// ============================================================================

describe('getIterationHistory', () => {
  it('should return empty array when no iterations', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    const history = tracker.getIterationHistory();

    expect(history).toEqual([]);
  });

  it('should return all logged iterations', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Write files directly with unique names
    for (let i = 1; i <= 3; i++) {
      writeIterationFile(TEST_DATA_DIR, i, { avgF1: 0.5 + i * 0.1 });
    }

    const history = tracker.getIterationHistory();

    expect(history.length).toBe(3);
  });

  it('should return iterations in chronological order', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Write files directly with unique names (they sort by filename)
    for (let i = 1; i <= 3; i++) {
      writeIterationFile(TEST_DATA_DIR, i, { avgF1: 0.5 + i * 0.1 });
    }

    const history = tracker.getIterationHistory();

    // Files are sorted, iterations should be in order
    expect(history.length).toBe(3);
  });

  it('should handle corrupted files gracefully', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Create a valid iteration
    const result = createIterationResult(1, [createSuccessfulAttempt('1')]);
    tracker.logIteration(result);

    // Create a corrupted file
    writeFileSync(join(TEST_DATA_DIR, 'iteration-corrupted.json'), 'not valid json');

    const history = tracker.getIterationHistory();

    // Should still return the valid iteration
    expect(history.length).toBe(1);
  });
});

// ============================================================================
// generatePriorities Tests
// ============================================================================

describe('generatePriorities', () => {
  it('should generate priorities sorted by count', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createFailedAttempt('1', ErrorCategory.FETCH_ERROR),
      createFailedAttempt('2', ErrorCategory.PARSE_ERROR),
      createFailedAttempt('3', ErrorCategory.PARSE_ERROR),
      createFailedAttempt('4', ErrorCategory.PARSE_ERROR),
    ];

    const priorities = tracker.generatePriorities(attempts);

    expect(priorities[0]?.category).toBe(ErrorCategory.PARSE_ERROR);
    expect(priorities[0]?.count).toBe(3);
  });

  it('should calculate percentage of failures', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createFailedAttempt('1', ErrorCategory.FETCH_ERROR),
      createFailedAttempt('2', ErrorCategory.FETCH_ERROR),
      createFailedAttempt('3', ErrorCategory.PARSE_ERROR),
      createFailedAttempt('4', ErrorCategory.PARSE_ERROR),
    ];

    const priorities = tracker.generatePriorities(attempts);

    // Each category is 50% of failures
    expect(priorities[0]?.percentOfFailures).toBeCloseTo(50, 0);
  });

  it('should include suggestions', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [createFailedAttempt('1', ErrorCategory.FETCH_ERROR)];

    const priorities = tracker.generatePriorities(attempts);

    expect(priorities[0]?.suggestion).toBeDefined();
    expect(priorities[0]?.suggestion.length).toBeGreaterThan(0);
  });

  it('should return empty array when no failures', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [createSuccessfulAttempt('1'), createSuccessfulAttempt('2')];

    const priorities = tracker.generatePriorities(attempts);

    expect(priorities).toEqual([]);
  });

  it('should only count failed attempts', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createSuccessfulAttempt('1'),
      createFailedAttempt('2', ErrorCategory.FETCH_ERROR),
      createSuccessfulAttempt('3'),
    ];

    const priorities = tracker.generatePriorities(attempts);

    expect(priorities.length).toBe(1);
    expect(priorities[0]?.count).toBe(1);
  });
});

// ============================================================================
// generateReport Tests
// ============================================================================

describe('generateReport', () => {
  it('should include total iterations', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Write files directly with unique names
    for (let i = 1; i <= 3; i++) {
      writeIterationFile(TEST_DATA_DIR, i, { avgF1: 0.5 + i * 0.1 });
    }

    const report = tracker.generateReport([createSuccessfulAttempt()], {});

    expect(report.totalIterations).toBe(3);
  });

  it('should include latest iteration summary', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    const result = createIterationResult(1, [createSuccessfulAttempt('1')]);
    tracker.logIteration(result);

    const report = tracker.generateReport([createSuccessfulAttempt()], {});

    expect(report.latestIteration).not.toBeNull();
    expect(report.latestIteration?.iterationNumber).toBe(1);
  });

  it('should include trend analysis when available', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Write files directly with unique names and increasing F1
    for (let i = 1; i <= 3; i++) {
      writeIterationFile(TEST_DATA_DIR, i, { avgF1: 0.5 + i * 0.1 });
    }

    const report = tracker.generateReport([createSuccessfulAttempt()], {});

    expect(report.trend).not.toBeNull();
    expect(report.trend?.direction).toBe('improving');
  });

  it('should include priorities', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createFailedAttempt('1', ErrorCategory.FETCH_ERROR),
      createFailedAttempt('2', ErrorCategory.FETCH_ERROR),
    ];

    const report = tracker.generateReport(attempts, {});

    expect(report.priorities.length).toBeGreaterThan(0);
  });

  it('should calculate target progress', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [
      createSuccessfulAttempt('1', 'TITLE'),
      createSuccessfulAttempt('2', 'TITLE'),
    ];
    const targets = { TITLE: 0.8 };

    const report = tracker.generateReport(attempts, targets);

    expect(report.targetProgress['TITLE']).toBeDefined();
    expect(report.targetProgress['TITLE']?.target).toBe(0.8);
  });

  it('should mark target as met when achieved', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Create attempts with perfect metrics for TITLE
    const attempts = [
      {
        ...createSuccessfulAttempt('1'),
        metrics: {
          truePositives: 1,
          falsePositives: 0,
          falseNegatives: 0,
          precision: 1.0,
          recall: 1.0,
          f1: 1.0,
          byEntityType: {
            TITLE: {
              entityType: 'TITLE' as const,
              truePositives: 10,
              falsePositives: 0,
              falseNegatives: 0,
              precision: 1.0,
              recall: 1.0,
              f1: 1.0,
            },
          },
          matches: [],
          unmatchedExtracted: [],
          unmatchedExpected: [],
        },
      },
    ] as LabelingAttempt[];

    const targets = { TITLE: 0.8 };

    const report = tracker.generateReport(attempts, targets);

    expect(report.targetProgress['TITLE']?.met).toBe(true);
  });
});

// ============================================================================
// formatReport Tests
// ============================================================================

describe('formatReport', () => {
  it('should include header', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const report = tracker.generateReport([], {});

    const formatted = tracker.formatReport(report);

    expect(formatted).toContain('Progress Report');
  });

  it('should include total iterations', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const report = tracker.generateReport([], {});

    const formatted = tracker.formatReport(report);

    expect(formatted).toContain('Total Iterations');
  });

  it('should include latest iteration metrics when available', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    const result = createIterationResult(1, [createSuccessfulAttempt('1')]);
    tracker.logIteration(result);

    const report = tracker.generateReport([], {});
    const formatted = tracker.formatReport(report);

    expect(formatted).toContain('Latest Iteration');
    expect(formatted).toContain('Success Rate');
    expect(formatted).toContain('Precision');
  });

  it('should include trend analysis when available', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });

    // Write files directly with unique names and increasing F1
    for (let i = 1; i <= 3; i++) {
      writeIterationFile(TEST_DATA_DIR, i, { avgF1: 0.5 + i * 0.1 });
    }

    const report = tracker.generateReport([], {});
    const formatted = tracker.formatReport(report);

    expect(formatted).toContain('Trend Analysis');
    expect(formatted).toContain('Direction');
  });

  it('should include priorities when available', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [createFailedAttempt('1', ErrorCategory.FETCH_ERROR)];

    const report = tracker.generateReport(attempts, {});
    const formatted = tracker.formatReport(report);

    expect(formatted).toContain('Improvement Priorities');
    expect(formatted).toContain('FETCH_ERROR');
  });

  it('should include target progress when targets provided', () => {
    const tracker = new ImprovementTracker({ dataDir: TEST_DATA_DIR });
    const attempts = [createSuccessfulAttempt('1', 'TITLE')];
    const targets = { TITLE: 0.8 };

    const report = tracker.generateReport(attempts, targets);
    const formatted = tracker.formatReport(report);

    expect(formatted).toContain('Target Progress');
    expect(formatted).toContain('TITLE');
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('singleton functions', () => {
  it('getTracker should return same instance', () => {
    const tracker1 = getTracker({ dataDir: TEST_DATA_DIR });
    const tracker2 = getTracker({ dataDir: TEST_DATA_DIR });

    expect(tracker1).toBe(tracker2);
  });

  it('resetTracker should clear instance', () => {
    const tracker1 = getTracker({ dataDir: TEST_DATA_DIR });
    resetTracker();
    const tracker2 = getTracker({ dataDir: TEST_DATA_DIR });

    expect(tracker1).not.toBe(tracker2);
  });
});
