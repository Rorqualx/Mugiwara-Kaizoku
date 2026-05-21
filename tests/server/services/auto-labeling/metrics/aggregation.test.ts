/**
 * Metrics Aggregation Tests
 *
 * Tests for aggregateMetrics and computeEntityBreakdown functions.
 *
 * @module tests/auto-labeling/metrics/aggregation
 */

import { aggregateMetrics, computeEntityBreakdown } from '@/server/services/auto-labeling/metrics';

import type {
  LabelingAttempt,
  LabelingMetrics,
  ExtractedEntity,
  ExpectedEntity,
  EntityMatch,
  SampledPage,
} from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createSampledPage(id: string): SampledPage {
  return {
    id,
    title: `Test Manga ${id}`,
    anilistId: parseInt(id) || 1,
    source: 'fandom',
    url: `https://example.fandom.com/wiki/${id}`,
    urlType: 'CHAPTERS',
    baseUrl: 'https://example.fandom.com',
  };
}

function createMetrics(
  tp: number,
  fp: number,
  fn: number,
  byEntityType?: Record<string, { tp: number; fp: number; fn: number }>
): LabelingMetrics {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const entityBreakdown: Record<string, LabelingMetrics['byEntityType'][string]> = {};
  if (byEntityType) {
    for (const [type, counts] of Object.entries(byEntityType)) {
      const typeP = counts.tp + counts.fp > 0 ? counts.tp / (counts.tp + counts.fp) : 0;
      const typeR = counts.tp + counts.fn > 0 ? counts.tp / (counts.tp + counts.fn) : 0;
      const typeF1 = typeP + typeR > 0 ? (2 * typeP * typeR) / (typeP + typeR) : 0;
      entityBreakdown[type] = {
        entityType: type as ExtractedEntity['type'],
        truePositives: counts.tp,
        falsePositives: counts.fp,
        falseNegatives: counts.fn,
        precision: typeP,
        recall: typeR,
        f1: typeF1,
      };
    }
  }

  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    byEntityType: entityBreakdown,
    matches: [],
    unmatchedExtracted: [],
    unmatchedExpected: [],
  };
}

function createSuccessfulAttempt(
  id: string,
  metrics: LabelingMetrics
): LabelingAttempt {
  return {
    page: createSampledPage(id),
    success: true,
    extractedEntities: [],
    expectedEntities: [],
    metrics,
    durationMs: 100,
    timestamp: new Date(),
  };
}

function createFailedAttempt(id: string, error?: string): LabelingAttempt {
  return {
    page: createSampledPage(id),
    success: false,
    error: error ?? 'Test error',
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: 50,
    timestamp: new Date(),
  };
}

// ============================================================================
// aggregateMetrics Tests
// ============================================================================

describe('aggregateMetrics', () => {
  describe('basic aggregation', () => {
    it('should return correct total and successful attempt counts', () => {
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
        createFailedAttempt('3'),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.totalAttempts).toBe(3);
      expect(aggregated.successfulAttempts).toBe(2);
    });

    it('should handle all successful attempts', () => {
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.totalAttempts).toBe(2);
      expect(aggregated.successfulAttempts).toBe(2);
    });

    it('should handle all failed attempts', () => {
      const attempts = [
        createFailedAttempt('1'),
        createFailedAttempt('2'),
        createFailedAttempt('3'),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.totalAttempts).toBe(3);
      expect(aggregated.successfulAttempts).toBe(0);
    });

    it('should handle empty attempts array', () => {
      const aggregated = aggregateMetrics([]);

      expect(aggregated.totalAttempts).toBe(0);
      expect(aggregated.successfulAttempts).toBe(0);
    });
  });

  describe('micro-averaged metrics', () => {
    it('should calculate micro-averaged precision from pooled counts', () => {
      // Attempt 1: TP=5, FP=1 (P=5/6)
      // Attempt 2: TP=3, FP=2 (P=3/5)
      // Pooled: TP=8, FP=3, P=8/11
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.microPrecision).toBeCloseTo(8 / 11, 5);
    });

    it('should calculate micro-averaged recall from pooled counts', () => {
      // Attempt 1: TP=5, FN=2 (R=5/7)
      // Attempt 2: TP=3, FN=1 (R=3/4)
      // Pooled: TP=8, FN=3, R=8/11
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.microRecall).toBeCloseTo(8 / 11, 5);
    });

    it('should calculate micro-averaged F1 from micro P and R', () => {
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      // P=8/11, R=8/11 -> F1 = 2 * (8/11 * 8/11) / (8/11 + 8/11) = 8/11
      expect(aggregated.microF1).toBeCloseTo(8 / 11, 5);
    });

    it('should return 0 for micro metrics when no successful attempts', () => {
      const attempts = [createFailedAttempt('1'), createFailedAttempt('2')];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.microPrecision).toBe(0);
      expect(aggregated.microRecall).toBe(0);
      expect(aggregated.microF1).toBe(0);
    });
  });

  describe('macro-averaged metrics', () => {
    it('should calculate macro-averaged precision as mean of per-attempt precision', () => {
      // Attempt 1: P=5/6 ≈ 0.833
      // Attempt 2: P=3/5 = 0.6
      // Macro P = (0.833 + 0.6) / 2 ≈ 0.717
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      const expectedAvgP = ((5 / 6) + (3 / 5)) / 2;
      expect(aggregated.avgPrecision).toBeCloseTo(expectedAvgP, 5);
    });

    it('should calculate macro-averaged recall as mean of per-attempt recall', () => {
      // Attempt 1: R=5/7 ≈ 0.714
      // Attempt 2: R=3/4 = 0.75
      // Macro R = (0.714 + 0.75) / 2 ≈ 0.732
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      const expectedAvgR = ((5 / 7) + (3 / 4)) / 2;
      expect(aggregated.avgRecall).toBeCloseTo(expectedAvgR, 5);
    });

    it('should calculate macro-averaged F1 as mean of per-attempt F1', () => {
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createSuccessfulAttempt('2', createMetrics(3, 2, 1)),
      ];

      const aggregated = aggregateMetrics(attempts);

      // Calculate expected F1s
      const p1 = 5 / 6, r1 = 5 / 7;
      const f1_1 = (2 * p1 * r1) / (p1 + r1);
      const p2 = 3 / 5, r2 = 3 / 4;
      const f1_2 = (2 * p2 * r2) / (p2 + r2);
      const expectedAvgF1 = (f1_1 + f1_2) / 2;

      expect(aggregated.avgF1).toBeCloseTo(expectedAvgF1, 5);
    });

    it('should return 0 for macro metrics when no successful attempts', () => {
      const attempts = [createFailedAttempt('1'), createFailedAttempt('2')];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.avgPrecision).toBe(0);
      expect(aggregated.avgRecall).toBe(0);
      expect(aggregated.avgF1).toBe(0);
    });
  });

  describe('entity type breakdown', () => {
    it('should aggregate entity type metrics across attempts', () => {
      const attempts = [
        createSuccessfulAttempt(
          '1',
          createMetrics(5, 1, 2, {
            TITLE: { tp: 1, fp: 0, fn: 0 },
            AUTHOR: { tp: 1, fp: 1, fn: 0 },
          })
        ),
        createSuccessfulAttempt(
          '2',
          createMetrics(3, 2, 1, {
            TITLE: { tp: 1, fp: 0, fn: 0 },
            AUTHOR: { tp: 1, fp: 0, fn: 1 },
          })
        ),
      ];

      const aggregated = aggregateMetrics(attempts);

      // TITLE: TP=2, FP=0, FN=0
      expect(aggregated.byEntityType['TITLE']?.truePositives).toBe(2);
      expect(aggregated.byEntityType['TITLE']?.falsePositives).toBe(0);
      expect(aggregated.byEntityType['TITLE']?.precision).toBe(1.0);

      // AUTHOR: TP=2, FP=1, FN=1
      expect(aggregated.byEntityType['AUTHOR']?.truePositives).toBe(2);
      expect(aggregated.byEntityType['AUTHOR']?.falsePositives).toBe(1);
      expect(aggregated.byEntityType['AUTHOR']?.falseNegatives).toBe(1);
    });

    it('should include entity types from all attempts', () => {
      const attempts = [
        createSuccessfulAttempt(
          '1',
          createMetrics(2, 0, 0, {
            TITLE: { tp: 1, fp: 0, fn: 0 },
          })
        ),
        createSuccessfulAttempt(
          '2',
          createMetrics(2, 0, 0, {
            AUTHOR: { tp: 1, fp: 0, fn: 0 },
          })
        ),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.byEntityType['TITLE']).toBeDefined();
      expect(aggregated.byEntityType['AUTHOR']).toBeDefined();
    });

    it('should return empty breakdown when no successful attempts', () => {
      const attempts = [createFailedAttempt('1')];

      const aggregated = aggregateMetrics(attempts);

      expect(Object.keys(aggregated.byEntityType).length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle single successful attempt', () => {
      const metrics = createMetrics(5, 1, 2);
      const attempts = [createSuccessfulAttempt('1', metrics)];

      const aggregated = aggregateMetrics(attempts);

      // Micro and macro should be the same with single attempt
      expect(aggregated.microPrecision).toBeCloseTo(aggregated.avgPrecision, 5);
      expect(aggregated.microRecall).toBeCloseTo(aggregated.avgRecall, 5);
      expect(aggregated.microF1).toBeCloseTo(aggregated.avgF1, 5);
    });

    it('should handle attempts with zero counts', () => {
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(0, 0, 0)),
        createSuccessfulAttempt('2', createMetrics(5, 1, 2)),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.totalAttempts).toBe(2);
      expect(aggregated.successfulAttempts).toBe(2);
    });

    it('should handle mixed successful and failed attempts', () => {
      const attempts = [
        createSuccessfulAttempt('1', createMetrics(5, 1, 2)),
        createFailedAttempt('2'),
        createSuccessfulAttempt('3', createMetrics(3, 0, 1)),
        createFailedAttempt('4'),
      ];

      const aggregated = aggregateMetrics(attempts);

      expect(aggregated.totalAttempts).toBe(4);
      expect(aggregated.successfulAttempts).toBe(2);
      // Only successful attempts contribute to metrics
      expect(aggregated.microPrecision).toBeCloseTo(8 / 9, 5); // TP=8, FP=1
    });
  });
});

// ============================================================================
// computeEntityBreakdown Tests
// ============================================================================

describe('computeEntityBreakdown', () => {
  function createExtracted(type: string, value: string): ExtractedEntity {
    return {
      type: type as ExtractedEntity['type'],
      value,
      normalizedValue: value.toLowerCase(),
      confidence: 0.9,
      source: 'bootstrap',
    };
  }

  function createExpected(type: string, value: string): ExpectedEntity {
    return {
      type: type as ExpectedEntity['type'],
      value,
      normalizedValue: value.toLowerCase(),
      required: true,
    };
  }

  function createMatch(
    extractedType: string,
    expectedType: string,
    value: string
  ): EntityMatch {
    return {
      extracted: createExtracted(extractedType, value),
      expected: createExpected(expectedType, value),
      similarity: 1.0,
      matchType: 'exact',
    };
  }

  it('should compute metrics for each entity type in matches', () => {
    const matches: EntityMatch[] = [
      createMatch('TITLE', 'TITLE', 'One Piece'),
      createMatch('AUTHOR', 'AUTHOR', 'Eiichiro Oda'),
    ];

    const breakdown = computeEntityBreakdown(matches, [], []);

    expect(breakdown['TITLE']?.truePositives).toBe(1);
    expect(breakdown['AUTHOR']?.truePositives).toBe(1);
  });

  it('should include false positives by entity type', () => {
    const matches: EntityMatch[] = [];
    const unmatchedExtracted: ExtractedEntity[] = [
      createExtracted('GENRE', 'Action'),
      createExtracted('GENRE', 'Adventure'),
      createExtracted('TITLE', 'Wrong Title'),
    ];

    const breakdown = computeEntityBreakdown(matches, unmatchedExtracted, []);

    expect(breakdown['GENRE']?.falsePositives).toBe(2);
    expect(breakdown['TITLE']?.falsePositives).toBe(1);
  });

  it('should include false negatives by entity type', () => {
    const matches: EntityMatch[] = [];
    const unmatchedExpected: ExpectedEntity[] = [
      createExpected('AUTHOR', 'Missing Author'),
      createExpected('STATUS', 'Missing Status'),
    ];

    const breakdown = computeEntityBreakdown(matches, [], unmatchedExpected);

    expect(breakdown['AUTHOR']?.falseNegatives).toBe(1);
    expect(breakdown['STATUS']?.falseNegatives).toBe(1);
  });

  it('should calculate correct precision per entity type', () => {
    const matches: EntityMatch[] = [
      createMatch('TITLE', 'TITLE', 'One Piece'),
    ];
    const unmatchedExtracted: ExtractedEntity[] = [
      createExtracted('TITLE', 'Wrong Title'),
    ];

    const breakdown = computeEntityBreakdown(matches, unmatchedExtracted, []);

    // TITLE: TP=1, FP=1 -> P=0.5
    expect(breakdown['TITLE']?.precision).toBe(0.5);
  });

  it('should calculate correct recall per entity type', () => {
    const matches: EntityMatch[] = [
      createMatch('AUTHOR', 'AUTHOR', 'Eiichiro Oda'),
    ];
    const unmatchedExpected: ExpectedEntity[] = [
      createExpected('AUTHOR', 'Missing Author'),
    ];

    const breakdown = computeEntityBreakdown(matches, [], unmatchedExpected);

    // AUTHOR: TP=1, FN=1 -> R=0.5
    expect(breakdown['AUTHOR']?.recall).toBe(0.5);
  });

  it('should calculate correct F1 per entity type', () => {
    const matches: EntityMatch[] = [
      createMatch('GENRE', 'GENRE', 'Action'),
      createMatch('GENRE', 'GENRE', 'Adventure'),
    ];
    const unmatchedExtracted: ExtractedEntity[] = [
      createExtracted('GENRE', 'Wrong Genre'),
    ];
    const unmatchedExpected: ExpectedEntity[] = [
      createExpected('GENRE', 'Missing Genre'),
    ];

    const breakdown = computeEntityBreakdown(matches, unmatchedExtracted, unmatchedExpected);

    // GENRE: TP=2, FP=1, FN=1 -> P=2/3, R=2/3, F1=2/3
    expect(breakdown['GENRE']?.f1).toBeCloseTo(2 / 3, 5);
  });

  it('should handle empty inputs', () => {
    const breakdown = computeEntityBreakdown([], [], []);

    expect(Object.keys(breakdown).length).toBe(0);
  });

  it('should handle entity types appearing only in one category', () => {
    const matches: EntityMatch[] = [
      createMatch('TITLE', 'TITLE', 'One Piece'),
    ];
    const unmatchedExtracted: ExtractedEntity[] = [
      createExtracted('GENRE', 'Action'),
    ];
    const unmatchedExpected: ExpectedEntity[] = [
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const breakdown = computeEntityBreakdown(matches, unmatchedExtracted, unmatchedExpected);

    expect(breakdown['TITLE']?.truePositives).toBe(1);
    expect(breakdown['TITLE']?.precision).toBe(1.0);
    expect(breakdown['GENRE']?.falsePositives).toBe(1);
    expect(breakdown['GENRE']?.precision).toBe(0);
    expect(breakdown['AUTHOR']?.falseNegatives).toBe(1);
    expect(breakdown['AUTHOR']?.recall).toBe(0);
  });

  it('should handle multiple entities of same type', () => {
    const matches: EntityMatch[] = [
      createMatch('GENRE', 'GENRE', 'Action'),
      createMatch('GENRE', 'GENRE', 'Adventure'),
      createMatch('GENRE', 'GENRE', 'Comedy'),
    ];

    const breakdown = computeEntityBreakdown(matches, [], []);

    expect(breakdown['GENRE']?.truePositives).toBe(3);
    expect(breakdown['GENRE']?.precision).toBe(1.0);
    expect(breakdown['GENRE']?.recall).toBe(1.0);
    expect(breakdown['GENRE']?.f1).toBe(1.0);
  });
});
