/**
 * Bootstrap Bridge Entity Extraction Tests
 *
 * Tests for extractEntitiesFromSpans, enhanceWithStaticAnalysis,
 * countEntitiesFromLabels, and extractSpansFromLabels functions.
 *
 * @module tests/auto-labeling/bootstrap-bridge/entity-extraction
 */

import { describe, it, expect } from 'bun:test';

import {
  extractEntitiesFromSpans,
  enhanceWithStaticAnalysis,
  countEntitiesFromLabels,
  extractSpansFromLabels,
} from '@/server/services/auto-labeling/bootstrap-bridge';
import type { BIOTag } from '@/server/ml/features/dom-linearizer';
import type { BootstrapResult } from '@/server/ml/training/bootstrap-labeler/types';
import type { StaticAnalysisResult } from '@/server/services/fandom/adaptive/static-analyzer';
import type { ExtractedEntity } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createBootstrapResult(options: {
  tokens?: Array<{ text: string; label: BIOTag }>;
  spans?: Array<{ entityType: string; start: number; end: number; confidence: number }>;
  extractedValues?: Partial<BootstrapResult['extractedValues']>;
  confidence?: number;
}): BootstrapResult {
  const defaultTokens = [
    { text: 'One', label: 'B-TITLE' as BIOTag },
    { text: 'Piece', label: 'I-TITLE' as BIOTag },
  ];

  return {
    tokens: options.tokens ?? defaultTokens,
    labels: (options.tokens ?? defaultTokens).map(t => t.label),
    spans: (options.spans ?? [{ entityType: 'TITLE', start: 0, end: 1, confidence: 0.9 }]) as BootstrapResult['spans'],
    extractedValues: {
      title: options.extractedValues?.title,
      altTitles: options.extractedValues?.altTitles,
      author: options.extractedValues?.author,
      artist: options.extractedValues?.artist,
      status: options.extractedValues?.status,
      genres: options.extractedValues?.genres,
      summary: options.extractedValues?.summary,
      volumeCount: options.extractedValues?.volumeCount,
      chapterCount: options.extractedValues?.chapterCount,
      publisher: options.extractedValues?.publisher,
      magazine: options.extractedValues?.magazine,
      demographic: options.extractedValues?.demographic,
      releaseDate: options.extractedValues?.releaseDate,
      coverImage: options.extractedValues?.coverImage,
    },
    confidence: options.confidence ?? 0.9,
    source: 'test',
    processingTimeMs: 100,
  };
}

function createStaticAnalysis(options: {
  tablesWithVolumeData?: number;
  tablesWithChapterLinks?: number;
  volumeHeaders?: number;
  hasIsbn?: boolean;
}): StaticAnalysisResult {
  return {
    tables: {
      tablesWithVolumeData: options.tablesWithVolumeData ?? 0,
      tablesWithChapterLinks: options.tablesWithChapterLinks ?? 0,
      totalTables: 0,
      tablesWithCoverImages: 0,
      tablesWithReleaseDates: 0,
    },
    headers: {
      volumeHeaders: options.volumeHeaders ?? 0,
      chapterHeaders: 0,
      arcHeaders: 0,
      totalHeaders: 0,
    },
    content: {
      hasIsbn: options.hasIsbn ?? false,
      hasInfobox: false,
      estimatedWordCount: 1000,
    },
  };
}

function createEntity(
  type: string,
  value: string,
  confidence: number
): ExtractedEntity {
  return {
    type: type as ExtractedEntity['type'],
    value,
    normalizedValue: value.toLowerCase().replace(/\s+/g, ' ').trim(),
    confidence,
    source: 'bootstrap',
  };
}

// ============================================================================
// extractEntitiesFromSpans Tests
// ============================================================================

describe('extractEntitiesFromSpans', () => {
  describe('basic extraction', () => {
    it('should extract entity from single span', () => {
      const result = createBootstrapResult({
        tokens: [
          { text: 'One', label: 'B-TITLE' },
          { text: 'Piece', label: 'I-TITLE' },
        ],
        spans: [{ entityType: 'TITLE', start: 0, end: 1, confidence: 0.9 }],
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      expect(entities.length).toBeGreaterThanOrEqual(1);
      const title = entities.find(e => e.type === 'TITLE');
      expect(title).toBeDefined();
      expect(title?.value).toBe('One Piece');
    });

    it('should extract multiple entities', () => {
      const result = createBootstrapResult({
        tokens: [
          { text: 'One', label: 'B-TITLE' },
          { text: 'Piece', label: 'I-TITLE' },
          { text: 'by', label: 'O' as BIOTag },
          { text: 'Oda', label: 'B-AUTHOR' },
        ],
        spans: [
          { entityType: 'TITLE', start: 0, end: 1, confidence: 0.9 },
          { entityType: 'AUTHOR', start: 3, end: 3, confidence: 0.85 },
        ],
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      expect(entities.filter(e => e.source === 'bootstrap' && e.type === 'TITLE').length).toBeGreaterThanOrEqual(1);
      expect(entities.filter(e => e.source === 'bootstrap' && e.type === 'AUTHOR').length).toBeGreaterThanOrEqual(1);
    });

    it('should skip low confidence spans', () => {
      const result = createBootstrapResult({
        tokens: [
          { text: 'Title', label: 'B-TITLE' },
        ],
        spans: [{ entityType: 'TITLE', start: 0, end: 0, confidence: 0.3 }],
        extractedValues: {},
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      // Should not include spans below confidence threshold
      const spanEntities = entities.filter(e => e.tokenIndices);
      expect(spanEntities.length).toBe(0);
    });

    it('should include token indices', () => {
      const result = createBootstrapResult({
        tokens: [
          { text: 'One', label: 'B-TITLE' },
          { text: 'Piece', label: 'I-TITLE' },
        ],
        spans: [{ entityType: 'TITLE', start: 0, end: 1, confidence: 0.9 }],
      });

      const entities = extractEntitiesFromSpans(result, 0.5);
      const title = entities.find(e => e.tokenIndices);

      expect(title?.tokenIndices).toEqual([0, 1]);
    });
  });

  describe('extracted values', () => {
    it('should extract title from extractedValues', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: { title: 'Naruto' },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      const title = entities.find(e => e.type === 'TITLE');
      expect(title?.value).toBe('Naruto');
    });

    it('should extract alt titles', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: { altTitles: ['Alt 1', 'Alt 2'] },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      const altTitles = entities.filter(e => e.type === 'ALT_TITLE');
      expect(altTitles.length).toBe(2);
    });

    it('should extract author and artist', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: {
          author: 'Eiichiro Oda',
          artist: 'Eiichiro Oda',
        },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      expect(entities.find(e => e.type === 'AUTHOR')).toBeDefined();
      expect(entities.find(e => e.type === 'ARTIST')).toBeDefined();
    });

    it('should extract status', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: { status: 'Ongoing' },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      expect(entities.find(e => e.type === 'STATUS')?.value).toBe('Ongoing');
    });

    it('should extract genres', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: { genres: ['Action', 'Adventure', 'Comedy'] },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      const genres = entities.filter(e => e.type === 'GENRE');
      expect(genres.length).toBe(3);
    });

    it('should extract volume and chapter counts', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: {
          volumeCount: 107,
          chapterCount: 1100,
        },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      expect(entities.find(e => e.type === 'VOLUME_COUNT')?.value).toBe('107');
      expect(entities.find(e => e.type === 'CHAPTER_COUNT')?.value).toBe('1100');
    });

    it('should extract publisher and magazine', () => {
      const result = createBootstrapResult({
        spans: [],
        extractedValues: {
          publisher: 'Shueisha',
          magazine: 'Weekly Shonen Jump',
        },
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      expect(entities.find(e => e.type === 'PUBLISHER')?.value).toBe('Shueisha');
      expect(entities.find(e => e.type === 'MAGAZINE')?.value).toBe('Weekly Shonen Jump');
    });
  });

  describe('deduplication', () => {
    it('should keep highest confidence for duplicates', () => {
      const result = createBootstrapResult({
        tokens: [
          { text: 'One Piece', label: 'B-TITLE' },
        ],
        spans: [
          { entityType: 'TITLE', start: 0, end: 0, confidence: 0.7 },
        ],
        extractedValues: { title: 'One Piece' },
        confidence: 0.9,
      });

      const entities = extractEntitiesFromSpans(result, 0.5);

      const titles = entities.filter(e => e.type === 'TITLE');
      expect(titles.length).toBe(1);
      expect(titles[0]?.confidence).toBe(0.9);
    });
  });
});

// ============================================================================
// enhanceWithStaticAnalysis Tests
// ============================================================================

describe('enhanceWithStaticAnalysis', () => {
  describe('volume/chapter count boost', () => {
    it('should boost volume count when volume tables detected', () => {
      const entities = [createEntity('VOLUME_COUNT', '107', 0.8)];
      const analysis = createStaticAnalysis({ tablesWithVolumeData: 2 });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBeGreaterThan(0.8);
    });

    it('should boost chapter count when chapter tables detected', () => {
      const entities = [createEntity('CHAPTER_COUNT', '1100', 0.8)];
      const analysis = createStaticAnalysis({ tablesWithChapterLinks: 3 });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBeGreaterThan(0.8);
    });

    it('should apply cumulative boost for both tables', () => {
      const entities = [createEntity('VOLUME_COUNT', '107', 0.8)];
      const analysis = createStaticAnalysis({
        tablesWithVolumeData: 1,
        tablesWithChapterLinks: 1,
      });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      // Should get both boosts (0.1 + 0.05)
      expect(enhanced[0]?.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('volume title boost', () => {
    it('should boost volume title when volume headers detected', () => {
      const entities = [createEntity('VOLUME_TITLE', 'Romance Dawn', 0.7)];
      const analysis = createStaticAnalysis({ volumeHeaders: 5 });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBeCloseTo(0.8, 10);
    });
  });

  describe('author/artist boost', () => {
    it('should boost author when ISBN detected', () => {
      const entities = [createEntity('AUTHOR', 'Eiichiro Oda', 0.8)];
      const analysis = createStaticAnalysis({ hasIsbn: true });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBeCloseTo(0.85, 10);
    });

    it('should boost artist when ISBN detected', () => {
      const entities = [createEntity('ARTIST', 'Eiichiro Oda', 0.8)];
      const analysis = createStaticAnalysis({ hasIsbn: true });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBeCloseTo(0.85, 10);
    });
  });

  describe('confidence cap', () => {
    it('should cap confidence at 1.0', () => {
      const entities = [createEntity('VOLUME_COUNT', '107', 0.95)];
      const analysis = createStaticAnalysis({
        tablesWithVolumeData: 5,
        tablesWithChapterLinks: 5,
      });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBe(1.0);
    });
  });

  describe('no boost cases', () => {
    it('should not boost when no relevant analysis', () => {
      const entities = [createEntity('TITLE', 'One Piece', 0.8)];
      const analysis = createStaticAnalysis({});

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBeCloseTo(0.8, 10);
    });

    it('should not modify non-matching entity types', () => {
      const entities = [createEntity('GENRE', 'Action', 0.7)];
      const analysis = createStaticAnalysis({
        tablesWithVolumeData: 5,
        volumeHeaders: 5,
        hasIsbn: true,
      });

      const enhanced = enhanceWithStaticAnalysis(entities, analysis);

      expect(enhanced[0]?.confidence).toBe(0.7);
    });
  });
});

// ============================================================================
// countEntitiesFromLabels Tests
// ============================================================================

describe('countEntitiesFromLabels', () => {
  describe('basic counting', () => {
    it('should count single entity type', () => {
      const labels: BIOTag[] = ['B-TITLE', 'I-TITLE', 'O', 'O'];

      const counts = countEntitiesFromLabels(labels);

      expect(counts['TITLE']).toBe(1);
    });

    it('should count multiple entity types', () => {
      const labels: BIOTag[] = [
        'B-TITLE', 'I-TITLE',
        'O',
        'B-AUTHOR',
        'O',
        'B-STATUS',
      ];

      const counts = countEntitiesFromLabels(labels);

      expect(counts['TITLE']).toBe(1);
      expect(counts['AUTHOR']).toBe(1);
      expect(counts['STATUS']).toBe(1);
    });

    it('should count multiple instances of same type', () => {
      const labels: BIOTag[] = [
        'B-GENRE', 'O',
        'B-GENRE', 'O',
        'B-GENRE',
      ];

      const counts = countEntitiesFromLabels(labels);

      expect(counts['GENRE']).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should return empty object for no entities', () => {
      const labels: BIOTag[] = ['O', 'O', 'O', 'O'];

      const counts = countEntitiesFromLabels(labels);

      expect(Object.keys(counts).length).toBe(0);
    });

    it('should handle empty array', () => {
      const counts = countEntitiesFromLabels([]);

      expect(counts).toEqual({});
    });

    it('should only count B- tags, not I- tags', () => {
      const labels: BIOTag[] = ['B-TITLE', 'I-TITLE', 'I-TITLE'];

      const counts = countEntitiesFromLabels(labels);

      expect(counts['TITLE']).toBe(1);
    });
  });
});

// ============================================================================
// extractSpansFromLabels Tests
// ============================================================================

describe('extractSpansFromLabels', () => {
  describe('basic span extraction', () => {
    it('should extract single span', () => {
      const labels: BIOTag[] = ['B-TITLE', 'I-TITLE', 'O'];

      const spans = extractSpansFromLabels(labels);

      expect(spans.length).toBe(1);
      expect(spans[0]).toEqual({ start: 0, end: 1, entityType: 'TITLE' });
    });

    it('should extract multiple spans', () => {
      const labels: BIOTag[] = [
        'B-TITLE', 'I-TITLE', 'O',
        'B-AUTHOR', 'O',
        'B-STATUS',
      ];

      const spans = extractSpansFromLabels(labels);

      expect(spans.length).toBe(3);
      expect(spans[0]?.entityType).toBe('TITLE');
      expect(spans[1]?.entityType).toBe('AUTHOR');
      expect(spans[2]?.entityType).toBe('STATUS');
    });

    it('should handle consecutive different entities', () => {
      const labels: BIOTag[] = ['B-TITLE', 'B-AUTHOR', 'B-STATUS'];

      const spans = extractSpansFromLabels(labels);

      expect(spans.length).toBe(3);
      expect(spans[0]).toEqual({ start: 0, end: 0, entityType: 'TITLE' });
      expect(spans[1]).toEqual({ start: 1, end: 1, entityType: 'AUTHOR' });
      expect(spans[2]).toEqual({ start: 2, end: 2, entityType: 'STATUS' });
    });
  });

  describe('span boundaries', () => {
    it('should close span on O tag', () => {
      const labels: BIOTag[] = ['B-TITLE', 'I-TITLE', 'O', 'O'];

      const spans = extractSpansFromLabels(labels);

      expect(spans[0]?.end).toBe(1);
    });

    it('should close span on new B- tag', () => {
      const labels: BIOTag[] = ['B-TITLE', 'I-TITLE', 'B-AUTHOR'];

      const spans = extractSpansFromLabels(labels);

      expect(spans[0]?.end).toBe(1);
      expect(spans[1]?.start).toBe(2);
    });

    it('should close span on type mismatch in I- tag', () => {
      const labels: BIOTag[] = ['B-TITLE', 'I-AUTHOR'];

      const spans = extractSpansFromLabels(labels);

      // Type mismatch closes span without starting new
      expect(spans.length).toBe(1);
      expect(spans[0]?.end).toBe(0);
    });
  });

  describe('span at end', () => {
    it('should include span at end of sequence', () => {
      const labels: BIOTag[] = ['O', 'O', 'B-TITLE', 'I-TITLE'];

      const spans = extractSpansFromLabels(labels);

      expect(spans.length).toBe(1);
      expect(spans[0]).toEqual({ start: 2, end: 3, entityType: 'TITLE' });
    });

    it('should handle single B- at end', () => {
      const labels: BIOTag[] = ['O', 'O', 'B-STATUS'];

      const spans = extractSpansFromLabels(labels);

      expect(spans.length).toBe(1);
      expect(spans[0]).toEqual({ start: 2, end: 2, entityType: 'STATUS' });
    });
  });

  describe('edge cases', () => {
    it('should return empty array for all O tags', () => {
      const labels: BIOTag[] = ['O', 'O', 'O'];

      const spans = extractSpansFromLabels(labels);

      expect(spans).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      const spans = extractSpansFromLabels([]);

      expect(spans).toEqual([]);
    });

    it('should handle I- tag without B- tag', () => {
      const labels: BIOTag[] = ['I-TITLE', 'I-TITLE', 'O'];

      const spans = extractSpansFromLabels(labels);

      // I- without B- is ignored
      expect(spans.length).toBe(0);
    });
  });
});
