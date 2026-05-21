/**
 * Source-Specific Rules Test Suite
 *
 * Tests for the source-rules module including:
 * - Helper functions (hasClassPattern, hasExactClass, etc.)
 * - Rule retrieval utilities
 * - Individual source rule validation
 *
 * @module ml/training/bootstrap-labeler/__tests__/source-rules.test
 */

// Using Jest for test runner

import type { EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { applyPositionalHeuristics } from '../positional-heuristics';
import {
  COMICVINE_RULES,
  FANDOM_RULES,
  findSpanEnd,
  getAllSourceRules,
  getSourceRules,
  getSourceRulesSortedByPriority,
  getSourceRuleStats,
  hasClassPattern,
  hasExactClass,
  hasIdPattern,
  hasXPathPattern,
  isInEditorialMetadataContext,
  isLabelToken,
  isLargeImage,
  WIKIPEDIA_RULES,
} from '../source-rules';

import type { SourceRuleContext, SourceType } from '../source-rules';

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

function createMockContext(
  tokens: LinearizedToken[] = [],
  sourceType: SourceType = 'fandom'
): SourceRuleContext {
  return {
    tokens,
    sourceType,
    usedIndices: new Set<number>(),
    matchedEntities: new Set<EntityType>(),
  };
}

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Source Rules Helper Functions', () => {
  describe('hasClassPattern', () => {
    it('should match class patterns case-insensitively', () => {
      const token = createMockToken({ classes: ['pi-data-value', 'test-class'] });
      expect(hasClassPattern(token, ['pi-data'])).toBe(true);
      expect(hasClassPattern(token, ['PI-DATA'])).toBe(true);
    });

    it('should return false when no patterns match', () => {
      const token = createMockToken({ classes: ['other-class'] });
      expect(hasClassPattern(token, ['pi-data'])).toBe(false);
    });

    it('should handle empty classes array', () => {
      const token = createMockToken({ classes: [] });
      expect(hasClassPattern(token, ['test'])).toBe(false);
    });

    it('should match partial patterns', () => {
      const token = createMockToken({ classes: ['infobox-data-value'] });
      expect(hasClassPattern(token, ['infobox'])).toBe(true);
      expect(hasClassPattern(token, ['data-value'])).toBe(true);
    });
  });

  describe('hasExactClass', () => {
    it('should match exact class name', () => {
      const token = createMockToken({ classes: ['pi-title', 'other'] });
      expect(hasExactClass(token, 'pi-title')).toBe(true);
    });

    it('should not match partial class names', () => {
      const token = createMockToken({ classes: ['pi-title-large'] });
      expect(hasExactClass(token, 'pi-title')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const token = createMockToken({ classes: ['PI-TITLE'] });
      expect(hasExactClass(token, 'pi-title')).toBe(false);
    });
  });

  describe('hasIdPattern', () => {
    it('should match ID patterns case-insensitively', () => {
      const token = createMockToken({ elementId: 'firstHeading' });
      expect(hasIdPattern(token, ['firstheading'])).toBe(true);
      expect(hasIdPattern(token, ['FIRST'])).toBe(true);
    });

    it('should return false when no elementId', () => {
      const token = createMockToken({ elementId: null });
      expect(hasIdPattern(token, ['test'])).toBe(false);
    });
  });

  describe('hasXPathPattern', () => {
    it('should match XPath patterns case-insensitively', () => {
      const token = createMockToken({ xpath: '/html/body/div[@class="INFOBOX"]' });
      expect(hasXPathPattern(token, ['infobox'])).toBe(true);
    });

    it('should return false when no pattern matches', () => {
      const token = createMockToken({ xpath: '/html/body/p' });
      expect(hasXPathPattern(token, ['infobox'])).toBe(false);
    });
  });

  describe('isLabelToken', () => {
    it('should detect tokens ending with colon', () => {
      const token = createMockToken({ text: 'Author:' });
      expect(isLabelToken(token)).toBe(true);
    });

    it('should detect tokens with label classes', () => {
      const token = createMockToken({
        text: 'Author',
        classes: ['data-label'],
      });
      expect(isLabelToken(token)).toBe(true);
    });

    it('should return false for non-label tokens', () => {
      const token = createMockToken({ text: 'John Doe', classes: ['value'] });
      expect(isLabelToken(token)).toBe(false);
    });
  });

  describe('findSpanEnd', () => {
    it('should find span end based on stop condition', () => {
      const tokens = [
        createMockToken({ text: 'Action' }),
        createMockToken({ text: 'Adventure' }),
        createMockToken({ text: 'Comedy' }),
        createMockToken({ text: 'Status:', classes: ['label'] }),
      ];

      const endIndex = findSpanEnd(tokens, 0, 10, (t) => t.text.endsWith(':'));
      expect(endIndex).toBe(2);
    });

    it('should respect maxTokens limit', () => {
      const tokens = Array.from({ length: 20 }, (_, i) =>
        createMockToken({ text: `Token ${i}` })
      );

      const endIndex = findSpanEnd(tokens, 0, 5, () => false);
      expect(endIndex).toBe(4);
    });

    it('should return start index when first token matches stop condition', () => {
      const tokens = [
        createMockToken({ text: 'Start' }),
        createMockToken({ text: 'Stop:', classes: ['label'] }),
      ];

      const endIndex = findSpanEnd(tokens, 0, 10, (t) => t.text.endsWith(':'));
      expect(endIndex).toBe(0);
    });
  });

  describe('isLargeImage', () => {
    it('should detect large images', () => {
      const token = createMockToken({
        isImage: true,
        imageWidth: 200,
        imageHeight: 300,
      });
      expect(isLargeImage(token)).toBe(true);
    });

    it('should reject small images', () => {
      const token = createMockToken({
        isImage: true,
        imageWidth: 50,
        imageHeight: 50,
      });
      expect(isLargeImage(token)).toBe(false);
    });

    it('should handle missing dimensions', () => {
      const token = createMockToken({
        isImage: true,
        imageWidth: null,
        imageHeight: null,
      });
      expect(isLargeImage(token)).toBe(false);
    });

    it('should require minimum dimensions', () => {
      const token = createMockToken({
        isImage: true,
        imageWidth: 100,
        imageHeight: 150,
      });
      expect(isLargeImage(token)).toBe(true);

      const tokenTooSmall = createMockToken({
        isImage: true,
        imageWidth: 99,
        imageHeight: 149,
      });
      expect(isLargeImage(tokenTooSmall)).toBe(false);
    });
  });
});

// ============================================================================
// Rule Retrieval Tests
// ============================================================================

describe('Source Rule Retrieval', () => {
  describe('getSourceRules', () => {
    it('should return Fandom rules for fandom source', () => {
      const rules = getSourceRules('fandom');
      expect(rules).toBe(FANDOM_RULES);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return Wikipedia rules for wikipedia source', () => {
      const rules = getSourceRules('wikipedia');
      expect(rules).toBe(WIKIPEDIA_RULES);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return ComicVine rules for comicvine source', () => {
      const rules = getSourceRules('comicvine');
      expect(rules).toBe(COMICVINE_RULES);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown source', () => {
      const rules = getSourceRules('unknown');
      expect(rules).toEqual([]);
    });
  });

  describe('getAllSourceRules', () => {
    it('should return combined rules from all sources', () => {
      const allRules = getAllSourceRules();
      const totalExpected =
        FANDOM_RULES.length +
        WIKIPEDIA_RULES.length +
        COMICVINE_RULES.length;

      expect(allRules.length).toBe(totalExpected);
    });

    it('should contain rules from each source', () => {
      const allRules = getAllSourceRules();
      const ruleIds = allRules.map((r) => r.id);

      expect(ruleIds.some((id) => id.startsWith('fandom-'))).toBe(true);
      expect(ruleIds.some((id) => id.startsWith('wikipedia-'))).toBe(true);
      expect(ruleIds.some((id) => id.startsWith('comicvine-'))).toBe(true);
    });
  });

  describe('getSourceRulesSortedByPriority', () => {
    it('should return rules sorted by priority (highest first)', () => {
      const sortedRules = getSourceRulesSortedByPriority('fandom');

      for (let i = 1; i < sortedRules.length; i++) {
        expect(sortedRules[i - 1]?.priority).toBeGreaterThanOrEqual(
          sortedRules[i]?.priority ?? 0
        );
      }
    });

    it('should have title rules near the top', () => {
      const sortedRules = getSourceRulesSortedByPriority('fandom');
      const topRules = sortedRules.slice(0, 5);

      expect(topRules.some((r) => r.entityType === 'TITLE')).toBe(true);
    });
  });

  describe('getSourceRuleStats', () => {
    it('should return valid statistics for Fandom', () => {
      const stats = getSourceRuleStats('fandom');

      expect(stats.totalRules).toBe(FANDOM_RULES.length);
      expect(stats.entityTypeCoverage.length).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThan(0.5);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should return zeros for unknown source', () => {
      const stats = getSourceRuleStats('unknown');

      expect(stats.totalRules).toBe(0);
      expect(stats.entityTypeCoverage).toEqual([]);
      expect(stats.averageConfidence).toBe(0);
    });

    it('should cover expected entity types', () => {
      const stats = getSourceRuleStats('fandom');
      const expectedTypes: EntityType[] = [
        'TITLE',
        'COVER_IMAGE',
        'AUTHOR',
        'ARTIST',
        'PUBLISHER',
      ];

      for (const type of expectedTypes) {
        expect(stats.entityTypeCoverage).toContain(type);
      }
    });
  });
});

// ============================================================================
// Rule Structure Validation
// ============================================================================

describe('Rule Structure Validation', () => {
  const allRules = getAllSourceRules();

  it('all rules should have unique IDs', () => {
    const ids = allRules.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all rules should have valid confidence scores', () => {
    for (const rule of allRules) {
      expect(rule.confidence).toBeGreaterThan(0);
      expect(rule.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('all rules should have positive priorities', () => {
    for (const rule of allRules) {
      expect(rule.priority).toBeGreaterThan(0);
    }
  });

  it('all rules should have non-empty descriptions', () => {
    for (const rule of allRules) {
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });

  it('all rules should have valid condition functions', () => {
    for (const rule of allRules) {
      expect(typeof rule.condition).toBe('function');
    }
  });

  it('condition functions should be callable', () => {
    const mockToken = createMockToken();
    const mockContext = createMockContext([mockToken]);

    for (const rule of allRules) {
      const result = rule.condition(mockToken, 0, mockContext);
      expect(typeof result).toBe('boolean');
    }
  });
});

// ============================================================================
// Fandom Rules Tests
// ============================================================================

describe('Fandom Source Rules', () => {
  it('should match pi-title for TITLE', () => {
    const titleRule = FANDOM_RULES.find((r) => r.id === 'fandom-pi-title');
    expect(titleRule).toBeDefined();

    const token = createMockToken({
      text: 'One Piece',
      classes: ['pi-title'],
    });
    const context = createMockContext([token]);

    expect(titleRule?.condition(token, 0, context)).toBe(true);
  });

  it('should not match pi-title if TITLE already matched', () => {
    const titleRule = FANDOM_RULES.find((r) => r.id === 'fandom-pi-title');
    const token = createMockToken({
      text: 'One Piece',
      classes: ['pi-title'],
    });
    const context = createMockContext([token]);
    context.matchedEntities.add('TITLE');

    expect(titleRule?.condition(token, 0, context)).toBe(false);
  });

  it('should match pi-image for COVER_IMAGE', () => {
    const imageRule = FANDOM_RULES.find((r) => r.id === 'fandom-pi-image-cover');
    expect(imageRule).toBeDefined();

    const token = createMockToken({
      isImage: true,
      classes: ['pi-image'],
    });
    const context = createMockContext([token]);

    expect(imageRule?.condition(token, 0, context)).toBe(true);
  });

  it('should match author label for AUTHOR', () => {
    const authorRule = FANDOM_RULES.find((r) => r.id === 'fandom-pi-author');
    expect(authorRule).toBeDefined();

    const token = createMockToken({
      text: 'Eiichiro Oda',
      classes: ['pi-data-value'],
      nearestLabelText: 'Author',
      distanceFromLabel: 1,
    });
    const context = createMockContext([token]);

    expect(authorRule?.condition(token, 0, context)).toBe(true);
  });

  it('should cover required entity types', () => {
    const entityTypes = FANDOM_RULES.map((r) => r.entityType);
    const requiredTypes: EntityType[] = [
      'TITLE',
      'COVER_IMAGE',
      'AUTHOR',
      'ARTIST',
      'PUBLISHER',
      'STATUS',
      'GENRE',
    ];

    for (const type of requiredTypes) {
      expect(entityTypes).toContain(type);
    }
  });
});

// ============================================================================
// Wikipedia Rules Tests
// ============================================================================

describe('Wikipedia Source Rules', () => {
  it('should match lead bold text for TITLE', () => {
    const titleRule = WIKIPEDIA_RULES.find((r) => r.id === 'wikipedia-lead-bold-title');
    expect(titleRule).toBeDefined();

    const token = createMockToken({
      text: 'Naruto',
      isBold: true,
      sectionType: 'main_content',
      isInTable: false,
    });
    const context = createMockContext([token], 'wikipedia');

    expect(titleRule?.condition(token, 5, context)).toBe(true);
  });

  it('should match firstHeading for TITLE', () => {
    const headingRule = WIKIPEDIA_RULES.find((r) => r.id === 'wikipedia-firstheading');
    expect(headingRule).toBeDefined();

    const token = createMockToken({
      text: 'Naruto',
      isHeader: true,
      headerLevel: 1,
      elementId: 'firstHeading',
    });
    const context = createMockContext([token], 'wikipedia');

    expect(headingRule?.condition(token, 0, context)).toBe(true);
  });

  it('should match infobox-image for COVER_IMAGE', () => {
    const imageRule = WIKIPEDIA_RULES.find((r) => r.id === 'wikipedia-infobox-image');
    expect(imageRule).toBeDefined();

    const token = createMockToken({
      isImage: true,
      classes: ['infobox-image'],
    });
    const context = createMockContext([token], 'wikipedia');

    expect(imageRule?.condition(token, 0, context)).toBe(true);
  });

  it.skip('should match infobox data for AUTHOR', () => {
    const authorRule = WIKIPEDIA_RULES.find((r) => r.id === 'wikipedia-infobox-author');
    expect(authorRule).toBeDefined();

    const token = createMockToken({
      text: 'Masashi Kishimoto',
      isInInfobox: true,
      nearestLabelText: 'Written by',
      distanceFromLabel: 1,
    });
    const context = createMockContext([token], 'wikipedia');

    expect(authorRule?.condition(token, 0, context)).toBe(true);
  });
});

// ============================================================================
// ComicVine Rules Tests
// ============================================================================

describe('ComicVine Source Rules', () => {
  it('should match wiki-title for TITLE', () => {
    const titleRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-wiki-title');
    expect(titleRule).toBeDefined();

    const token = createMockToken({
      text: 'Batman',
      classes: ['wiki-title'],
    });
    const context = createMockContext([token], 'comicvine');

    expect(titleRule?.condition(token, 0, context)).toBe(true);
  });

  it('should match main-image for COVER_IMAGE', () => {
    const imageRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-main-image');
    expect(imageRule).toBeDefined();

    const token = createMockToken({
      isImage: true,
      classes: ['main-image', 'imgboxart'],
    });
    const context = createMockContext([token], 'comicvine');

    expect(imageRule?.condition(token, 0, context)).toBe(true);
  });

  it('should match writer label for AUTHOR', () => {
    const authorRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-writer');
    expect(authorRule).toBeDefined();

    const token = createMockToken({
      text: 'Bob Kane',
      classes: ['wiki-details', 'value'],
      nearestLabelText: 'Writer',
      distanceFromLabel: 1,
    });
    const context = createMockContext([token], 'comicvine');

    expect(authorRule?.condition(token, 0, context)).toBe(true);
  });

  it('should match artist label for ARTIST', () => {
    const artistRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-artist');
    expect(artistRule).toBeDefined();

    const token = createMockToken({
      text: 'Jim Lee',
      classes: ['wiki-value'],
      nearestLabelText: 'Penciler',
      distanceFromLabel: 2,
    });
    const context = createMockContext([token], 'comicvine');

    expect(artistRule?.condition(token, 0, context)).toBe(true);
  });

  it('should match publisher label for PUBLISHER', () => {
    const publisherRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-publisher');
    expect(publisherRule).toBeDefined();

    const token = createMockToken({
      text: 'DC Comics',
      classes: ['detail-value'],
      nearestLabelText: 'Publisher',
      distanceFromLabel: 1,
    });
    const context = createMockContext([token], 'comicvine');

    expect(publisherRule?.condition(token, 0, context)).toBe(true);
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle tokens with no classes', () => {
    const allRules = getAllSourceRules();
    const token = createMockToken({ classes: [] });
    const context = createMockContext([token]);

    for (const rule of allRules) {
      expect(() => rule.condition(token, 0, context)).not.toThrow();
    }
  });

  it('should handle empty token text', () => {
    const allRules = getAllSourceRules();
    const token = createMockToken({ text: '' });
    const context = createMockContext([token]);

    for (const rule of allRules) {
      expect(() => rule.condition(token, 0, context)).not.toThrow();
    }
  });

  it('should handle tokens at document boundaries', () => {
    const token = createMockToken();
    const context = createMockContext([token]);

    const rulesWithSpanEnd = getAllSourceRules().filter((r) => r.getSpanEnd);

    for (const rule of rulesWithSpanEnd) {
      const endIndex = rule.getSpanEnd?.(token, 0, context);
      expect(endIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle deeply nested tokens', () => {
    const token = createMockToken({
      xpath: '/html/body/div[1]/div[2]/div[3]/div[4]/div[5]/span',
      domDepth: 7,
    });
    const context = createMockContext([token]);

    for (const rule of getAllSourceRules()) {
      expect(() => rule.condition(token, 0, context)).not.toThrow();
    }
  });
});

// ============================================================================
// Editorial Metadata Detection Tests
// ============================================================================

describe('Editorial Metadata Detection', () => {
  describe('isInEditorialMetadataContext', () => {
    it('should detect "last edited by" context', () => {
      const tokens = [
        createMockToken({ text: 'Vol.' }),
        createMockToken({ text: '1' }),
        createMockToken({ text: 'last' }),
        createMockToken({ text: 'edited' }),
        createMockToken({ text: 'by' }),
        createMockToken({ text: 'user123' }),
        createMockToken({ text: 'on' }),
        createMockToken({ text: '01/02/22', matchesDatePattern: true }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      // The date token at index 7 should be in editorial context
      expect(isInEditorialMetadataContext(tokens[7]!, 7, context)).toBe(true);
    });

    it('should detect "edited by" context', () => {
      const tokens = [
        createMockToken({ text: 'edited' }),
        createMockToken({ text: 'by' }),
        createMockToken({ text: 'admin' }),
        createMockToken({ text: '2022', isNumeric: true }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(isInEditorialMetadataContext(tokens[3]!, 3, context)).toBe(true);
    });

    it('should NOT detect editorial context for normal release dates', () => {
      const tokens = [
        createMockToken({ text: 'Start' }),
        createMockToken({ text: 'Year:' }),
        createMockToken({ text: '2005', isNumeric: true, nearestLabelText: 'Start Year:' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(isInEditorialMetadataContext(tokens[2]!, 2, context)).toBe(false);
    });

    it('should NOT detect editorial context at document start', () => {
      const tokens = [
        createMockToken({ text: '2005', isNumeric: true }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(isInEditorialMetadataContext(tokens[0]!, 0, context)).toBe(false);
    });
  });

  describe('ComicVine release date rule with editorial exclusion', () => {
    it('should NOT match dates in "last edited by" context', () => {
      const releaseDateRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-release-date');
      expect(releaseDateRule).toBeDefined();

      // Simulate ComicVine "Vol. 1 last edited by user on 01/02/22" pattern
      const tokens = [
        createMockToken({ text: 'Vol.' }),
        createMockToken({ text: '1' }),
        createMockToken({ text: 'last' }),
        createMockToken({ text: 'edited' }),
        createMockToken({ text: 'by' }),
        createMockToken({ text: 'user123' }),
        createMockToken({ text: 'on' }),
        createMockToken({
          text: '01/02/22',
          matchesDatePattern: true,
          classes: ['wiki-details'],
          nearestLabelText: 'started',
          distanceFromLabel: 2,
        }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      // The rule should NOT match because the date is in editorial context
      expect(releaseDateRule?.condition(tokens[7]!, 7, context)).toBe(false);
    });

    it('should match legitimate release dates', () => {
      const releaseDateRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-release-date');

      const token = createMockToken({
        text: '2005',
        isNumeric: true,
        matchesDatePattern: true,
        classes: ['wiki-details', 'value'],
        nearestLabelText: 'Start Year:',
        distanceFromLabel: 1,
      });
      const context = createMockContext([token], 'comicvine');

      expect(releaseDateRule?.condition(token, 0, context)).toBe(true);
    });
  });

  describe('Time patterns in editorial context', () => {
    it('should detect time pattern following editorial date', () => {
      const tokens = [
        createMockToken({ text: 'last' }),
        createMockToken({ text: 'edited' }),
        createMockToken({ text: 'by' }),
        createMockToken({ text: 'user123' }),
        createMockToken({ text: 'on' }),
        createMockToken({ text: '01/02/22', matchesDatePattern: true }),
        createMockToken({ text: '11:00AM' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      // The time token at index 6 should be in editorial context
      expect(isInEditorialMetadataContext(tokens[6]!, 6, context)).toBe(true);
    });
  });
});

// ============================================================================
// Creator Role Exclusion Tests
// ============================================================================

describe('ComicVine Creator Role Exclusion', () => {
  describe('comicvine-creator-writer rule', () => {
    const writerRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-creator-writer');

    it('should match creator with "writer" as primary role', () => {
      expect(writerRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Kendi Oiwa',
          isLink: true,
          linkHref: '/creator/kendi-oiwa',
        }),
        createMockToken({ text: 'writer' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(writerRule?.condition(tokens[51]!, 51, context)).toBe(true);
    });

    it('should NOT match creator with "other" role', () => {
      expect(writerRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Stuart Levy',
          isLink: true,
          linkHref: '/creator/stuart-levy',
        }),
        createMockToken({ text: 'other' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(writerRule?.condition(tokens[51]!, 51, context)).toBe(false);
    });

    it('should NOT match creator with "writer, other" combined role', () => {
      expect(writerRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'John Doe',
          isLink: true,
          linkHref: '/creator/john-doe',
        }),
        createMockToken({ text: 'writer,' }),
        createMockToken({ text: 'other' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(writerRule?.condition(tokens[51]!, 51, context)).toBe(false);
    });

    it('should NOT match creator with "story, other" combined role', () => {
      expect(writerRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Jane Doe',
          isLink: true,
          linkHref: '/creator/jane-doe',
        }),
        createMockToken({ text: 'story,' }),
        createMockToken({ text: 'other' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(writerRule?.condition(tokens[51]!, 51, context)).toBe(false);
    });
  });

  describe('comicvine-creator-artist rule', () => {
    const artistRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-creator-artist');

    it('should match creator with "artist" as primary role', () => {
      expect(artistRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Kendi Oiwa',
          isLink: true,
          linkHref: '/creator/kendi-oiwa',
        }),
        createMockToken({ text: 'artist' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(artistRule?.condition(tokens[51]!, 51, context)).toBe(true);
    });

    it('should NOT match creator with "other" role only', () => {
      expect(artistRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'John Parker',
          isLink: true,
          linkHref: '/creator/john-parker',
        }),
        createMockToken({ text: 'other' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(artistRule?.condition(tokens[51]!, 51, context)).toBe(false);
    });

    it('should NOT match creator with "artist, other" combined role', () => {
      expect(artistRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Mixed Creator',
          isLink: true,
          linkHref: '/creator/mixed',
        }),
        createMockToken({ text: 'artist,' }),
        createMockToken({ text: 'other' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(artistRule?.condition(tokens[51]!, 51, context)).toBe(false);
    });

    it('should NOT match creator with editor role', () => {
      expect(artistRule).toBeDefined();

      const tokens = [
        createMockToken({ text: 'Creators', isHeader: false, isInList: false, isInTable: false }),
        ...Array.from({ length: 50 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Editor Person',
          isLink: true,
          linkHref: '/creator/editor',
        }),
        createMockToken({ text: 'editor' }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(artistRule?.condition(tokens[51]!, 51, context)).toBe(false);
    });
  });
});

// ============================================================================
// Navigation Word Exclusion Tests
// ============================================================================

describe('ComicVine Navigation Word Exclusion', () => {
  describe('comicvine-series-summary rule', () => {
    const summaryRule = COMICVINE_RULES.find((r) => r.id === 'comicvine-series-summary');

    it('should NOT match "Concepts" navigation word', () => {
      expect(summaryRule).toBeDefined();

      const tokens = [
        ...Array.from({ length: 60 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Concepts',
          sectionType: 'main_content',
        }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(summaryRule?.condition(tokens[60]!, 60, context)).toBe(false);
    });

    it('should NOT match "View" navigation word', () => {
      expect(summaryRule).toBeDefined();

      const tokens = [
        ...Array.from({ length: 60 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'View',
          sectionType: 'main_content',
        }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(summaryRule?.condition(tokens[60]!, 60, context)).toBe(false);
    });

    it('should NOT match "least" as TAGS (common false positive)', () => {
      expect(summaryRule).toBeDefined();

      const tokens = [
        ...Array.from({ length: 60 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'least',
          sectionType: 'main_content',
        }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      // "least" starts with lowercase, so it shouldn't match the pattern anyway
      // But it's also in the navWords list now
      expect(summaryRule?.condition(tokens[60]!, 60, context)).toBe(false);
    });

    it('should match legitimate summary text', () => {
      expect(summaryRule).toBeDefined();

      const tokens = [
        ...Array.from({ length: 60 }, () => createMockToken({ text: 'filler' })),
        createMockToken({
          text: 'Welcome',
          sectionType: 'main_content',
          isHeader: false,
          isInList: false,
          isImage: false,
        }),
      ];
      const context = createMockContext(tokens, 'comicvine');

      expect(summaryRule?.condition(tokens[60]!, 60, context)).toBe(true);
    });
  });
});

// ============================================================================
// Fandom Chapter Title Span Tests
// ============================================================================

describe('Fandom Chapter Hash Number Rule', () => {
  const chapterRule = FANDOM_RULES.find((r) => r.id === 'fandom-chapter-hash-number');

  describe('condition', () => {
    it('should match combined #N. format', () => {
      expect(chapterRule).toBeDefined();

      const token = createMockToken({
        text: '#4.',
        sectionType: 'main_content',
        classes: [],
      });
      const context = createMockContext([token], 'fandom');

      expect(chapterRule?.condition(token, 0, context)).toBe(true);
    });

    it('should match separate # token followed by number', () => {
      expect(chapterRule).toBeDefined();

      const hashToken = createMockToken({
        text: '#',
        sectionType: 'main_content',
        classes: [],
      });
      const numberToken = createMockToken({
        text: '4',
        sectionType: 'main_content',
        classes: [],
      });
      const context = createMockContext([hashToken, numberToken], 'fandom');

      expect(chapterRule?.condition(hashToken, 0, context)).toBe(true);
    });

    it('should NOT match TOC items', () => {
      expect(chapterRule).toBeDefined();

      const token = createMockToken({
        text: '#4.',
        sectionType: 'main_content',
        classes: ['toctext'],
      });
      const context = createMockContext([token], 'fandom');

      expect(chapterRule?.condition(token, 0, context)).toBe(false);
    });

    it('should NOT match navigation section', () => {
      expect(chapterRule).toBeDefined();

      const token = createMockToken({
        text: '#4.',
        sectionType: 'navigation',
        classes: [],
      });
      const context = createMockContext([token], 'fandom');

      expect(chapterRule?.condition(token, 0, context)).toBe(false);
    });
  });

  describe('getSpanEnd - chapter title spanning multiple tokens', () => {
    it('should span entire chapter title "#4. CA of the Dead 1"', () => {
      expect(chapterRule).toBeDefined();

      // Simulate tokens for "#4. CA of the Dead 1"
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'of', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'the', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'Dead', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: '1', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(5); // Should include all tokens (indices 0-5)
    });

    it('should span entire chapter title with different link destinations', () => {
      expect(chapterRule).toBeDefined();

      // Simulate tokens where words have different link destinations
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content', isLink: true, linkHref: '/wiki/CA' }),
        createMockToken({ text: 'of', sectionType: 'main_content', isLink: false }),
        createMockToken({ text: 'the', sectionType: 'main_content', isLink: false }),
        createMockToken({ text: 'Dead', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Dead' }),
        createMockToken({ text: '1', sectionType: 'main_content', isLink: false }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(5); // Should include all tokens regardless of link status
    });

    it('should stop at opening parenthesis (alt title boundary)', () => {
      expect(chapterRule).toBeDefined();

      // "#4. CA of the Dead 1 (別タイトル)"
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content' }),
        createMockToken({ text: 'of', sectionType: 'main_content' }),
        createMockToken({ text: 'the', sectionType: 'main_content' }),
        createMockToken({ text: 'Dead', sectionType: 'main_content' }),
        createMockToken({ text: '1', sectionType: 'main_content' }),
        createMockToken({ text: '(', sectionType: 'main_content' }),
        createMockToken({ text: '別タイトル', sectionType: 'main_content' }),
        createMockToken({ text: ')', sectionType: 'main_content' }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(5); // Should stop before '('
    });

    it('should stop at next chapter entry', () => {
      expect(chapterRule).toBeDefined();

      // "#4. Title #5. Next Title"
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'Title', sectionType: 'main_content' }),
        createMockToken({ text: '#5.', sectionType: 'main_content' }),
        createMockToken({ text: 'Next', sectionType: 'main_content' }),
        createMockToken({ text: 'Title', sectionType: 'main_content' }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(1); // Should stop before '#5.'
    });

    it('should stop at line break', () => {
      expect(chapterRule).toBeDefined();

      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'Title', sectionType: 'main_content' }),
        createMockToken({ text: '\n', sectionType: 'main_content' }),
        createMockToken({ text: 'Next', sectionType: 'main_content' }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(1); // Should stop before newline
    });

    it('should stop at header', () => {
      expect(chapterRule).toBeDefined();

      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'Title', sectionType: 'main_content' }),
        createMockToken({ text: 'Section', sectionType: 'main_content', isHeader: true }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(1); // Should stop before header
    });

    it('should stop at image', () => {
      expect(chapterRule).toBeDefined();

      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'Title', sectionType: 'main_content' }),
        createMockToken({ text: '', sectionType: 'main_content', isImage: true }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(1); // Should stop before image
    });

    it('should handle Japanese parenthesis', () => {
      expect(chapterRule).toBeDefined();

      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'タイトル', sectionType: 'main_content' }),
        createMockToken({ text: '（', sectionType: 'main_content' }), // Japanese open paren
        createMockToken({ text: '代替', sectionType: 'main_content' }),
      ];
      const context = createMockContext(tokens, 'fandom');

      const spanEnd = chapterRule?.getSpanEnd?.(tokens[0]!, 0, context);
      expect(spanEnd).toBe(1); // Should stop before '（'
    });
  });

  describe('integration with applyPositionalHeuristics', () => {
    it('should label all tokens in "#4. CA of the Dead 1" as CHAPTER_TITLE', () => {
      // Simulate tokens for "#4. CA of the Dead 1"
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'of', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'the', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'Dead', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: '1', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
      ];

      const matches = applyPositionalHeuristics(tokens, 'fandom');

      // Find the CHAPTER_TITLE match
      const chapterTitleMatch = matches.find(m => m.rule.entityType === 'CHAPTER_TITLE');
      expect(chapterTitleMatch).toBeDefined();

      // Verify the span covers all tokens (indices 0-5)
      expect(chapterTitleMatch?.span.start).toBe(0);
      expect(chapterTitleMatch?.span.end).toBe(5);
      expect(chapterTitleMatch?.tokenIndices).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should label all tokens even when words have different link destinations', () => {
      // Simulate tokens where words have different link destinations (e.g., wiki links)
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content', isLink: true, linkHref: '/wiki/CA' }),
        createMockToken({ text: 'of', sectionType: 'main_content', isLink: false }),
        createMockToken({ text: 'the', sectionType: 'main_content', isLink: false }),
        createMockToken({ text: 'Dead', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Dead' }),
        createMockToken({ text: '1', sectionType: 'main_content', isLink: false }),
      ];

      const matches = applyPositionalHeuristics(tokens, 'fandom');

      const chapterTitleMatch = matches.find(m => m.rule.entityType === 'CHAPTER_TITLE');
      expect(chapterTitleMatch).toBeDefined();

      // Verify the span covers all tokens (indices 0-5)
      expect(chapterTitleMatch?.span.start).toBe(0);
      expect(chapterTitleMatch?.span.end).toBe(5);
      expect(chapterTitleMatch?.tokenIndices).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('should not leave words like "of" and "the" unlabeled', () => {
      // This is the exact scenario from the bug report
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'of', sectionType: 'main_content', isLink: false }), // Plain text, not linked
        createMockToken({ text: 'the', sectionType: 'main_content', isLink: false }), // Plain text, not linked
        createMockToken({ text: 'Dead', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: '1', sectionType: 'main_content', isLink: false }),
      ];

      const matches = applyPositionalHeuristics(tokens, 'fandom');

      const chapterTitleMatch = matches.find(m => m.rule.entityType === 'CHAPTER_TITLE');
      expect(chapterTitleMatch).toBeDefined();

      // Critical: tokens at indices 2 ("of") and 3 ("the") must be included
      expect(chapterTitleMatch?.tokenIndices).toContain(2); // "of"
      expect(chapterTitleMatch?.tokenIndices).toContain(3); // "the"
    });

    it('should generate correct BIO labels for all tokens in a chapter title', () => {
      // Verify the actual BIO labels generated
      const tokens = [
        createMockToken({ text: '#4.', sectionType: 'main_content' }),
        createMockToken({ text: 'CA', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: 'of', sectionType: 'main_content', isLink: false }),
        createMockToken({ text: 'the', sectionType: 'main_content', isLink: false }),
        createMockToken({ text: 'Dead', sectionType: 'main_content', isLink: true, linkHref: '/wiki/Chapter_4' }),
        createMockToken({ text: '1', sectionType: 'main_content', isLink: false }),
      ];

      const matches = applyPositionalHeuristics(tokens, 'fandom');
      const chapterTitleMatch = matches.find(m => m.rule.entityType === 'CHAPTER_TITLE');

      expect(chapterTitleMatch).toBeDefined();
      expect(chapterTitleMatch?.span.start).toBe(0);
      expect(chapterTitleMatch?.span.end).toBe(5);

      // Verify the span generates these labels:
      // index 0: B-CHAPTER_TITLE (#4.)
      // index 1: I-CHAPTER_TITLE (CA)
      // index 2: I-CHAPTER_TITLE (of) -- critical!
      // index 3: I-CHAPTER_TITLE (the) -- critical!
      // index 4: I-CHAPTER_TITLE (Dead)
      // index 5: I-CHAPTER_TITLE (1)

      // The tokenIndices array should have 6 elements (indices 0-5)
      expect(chapterTitleMatch?.tokenIndices).toHaveLength(6);
      expect(chapterTitleMatch?.tokenIndices).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });
});
