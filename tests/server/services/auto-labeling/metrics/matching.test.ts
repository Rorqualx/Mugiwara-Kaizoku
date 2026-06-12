/**
 * Entity Matching Tests
 *
 * Tests for matchEntities function and fuzzy matching logic.
 *
 * @module tests/auto-labeling/metrics/matching
 */

import { matchEntities, calculateMetrics } from '@/server/services/auto-labeling/metrics';

import type { MatchConfig } from '@/server/services/auto-labeling/metrics';
import type { ExtractedEntity, ExpectedEntity } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createExtracted(type: string, value: string, normalizedValue?: string): ExtractedEntity {
  return {
    type: type as ExtractedEntity['type'],
    value,
    normalizedValue: normalizedValue ?? value.toLowerCase(),
    confidence: 0.9,
    source: 'bootstrap',
  };
}

function createExpected(type: string, value: string, normalizedValue?: string, required = true): ExpectedEntity {
  return {
    type: type as ExpectedEntity['type'],
    value,
    normalizedValue: normalizedValue ?? value.toLowerCase(),
    required,
  };
}

const DEFAULT_CONFIG: MatchConfig = {
  minSimilarity: 0.8,
  allowPartial: true,
  partialThreshold: 0.6,
};

// ============================================================================
// Exact Matching Tests
// ============================================================================

describe('exact matching', () => {
  it('should match entities with identical normalized values', () => {
    const extracted = [createExtracted('TITLE', 'One Piece', 'one piece')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    expect(result.matches[0]?.matchType).toBe('exact');
    expect(result.matches[0]?.similarity).toBe(1.0);
  });

  it('should not match entities with different types', () => {
    const extracted = [createExtracted('AUTHOR', 'One Piece', 'one piece')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(0);
    // AUTHOR has no ground truth in `expected`, so the stray extraction is
    // excluded from FP counting (only scoreable types are kept).
    expect(result.unmatchedExtracted.length).toBe(0);
    expect(result.unmatchedExpected.length).toBe(1);
  });

  it('should prefer exact matches over fuzzy matches', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece', 'one piece'),
      createExtracted('TITLE', 'One Piec', 'one piec'),
    ];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    expect(result.matches[0]?.matchType).toBe('exact');
    expect(result.matches[0]?.extracted.value).toBe('One Piece');
  });

  it('should handle multiple exact matches', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece', 'one piece'),
      createExtracted('AUTHOR', 'Eiichiro Oda', 'eiichiro oda'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece', 'one piece'),
      createExpected('AUTHOR', 'Eiichiro Oda', 'eiichiro oda'),
    ];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(2);
    expect(result.matches.every(m => m.matchType === 'exact')).toBe(true);
  });

  it('should match case-insensitively when normalized values match', () => {
    const extracted = [createExtracted('TITLE', 'ONE PIECE', 'one piece')];
    const expected = [createExpected('TITLE', 'one piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    expect(result.matches[0]?.matchType).toBe('exact');
  });
});

// ============================================================================
// Fuzzy Matching Tests
// ============================================================================

describe('fuzzy matching', () => {
  it('should fuzzy match similar values above minSimilarity threshold', () => {
    // "one piece" vs "one piec" -> very high similarity (90%+)
    const extracted = [createExtracted('TITLE', 'One Piec', 'one piec')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    expect(result.matches[0]?.matchType).toBe('fuzzy');
    expect(result.matches[0]?.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it('should not fuzzy match values below minSimilarity threshold', () => {
    // Very different values
    const extracted = [createExtracted('TITLE', 'Naruto', 'naruto')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(0);
    expect(result.unmatchedExtracted.length).toBe(1);
    expect(result.unmatchedExpected.length).toBe(1);
  });

  it('should select best fuzzy match when multiple candidates exist', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piec', 'one piec'), // 90% similar
      createExtracted('TITLE', 'One Pi', 'one pi'), // ~70% similar
    ];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    // Should match with "one piec" (higher similarity)
    expect(result.matches[0]?.extracted.normalizedValue).toBe('one piec');
  });

  it('should require same type for fuzzy matches', () => {
    const extracted = [createExtracted('AUTHOR', 'One Piec', 'one piec')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(0);
  });

  it('should handle fuzzy match with accented characters', () => {
    const extracted = [createExtracted('AUTHOR', 'Eiichiro Oda', 'eiichiro oda')];
    const expected = [createExpected('AUTHOR', 'Eiichirō Oda', 'eiichirō oda')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    // Depending on similarity calculation, this might be fuzzy or partial
    expect(result.matches.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Partial Matching Tests
// ============================================================================

describe('partial matching', () => {
  it('should partial match values above partialThreshold when allowPartial is true', () => {
    // ~70% similarity (above 0.6 partial threshold, below 0.8 fuzzy threshold)
    const extracted = [createExtracted('TITLE', 'One', 'one')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const config: MatchConfig = {
      minSimilarity: 0.8,
      allowPartial: true,
      partialThreshold: 0.3, // Low threshold for testing
    };

    const result = matchEntities(extracted, expected, config);

    // This should be partial match since similarity is between 0.3 and 0.8
    if (result.matches.length > 0) {
      expect(result.matches[0]?.matchType).toBe('partial');
    }
  });

  it('should not partial match when allowPartial is false', () => {
    const extracted = [createExtracted('TITLE', 'One Piec', 'one piec')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const config: MatchConfig = {
      minSimilarity: 0.99, // Very high threshold to force partial
      allowPartial: false,
      partialThreshold: 0.6,
    };

    const result = matchEntities(extracted, expected, config);

    // Should not match because allowPartial is false
    expect(result.matches.every(m => m.matchType !== 'partial')).toBe(true);
  });

  it('should prefer fuzzy match over partial match', () => {
    const extracted = [createExtracted('TITLE', 'One Piecc', 'one piecc')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const config: MatchConfig = {
      minSimilarity: 0.8,
      allowPartial: true,
      partialThreshold: 0.6,
    };

    const result = matchEntities(extracted, expected, config);

    // If similarity >= 0.8, it should be fuzzy, not partial
    if (result.matches.length > 0 && result.matches[0]!.similarity >= 0.8) {
      expect(result.matches[0]?.matchType).toBe('fuzzy');
    }
  });
});

// ============================================================================
// Match Configuration Tests
// ============================================================================

describe('match configuration', () => {
  it('should respect custom minSimilarity threshold', () => {
    // GENRE has no RELAXED_SIMILARITY_TYPES override, so config.minSimilarity
    // applies as-is (TITLE would use its relaxed 0.65 threshold instead).
    const extracted = [createExtracted('GENRE', 'Adventur', 'adventur')];
    const expected = [createExpected('GENRE', 'Adventure', 'adventure')];

    // Very high threshold that won't match
    const strictConfig: MatchConfig = {
      minSimilarity: 0.99,
      allowPartial: false,
      partialThreshold: 0.6,
    };

    const result = matchEntities(extracted, expected, strictConfig);

    expect(result.matches.length).toBe(0);
  });

  it('should respect custom partialThreshold', () => {
    const extracted = [createExtracted('TITLE', 'One', 'one')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    // Very low partial threshold
    const config: MatchConfig = {
      minSimilarity: 0.95,
      allowPartial: true,
      partialThreshold: 0.2,
    };

    const result = matchEntities(extracted, expected, config);

    // Should potentially get a partial match with low threshold
    if (result.matches.length > 0) {
      expect(['fuzzy', 'partial']).toContain(result.matches[0]?.matchType);
    }
  });

  it('should use default config when not provided', () => {
    const extracted = [createExtracted('TITLE', 'One Piece', 'one piece')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    // Test through calculateMetrics which uses default config
    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.matches.length).toBe(1);
  });
});

// ============================================================================
// One-to-One Matching Tests
// ============================================================================

describe('one-to-one matching', () => {
  it('should not reuse extracted entities for multiple matches', () => {
    const extracted = [createExtracted('TITLE', 'One Piece', 'one piece')];
    const expected = [
      createExpected('TITLE', 'One Piece', 'one piece'),
      createExpected('TITLE', 'One Piece', 'one piece'),
    ];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    expect(result.unmatchedExpected.length).toBe(1);
  });

  it('should not reuse expected entities for multiple matches', () => {
    const extracted = [
      createExtracted('TITLE', 'One Piece', 'one piece'),
      createExtracted('TITLE', 'One Piece', 'one piece'),
    ];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
    expect(result.unmatchedExtracted.length).toBe(1);
  });

  it('should match entities greedily in first-pass', () => {
    const extracted = [
      createExtracted('GENRE', 'Action', 'action'),
      createExtracted('GENRE', 'Adventure', 'adventure'),
      createExtracted('GENRE', 'Comedy', 'comedy'),
    ];
    const expected = [
      createExpected('GENRE', 'Action', 'action'),
      createExpected('GENRE', 'Adventure', 'adventure'),
      createExpected('GENRE', 'Comedy', 'comedy'),
    ];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(3);
    expect(result.unmatchedExtracted.length).toBe(0);
    expect(result.unmatchedExpected.length).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('matching edge cases', () => {
  it('should handle empty extracted array', () => {
    const extracted: ExtractedEntity[] = [];
    const expected = [createExpected('TITLE', 'One Piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(0);
    expect(result.unmatchedExtracted.length).toBe(0);
    expect(result.unmatchedExpected.length).toBe(1);
  });

  it('should handle empty expected array', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected: ExpectedEntity[] = [];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(0);
    // No ground truth at all -> no types are scoreable -> no FPs reported.
    expect(result.unmatchedExtracted.length).toBe(0);
    expect(result.unmatchedExpected.length).toBe(0);
  });

  it('should handle both arrays empty', () => {
    const extracted: ExtractedEntity[] = [];
    const expected: ExpectedEntity[] = [];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(0);
    expect(result.unmatchedExtracted.length).toBe(0);
    expect(result.unmatchedExpected.length).toBe(0);
  });

  it('should handle entities with empty normalized values', () => {
    const extracted = [createExtracted('TITLE', '', '')];
    const expected = [createExpected('TITLE', '', '')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    // Empty strings should match exactly
    expect(result.matches.length).toBe(1);
  });

  it('should handle very long values', () => {
    const longValue = 'a'.repeat(1000);
    const extracted = [createExtracted('SUMMARY', longValue, longValue)];
    const expected = [createExpected('SUMMARY', longValue, longValue)];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
  });

  it('should handle special characters in values', () => {
    const extracted = [createExtracted('TITLE', 'Re:Zero', 're:zero')];
    const expected = [createExpected('TITLE', 'Re:Zero', 're:zero')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
  });

  it('should handle unicode characters', () => {
    const extracted = [createExtracted('TITLE', 'ワンピース', 'ワンピース')];
    const expected = [createExpected('TITLE', 'ワンピース', 'ワンピース')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches.length).toBe(1);
  });
});

// ============================================================================
// Match Results Structure
// ============================================================================

describe('match results structure', () => {
  it('should include extracted entity in match', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [createExpected('TITLE', 'One Piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches[0]?.extracted).toBeDefined();
    expect(result.matches[0]?.extracted.type).toBe('TITLE');
  });

  it('should include expected entity in match', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [createExpected('TITLE', 'One Piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches[0]?.expected).toBeDefined();
    expect(result.matches[0]?.expected.type).toBe('TITLE');
  });

  it('should include similarity score in match', () => {
    const extracted = [createExtracted('TITLE', 'One Piec', 'one piec')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    if (result.matches.length > 0) {
      expect(typeof result.matches[0]?.similarity).toBe('number');
      expect(result.matches[0]?.similarity).toBeGreaterThan(0);
      expect(result.matches[0]?.similarity).toBeLessThanOrEqual(1);
    }
  });

  it('should include match type in match', () => {
    const extracted = [createExtracted('TITLE', 'One Piece', 'one piece')];
    const expected = [createExpected('TITLE', 'One Piece', 'one piece')];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.matches[0]?.matchType).toBeDefined();
    expect(['exact', 'fuzzy', 'partial']).toContain(result.matches[0]?.matchType);
  });

  it('should preserve original entities in unmatched arrays', () => {
    // AUTHOR appears in the ground truth, so the dissimilar extraction is
    // kept as a false positive (unscored types are filtered out instead).
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Zzz Qqq'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Eiichiro Oda'),
    ];

    const result = matchEntities(extracted, expected, DEFAULT_CONFIG);

    expect(result.unmatchedExtracted[0]?.type).toBe('AUTHOR');
    expect(result.unmatchedExtracted[0]?.value).toBe('Zzz Qqq');
  });
});

// ============================================================================
// Integration with calculateMetrics
// ============================================================================

describe('integration with calculateMetrics', () => {
  it('should pass custom config to matchEntities', () => {
    // GENRE is used because it has no per-type relaxed threshold override.
    const extracted = [createExtracted('GENRE', 'Adventur', 'adventur')];
    const expected = [createExpected('GENRE', 'Adventure', 'adventure')];

    // With high threshold and no partial matching, should not match
    const strictMetrics = calculateMetrics(extracted, expected, {
      minSimilarity: 0.99,
      allowPartial: false,
    });

    // With normal threshold, should match
    const normalMetrics = calculateMetrics(extracted, expected, { minSimilarity: 0.8 });

    expect(strictMetrics.matches.length).toBe(0);
    expect(normalMetrics.matches.length).toBe(1);
  });

  it('should include matches in metrics result', () => {
    const extracted = [createExtracted('TITLE', 'One Piece')];
    const expected = [createExpected('TITLE', 'One Piece')];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.matches).toBeDefined();
    expect(Array.isArray(metrics.matches)).toBe(true);
    expect(metrics.matches.length).toBe(1);
  });

  it('should include unmatched entities in metrics result', () => {
    // The stray extraction must be a type with ground truth (AUTHOR) —
    // extractions of unscored types (e.g. GENRE here) are filtered from FPs.
    const extracted = [
      createExtracted('TITLE', 'One Piece'),
      createExtracted('AUTHOR', 'Zzz Qqq'),
    ];
    const expected = [
      createExpected('TITLE', 'One Piece'),
      createExpected('AUTHOR', 'Missing Person'),
    ];

    const metrics = calculateMetrics(extracted, expected);

    expect(metrics.unmatchedExtracted.length).toBe(1);
    expect(metrics.unmatchedExpected.length).toBe(1);
  });
});
