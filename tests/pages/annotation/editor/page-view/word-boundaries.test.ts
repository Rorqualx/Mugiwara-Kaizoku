/**
 * Test 2: Word Boundary Detection (Abbreviations)
 *
 * Tests for word boundary detection that handles abbreviations like "Vol.", "Dr.", etc.
 * These functions are injected into iframes, so we test them by defining them inline.
 */

import { describe, it, expect } from '@jest/globals';

// Common abbreviations that shouldn't break word boundaries
const ABBREVIATIONS = ['vol', 'dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'st', 'no', 'ch', 'pt', 'vs', 'etc', 'fig', 'inc', 'ltd', 'corp', 'prof', 'gen', 'col', 'lt', 'sgt', 'rev', 'hon', 'gov', 'pres', 'sen', 'rep'];

// Extend word end to include abbreviation and following number (e.g., "Vol. 1")
function extendForAbbreviation(text: string, word: string, end: number): number {
  if (text.charAt(end) !== '.') return end;
  if (!ABBREVIATIONS.includes(word.toLowerCase())) return end;

  let extendedEnd = end + 1;
  while (extendedEnd < text.length && text.charAt(extendedEnd) === ' ') extendedEnd++;
  while (extendedEnd < text.length && /\d/.test(text.charAt(extendedEnd))) extendedEnd++;
  return extendedEnd;
}

// Get word boundaries using regex (fallback from Intl.Segmenter)
function getWordBoundariesWithRegex(text: string, offset: number): { start: number; end: number } {
  let start = offset;
  let end = offset;
  const charAtOffset = text.charAt(offset);
  const cjkRegex = /[\u3000-\u9fff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/;
  const isCJK = cjkRegex.test(charAtOffset);

  if (isCJK) {
    while (start > 0 && cjkRegex.test(text.charAt(start - 1))) start--;
    while (end < text.length && cjkRegex.test(text.charAt(end))) end++;
  } else {
    const wordRegex = /[\w\u00C0-\u024F'-]/;
    while (start > 0 && wordRegex.test(text.charAt(start - 1))) start--;
    while (end < text.length && wordRegex.test(text.charAt(end))) end++;
    const word = text.substring(start, end);
    end = extendForAbbreviation(text, word, end);
  }

  return { start, end };
}

describe('Word Boundary Detection', () => {
  describe('extendForAbbreviation', () => {
    it('should extend "Vol" to include period and number', () => {
      // "Read Vol. 1 first."
      //  01234567890123456789
      //       Vol.X1
      // "Vol" is at 5-7, end=8, "." at 8, " " at 9, "1" at 10
      const text = 'Read Vol. 1 first.';
      const word = 'Vol';
      const end = 8; // Position after "Vol" (exclusive end)
      expect(extendForAbbreviation(text, word, end)).toBe(11); // After "Vol. 1"
    });

    it('should extend "Ch" to include period and number', () => {
      // "See Ch. 5 for details."
      //  0123456789...
      //      Ch.X5
      // "Ch" is at 4-5, end=6, "." at 6, " " at 7, "5" at 8
      const text = 'See Ch. 5 for details.';
      const word = 'Ch';
      const end = 6; // Position after "Ch"
      expect(extendForAbbreviation(text, word, end)).toBe(9); // After "Ch. 5"
    });

    it('should extend "Dr" to include period only (no number)', () => {
      // "Dr. Stone"
      //  012345678
      // "Dr" is at 0-1, end=2, "." at 2, " " at 3
      const text = 'Dr. Stone';
      const word = 'Dr';
      const end = 2; // Position after "Dr"
      expect(extendForAbbreviation(text, word, end)).toBe(4); // After "Dr. "
    });

    it('should not extend non-abbreviations', () => {
      const text = 'The. end.';
      const word = 'The';
      const end = 3; // Position after "The"
      expect(extendForAbbreviation(text, word, end)).toBe(3); // No change
    });

    it('should not extend when no period follows', () => {
      const text = 'Vol 1 is great.';
      const word = 'Vol';
      const end = 3; // Position after "Vol"
      expect(extendForAbbreviation(text, word, end)).toBe(3); // No change
    });

    it('should be case-insensitive', () => {
      // "VOL. 1"
      //  012345
      const text = 'VOL. 1';
      const word = 'VOL';
      const end = 3; // Position after "VOL"
      expect(extendForAbbreviation(text, word, end)).toBe(6);
    });

    it('should handle multiple spaces before number', () => {
      // "Vol.  5 test"
      //  0123456789
      const text = 'Vol.  5 test';
      const word = 'Vol';
      const end = 3; // Position after "Vol"
      expect(extendForAbbreviation(text, word, end)).toBe(7); // After "Vol.  5"
    });

    it('should handle multi-digit numbers', () => {
      // "Vol. 123 test"
      //  01234567890
      const text = 'Vol. 123 test';
      const word = 'Vol';
      const end = 3; // Position after "Vol"
      expect(extendForAbbreviation(text, word, end)).toBe(8); // After "Vol. 123"
    });
  });

  describe('getWordBoundariesWithRegex', () => {
    describe('Latin text', () => {
      it('should find word boundaries for simple word', () => {
        const text = 'Hello World';
        const result = getWordBoundariesWithRegex(text, 2); // Click on "l" in "Hello"
        expect(text.substring(result.start, result.end)).toBe('Hello');
      });

      it('should find "Vol. 1" as single unit', () => {
        const text = 'Read Vol. 1 first';
        const result = getWordBoundariesWithRegex(text, 5); // Click on "V"
        expect(text.substring(result.start, result.end)).toBe('Vol. 1');
      });

      it('should find "Dr." as abbreviation', () => {
        const text = 'Dr. Stone';
        const result = getWordBoundariesWithRegex(text, 0); // Click on "D"
        // Dr. with trailing space since no number follows
        expect(text.substring(result.start, result.end)).toBe('Dr. ');
      });

      it('should not extend regular words with period', () => {
        const text = 'cat. dog';
        const result = getWordBoundariesWithRegex(text, 0); // Click on "c"
        expect(text.substring(result.start, result.end)).toBe('cat');
      });

      it('should handle hyphenated words', () => {
        const text = 'self-aware robot';
        const result = getWordBoundariesWithRegex(text, 2); // Click on "l"
        expect(text.substring(result.start, result.end)).toBe('self-aware');
      });

      it('should handle contractions', () => {
        const text = "don't stop";
        const result = getWordBoundariesWithRegex(text, 2); // Click on "n"
        expect(text.substring(result.start, result.end)).toBe("don't");
      });

      it('should handle accented characters', () => {
        const text = 'café latté';
        const result = getWordBoundariesWithRegex(text, 2); // Click on "f"
        expect(text.substring(result.start, result.end)).toBe('café');
      });
    });

    describe('CJK text', () => {
      it('should find boundaries in Japanese text', () => {
        const text = 'ワンピース';
        const result = getWordBoundariesWithRegex(text, 0);
        expect(text.substring(result.start, result.end)).toBe('ワンピース');
      });

      it('should find boundaries in Chinese text', () => {
        const text = '海贼王漫画';
        const result = getWordBoundariesWithRegex(text, 2);
        expect(text.substring(result.start, result.end)).toBe('海贼王漫画');
      });

      it('should find boundaries in Korean text', () => {
        const text = '원피스만화';
        const result = getWordBoundariesWithRegex(text, 2);
        expect(text.substring(result.start, result.end)).toBe('원피스만화');
      });

      it('should handle mixed CJK and Latin', () => {
        const text = 'One Piece ワンピース';
        // Click on Latin part
        const latinResult = getWordBoundariesWithRegex(text, 0);
        expect(text.substring(latinResult.start, latinResult.end)).toBe('One');

        // Click on CJK part
        const cjkResult = getWordBoundariesWithRegex(text, 10);
        expect(text.substring(cjkResult.start, cjkResult.end)).toBe('ワンピース');
      });
    });

    describe('edge cases', () => {
      it('should handle click at start of text', () => {
        const text = 'Hello';
        const result = getWordBoundariesWithRegex(text, 0);
        expect(result.start).toBe(0);
        expect(text.substring(result.start, result.end)).toBe('Hello');
      });

      it('should handle click at end of word', () => {
        const text = 'Hello World';
        const result = getWordBoundariesWithRegex(text, 4); // Last char of "Hello"
        expect(text.substring(result.start, result.end)).toBe('Hello');
      });

      it('should handle single character word', () => {
        const text = 'I am here';
        const result = getWordBoundariesWithRegex(text, 0);
        expect(text.substring(result.start, result.end)).toBe('I');
      });

      it('should handle numbers', () => {
        const text = 'Chapter 123';
        const result = getWordBoundariesWithRegex(text, 8);
        expect(text.substring(result.start, result.end)).toBe('123');
      });

      it('should expand from whitespace to find previous word', () => {
        const text = 'Hello World';
        const result = getWordBoundariesWithRegex(text, 5); // The space
        // Whitespace doesn't match wordRegex, so boundaries stay at click point
        expect(result.start).toBe(0); // Expands to find "Hello"
        expect(result.end).toBe(5); // Stops at space
      });
    });
  });
});
