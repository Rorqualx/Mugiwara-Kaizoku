/**
 * Pattern Propagation Tests
 *
 * Unit tests for the pattern propagation module that converts detected
 * label patterns into entity spans by propagating to following tokens.
 *
 * @module ml/training/bootstrap-labeler/__tests__/pattern-propagation.test
 */

import { describe, it, expect } from '@jest/globals';

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { propagatePatterns, PROPAGATION_RULES } from '../pattern-propagation';

import type { PatternDetectionResult, PatternSignal } from '../pattern-detector';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockToken(overrides: Partial<LinearizedToken> = {}): LinearizedToken {
  return {
    id: 'test-token-1',
    text: 'Test',
    normalizedText: 'test',
    tagName: 'SPAN',
    xpath: '/html/body/div/span',
    cssPath: 'body > div > span',
    domDepth: 3,
    siblingIndex: 0,
    parentId: null,
    childIds: [],
    isBold: false,
    isItalic: false,
    isHeader: false,
    headerLevel: 0,
    isInTable: false,
    isInList: false,
    isInInfobox: false,
    isLink: false,
    linkHref: null,
    tableRow: null,
    tableCol: null,
    isTableHeader: false,
    documentPosition: 0,
    charOffset: 0,
    textLength: 4,
    wordCount: 1,
    sourceHtml: '<span>Test</span>',
    classes: [],
    elementId: null,
    isImage: false,
    imageSrc: null,
    imageAlt: null,
    imageWidth: null,
    imageHeight: null,
    tokenType: 'word',
    isNumeric: false,
    isDate: false,
    isPunctuation: false,
    isCJK: false,
    isAllCaps: false,
    matchesDatePattern: false,
    matchesVolumePattern: false,
    matchesChapterPattern: false,
    matchesNamePattern: false,
    precedingText: null,
    followingText: null,
    distanceFromLabel: 0,
    nearestLabelText: null,
    sectionType: 'main_content',
    isFirstInElement: true,
    isLastInElement: true,
    fontSize: null,
    fontWeight: null,
    color: null,
    backgroundColor: null,
    htmlContext: '<div><span>Test</span></div>',
    ...overrides,
  } as LinearizedToken;
}

function createTokenSequence(texts: string[], startIndex = 0): LinearizedToken[] {
  return texts.map((text, i) => createMockToken({
    id: `token-${startIndex + i}`,
    text,
    documentPosition: startIndex + i,
  }));
}

function createPatternResult(patterns: PatternSignal[]): PatternDetectionResult {
  const tokenConfidenceBoosts = new Map<number, Array<{ entityType: string; boost: number }>>();

  for (const pattern of patterns) {
    if (!pattern.entityType) continue;
    for (const idx of pattern.valueTokenIndices) {
      const existing = tokenConfidenceBoosts.get(idx) ?? [];
      existing.push({ entityType: pattern.entityType, boost: pattern.confidence });
      tokenConfidenceBoosts.set(idx, existing);
    }
  }

  return {
    patterns,
    tokenConfidenceBoosts: tokenConfidenceBoosts as PatternDetectionResult['tokenConfidenceBoosts'],
  };
}

// ============================================================================
// Rule Definition Tests
// ============================================================================

describe('Propagation Rules', () => {
  it('should have rules for common entity types', () => {
    const entityTypes = PROPAGATION_RULES.map(r => r.entityType);

    expect(entityTypes).toContain('AUTHOR');
    expect(entityTypes).toContain('ARTIST');
    expect(entityTypes).toContain('GENRE');
    expect(entityTypes).toContain('VOLUME_COUNT');
    expect(entityTypes).toContain('CHAPTER_COUNT');
    expect(entityTypes).toContain('STATUS');
  });

  it('should have valid confidence values', () => {
    for (const rule of PROPAGATION_RULES) {
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should have reasonable maxTokens values', () => {
    for (const rule of PROPAGATION_RULES) {
      expect(rule.maxTokens).toBeGreaterThan(0);
      const isSummaryType = rule.entityType.includes('SUMMARY'); expect(rule.maxTokens).toBeLessThanOrEqual(isSummaryType ? 200 : 20);
    }
  });
});

// ============================================================================
// Basic Propagation Tests
// ============================================================================

describe('propagatePatterns', () => {
  it('should propagate author label to following tokens', () => {
    const tokens = createTokenSequence(['Author:', 'John', 'Smith']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1, 2],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(1);
    expect(result.spans[0]?.entityType).toBe('AUTHOR');
    expect(result.spans[0]?.start).toBe(1);
    expect(result.spans[0]?.end).toBe(2);
    expect(result.spans[0]?.matchType).toBe('propagation');
  });

  it('should propagate genre label to multiple tokens', () => {
    const tokens = createTokenSequence(['Genres:', 'Action', ',', 'Adventure', ',', 'Comedy']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'genres',
      entityType: 'GENRE',
      valueTokenIndices: [1, 2, 3, 4, 5],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(1);
    expect(result.spans[0]?.entityType).toBe('GENRE');
    expect(result.spans[0]?.start).toBe(1);
    // Should propagate through the entire list
    expect(result.spans[0]?.end).toBeGreaterThanOrEqual(3);
  });

  it('should stop propagation at another label', () => {
    const tokens = createTokenSequence(['Author:', 'John', 'Status:', 'Ongoing']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1, 2, 3],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(1);
    expect(result.spans[0]?.end).toBe(1); // Should stop before "Status:"
  });

  it('should handle volume count with numeric filter', () => {
    const tokens = [
      createMockToken({ id: 'token-0', text: 'Volumes:', documentPosition: 0 }),
      createMockToken({ id: 'token-1', text: '25', isNumeric: true, documentPosition: 1 }),
      createMockToken({ id: 'token-2', text: 'chapters', documentPosition: 2 }),
    ];
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'volumes',
      entityType: 'VOLUME_COUNT',
      valueTokenIndices: [1, 2],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(1);
    expect(result.spans[0]?.entityType).toBe('VOLUME_COUNT');
    expect(result.spans[0]?.start).toBe(1);
    expect(result.spans[0]?.end).toBe(1); // Should only include the number
  });
});

// ============================================================================
// Conflict Resolution Tests
// ============================================================================

describe('Conflict Resolution', () => {
  it('should skip already claimed indices', () => {
    const tokens = createTokenSequence(['Author:', 'John', 'Smith']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1, 2],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);
    const usedIndices = new Set([1, 2]); // Already claimed

    const result = propagatePatterns(tokens, patternResult, usedIndices);

    expect(result.spans.length).toBe(0); // No spans created
  });

  it('should handle multiple non-overlapping patterns', () => {
    const tokens = createTokenSequence(['Author:', 'John', 'Status:', 'Ongoing']);
    const authorPattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1],
      confidence: 0.8,
      source: 'test',
    };
    const statusPattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'status',
      entityType: 'STATUS',
      valueTokenIndices: [3],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([authorPattern, statusPattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(2);
    expect(result.spans.some(s => s.entityType === 'AUTHOR')).toBe(true);
    expect(result.spans.some(s => s.entityType === 'STATUS')).toBe(true);
  });
});

// ============================================================================
// Stop Condition Tests
// ============================================================================

describe('Stop Conditions', () => {
  it('should stop at header tokens', () => {
    const tokens = [
      createMockToken({ id: 'token-0', text: 'Author:', documentPosition: 0 }),
      createMockToken({ id: 'token-1', text: 'John', documentPosition: 1 }),
      createMockToken({ id: 'token-2', text: 'Chapter 1', isHeader: true, headerLevel: 2, documentPosition: 2 }),
      createMockToken({ id: 'token-3', text: 'Content', documentPosition: 3 }),
    ];
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1, 2, 3],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans[0]?.end).toBe(1); // Should stop before header
  });

  it('should stop at section change', () => {
    const tokens = [
      createMockToken({ id: 'token-0', text: 'Author:', sectionType: 'main_content', documentPosition: 0 }),
      createMockToken({ id: 'token-1', text: 'John', sectionType: 'main_content', documentPosition: 1 }),
      createMockToken({ id: 'token-2', text: 'Navigation', sectionType: 'navigation', documentPosition: 2 }),
    ];
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1, 2],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans[0]?.end).toBe(1); // Should stop at section change
  });

  it('should respect maxTokens limit', () => {
    // Create a long sequence that exceeds maxTokens
    const texts = ['Author:', ...Array.from({ length: 20 }, (_, i) => `Word${i}`)];
    const tokens = createTokenSequence(texts);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: Array.from({ length: 20 }, (_, i) => i + 1),
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    // AUTHOR rule has maxTokens of 5
    expect(result.spans[0]?.end).toBeLessThanOrEqual(5);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty pattern result', () => {
    const tokens = createTokenSequence(['Some', 'text']);
    const patternResult = createPatternResult([]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(0);
    expect(result.propagatedIndices.size).toBe(0);
  });

  it('should handle pattern with no entity type', () => {
    const tokens = createTokenSequence(['Label:', 'Value']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'unknown',
      entityType: null,
      valueTokenIndices: [1],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(0);
  });

  it('should handle pattern with empty value indices', () => {
    const tokens = createTokenSequence(['Author:']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.spans.length).toBe(0);
  });

  it('should handle entity type without specific rule', () => {
    const tokens = createTokenSequence(['Label:', 'Value1', 'Value2']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'test',
      entityType: 'TITLE', // TITLE doesn't have a propagation rule
      valueTokenIndices: [1, 2],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    // Should use default handling (create span from indices)
    expect(result.spans.length).toBe(1);
    expect(result.spans[0]?.entityType).toBe('TITLE');
  });

  it('should track propagated indices correctly', () => {
    const tokens = createTokenSequence(['Author:', 'John', 'Smith']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1, 2],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    expect(result.propagatedIndices.has(1)).toBe(true);
    expect(result.propagatedIndices.has(2)).toBe(true);
    expect(result.propagatedIndices.has(0)).toBe(false);
  });
});

// ============================================================================
// Confidence Calculation Tests
// ============================================================================

describe('Confidence Calculation', () => {
  it('should combine rule confidence with pattern confidence', () => {
    const tokens = createTokenSequence(['Author:', 'John']);
    const pattern: PatternSignal = {
      type: 'label_colon_value',
      labelText: 'author',
      entityType: 'AUTHOR',
      valueTokenIndices: [1],
      confidence: 0.8,
      source: 'test',
    };
    const patternResult = createPatternResult([pattern]);

    const result = propagatePatterns(tokens, patternResult);

    // Confidence should be rule.confidence * pattern.confidence
    // AUTHOR rule has confidence 0.75, pattern has 0.8
    expect(result.spans[0]?.confidence).toBeCloseTo(0.75 * 0.8, 2);
  });
});
