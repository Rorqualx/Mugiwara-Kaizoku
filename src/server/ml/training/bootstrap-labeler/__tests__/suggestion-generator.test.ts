/**
 * Suggestion Generator Test Suite
 *
 * Tests for the suggestion generation module that converts
 * bootstrap results into reviewable label suggestions.
 *
 * @module ml/training/bootstrap-labeler/__tests__/suggestion-generator.test
 */

// Using Jest for test runner

import type { BIOTag, EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  applySuggestionToLabels,
  autoApplySuggestions,
  generateSuggestions,
  getPendingSuggestions,
  groupSuggestionsByEntity,
} from '../suggestion-generator';

import type {
  BootstrapResult,
  LabelSuggestion,
} from '../types';

// ============================================================================
// Test Token Factory
// ============================================================================

function createMockToken(overrides: Partial<LinearizedToken> = {}): LinearizedToken {
  return {
    id: 'token-0',
    text: 'Test Token',
    normalizedText: 'test token',
    tagName: 'span',
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
    textLength: 10,
    wordCount: 2,
    sourceHtml: '<span>Test Token</span>',
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
    distanceFromLabel: 999,
    nearestLabelText: null,
    sectionType: 'main_content',
    isFirstInElement: true,
    isLastInElement: true,
    fontSize: null,
    fontWeight: null,
    color: null,
    backgroundColor: null,
    htmlContext: '<div><span>Test Token</span></div>',
    ...overrides,
  };
}

function createMockBootstrapResult(overrides: Partial<BootstrapResult> = {}): BootstrapResult {
  return {
    tokens: [
      createMockToken({ id: 'token-0', text: 'One Piece' }),
      createMockToken({ id: 'token-1', text: 'Eiichiro' }),
      createMockToken({ id: 'token-2', text: 'Oda' }),
      createMockToken({ id: 'token-3', text: 'Action' }),
      createMockToken({ id: 'token-4', text: 'Adventure' }),
    ],
    labels: ['B-TITLE', 'B-AUTHOR', 'I-AUTHOR', 'B-GENRE', 'I-GENRE'] as BIOTag[],
    spans: [
      { start: 0, end: 0, entityType: 'TITLE', confidence: 0.95, matchType: 'exact' },
      { start: 1, end: 2, entityType: 'AUTHOR', confidence: 0.85, matchType: 'multi-token' },
      { start: 3, end: 4, entityType: 'GENRE', confidence: 0.6, matchType: 'propagation' },
    ],
    extractedValues: { title: 'One Piece', author: 'Eiichiro Oda' },
    confidence: 0.8,
    needsReview: false,
    stats: {
      totalTokens: 5,
      labeledTokens: 5,
      entityCounts: { TITLE: 1, AUTHOR: 2, GENRE: 2 } as Record<EntityType, number>,
      matchedEntities: ['TITLE', 'AUTHOR', 'GENRE'] as EntityType[],
      missedEntities: [] as EntityType[],
    },
    ...overrides,
  };
}

// ============================================================================
// generateSuggestions Tests
// ============================================================================

describe('generateSuggestions', () => {
  it('should convert spans to suggestions', () => {
    const result = createMockBootstrapResult();
    const enhanced = generateSuggestions(result);

    expect(enhanced.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(enhanced.suggestions[0]?.entityType).toBe('TITLE');
    expect(enhanced.suggestions[0]?.confidence).toBe(0.95);
  });

  it('should sort suggestions by confidence (highest first)', () => {
    const result = createMockBootstrapResult();
    const enhanced = generateSuggestions(result);

    for (let i = 1; i < enhanced.suggestions.length; i++) {
      expect(enhanced.suggestions[i - 1]?.confidence).toBeGreaterThanOrEqual(
        enhanced.suggestions[i]?.confidence ?? 0
      );
    }
  });

  it('should count auto-applied and pending review correctly', () => {
    const result = createMockBootstrapResult();
    const enhanced = generateSuggestions(result, { autoApply: 0.9, minDisplay: 0.4 });

    // Only TITLE at 0.95 should be auto-applied
    expect(enhanced.autoAppliedCount).toBe(1);
    // AUTHOR at 0.85 and GENRE at 0.6 are pending
    expect(enhanced.pendingReviewCount).toBeGreaterThanOrEqual(2);
  });

  it('should filter out suggestions below minDisplay threshold', () => {
    const result = createMockBootstrapResult({
      labels: ['O', 'O', 'O', 'O', 'O'] as BIOTag[], // Clear labels to only test span-based filtering
      spans: [
        { start: 0, end: 0, entityType: 'TITLE', confidence: 0.95, matchType: 'exact' },
        { start: 1, end: 1, entityType: 'AUTHOR', confidence: 0.3, matchType: 'exact' },
      ],
    });

    const enhanced = generateSuggestions(result, { autoApply: 0.9, minDisplay: 0.5 });

    // Only TITLE should be included (AUTHOR is below 0.5 threshold)
    expect(enhanced.suggestions.length).toBe(1);
    expect(enhanced.suggestions[0]?.entityType).toBe('TITLE');
  });

  it('should generate reasoning for each suggestion', () => {
    const result = createMockBootstrapResult();
    const enhanced = generateSuggestions(result);

    for (const suggestion of enhanced.suggestions) {
      expect(suggestion.reasoning.length).toBeGreaterThan(0);
      expect(suggestion.reasoning).toContain('Detected as');
    }
  });

  it('should include token text in suggestions', () => {
    const result = createMockBootstrapResult();
    const enhanced = generateSuggestions(result);

    const titleSuggestion = enhanced.suggestions.find(s => s.entityType === 'TITLE');
    expect(titleSuggestion?.text).toBe('One Piece');

    const authorSuggestion = enhanced.suggestions.find(s => s.entityType === 'AUTHOR');
    expect(authorSuggestion?.text).toBe('Eiichiro Oda');
  });
});

// ============================================================================
// applySuggestionToLabels Tests
// ============================================================================

describe('applySuggestionToLabels', () => {
  it('should apply B- prefix to first token and I- to rest', () => {
    const labels: BIOTag[] = ['O', 'O', 'O', 'O', 'O'];
    const suggestion: LabelSuggestion = {
      id: 'test-1',
      tokenIndices: [1, 2, 3],
      entityType: 'AUTHOR',
      confidence: 0.8,
      source: 'pattern',
      reasoning: 'Test',
      text: 'Test Author Name',
    };

    const newLabels = applySuggestionToLabels(labels, suggestion);

    expect(newLabels[0]).toBe('O');
    expect(newLabels[1]).toBe('B-AUTHOR');
    expect(newLabels[2]).toBe('I-AUTHOR');
    expect(newLabels[3]).toBe('I-AUTHOR');
    expect(newLabels[4]).toBe('O');
  });

  it('should handle single-token suggestions', () => {
    const labels: BIOTag[] = ['O', 'O', 'O'];
    const suggestion: LabelSuggestion = {
      id: 'test-1',
      tokenIndices: [1],
      entityType: 'TITLE',
      confidence: 0.9,
      source: 'positional',
      reasoning: 'Test',
      text: 'One Piece',
    };

    const newLabels = applySuggestionToLabels(labels, suggestion);

    expect(newLabels[0]).toBe('O');
    expect(newLabels[1]).toBe('B-TITLE');
    expect(newLabels[2]).toBe('O');
  });

  it('should not modify original labels array', () => {
    const labels: BIOTag[] = ['O', 'O', 'O'];
    const suggestion: LabelSuggestion = {
      id: 'test-1',
      tokenIndices: [1],
      entityType: 'TITLE',
      confidence: 0.9,
      source: 'positional',
      reasoning: 'Test',
      text: 'Test',
    };

    const newLabels = applySuggestionToLabels(labels, suggestion);

    expect(labels[1]).toBe('O'); // Original unchanged
    expect(newLabels[1]).toBe('B-TITLE');
  });
});

// ============================================================================
// autoApplySuggestions Tests
// ============================================================================

describe('autoApplySuggestions', () => {
  it('should apply suggestions above autoApply threshold', () => {
    const result = createMockBootstrapResult({
      labels: ['O', 'O', 'O', 'O', 'O'] as BIOTag[],
      spans: [
        { start: 0, end: 0, entityType: 'TITLE', confidence: 0.95, matchType: 'exact' },
        { start: 1, end: 1, entityType: 'AUTHOR', confidence: 0.7, matchType: 'exact' },
      ],
    });

    const enhanced = generateSuggestions(result, { autoApply: 0.9, minDisplay: 0.4 });
    const applied = autoApplySuggestions(enhanced);

    // TITLE at 0.95 should be applied
    expect(applied.labels[0]).toBe('B-TITLE');
    // AUTHOR at 0.7 should NOT be applied (below 0.9 threshold)
    expect(applied.labels[1]).toBe('O');
  });

  it('should not apply suggestions below threshold', () => {
    const result = createMockBootstrapResult({
      labels: ['O', 'O', 'O'] as BIOTag[],
      spans: [
        { start: 0, end: 0, entityType: 'TITLE', confidence: 0.85, matchType: 'exact' },
      ],
    });

    const enhanced = generateSuggestions(result, { autoApply: 0.9, minDisplay: 0.4 });
    const applied = autoApplySuggestions(enhanced);

    // No suggestions above 0.9, so no changes
    expect(applied.labels[0]).toBe('O');
  });
});

// ============================================================================
// getPendingSuggestions Tests
// ============================================================================

describe('getPendingSuggestions', () => {
  it('should return only suggestions pending review', () => {
    const result = createMockBootstrapResult({
      labels: ['O', 'O', 'O', 'O', 'O'] as BIOTag[], // Clear labels to only test span-based suggestions
      spans: [
        { start: 0, end: 0, entityType: 'TITLE', confidence: 0.95, matchType: 'exact' },
        { start: 1, end: 1, entityType: 'AUTHOR', confidence: 0.7, matchType: 'exact' },
        { start: 2, end: 2, entityType: 'GENRE', confidence: 0.5, matchType: 'exact' },
      ],
    });

    const enhanced = generateSuggestions(result, { autoApply: 0.9, minDisplay: 0.4 });
    const pending = getPendingSuggestions(enhanced);

    // TITLE at 0.95 is auto-applied, so only AUTHOR and GENRE are pending
    expect(pending.length).toBe(2);
    expect(pending.find(s => s.entityType === 'TITLE')).toBeUndefined();
    expect(pending.find(s => s.entityType === 'AUTHOR')).toBeDefined();
    expect(pending.find(s => s.entityType === 'GENRE')).toBeDefined();
  });
});

// ============================================================================
// groupSuggestionsByEntity Tests
// ============================================================================

describe('groupSuggestionsByEntity', () => {
  it('should group suggestions by entity type', () => {
    const suggestions: LabelSuggestion[] = [
      { id: '1', tokenIndices: [0], entityType: 'TITLE', confidence: 0.9, source: 'pattern', reasoning: '', text: 'A' },
      { id: '2', tokenIndices: [1], entityType: 'AUTHOR', confidence: 0.8, source: 'pattern', reasoning: '', text: 'B' },
      { id: '3', tokenIndices: [2], entityType: 'TITLE', confidence: 0.7, source: 'pattern', reasoning: '', text: 'C' },
      { id: '4', tokenIndices: [3], entityType: 'GENRE', confidence: 0.6, source: 'pattern', reasoning: '', text: 'D' },
    ];

    const grouped = groupSuggestionsByEntity(suggestions);

    expect(grouped.get('TITLE')?.length).toBe(2);
    expect(grouped.get('AUTHOR')?.length).toBe(1);
    expect(grouped.get('GENRE')?.length).toBe(1);
  });

  it('should return empty map for empty suggestions', () => {
    const grouped = groupSuggestionsByEntity([]);
    expect(grouped.size).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty bootstrap result', () => {
    const result = createMockBootstrapResult({
      tokens: [],
      labels: [],
      spans: [],
    });

    const enhanced = generateSuggestions(result);

    expect(enhanced.suggestions.length).toBe(0);
    expect(enhanced.autoAppliedCount).toBe(0);
    expect(enhanced.pendingReviewCount).toBe(0);
  });

  it('should handle spans at document boundaries', () => {
    const result = createMockBootstrapResult({
      tokens: [createMockToken({ text: 'Only Token' })],
      labels: ['B-TITLE'] as BIOTag[],
      spans: [{ start: 0, end: 0, entityType: 'TITLE', confidence: 0.9, matchType: 'exact' }],
    });

    const enhanced = generateSuggestions(result);

    expect(enhanced.suggestions.length).toBe(1);
    expect(enhanced.suggestions[0]?.tokenIndices).toEqual([0]);
  });

  it('should handle overlapping label extraction', () => {
    const result = createMockBootstrapResult({
      tokens: [
        createMockToken({ text: 'One' }),
        createMockToken({ text: 'Piece' }),
      ],
      labels: ['B-TITLE', 'I-TITLE'] as BIOTag[],
      spans: [], // No spans, only labels
    });

    const enhanced = generateSuggestions(result);

    // Should extract suggestions from labels
    expect(enhanced.suggestions.length).toBeGreaterThanOrEqual(1);
    const titleSuggestion = enhanced.suggestions.find(s => s.entityType === 'TITLE');
    expect(titleSuggestion?.tokenIndices).toEqual([0, 1]);
  });
});
