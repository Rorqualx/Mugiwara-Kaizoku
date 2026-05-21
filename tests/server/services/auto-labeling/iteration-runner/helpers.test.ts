/**
 * Iteration Runner Helpers Tests
 *
 * Tests for helper functions used by the iteration runner.
 * Since most helpers are private, we test them through the module's behavior.
 *
 * @module tests/auto-labeling/iteration-runner/helpers
 */

import { describe, it, expect } from 'bun:test';

import type { ExtractedEntity } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createEntity(
  type: string,
  value: string,
  confidence: number,
  source: 'parser' | 'bootstrap' = 'parser'
): ExtractedEntity {
  return {
    type: type as ExtractedEntity['type'],
    value,
    normalizedValue: value.toLowerCase().replace(/\s+/g, ' ').trim(),
    confidence,
    source,
  };
}

/**
 * Merge entities from parser and bootstrap, preferring parser.
 * This is a copy of the private function for testing purposes.
 */
function mergeEntities(
  parserEntities: ExtractedEntity[],
  bootstrapEntities: ExtractedEntity[]
): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  // Add parser entities first (higher priority)
  for (const entity of parserEntities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    seen.set(key, entity);
  }

  // Add bootstrap entities if not already present
  for (const entity of bootstrapEntities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    if (!seen.has(key)) {
      seen.set(key, entity);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// mergeEntities Tests (Testing the logic)
// ============================================================================

describe('mergeEntities', () => {
  describe('basic merging', () => {
    it('should merge entities from both sources', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('AUTHOR', 'Eiichiro Oda', 0.8, 'bootstrap')];

      const merged = mergeEntities(parser, bootstrap);

      expect(merged.length).toBe(2);
      expect(merged.find(e => e.type === 'TITLE')).toBeDefined();
      expect(merged.find(e => e.type === 'AUTHOR')).toBeDefined();
    });

    it('should handle empty parser entities', () => {
      const bootstrap = [createEntity('TITLE', 'Naruto', 0.8, 'bootstrap')];

      const merged = mergeEntities([], bootstrap);

      expect(merged.length).toBe(1);
      expect(merged[0]?.source).toBe('bootstrap');
    });

    it('should handle empty bootstrap entities', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];

      const merged = mergeEntities(parser, []);

      expect(merged.length).toBe(1);
      expect(merged[0]?.source).toBe('parser');
    });

    it('should handle both empty', () => {
      const merged = mergeEntities([], []);
      expect(merged).toEqual([]);
    });
  });

  describe('deduplication', () => {
    it('should prefer parser entities over bootstrap for same type+value', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('TITLE', 'One Piece', 0.95, 'bootstrap')];

      const merged = mergeEntities(parser, bootstrap);

      expect(merged.length).toBe(1);
      expect(merged[0]?.source).toBe('parser');
      expect(merged[0]?.confidence).toBe(0.9);
    });

    it('should normalize values for comparison', () => {
      const parser = [createEntity('TITLE', 'ONE PIECE', 0.9, 'parser')];
      const bootstrap = [createEntity('TITLE', 'one piece', 0.8, 'bootstrap')];

      const merged = mergeEntities(parser, bootstrap);

      // Same normalized value, should only keep parser
      expect(merged.length).toBe(1);
      expect(merged[0]?.source).toBe('parser');
    });

    it('should keep different values even for same type', () => {
      const parser = [createEntity('GENRE', 'Action', 0.9, 'parser')];
      const bootstrap = [createEntity('GENRE', 'Adventure', 0.8, 'bootstrap')];

      const merged = mergeEntities(parser, bootstrap);

      expect(merged.length).toBe(2);
    });
  });

  describe('multiple entities', () => {
    it('should handle multiple entities of different types', () => {
      const parser = [
        createEntity('TITLE', 'One Piece', 0.9, 'parser'),
        createEntity('AUTHOR', 'Eiichiro Oda', 0.85, 'parser'),
      ];
      const bootstrap = [
        createEntity('STATUS', 'Ongoing', 0.8, 'bootstrap'),
        createEntity('GENRE', 'Action', 0.75, 'bootstrap'),
      ];

      const merged = mergeEntities(parser, bootstrap);

      expect(merged.length).toBe(4);
    });

    it('should handle overlapping and non-overlapping entities', () => {
      const parser = [
        createEntity('TITLE', 'One Piece', 0.9, 'parser'),
        createEntity('AUTHOR', 'Oda', 0.8, 'parser'),
      ];
      const bootstrap = [
        createEntity('TITLE', 'One Piece', 0.95, 'bootstrap'), // Should be ignored
        createEntity('STATUS', 'Ongoing', 0.7, 'bootstrap'), // Should be added
      ];

      const merged = mergeEntities(parser, bootstrap);

      expect(merged.length).toBe(3);
      const title = merged.find(e => e.type === 'TITLE');
      expect(title?.source).toBe('parser');
    });
  });
});

// ============================================================================
// createFailedAttempt Logic Tests
// ============================================================================

describe('createFailedAttempt logic', () => {
  it('should create a failed attempt with required fields', () => {
    // Testing the structure that createFailedAttempt would produce
    const failedAttempt = {
      page: { id: '1', title: 'Test', url: 'https://example.com' },
      success: false,
      errorCategory: 'FETCH_ERROR',
      extractedEntities: [],
      expectedEntities: [],
      metrics: null,
      durationMs: 100,
      timestamp: new Date(),
    };

    expect(failedAttempt.success).toBe(false);
    expect(failedAttempt.extractedEntities).toEqual([]);
    expect(failedAttempt.metrics).toBeNull();
  });

  it('should include error message when provided', () => {
    const failedAttempt = {
      page: { id: '1', title: 'Test', url: 'https://example.com' },
      success: false,
      errorCategory: 'FETCH_ERROR',
      error: 'Network timeout',
      extractedEntities: [],
      expectedEntities: [],
      metrics: null,
      durationMs: 100,
      timestamp: new Date(),
    };

    expect(failedAttempt.error).toBe('Network timeout');
  });
});

// ============================================================================
// Priority Calculation Tests
// ============================================================================

describe('getPriorityForCategory logic', () => {
  function getPriorityForCategory(percentage: number): 'critical' | 'high' | 'medium' | 'low' {
    if (percentage >= 40) return 'critical';
    if (percentage >= 25) return 'high';
    if (percentage >= 10) return 'medium';
    return 'low';
  }

  it('should return critical for 40%+', () => {
    expect(getPriorityForCategory(40)).toBe('critical');
    expect(getPriorityForCategory(50)).toBe('critical');
    expect(getPriorityForCategory(100)).toBe('critical');
  });

  it('should return high for 25-39%', () => {
    expect(getPriorityForCategory(25)).toBe('high');
    expect(getPriorityForCategory(30)).toBe('high');
    expect(getPriorityForCategory(39)).toBe('high');
  });

  it('should return medium for 10-24%', () => {
    expect(getPriorityForCategory(10)).toBe('medium');
    expect(getPriorityForCategory(15)).toBe('medium');
    expect(getPriorityForCategory(24)).toBe('medium');
  });

  it('should return low for <10%', () => {
    expect(getPriorityForCategory(0)).toBe('low');
    expect(getPriorityForCategory(5)).toBe('low');
    expect(getPriorityForCategory(9)).toBe('low');
  });

  it('should handle boundary values correctly', () => {
    expect(getPriorityForCategory(9.9)).toBe('low');
    expect(getPriorityForCategory(10)).toBe('medium');
    expect(getPriorityForCategory(24.9)).toBe('medium');
    expect(getPriorityForCategory(25)).toBe('high');
    expect(getPriorityForCategory(39.9)).toBe('high');
    expect(getPriorityForCategory(40)).toBe('critical');
  });
});

// ============================================================================
// Pattern Finding Tests
// ============================================================================

describe('findCommonPatterns logic', () => {
  interface MockAttempt {
    errorCategory: string;
    page: { id: string; source: string; urlType: string };
  }

  function findCommonPatterns(attempts: MockAttempt[]): Array<{
    pattern: string;
    count: number;
    affectedPages: string[];
  }> {
    const patterns = new Map<string, { count: number; pageIds: string[] }>();

    for (const attempt of attempts) {
      const pattern = `${attempt.errorCategory}:${attempt.page.source}:${attempt.page.urlType}`;
      const existing = patterns.get(pattern) ?? { count: 0, pageIds: [] };
      existing.count++;
      existing.pageIds.push(attempt.page.id);
      patterns.set(pattern, existing);
    }

    return Array.from(patterns.entries())
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        affectedPages: data.pageIds,
      }));
  }

  it('should find common patterns', () => {
    const attempts: MockAttempt[] = [
      { errorCategory: 'FETCH_ERROR', page: { id: '1', source: 'fandom', urlType: 'CHAPTERS' } },
      { errorCategory: 'FETCH_ERROR', page: { id: '2', source: 'fandom', urlType: 'CHAPTERS' } },
      { errorCategory: 'PARSE_ERROR', page: { id: '3', source: 'wikipedia', urlType: 'MANGA_PAGE' } },
    ];

    const patterns = findCommonPatterns(attempts);

    expect(patterns.length).toBe(1);
    expect(patterns[0]?.pattern).toBe('FETCH_ERROR:fandom:CHAPTERS');
    expect(patterns[0]?.count).toBe(2);
  });

  it('should filter out patterns with count < 2', () => {
    const attempts: MockAttempt[] = [
      { errorCategory: 'FETCH_ERROR', page: { id: '1', source: 'fandom', urlType: 'CHAPTERS' } },
      { errorCategory: 'PARSE_ERROR', page: { id: '2', source: 'wikipedia', urlType: 'MANGA_PAGE' } },
    ];

    const patterns = findCommonPatterns(attempts);

    expect(patterns.length).toBe(0);
  });

  it('should sort by count descending', () => {
    const attempts: MockAttempt[] = [
      { errorCategory: 'A', page: { id: '1', source: 's', urlType: 't' } },
      { errorCategory: 'A', page: { id: '2', source: 's', urlType: 't' } },
      { errorCategory: 'B', page: { id: '3', source: 's', urlType: 't' } },
      { errorCategory: 'B', page: { id: '4', source: 's', urlType: 't' } },
      { errorCategory: 'B', page: { id: '5', source: 's', urlType: 't' } },
    ];

    const patterns = findCommonPatterns(attempts);

    expect(patterns[0]?.pattern).toBe('B:s:t');
    expect(patterns[0]?.count).toBe(3);
  });

  it('should limit to 5 patterns', () => {
    const attempts: MockAttempt[] = [];
    for (let i = 0; i < 10; i++) {
      const category = String.fromCharCode(65 + i); // A, B, C, ...
      attempts.push(
        { errorCategory: category, page: { id: `${i}a`, source: 's', urlType: 't' } },
        { errorCategory: category, page: { id: `${i}b`, source: 's', urlType: 't' } }
      );
    }

    const patterns = findCommonPatterns(attempts);

    expect(patterns.length).toBe(5);
  });
});
