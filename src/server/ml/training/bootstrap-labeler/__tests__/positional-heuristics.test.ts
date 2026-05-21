/**
 * Positional Heuristics Tests
 *
 * Unit tests for the positional heuristics module that automatically
 * labels tokens based on document position and structure.
 *
 * @module ml/training/bootstrap-labeler/__tests__/positional-heuristics.test
 */

import { describe, it, expect } from '@jest/globals';

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  applyPositionalHeuristics,
  positionalMatchesToSpans,
  FANDOM_RULES,
  WIKIPEDIA_RULES,
  COMICVINE_RULES,
} from '../positional-heuristics';

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

function createImageToken(index: number, width: number, height: number, isInInfobox = false): LinearizedToken {
  return createMockToken({
    id: `token-${index}`,
    text: '',
    isImage: true,
    imageSrc: 'https://example.com/image.jpg',
    imageAlt: 'Test image',
    imageWidth: width,
    imageHeight: height,
    isInInfobox,
    documentPosition: index,
    tokenType: 'image',
  });
}

// ============================================================================
// Rule Definition Tests
// ============================================================================

describe('Rule Definitions', () => {
  it('should have source-specific rules defined', () => {
    // Each source has its own complete rule set (no generic rules - removed to avoid cross-source issues)
    expect(FANDOM_RULES.length).toBeGreaterThan(0);
    expect(WIKIPEDIA_RULES.length).toBeGreaterThan(0);
    // ANILIST_RULES removed - we don't scrape AniList
    expect(COMICVINE_RULES.length).toBeGreaterThan(0);
  });

  it('should have unique rule IDs', () => {
    const allRules = [...FANDOM_RULES, ...WIKIPEDIA_RULES, ...COMICVINE_RULES];
    const ids = allRules.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid confidence values', () => {
    const allRules = [...FANDOM_RULES, ...WIKIPEDIA_RULES, ...COMICVINE_RULES];
    for (const rule of allRules) {
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Cover Image Rule Tests
// ============================================================================

describe('First Infobox Image Rule', () => {
  it('should match first large image in infobox', () => {
    const tokens = [
      createMockToken({ id: 'token-0', text: 'Header' }),
      createImageToken(1, 200, 300, true), // Large image in infobox
      createMockToken({ id: 'token-2', text: 'Description' }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const coverMatch = matches.find(m => m.rule.entityType === 'COVER_IMAGE');

    expect(coverMatch).toBeDefined();
    expect(coverMatch?.span.start).toBe(1);
    expect(coverMatch?.span.entityType).toBe('COVER_IMAGE');
  });

  it('should not match small images in infobox', () => {
    const tokens = [
      createImageToken(0, 50, 50, true), // Small icon
      createImageToken(1, 200, 300, true), // Large image
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const coverMatch = matches.find(m => m.rule.entityType === 'COVER_IMAGE');

    // Should match the large image, not the small one
    expect(coverMatch?.span.start).toBe(1);
  });

  it('should not match images outside infobox for infobox-specific rules', () => {
    const tokens = [
      createImageToken(0, 200, 300, false), // Large but not in infobox
      createImageToken(1, 200, 300, true), // In infobox
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const coverMatch = matches.find(m => m.rule.entityType === 'COVER_IMAGE');

    // Should match the infobox image
    expect(coverMatch?.span.start).toBe(1);
  });
});

// ============================================================================
// Source-Specific Rule Tests
// ============================================================================

describe('Fandom-Specific Rules', () => {
  it('should match pi-title class for Fandom source', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'One Piece',
        classes: ['pi-title'],
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const titleMatch = matches.find(m => m.rule.id === 'fandom-pi-title');

    expect(titleMatch).toBeDefined();
    expect(titleMatch?.span.entityType).toBe('TITLE');
  });

  it('should not match pi-title for non-Fandom source', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'One Piece',
        classes: ['pi-title'],
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'wikipedia');
    const fandomTitleMatch = matches.find(m => m.rule.id === 'fandom-pi-title');

    expect(fandomTitleMatch).toBeUndefined();
  });

  it('should match pi-image class for cover', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: '',
        isImage: true,
        imageSrc: 'https://example.com/cover.jpg',
        classes: ['pi-image'],
        tokenType: 'image',
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const coverMatch = matches.find(m => m.rule.id === 'fandom-pi-image-cover');

    expect(coverMatch).toBeDefined();
    expect(coverMatch?.span.entityType).toBe('COVER_IMAGE');
  });
});

describe('Wikipedia-Specific Rules', () => {
  it('should match infobox-image class for cover', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: '',
        isImage: true,
        imageSrc: 'https://example.com/cover.jpg',
        classes: ['infobox-image'],
        tokenType: 'image',
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'wikipedia');
    const coverMatch = matches.find(m => m.rule.id === 'wikipedia-infobox-image');

    expect(coverMatch).toBeDefined();
    expect(coverMatch?.span.entityType).toBe('COVER_IMAGE');
  });

  it('should match first bold text as title', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'One Piece',
        isBold: true,
        sectionType: 'main_content',
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'wikipedia');
    const titleMatch = matches.find(m => m.rule.id === 'wikipedia-lead-bold-title');

    expect(titleMatch).toBeDefined();
  });
});

// ============================================================================
// Span Conversion Tests
// ============================================================================

describe('positionalMatchesToSpans', () => {
  it('should convert matches to spans', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'One Piece',
        classes: ['pi-title'],
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const spans = positionalMatchesToSpans(matches);

    expect(spans.length).toBe(matches.length);
    for (let i = 0; i < spans.length; i++) {
      expect(spans[i]).toBe(matches[i]?.span);
    }
  });
});

// ============================================================================
// Priority and Conflict Tests
// ============================================================================

describe('Rule Priority', () => {
  it('should apply source-specific rules with appropriate priority', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'One Piece',
        classes: ['pi-title'],
        sectionType: 'main_content',
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    const titleMatches = matches.filter(m => m.rule.entityType === 'TITLE');

    // Should only match once due to single-value entity constraint
    expect(titleMatches.length).toBe(1);
    // Fandom rule should match
    expect(titleMatches[0]?.rule.id).toBe('fandom-pi-title');
  });

  it('should not match same entity type twice for single-value entities', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'Title 1',
        isBold: true,
        sectionType: 'main_content',
      }),
      createMockToken({ id: 'token-1', text: 'Content' }),
      createMockToken({
        id: 'token-2',
        text: 'Title 2',
        isBold: true,
        sectionType: 'main_content',
      }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'wikipedia');
    const titleMatches = matches.filter(m => m.rule.entityType === 'TITLE');

    // Should only match once
    expect(titleMatches.length).toBe(1);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty token array', () => {
    const matches = applyPositionalHeuristics([], 'fandom');
    expect(matches).toEqual([]);
  });

  it('should handle tokens with no matching rules', () => {
    const tokens = [
      createMockToken({ id: 'token-0', text: 'Plain text' }),
      createMockToken({ id: 'token-1', text: 'More text' }),
    ];

    const matches = applyPositionalHeuristics(tokens, 'fandom');
    expect(Array.isArray(matches)).toBe(true);
  });

  it('should handle unknown source type with no rules', () => {
    const tokens = [
      createMockToken({
        id: 'token-0',
        text: 'Test',
        isHeader: true,
        headerLevel: 1,
      }),
    ];

    // Unknown source has no rules, should return empty
    const matches = applyPositionalHeuristics(tokens, 'unknown');
    expect(Array.isArray(matches)).toBe(true);
  });
});
