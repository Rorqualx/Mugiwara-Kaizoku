/**
 * Error Classification Tests
 *
 * Tests for classifyFailure function covering all 11 ErrorCategory values.
 *
 * @module tests/auto-labeling/error-classifier/classification
 */

import { classifyFailure, suggestFix } from '@/server/services/auto-labeling/error-classifier';
import { ErrorCategory } from '@/server/services/auto-labeling/types';

import type { LabelingAttempt, SampledPage, ExtractedEntity, ExpectedEntity } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

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

function createBaseAttempt(overrides?: Partial<LabelingAttempt>): LabelingAttempt {
  return {
    page: createPage(),
    success: false,
    extractedEntities: [],
    expectedEntities: [],
    metrics: null,
    durationMs: 100,
    timestamp: new Date(),
    ...overrides,
  } as LabelingAttempt;
}

// ============================================================================
// FETCH_ERROR Tests
// ============================================================================

describe('ErrorCategory.FETCH_ERROR', () => {
  it('should classify "fetch failed" error message', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'fetch failed: network error');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should classify "network error" message', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Network error occurred');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should classify ECONNREFUSED error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'ECONNREFUSED: Connection refused');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should classify 404 status code error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'HTTP 404: Page not found');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should classify 500 status code error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, '500 Internal Server Error');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should classify 503 status code error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, '503 Service Unavailable');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'fetch failed');

    expect(result.suggestion).toContain('URL validity');
  });
});

// ============================================================================
// GROUND_TRUTH_ERROR Tests
// ============================================================================

describe('ErrorCategory.GROUND_TRUTH_ERROR', () => {
  it('should classify when extracted entities exist but expected is empty', () => {
    const attempt = createBaseAttempt({
      extractedEntities: [createExtracted('TITLE', 'One Piece')],
      expectedEntities: [],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.GROUND_TRUTH_ERROR);
  });

  it('should not classify when both extracted and expected are empty', () => {
    const attempt = createBaseAttempt({
      extractedEntities: [],
      expectedEntities: [],
    });
    const result = classifyFailure(attempt);

    // Should fall through to UNKNOWN, not GROUND_TRUTH_ERROR
    expect(result.category).not.toBe(ErrorCategory.GROUND_TRUTH_ERROR);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      extractedEntities: [createExtracted('TITLE', 'Test')],
      expectedEntities: [],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('AniList');
  });
});

// ============================================================================
// TIMEOUT Tests
// ============================================================================

describe('ErrorCategory.TIMEOUT', () => {
  it('should classify "timeout" error message', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Operation timeout exceeded');

    expect(result.category).toBe(ErrorCategory.TIMEOUT);
  });

  it('should classify timeout message', () => {
    const attempt = createBaseAttempt();
    // Note: ETIMEDOUT is classified as FETCH_ERROR due to priority
    // Only pure "timeout" messages get classified as TIMEOUT
    const result = classifyFailure(attempt, 'Request timeout exceeded');

    expect(result.category).toBe(ErrorCategory.TIMEOUT);
  });

  it('should be case insensitive', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'TIMEOUT occurred');

    expect(result.category).toBe(ErrorCategory.TIMEOUT);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'timeout');

    expect(result.suggestion).toContain('timeout');
  });
});

// ============================================================================
// PARSE_ERROR Tests
// ============================================================================

describe('ErrorCategory.PARSE_ERROR', () => {
  it('should classify "parse error" message', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Parse error: unexpected token');

    expect(result.category).toBe(ErrorCategory.PARSE_ERROR);
  });

  it('should classify cheerio error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Cheerio failed to load document');

    expect(result.category).toBe(ErrorCategory.PARSE_ERROR);
  });

  it('should classify DOM error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'DOM parsing failed');

    expect(result.category).toBe(ErrorCategory.PARSE_ERROR);
  });

  it('should classify invalid HTML error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Invalid HTML structure');

    expect(result.category).toBe(ErrorCategory.PARSE_ERROR);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'parse error');

    expect(result.suggestion).toContain('HTML');
  });
});

// ============================================================================
// NO_CONTENT Tests
// ============================================================================

describe('ErrorCategory.NO_CONTENT', () => {
  it('should classify when static analysis finds no structure', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 0, withHeaders: 0, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 0, h2Count: 0, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'generic', confidence: 0.1, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.NO_CONTENT);
    expect(result.message).toContain('no extractable structure');
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 0, withHeaders: 0, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 0, h2Count: 0, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'generic', confidence: 0.1, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('filtering');
  });
});

// ============================================================================
// STRUCTURE_NOT_RECOGNIZED Tests
// ============================================================================

describe('ErrorCategory.STRUCTURE_NOT_RECOGNIZED', () => {
  it('should classify when structure exists but confidence is low', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 1, withHeaders: 1, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 0, h2Count: 0, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'table', confidence: 0.3, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.STRUCTURE_NOT_RECOGNIZED);
    expect(result.confidenceLevel).toBe(0.3);
  });

  it('should include recommended parser in result', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 1, withHeaders: 1, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 0, h2Count: 0, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'list', confidence: 0.4, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.recommendedParser).toBe('list');
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 1, withHeaders: 1, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 0, h2Count: 0, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'table', confidence: 0.3, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('structure detection');
  });
});

// ============================================================================
// PARSER_SELECTION_FAILED Tests
// ============================================================================

describe('ErrorCategory.PARSER_SELECTION_FAILED', () => {
  it('should classify when parser was recommended with high confidence but failed', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 2, withHeaders: 2, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 1, h2Count: 2, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'chapters-table', confidence: 0.8, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.PARSER_SELECTION_FAILED);
    expect(result.selectedParser).toBe('chapters-table');
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 2, withHeaders: 2, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 1, h2Count: 2, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'table', confidence: 0.9, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('parser');
  });
});

// ============================================================================
// ENTITY_EXTRACTION_FAILED Tests
// ============================================================================

describe('ErrorCategory.ENTITY_EXTRACTION_FAILED', () => {
  it('should classify when parser result has success=false', () => {
    const attempt = createBaseAttempt({
      parserResult: {
        success: false,
        error: 'Extraction failed',
        confidence: 0.7,
        data: null,
        structureType: 'table',
      } as unknown as LabelingAttempt['parserResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.ENTITY_EXTRACTION_FAILED);
  });

  it('should classify when parser succeeded but no data extracted', () => {
    const attempt = createBaseAttempt({
      parserResult: {
        success: true,
        confidence: 0.7,
        data: { volumeList: [], chapterList: [] },
        structureType: 'table',
      } as unknown as LabelingAttempt['parserResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.ENTITY_EXTRACTION_FAILED);
  });

  it('should classify bootstrap labeler finding spans but not matching', () => {
    const attempt = createBaseAttempt({
      bootstrapResult: {
        spans: [{ start: 0, end: 5, label: 'TITLE' }],
        confidence: 0.7,
      } as unknown as LabelingAttempt['bootstrapResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.ENTITY_EXTRACTION_FAILED);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      parserResult: {
        success: false,
        error: 'Failed',
        confidence: 0.5,
        data: null,
        structureType: 'list',
      } as unknown as LabelingAttempt['parserResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('selector');
  });
});

// ============================================================================
// CONFIDENCE_TOO_LOW Tests
// ============================================================================

describe('ErrorCategory.CONFIDENCE_TOO_LOW', () => {
  it('should classify when parser succeeded but confidence is too low', () => {
    const attempt = createBaseAttempt({
      parserResult: {
        success: true,
        confidence: 0.3,
        data: { volumeList: [{ title: 'Vol 1' }], chapterList: [] },
        structureType: 'table',
      } as unknown as LabelingAttempt['parserResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.CONFIDENCE_TOO_LOW);
    expect(result.confidenceLevel).toBe(0.3);
  });

  it('should classify when bootstrap confidence is too low', () => {
    const attempt = createBaseAttempt({
      bootstrapResult: {
        spans: [{ start: 0, end: 5, label: 'TITLE' }],
        confidence: 0.2,
      } as unknown as LabelingAttempt['bootstrapResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.CONFIDENCE_TOO_LOW);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      parserResult: {
        success: true,
        confidence: 0.4,
        data: { volumeList: [{}], chapterList: [] },
        structureType: 'table',
      } as unknown as LabelingAttempt['parserResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('confidence');
  });
});

// ============================================================================
// PATTERN_MISMATCH Tests
// ============================================================================

describe('ErrorCategory.PATTERN_MISMATCH', () => {
  it('should classify when parser extracted data but did not match expected', () => {
    const attempt = createBaseAttempt({
      parserResult: {
        success: true,
        confidence: 0.8,
        data: { volumeList: [{ title: 'Vol 1' }], chapterList: [{ number: '1' }] },
        structureType: 'table',
      } as unknown as LabelingAttempt['parserResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.PATTERN_MISMATCH);
  });

  it('should classify when bootstrap labeler found no spans', () => {
    const attempt = createBaseAttempt({
      bootstrapResult: {
        spans: [],
        confidence: 0.9,
      } as unknown as LabelingAttempt['bootstrapResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.PATTERN_MISMATCH);
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt({
      bootstrapResult: {
        spans: [],
        confidence: 0.8,
      } as unknown as LabelingAttempt['bootstrapResult'],
    });
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('label mappings');
  });
});

// ============================================================================
// UNKNOWN Tests
// ============================================================================

describe('ErrorCategory.UNKNOWN', () => {
  it('should classify when no specific category matches', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt);

    expect(result.category).toBe(ErrorCategory.UNKNOWN);
  });

  it('should use provided error message', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Some unknown error');

    expect(result.message).toBe('Some unknown error');
  });

  it('should use default message when no error provided', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt);

    expect(result.message).toContain('Unknown error');
  });

  it('should include appropriate suggestion', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt);

    expect(result.suggestion).toContain('error logs');
  });
});

// ============================================================================
// suggestFix Tests
// ============================================================================

describe('suggestFix', () => {
  it('should include base suggestion from category', () => {
    const failure = classifyFailure(createBaseAttempt(), 'fetch error');
    const suggestion = suggestFix(failure);

    expect(suggestion).toContain('URL validity');
  });

  it('should include parser mismatch details', () => {
    const failure = {
      category: ErrorCategory.PARSER_SELECTION_FAILED,
      message: 'Parser failed',
      selectedParser: 'table',
      recommendedParser: 'list',
    };
    const suggestion = suggestFix(failure);

    expect(suggestion).toContain('Selected parser: table');
    expect(suggestion).toContain('recommended: list');
  });

  it('should include failed patterns', () => {
    const failure = {
      category: ErrorCategory.PATTERN_MISMATCH,
      message: 'Pattern mismatch',
      failedPatterns: ['pattern1', 'pattern2'],
    };
    const suggestion = suggestFix(failure);

    expect(suggestion).toContain('pattern1, pattern2');
  });

  it('should include confidence level', () => {
    const failure = {
      category: ErrorCategory.CONFIDENCE_TOO_LOW,
      message: 'Low confidence',
      confidenceLevel: 0.35,
    };
    const suggestion = suggestFix(failure);

    expect(suggestion).toContain('35%');
  });

  it('should handle minimal failure details', () => {
    const failure = {
      category: ErrorCategory.UNKNOWN,
      message: 'Unknown error',
    };
    const suggestion = suggestFix(failure);

    expect(suggestion.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Error Message Priority Tests
// ============================================================================

describe('error classification priority', () => {
  it('should prioritize fetch error over other classifications', () => {
    const attempt = createBaseAttempt({
      extractedEntities: [createExtracted('TITLE', 'Test')],
      expectedEntities: [],
    });
    // Fetch error should take precedence over ground truth error
    const result = classifyFailure(attempt, 'fetch failed');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });

  it('should prioritize timeout error over parse error', () => {
    const attempt = createBaseAttempt();
    const result = classifyFailure(attempt, 'Operation timeout while parsing');

    expect(result.category).toBe(ErrorCategory.TIMEOUT);
  });

  it('should prioritize error message classifications over result-based', () => {
    const attempt = createBaseAttempt({
      staticAnalysis: {
        tables: { totalCount: 1, withHeaders: 1, structures: [] },
        lists: { totalCount: 0, ordered: 0, unordered: 0, nested: 0 },
        headers: { h1Count: 0, h2Count: 0, h3Count: 0, hierarchy: [] },
        recommendedParser: { primary: 'table', confidence: 0.9, alternatives: [] },
        pageContext: { hasInfobox: false, hasNavigation: false, hasCategories: false },
      } as unknown as LabelingAttempt['staticAnalysis'],
    });
    const result = classifyFailure(attempt, 'network error');

    expect(result.category).toBe(ErrorCategory.FETCH_ERROR);
  });
});
