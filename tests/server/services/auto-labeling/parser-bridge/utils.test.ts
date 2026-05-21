/**
 * Parser Bridge Utilities Tests
 *
 * Tests for normalizeEntityValue, normalizeStatusValue, mergeExtractions,
 * and mergeSourceSpecificEntities functions.
 *
 * @module tests/auto-labeling/parser-bridge/utils
 */

import { describe, it, expect } from 'bun:test';

import {
  normalizeEntityValue,
  normalizeStatusValue,
  mergeExtractions,
  mergeSourceSpecificEntities,
} from '@/server/services/auto-labeling/parser-bridge/utils';
import type { ExtractedEntity } from '@/server/services/auto-labeling/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createEntity(
  type: string,
  value: string,
  confidence: number,
  source: 'parser' | 'bootstrap' | 'static_analysis' | 'merged' = 'parser'
): ExtractedEntity {
  return {
    type: type as ExtractedEntity['type'],
    value,
    normalizedValue: normalizeEntityValue(value),
    confidence,
    source,
  };
}

// ============================================================================
// normalizeEntityValue Tests
// ============================================================================

describe('normalizeEntityValue', () => {
  describe('case normalization', () => {
    it('should convert to lowercase', () => {
      expect(normalizeEntityValue('ONE PIECE')).toBe('one piece');
    });

    it('should handle mixed case', () => {
      expect(normalizeEntityValue('OnE PiEcE')).toBe('one piece');
    });
  });

  describe('whitespace handling', () => {
    it('should trim leading whitespace', () => {
      expect(normalizeEntityValue('   Naruto')).toBe('naruto');
    });

    it('should trim trailing whitespace', () => {
      expect(normalizeEntityValue('Naruto   ')).toBe('naruto');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeEntityValue('One    Piece')).toBe('one piece');
    });

    it('should handle tabs', () => {
      expect(normalizeEntityValue('One\tPiece')).toBe('one piece');
    });

    it('should handle newlines', () => {
      expect(normalizeEntityValue('One\nPiece')).toBe('one piece');
    });
  });

  describe('special character removal', () => {
    it('should remove punctuation', () => {
      expect(normalizeEntityValue('One Piece!')).toBe('one piece');
    });

    it('should remove parentheses', () => {
      expect(normalizeEntityValue('Naruto (manga)')).toBe('naruto manga');
    });

    it('should remove quotes', () => {
      expect(normalizeEntityValue('"Attack on Titan"')).toBe('attack on titan');
    });

    it('should preserve hyphens', () => {
      expect(normalizeEntityValue('Spider-Man')).toBe('spider-man');
    });

    it('should preserve numbers', () => {
      expect(normalizeEntityValue('Chapter 107')).toBe('chapter 107');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(normalizeEntityValue('')).toBe('');
    });

    it('should handle whitespace only', () => {
      expect(normalizeEntityValue('   ')).toBe('');
    });

    it('should handle special chars only', () => {
      expect(normalizeEntityValue('!@#$%')).toBe('');
    });
  });
});

// ============================================================================
// normalizeStatusValue Tests
// ============================================================================

describe('normalizeStatusValue', () => {
  describe('ongoing status', () => {
    it('should normalize "Ongoing"', () => {
      expect(normalizeStatusValue('Ongoing')).toBe('ongoing');
    });

    it('should normalize "ONGOING"', () => {
      expect(normalizeStatusValue('ONGOING')).toBe('ongoing');
    });

    it('should normalize "Currently Running"', () => {
      expect(normalizeStatusValue('Currently Running')).toBe('ongoing');
    });

    it('should normalize "still ongoing"', () => {
      expect(normalizeStatusValue('still ongoing')).toBe('ongoing');
    });
  });

  describe('completed status', () => {
    it('should normalize "Completed"', () => {
      expect(normalizeStatusValue('Completed')).toBe('completed');
    });

    it('should normalize "Finished"', () => {
      expect(normalizeStatusValue('Finished')).toBe('completed');
    });

    it('should normalize "Series completed"', () => {
      expect(normalizeStatusValue('Series completed')).toBe('completed');
    });
  });

  describe('hiatus status', () => {
    it('should normalize "On Hiatus"', () => {
      expect(normalizeStatusValue('On Hiatus')).toBe('hiatus');
    });

    it('should normalize "Hiatus"', () => {
      expect(normalizeStatusValue('Hiatus')).toBe('hiatus');
    });

    it('should normalize "currently on hiatus"', () => {
      expect(normalizeStatusValue('currently on hiatus')).toBe('hiatus');
    });
  });

  describe('cancelled status', () => {
    it('should normalize "Cancelled"', () => {
      expect(normalizeStatusValue('Cancelled')).toBe('cancelled');
    });

    it('should normalize "Canceled" (US spelling)', () => {
      expect(normalizeStatusValue('Canceled')).toBe('cancelled');
    });

    it('should normalize "Series cancelled"', () => {
      expect(normalizeStatusValue('Series cancelled')).toBe('cancelled');
    });
  });

  describe('unknown status', () => {
    it('should return normalized unknown status', () => {
      expect(normalizeStatusValue('Unknown')).toBe('unknown');
    });

    it('should return normalized custom status', () => {
      expect(normalizeStatusValue('Indefinite Break')).toBe('indefinite break');
    });

    it('should handle empty string', () => {
      expect(normalizeStatusValue('')).toBe('');
    });
  });
});

// ============================================================================
// mergeExtractions Tests
// ============================================================================

describe('mergeExtractions', () => {
  describe('basic merging', () => {
    it('should combine entities from all sources', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('AUTHOR', 'Eiichiro Oda', 0.8, 'bootstrap')];
      const staticEnt = [createEntity('STATUS', 'Ongoing', 0.7, 'static_analysis')];

      const merged = mergeExtractions(parser, bootstrap, staticEnt);

      expect(merged.length).toBe(3);
      expect(merged.find(e => e.type === 'TITLE')).toBeDefined();
      expect(merged.find(e => e.type === 'AUTHOR')).toBeDefined();
      expect(merged.find(e => e.type === 'STATUS')).toBeDefined();
    });

    it('should handle empty arrays', () => {
      const merged = mergeExtractions([], [], []);
      expect(merged).toEqual([]);
    });

    it('should handle single source', () => {
      const parser = [createEntity('TITLE', 'Naruto', 0.9, 'parser')];
      const merged = mergeExtractions(parser, [], []);

      expect(merged.length).toBe(1);
    });
  });

  describe('deduplication', () => {
    it('should keep highest confidence for duplicate type+value', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('TITLE', 'One Piece', 0.95, 'bootstrap')];

      const merged = mergeExtractions(parser, bootstrap, []);

      expect(merged.length).toBe(1);
      expect(merged[0]?.confidence).toBe(0.95);
    });

    it('should keep both if values differ', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('TITLE', 'ONE PIECE', 0.8, 'bootstrap')];

      const merged = mergeExtractions(parser, bootstrap, []);

      // Both normalize to same value, so should be merged
      expect(merged.length).toBe(1);
      expect(merged[0]?.confidence).toBe(0.9);
    });

    it('should keep multiple entities of different types', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('AUTHOR', 'One Piece', 0.8, 'bootstrap')];

      const merged = mergeExtractions(parser, bootstrap, []);

      expect(merged.length).toBe(2);
    });
  });

  describe('sorting', () => {
    it('should sort by type then confidence', () => {
      const entities = [
        createEntity('TITLE', 'Bleach', 0.5, 'parser'),
        createEntity('AUTHOR', 'Tite Kubo', 0.9, 'parser'),
        createEntity('TITLE', 'Attack on Titan', 0.9, 'parser'),
      ];

      const merged = mergeExtractions(entities, [], []);

      expect(merged[0]?.type).toBe('AUTHOR');
      // TITLE entities are merged by normalizedValue
    });
  });

  describe('source marking', () => {
    it('should mark merged entities when duplicates exist', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const bootstrap = [createEntity('TITLE', 'One Piece', 0.95, 'bootstrap')];

      const merged = mergeExtractions(parser, bootstrap, []);

      expect(merged[0]?.source).toBe('merged');
    });

    it('should keep original source when no duplicates', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9, 'parser')];
      const merged = mergeExtractions(parser, [], []);

      expect(merged[0]?.source).toBe('parser');
    });
  });
});

// ============================================================================
// mergeSourceSpecificEntities Tests
// ============================================================================

describe('mergeSourceSpecificEntities', () => {
  describe('basic merging', () => {
    it('should combine parser and source entities', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9)];
      const source = [createEntity('PUBLISHER', 'Shueisha', 0.8)];

      const merged = mergeSourceSpecificEntities(parser, source);

      expect(merged.length).toBe(2);
    });

    it('should handle empty source entities', () => {
      const parser = [createEntity('TITLE', 'One Piece', 0.9)];
      const merged = mergeSourceSpecificEntities(parser, []);

      expect(merged.length).toBe(1);
    });

    it('should handle empty parser entities', () => {
      const source = [createEntity('PUBLISHER', 'Shueisha', 0.8)];
      const merged = mergeSourceSpecificEntities([], source);

      expect(merged.length).toBe(1);
    });
  });

  describe('type overriding', () => {
    it('should prefer source entities over parser for same type', () => {
      const parser = [createEntity('TITLE', 'Parser Title', 0.95)];
      const source = [createEntity('TITLE', 'Source Title', 0.8)];

      const merged = mergeSourceSpecificEntities(parser, source);

      expect(merged.length).toBe(1);
      expect(merged[0]?.value).toBe('Source Title');
    });

    it('should filter out all parser entities of conflicting types', () => {
      const parser = [
        createEntity('TITLE', 'Parser Title 1', 0.9),
        createEntity('TITLE', 'Parser Title 2', 0.8),
      ];
      const source = [createEntity('TITLE', 'Source Title', 0.7)];

      const merged = mergeSourceSpecificEntities(parser, source);

      expect(merged.length).toBe(1);
      expect(merged[0]?.value).toBe('Source Title');
    });

    it('should keep parser entities of non-conflicting types', () => {
      const parser = [
        createEntity('TITLE', 'Parser Title', 0.9),
        createEntity('AUTHOR', 'Parser Author', 0.8),
      ];
      const source = [createEntity('TITLE', 'Source Title', 0.7)];

      const merged = mergeSourceSpecificEntities(parser, source);

      expect(merged.length).toBe(2);
      expect(merged.find(e => e.type === 'TITLE')?.value).toBe('Source Title');
      expect(merged.find(e => e.type === 'AUTHOR')?.value).toBe('Parser Author');
    });
  });

  describe('ordering', () => {
    it('should place source entities first', () => {
      const parser = [createEntity('AUTHOR', 'Author', 0.9)];
      const source = [createEntity('PUBLISHER', 'Publisher', 0.8)];

      const merged = mergeSourceSpecificEntities(parser, source);

      expect(merged[0]?.type).toBe('PUBLISHER');
      expect(merged[1]?.type).toBe('AUTHOR');
    });
  });

  describe('edge cases', () => {
    it('should handle both empty', () => {
      const merged = mergeSourceSpecificEntities([], []);
      expect(merged).toEqual([]);
    });

    it('should handle multiple source types', () => {
      const parser = [
        createEntity('TITLE', 'T1', 0.9),
        createEntity('AUTHOR', 'A1', 0.8),
        createEntity('STATUS', 'S1', 0.7),
      ];
      const source = [
        createEntity('TITLE', 'T2', 0.6),
        createEntity('STATUS', 'S2', 0.5),
      ];

      const merged = mergeSourceSpecificEntities(parser, source);

      expect(merged.length).toBe(3);
      expect(merged.find(e => e.type === 'TITLE')?.value).toBe('T2');
      expect(merged.find(e => e.type === 'AUTHOR')?.value).toBe('A1');
      expect(merged.find(e => e.type === 'STATUS')?.value).toBe('S2');
    });
  });
});
