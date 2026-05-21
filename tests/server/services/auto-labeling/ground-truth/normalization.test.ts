/**
 * Normalization Tests
 *
 * Tests for normalizeForComparison and related normalization functions.
 *
 * @module tests/auto-labeling/ground-truth/normalization
 */

import { normalizeForComparison } from '@/server/services/auto-labeling/ground-truth';

// ============================================================================
// normalizeForComparison Tests
// ============================================================================

describe('normalizeForComparison', () => {
  describe('case normalization', () => {
    it('should convert uppercase to lowercase', () => {
      expect(normalizeForComparison('ONE PIECE')).toBe('one piece');
    });

    it('should convert mixed case to lowercase', () => {
      expect(normalizeForComparison('OnE PiEcE')).toBe('one piece');
    });

    it('should preserve already lowercase text', () => {
      expect(normalizeForComparison('one piece')).toBe('one piece');
    });
  });

  describe('whitespace handling', () => {
    it('should trim leading whitespace', () => {
      expect(normalizeForComparison('   one piece')).toBe('one piece');
    });

    it('should trim trailing whitespace', () => {
      expect(normalizeForComparison('one piece   ')).toBe('one piece');
    });

    it('should trim both leading and trailing whitespace', () => {
      expect(normalizeForComparison('   one piece   ')).toBe('one piece');
    });

    it('should collapse multiple spaces to single space', () => {
      expect(normalizeForComparison('one    piece')).toBe('one piece');
    });

    it('should handle tabs as whitespace', () => {
      expect(normalizeForComparison('one\tpiece')).toBe('one piece');
    });

    it('should handle newlines as whitespace', () => {
      expect(normalizeForComparison('one\npiece')).toBe('one piece');
    });

    it('should handle mixed whitespace', () => {
      expect(normalizeForComparison('one \t\n  piece')).toBe('one piece');
    });
  });

  describe('special character removal', () => {
    it('should remove exclamation marks', () => {
      expect(normalizeForComparison('One Piece!')).toBe('one piece');
    });

    it('should remove question marks', () => {
      expect(normalizeForComparison('One Piece?')).toBe('one piece');
    });

    it('should remove periods', () => {
      expect(normalizeForComparison('One Piece.')).toBe('one piece');
    });

    it('should remove commas', () => {
      expect(normalizeForComparison('One, Piece')).toBe('one piece');
    });

    it('should remove colons', () => {
      expect(normalizeForComparison('One: Piece')).toBe('one piece');
    });

    it('should remove semicolons', () => {
      expect(normalizeForComparison('One; Piece')).toBe('one piece');
    });

    it('should remove parentheses', () => {
      expect(normalizeForComparison('One (Piece)')).toBe('one piece');
    });

    it('should remove brackets', () => {
      expect(normalizeForComparison('One [Piece]')).toBe('one piece');
    });

    it('should remove curly braces', () => {
      expect(normalizeForComparison('One {Piece}')).toBe('one piece');
    });

    it('should remove quotes', () => {
      expect(normalizeForComparison('"One Piece"')).toBe('one piece');
    });

    it('should remove single quotes', () => {
      expect(normalizeForComparison("One's Piece")).toBe('ones piece');
    });

    it('should preserve hyphens', () => {
      expect(normalizeForComparison('Spider-Man')).toBe('spider-man');
    });

    it('should preserve numbers', () => {
      expect(normalizeForComparison('One Piece 2')).toBe('one piece 2');
    });

    it('should remove multiple special characters', () => {
      expect(normalizeForComparison('One!? Piece...')).toBe('one piece');
    });
  });

  describe('article word removal', () => {
    it('should remove leading "the"', () => {
      expect(normalizeForComparison('The One Piece')).toBe('one piece');
    });

    it('should remove leading "a"', () => {
      expect(normalizeForComparison('A Silent Voice')).toBe('silent voice');
    });

    it('should remove leading "an"', () => {
      expect(normalizeForComparison('An Attack on Titan')).toBe('attack on titan');
    });

    it('should remove "the" in the middle', () => {
      // "the" is removed as a word boundary match
      const result = normalizeForComparison('Attack the Titan');
      expect(result).toBe('attack  titan');
    });

    it('should not remove "the" when part of a word', () => {
      // "the" within "there" should not be removed
      expect(normalizeForComparison('There')).toBe('there');
    });
  });

  describe('empty and whitespace strings', () => {
    it('should return empty string for empty input', () => {
      expect(normalizeForComparison('')).toBe('');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(normalizeForComparison('   ')).toBe('');
    });

    it('should return empty string for special-characters-only input', () => {
      expect(normalizeForComparison('!@#$%')).toBe('');
    });
  });

  describe('unicode handling', () => {
    it('should preserve Japanese characters', () => {
      const result = normalizeForComparison('ワンピース');
      // Japanese characters are not word characters in default regex
      expect(result).toBe('');
    });

    it('should preserve accented Latin characters', () => {
      const result = normalizeForComparison('Café');
      expect(result).toBe('caf');
    });
  });

  describe('combined transformations', () => {
    it('should apply all transformations together', () => {
      const input = '  The ONE PIECE!  (Manga)  ';
      expect(normalizeForComparison(input)).toBe('one piece manga');
    });

    it('should handle complex title', () => {
      const input = 'Attack on Titan: The Final Season, Part 2';
      const result = normalizeForComparison(input);
      expect(result).toBe('attack on titan  final season part 2');
    });

    it('should handle author name format', () => {
      const input = 'Oda, Eiichiro';
      expect(normalizeForComparison(input)).toBe('oda eiichiro');
    });
  });

  describe('edge cases', () => {
    it('should handle very long input', () => {
      const longInput = 'word '.repeat(1000);
      const result = normalizeForComparison(longInput);
      expect(result).toContain('word');
    });

    it('should handle single character', () => {
      expect(normalizeForComparison('A')).toBe('');
    });

    it('should handle numeric-only input', () => {
      expect(normalizeForComparison('12345')).toBe('12345');
    });

    it('should handle year', () => {
      expect(normalizeForComparison('1997')).toBe('1997');
    });

    it('should handle status values', () => {
      expect(normalizeForComparison('Ongoing')).toBe('ongoing');
      expect(normalizeForComparison('Completed')).toBe('completed');
      expect(normalizeForComparison('On Hiatus')).toBe('on hiatus');
    });
  });
});
