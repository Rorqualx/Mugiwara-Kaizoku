/**
 * Metrics Calculations Tests
 *
 * Tests for precision, recall, and F1 score calculations.
 * These functions are tested indirectly through calculateMetrics since they are private.
 *
 * @module tests/auto-labeling/metrics/calculations
 */

import { calculateMetrics } from '@/server/services/auto-labeling/metrics';

import type { ExtractedEntity, ExpectedEntity } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createExtracted(type: string, value: string): ExtractedEntity {
  return {
    type: type as ExtractedEntity['type'],
    value,
    normalizedValue: value.toLowerCase(),
    confidence: 0.9,
    source: 'bootstrap',
  };
}

function createExpected(type: string, value: string, required = true): ExpectedEntity {
  return {
    type: type as ExpectedEntity['type'],
    value,
    normalizedValue: value.toLowerCase(),
    required,
  };
}

// ============================================================================
// Precision Tests
// ============================================================================

describe('precision calculation', () => {
  it('should return 1.0 when all extracted entities match (no false positives)', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.precision).toBe(1.0);
  });

  it('should return 0.5 when half of extracted entities are false positives', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Wrong Author'),
    ];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    // TP=1, FP=1 -> 1/(1+1) = 0.5
    expect(metrics.precision).toBe(0.5);
  });

  it('should return 0 when no extracted entities match (all false positives)', () => {
    const extracted = [
      createExtracted('TITLE', 'Wrong Title'),
      createExtracted('AUTHOR', 'Wrong Author'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.precision).toBe(0);
  });

  it('should return 0 when no entities are extracted (TP + FP = 0)', () => {
    const extracted: ExtractedEntity[] = [];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.precision).toBe(0);
  });

  it('should handle all entities being true positives', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
      createExtracted('STATUS', 'ongoing'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
      createExpected('STATUS', 'ongoing'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    // TP=3, FP=0 -> 3/3 = 1.0
    expect(metrics.precision).toBe(1.0);
    expect(metrics.truePositives).toBe(3);
    expect(metrics.falsePositives).toBe(0);
  });
});

// ============================================================================
// Recall Tests
// ============================================================================

describe('recall calculation', () => {
  it('should return 1.0 when all expected entities are found', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.recall).toBe(1.0);
  });

  it('should return 0.5 when half of expected entities are found', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    // TP=1, FN=1 -> 1/(1+1) = 0.5
    expect(metrics.recall).toBe(0.5);
  });

  it('should return 0 when no expected entities are found', () => {
    const extracted = [createExtracted('GENRE', 'Action')];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.recall).toBe(0);
  });

  it('should return 0 when expected is empty (TP + FN = 0)', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected: ExpectedEntity[] = [];

    const metrics = calculateMetrics(extracted, expected);

    // No expected entities means recall is undefined (we use 0)
    expect(metrics.recall).toBe(0);
  });

  it('should track false negatives correctly', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
      createExpected('STATUS', 'ongoing'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.falseNegatives).toBe(2);
    expect(metrics.unmatchedExpected.length).toBe(2);
  });
});

// ============================================================================
// F1 Score Tests
// ============================================================================

describe('f1 score calculation', () => {
  it('should return 1.0 for perfect precision and recall', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.f1).toBe(1.0);
  });

  it('should return 0 when precision is 0', () => {
    const extracted = [createExtracted('GENRE', 'Action')];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    // P=0, R=0 -> F1=0
    expect(metrics.f1).toBe(0);
  });

  it('should return 0 when recall is 0', () => {
    const extracted: ExtractedEntity[] = [];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.f1).toBe(0);
  });

  it('should calculate harmonic mean correctly', () => {
    // Create scenario with P=0.5 and R=1.0
    // F1 = 2 * 0.5 * 1.0 / (0.5 + 1.0) = 1.0 / 1.5 = 0.6667
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Wrong Author'),
    ];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    // P=0.5 (1 TP, 1 FP), R=1.0 (1 TP, 0 FN)
    expect(metrics.precision).toBe(0.5);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.f1).toBeCloseTo(0.6667, 3);
  });

  it('should handle equal precision and recall', () => {
    // When P=R, F1=P=R
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('GENRE', 'Action'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    // P=0.5 (1 TP, 1 FP), R=0.5 (1 TP, 1 FN)
    expect(metrics.precision).toBe(0.5);
    expect(metrics.recall).toBe(0.5);
    expect(metrics.f1).toBe(0.5);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty extracted and expected arrays', () => {
    const extracted: ExtractedEntity[] = [];
    const expected: ExpectedEntity[] = [];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives).toBe(0);
    expect(metrics.falsePositives).toBe(0);
    expect(metrics.falseNegatives).toBe(0);
    expect(metrics.precision).toBe(0);
    expect(metrics.recall).toBe(0);
    expect(metrics.f1).toBe(0);
  });

  it('should handle single entity match', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives).toBe(1);
    expect(metrics.precision).toBe(1.0);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.f1).toBe(1.0);
  });

  it('should handle large number of entities', () => {
    const extracted: ExtractedEntity[] = [];
    const expected: ExpectedEntity[] = [];

    for (let i = 0; i < 100; i++) {
      extracted.push(createExtracted('GENRE', `Genre ${i}`));
      expected.push(createExpected('GENRE', `Genre ${i}`));
    }

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives).toBe(100);
    expect(metrics.precision).toBe(1.0);
    expect(metrics.recall).toBe(1.0);
    expect(metrics.f1).toBe(1.0);
  });

  it('should handle multiple entity types', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
      createExtracted('GENRE', 'Action'),
      createExtracted('STATUS', 'ongoing'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
      createExpected('GENRE', 'Action'),
      createExpected('STATUS', 'ongoing'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives).toBe(4);
    expect(Object.keys(metrics.byEntityType).length).toBe(4);
  });

  it('should count entities by type in breakdown', () => {
    const extracted = [
      createExtracted('GENRE', 'Action'),
      createExtracted('GENRE', 'Adventure'),
      createExtracted('TITLE', 'One Piece'),
    ];
    const expected = [
      createExpected('GENRE', 'Action'),
      createExpected('GENRE', 'Adventure'),
      createExpected('GENRE', 'Comedy'),
      createExpected('TITLE', 'One Piece'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.byEntityType['GENRE']?.truePositives).toBe(2);
    expect(metrics.byEntityType['GENRE']?.falseNegatives).toBe(1);
    expect(metrics.byEntityType['TITLE']?.truePositives).toBe(1);
  });
});

// ============================================================================
// Counts Verification
// ============================================================================

describe('counts verification', () => {
  it('should track true positives correctly', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives).toBe(2);
    expect(metrics.matches.length).toBe(2);
  });

  it('should track false positives correctly', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Wrong Author'),
      createExtracted('GENRE', 'Random'),
    ];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.falsePositives).toBe(2);
    expect(metrics.unmatchedExtracted.length).toBe(2);
  });

  it('should track false negatives correctly', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
      createExpected('STATUS', 'ongoing'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.falseNegatives).toBe(2);
    expect(metrics.unmatchedExpected.length).toBe(2);
  });

  it('should satisfy TP + FP = extracted count', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Wrong Author'),
      createExtracted('GENRE', 'Action'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('GENRE', 'Action'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives + metrics.falsePositives).toBe(extracted.length);
  });

  it('should satisfy TP + FN = expected count', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
      createExpected('STATUS', 'ongoing'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.truePositives + metrics.falseNegatives).toBe(expected.length);
  });
});
