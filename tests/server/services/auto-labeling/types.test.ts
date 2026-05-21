/**
 * Type Guards Tests
 *
 * Tests for type guard functions in auto-labeling/types.ts.
 *
 * @module tests/auto-labeling/types
 */

import {
  isDiscoveredUrlType,
  isErrorCategory,
  isSampledPage,
  isLabelingAttempt,
  ErrorCategory,
} from '@/server/services/auto-labeling/types';

import {
  SAMPLED_PAGE_FANDOM,
  SAMPLED_PAGE_WIKIPEDIA,
  ALL_DISCOVERED_URL_TYPES,
} from './fixtures';

import {
  ATTEMPT_SUCCESS_PERFECT,
  ATTEMPT_FAILURE_FETCH,
  ALL_ERROR_CATEGORIES,
} from './fixtures/labeling-attempts.fixtures';

// ============================================================================
// isDiscoveredUrlType Tests
// ============================================================================

describe('isDiscoveredUrlType', () => {
  describe('valid types', () => {
    it.each(ALL_DISCOVERED_URL_TYPES)('should return true for valid type "%s"', (type) => {
      expect(isDiscoveredUrlType(type)).toBe(true);
    });
  });

  describe('invalid types', () => {
    it('should return false for null', () => {
      expect(isDiscoveredUrlType(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDiscoveredUrlType(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isDiscoveredUrlType('')).toBe(false);
    });

    it('should return false for invalid string', () => {
      expect(isDiscoveredUrlType('INVALID_TYPE')).toBe(false);
    });

    it('should return false for lowercase valid type', () => {
      expect(isDiscoveredUrlType('chapters')).toBe(false);
    });

    it('should return false for mixed case', () => {
      expect(isDiscoveredUrlType('Chapters')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isDiscoveredUrlType(123)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isDiscoveredUrlType({ type: 'CHAPTERS' })).toBe(false);
    });

    it('should return false for array', () => {
      expect(isDiscoveredUrlType(['CHAPTERS'])).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isDiscoveredUrlType(true)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for string with extra whitespace', () => {
      expect(isDiscoveredUrlType(' CHAPTERS ')).toBe(false);
    });

    it('should return false for partial match', () => {
      expect(isDiscoveredUrlType('CHAPTER')).toBe(false);
    });

    it('should return false for type with underscore variations', () => {
      expect(isDiscoveredUrlType('CHAPTERS_')).toBe(false);
    });
  });
});

// ============================================================================
// isErrorCategory Tests
// ============================================================================

describe('isErrorCategory', () => {
  describe('valid error categories', () => {
    it.each(ALL_ERROR_CATEGORIES)('should return true for valid category "%s"', (category) => {
      expect(isErrorCategory(category)).toBe(true);
    });
  });

  describe('enum values', () => {
    it('should return true for ErrorCategory.FETCH_ERROR', () => {
      expect(isErrorCategory(ErrorCategory.FETCH_ERROR)).toBe(true);
    });

    it('should return true for ErrorCategory.PARSE_ERROR', () => {
      expect(isErrorCategory(ErrorCategory.PARSE_ERROR)).toBe(true);
    });

    it('should return true for ErrorCategory.TIMEOUT', () => {
      expect(isErrorCategory(ErrorCategory.TIMEOUT)).toBe(true);
    });

    it('should return true for ErrorCategory.UNKNOWN', () => {
      expect(isErrorCategory(ErrorCategory.UNKNOWN)).toBe(true);
    });
  });

  describe('invalid categories', () => {
    it('should return false for null', () => {
      expect(isErrorCategory(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isErrorCategory(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isErrorCategory('')).toBe(false);
    });

    it('should return false for invalid string', () => {
      expect(isErrorCategory('NOT_A_CATEGORY')).toBe(false);
    });

    it('should return false for lowercase category', () => {
      expect(isErrorCategory('fetch_error')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isErrorCategory(0)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isErrorCategory({ category: 'FETCH_ERROR' })).toBe(false);
    });

    it('should return false for array', () => {
      expect(isErrorCategory([ErrorCategory.FETCH_ERROR])).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for partial match', () => {
      expect(isErrorCategory('FETCH')).toBe(false);
    });

    it('should return false for category with extra underscore', () => {
      expect(isErrorCategory('FETCH_ERROR_')).toBe(false);
    });
  });
});

// ============================================================================
// isSampledPage Tests
// ============================================================================

describe('isSampledPage', () => {
  describe('valid pages', () => {
    it('should return true for valid fandom page', () => {
      expect(isSampledPage(SAMPLED_PAGE_FANDOM)).toBe(true);
    });

    it('should return true for valid wikipedia page', () => {
      expect(isSampledPage(SAMPLED_PAGE_WIKIPEDIA)).toBe(true);
    });

    it('should return true for minimal valid page', () => {
      const minimalPage = {
        id: 'test-id',
        title: 'Test',
        anilistId: 1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(minimalPage)).toBe(true);
    });

    it('should return true for page with all properties', () => {
      const fullPage = {
        id: '123-fandom-CHAPTERS',
        title: 'Test Manga',
        anilistId: 123,
        source: 'fandom',
        url: 'https://test.fandom.com/chapters',
        urlType: 'CHAPTERS',
        baseUrl: 'https://test.fandom.com',
      };
      expect(isSampledPage(fullPage)).toBe(true);
    });
  });

  describe('invalid pages - null and undefined', () => {
    it('should return false for null', () => {
      expect(isSampledPage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isSampledPage(undefined)).toBe(false);
    });
  });

  describe('invalid pages - wrong types', () => {
    it('should return false for string', () => {
      expect(isSampledPage('page')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isSampledPage(123)).toBe(false);
    });

    it('should return false for array', () => {
      expect(isSampledPage([SAMPLED_PAGE_FANDOM])).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isSampledPage(true)).toBe(false);
    });
  });

  describe('invalid pages - missing required fields', () => {
    it('should return false for missing id', () => {
      const page = {
        title: 'Test',
        anilistId: 1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for missing title', () => {
      const page = {
        id: 'test-id',
        anilistId: 1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for missing anilistId', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for missing source', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: 1,
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for missing url', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: 1,
        source: 'fandom',
      };
      expect(isSampledPage(page)).toBe(false);
    });
  });

  describe('invalid pages - wrong field types', () => {
    it('should return false for numeric id', () => {
      const page = {
        id: 123,
        title: 'Test',
        anilistId: 1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for numeric title', () => {
      const page = {
        id: 'test-id',
        title: 123,
        anilistId: 1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for string anilistId', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: '1',
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for numeric source', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: 1,
        source: 1,
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(false);
    });

    it('should return false for null url', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: 1,
        source: 'fandom',
        url: null,
      };
      expect(isSampledPage(page)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return true for empty string id', () => {
      // Type guard only checks typeof, not semantic validity
      const page = {
        id: '',
        title: 'Test',
        anilistId: 1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(true);
    });

    it('should return true for zero anilistId', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: 0,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(true);
    });

    it('should return true for negative anilistId', () => {
      const page = {
        id: 'test-id',
        title: 'Test',
        anilistId: -1,
        source: 'fandom',
        url: 'https://example.com',
      };
      expect(isSampledPage(page)).toBe(true);
    });
  });
});

// ============================================================================
// isLabelingAttempt Tests
// ============================================================================

describe('isLabelingAttempt', () => {
  describe('valid attempts', () => {
    it('should return true for successful attempt', () => {
      expect(isLabelingAttempt(ATTEMPT_SUCCESS_PERFECT)).toBe(true);
    });

    it('should return true for failed attempt', () => {
      expect(isLabelingAttempt(ATTEMPT_FAILURE_FETCH)).toBe(true);
    });

    it('should return true for minimal valid attempt', () => {
      const minimalAttempt = {
        page: {
          id: 'test-id',
          title: 'Test',
          anilistId: 1,
          source: 'fandom',
          url: 'https://example.com',
        },
        success: true,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(minimalAttempt)).toBe(true);
    });

    it('should return true for failed attempt with error', () => {
      const failedAttempt = {
        page: {
          id: 'test-id',
          title: 'Test',
          anilistId: 1,
          source: 'fandom',
          url: 'https://example.com',
        },
        success: false,
        error: 'Some error',
        errorCategory: ErrorCategory.UNKNOWN,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 100,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(failedAttempt)).toBe(true);
    });
  });

  describe('invalid attempts - null and undefined', () => {
    it('should return false for null', () => {
      expect(isLabelingAttempt(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isLabelingAttempt(undefined)).toBe(false);
    });
  });

  describe('invalid attempts - wrong types', () => {
    it('should return false for string', () => {
      expect(isLabelingAttempt('attempt')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isLabelingAttempt(123)).toBe(false);
    });

    it('should return false for array', () => {
      expect(isLabelingAttempt([ATTEMPT_SUCCESS_PERFECT])).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isLabelingAttempt(false)).toBe(false);
    });
  });

  describe('invalid attempts - missing required fields', () => {
    it('should return false for missing success', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return false for missing page', () => {
      const attempt = {
        success: true,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return false for missing extractedEntities', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: true,
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });
  });

  describe('invalid attempts - wrong field types', () => {
    it('should return false for string success', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: 'true',
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return false for invalid page', () => {
      const attempt = {
        page: { invalid: 'page' },
        success: true,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return false for non-array extractedEntities', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: true,
        extractedEntities: 'entities',
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return false for null extractedEntities', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: true,
        extractedEntities: null,
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return true for empty extractedEntities array', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: true,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(true);
    });

    it('should return true for numeric success (0)', () => {
      // JavaScript falsy value check - 0 is falsy but typeof is not 'boolean'
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: 0,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return true for numeric success (1)', () => {
      const attempt = {
        page: SAMPLED_PAGE_FANDOM,
        success: 1,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });

    it('should return false for null page', () => {
      const attempt = {
        page: null,
        success: true,
        extractedEntities: [],
        expectedEntities: [],
        metrics: null,
        durationMs: 0,
        timestamp: new Date(),
      };
      expect(isLabelingAttempt(attempt)).toBe(false);
    });
  });
});
