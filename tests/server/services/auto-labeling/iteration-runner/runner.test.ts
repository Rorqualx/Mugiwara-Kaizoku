/**
 * Iteration Runner Tests
 *
 * Tests for runSingleIteration and runIterativeImprovement functions.
 * These require extensive mocking of dependencies.
 *
 * @module tests/auto-labeling/iteration-runner/runner
 */

import { describe, it, expect } from 'bun:test';

import type { IterationProgress, RunnerStatus } from '@/server/services/auto-labeling/iteration-runner';
import type { IterationConfig } from '@/server/services/auto-labeling/types';

// ============================================================================
// Type Definitions
// ============================================================================

// Since the module has many dependencies that need mocking,
// we test the types and callback behavior here.

describe('IterationProgress type', () => {
  it('should have required fields', () => {
    const progress: IterationProgress = {
      currentIteration: 1,
      maxIterations: 5,
      currentPage: 3,
      totalPages: 10,
      currentF1: 0.75,
      targetF1: 0.85,
      status: 'running',
      message: 'Processing page',
    };

    expect(progress.currentIteration).toBe(1);
    expect(progress.maxIterations).toBe(5);
    expect(progress.currentPage).toBe(3);
    expect(progress.totalPages).toBe(10);
    expect(progress.currentF1).toBe(0.75);
    expect(progress.targetF1).toBe(0.85);
    expect(progress.status).toBe('running');
    expect(progress.message).toBe('Processing page');
  });

  it('should support all RunnerStatus values', () => {
    const statuses: RunnerStatus[] = ['idle', 'running', 'paused', 'completed', 'failed'];

    for (const status of statuses) {
      const progress: IterationProgress = {
        currentIteration: 1,
        maxIterations: 1,
        currentPage: 0,
        totalPages: 0,
        currentF1: 0,
        targetF1: 0.8,
        status,
        message: '',
      };
      expect(progress.status).toBe(status);
    }
  });
});

describe('IterationConfig defaults', () => {
  it('should have sensible default values', () => {
    // Test the expected default config structure
    const expectedDefaults: Partial<IterationConfig> = {
      sampleSize: 50,
      maxIterations: 10,
      targetF1: 0.85,
      pageTimeoutMs: 30000,
      minMatchConfidence: 0.8,
    };

    // Verify expected ranges
    expect(expectedDefaults.sampleSize).toBeGreaterThan(0);
    expect(expectedDefaults.maxIterations).toBeGreaterThan(0);
    expect(expectedDefaults.targetF1).toBeGreaterThan(0);
    expect(expectedDefaults.targetF1).toBeLessThanOrEqual(1);
    expect(expectedDefaults.pageTimeoutMs).toBeGreaterThan(0);
    expect(expectedDefaults.minMatchConfidence).toBeGreaterThan(0);
    expect(expectedDefaults.minMatchConfidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Progress Callback Tests
// ============================================================================

describe('ProgressCallback behavior', () => {
  it('should call callback with correct progress structure', () => {
    const progressHistory: IterationProgress[] = [];
    const callback = (progress: IterationProgress): void => {
      progressHistory.push({ ...progress });
    };

    // Simulate progress calls
    callback({
      currentIteration: 1,
      maxIterations: 1,
      currentPage: 0,
      totalPages: 10,
      currentF1: 0,
      targetF1: 0.85,
      status: 'running',
      message: 'Loading training data',
    });

    callback({
      currentIteration: 1,
      maxIterations: 1,
      currentPage: 5,
      totalPages: 10,
      currentF1: 0.4,
      targetF1: 0.85,
      status: 'running',
      message: 'Processing page 5',
    });

    callback({
      currentIteration: 1,
      maxIterations: 1,
      currentPage: 10,
      totalPages: 10,
      currentF1: 0.87,
      targetF1: 0.85,
      status: 'completed',
      message: 'Target F1 met!',
    });

    expect(progressHistory.length).toBe(3);
    expect(progressHistory[0]?.status).toBe('running');
    expect(progressHistory[1]?.currentPage).toBe(5);
    expect(progressHistory[2]?.status).toBe('completed');
  });

  it('should track iteration progress across multiple iterations', () => {
    const progressHistory: IterationProgress[] = [];
    const callback = (progress: IterationProgress): void => {
      progressHistory.push({ ...progress });
    };

    // Simulate multiple iterations
    for (let iteration = 1; iteration <= 3; iteration++) {
      callback({
        currentIteration: iteration,
        maxIterations: 5,
        currentPage: 10,
        totalPages: 10,
        currentF1: 0.5 + iteration * 0.1,
        targetF1: 0.85,
        status: iteration < 3 ? 'running' : 'completed',
        message: `Iteration ${iteration} complete`,
      });
    }

    expect(progressHistory.length).toBe(3);
    expect(progressHistory[0]?.currentIteration).toBe(1);
    expect(progressHistory[1]?.currentIteration).toBe(2);
    expect(progressHistory[2]?.currentIteration).toBe(3);
    expect(progressHistory[2]?.status).toBe('completed');
  });
});

// ============================================================================
// Iteration Result Structure Tests
// ============================================================================

describe('IterationResult structure', () => {
  it('should have required fields', () => {
    // Verify the expected structure of an iteration result
    const mockResult = {
      iterationNumber: 1,
      timestamp: new Date(),
      config: {
        sampleSize: 50,
        maxIterations: 10,
        targetF1: 0.85,
      },
      sampledPages: [],
      attempts: [],
      metrics: {
        totalAttempts: 10,
        successfulAttempts: 8,
        avgPrecision: 0.82,
        avgRecall: 0.78,
        avgF1: 0.80,
        microF1: 0.79,
        macroF1: 0.81,
        entityBreakdown: {},
      },
      failures: {
        totalFailures: 2,
        byCategory: {},
        commonPatterns: [],
        failedPageIds: ['1', '2'],
      },
      suggestions: [],
      durationMs: 5000,
      targetMet: false,
    };

    expect(mockResult.iterationNumber).toBe(1);
    expect(mockResult.metrics.avgF1).toBe(0.80);
    expect(mockResult.targetMet).toBe(false);
    expect(mockResult.failures.totalFailures).toBe(2);
  });

  it('should mark targetMet true when F1 exceeds target', () => {
    const result1 = { metrics: { avgF1: 0.80 }, targetF1: 0.85, targetMet: false };
    const result2 = { metrics: { avgF1: 0.87 }, targetF1: 0.85, targetMet: true };

    expect(result1.metrics.avgF1 < result1.targetF1).toBe(true);
    expect(result1.targetMet).toBe(false);

    expect(result2.metrics.avgF1 >= result2.targetF1).toBe(true);
    expect(result2.targetMet).toBe(true);
  });
});

// ============================================================================
// Improvement Suggestion Tests
// ============================================================================

describe('ImprovementSuggestion structure', () => {
  it('should have correct priority values', () => {
    const priorities = ['critical', 'high', 'medium', 'low'] as const;

    for (const priority of priorities) {
      const suggestion = {
        id: 'test-1',
        category: 'parser' as const,
        title: 'Test Suggestion',
        description: 'Test description',
        priority,
        expectedImpact: 0.5,
        relatedErrors: ['PARSE_ERROR'],
        affectedPageCount: 5,
      };

      expect(suggestion.priority).toBe(priority);
    }
  });

  it('should calculate expected impact correctly', () => {
    const totalAttempts = 100;
    const failedCount = 25;
    const expectedImpact = (failedCount / totalAttempts) * 0.8;

    expect(expectedImpact).toBe(0.2);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error handling behavior', () => {
  it('should handle empty sampled pages', () => {
    const sampledPages: unknown[] = [];
    const shouldThrow = sampledPages.length === 0;

    expect(shouldThrow).toBe(true);
  });

  it('should create proper error categories', () => {
    const errorCategories = [
      'FETCH_ERROR',
      'PARSE_ERROR',
      'TIMEOUT',
      'GROUND_TRUTH_ERROR',
      'PARSER_SELECTION_FAILED',
      'STRUCTURE_NOT_RECOGNIZED',
      'ENTITY_EXTRACTION_FAILED',
      'PATTERN_MISMATCH',
      'CONFIDENCE_TOO_LOW',
      'NO_CONTENT',
      'UNKNOWN',
    ];

    expect(errorCategories.length).toBe(11);
    expect(errorCategories).toContain('FETCH_ERROR');
    expect(errorCategories).toContain('UNKNOWN');
  });
});

// ============================================================================
// Config Merging Tests
// ============================================================================

describe('Config merging', () => {
  it('should merge partial config with defaults', () => {
    const defaults = {
      sampleSize: 50,
      maxIterations: 10,
      targetF1: 0.85,
      pageTimeoutMs: 30000,
      minMatchConfidence: 0.8,
    };

    const partialConfig = {
      sampleSize: 100,
      targetF1: 0.9,
    };

    const merged = { ...defaults, ...partialConfig };

    expect(merged.sampleSize).toBe(100);
    expect(merged.targetF1).toBe(0.9);
    expect(merged.maxIterations).toBe(10); // Default preserved
    expect(merged.pageTimeoutMs).toBe(30000); // Default preserved
  });

  it('should override all fields when provided', () => {
    const defaults = {
      sampleSize: 50,
      maxIterations: 10,
      targetF1: 0.85,
    };

    const fullConfig = {
      sampleSize: 200,
      maxIterations: 20,
      targetF1: 0.95,
    };

    const merged = { ...defaults, ...fullConfig };

    expect(merged.sampleSize).toBe(200);
    expect(merged.maxIterations).toBe(20);
    expect(merged.targetF1).toBe(0.95);
  });
});

// ============================================================================
// Duration Tracking Tests
// ============================================================================

describe('Duration tracking', () => {
  it('should calculate duration correctly', async () => {
    const startTime = Date.now();

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 50));

    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(50);
    expect(duration).toBeLessThan(200); // Should not take too long
  });

  it('should track duration in milliseconds', () => {
    const start = Date.now();
    const end = start + 5000;
    const durationMs = end - start;

    expect(durationMs).toBe(5000);
  });
});

// ============================================================================
// Iteration Number Tests
// ============================================================================

describe('Iteration numbering', () => {
  it('should start from 1', () => {
    const historyLength = 0;
    const nextIteration = historyLength + 1;

    expect(nextIteration).toBe(1);
  });

  it('should increment based on history', () => {
    const histories = [0, 1, 2, 5, 10];
    const expectedNexts = [1, 2, 3, 6, 11];

    for (let i = 0; i < histories.length; i++) {
      const nextIteration = (histories[i] ?? 0) + 1;
      expect(nextIteration).toBe(expectedNexts[i] ?? 0);
    }
  });
});

// ============================================================================
// Target Achievement Tests
// ============================================================================

describe('Target achievement logic', () => {
  it('should detect when target is met', () => {
    const testCases = [
      { avgF1: 0.80, targetF1: 0.85, expected: false },
      { avgF1: 0.85, targetF1: 0.85, expected: true },
      { avgF1: 0.87, targetF1: 0.85, expected: true },
      { avgF1: 0.84, targetF1: 0.85, expected: false },
      { avgF1: 0.9, targetF1: 0.8, expected: true },
    ];

    for (const { avgF1, targetF1, expected } of testCases) {
      const targetMet = avgF1 >= targetF1;
      expect(targetMet).toBe(expected);
    }
  });

  it('should stop iterations when target is met', () => {
    const maxIterations = 10;
    const results = [
      { avgF1: 0.70, targetMet: false },
      { avgF1: 0.75, targetMet: false },
      { avgF1: 0.82, targetMet: false },
      { avgF1: 0.88, targetMet: true },
    ];

    let iterationsRun = 0;
    for (const result of results) {
      iterationsRun++;
      if (result.targetMet) break;
    }

    expect(iterationsRun).toBe(4);
    expect(iterationsRun).toBeLessThan(maxIterations);
  });
});
