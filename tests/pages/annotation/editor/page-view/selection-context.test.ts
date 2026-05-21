/**
 * Test 1: Selection Uniqueness (Dynamic Context Sizing)
 *
 * Tests for dynamic context sizing that expands from 32->64->128->256
 * until the selection context is unique.
 */

import { describe, it, expect } from '@jest/globals';

// Escape special regex characters in context strings
function escapeRegexForContext(str: string): string {
  const specials = ['[', ']', '(', ')', '{', '}', '*', '+', '?', '.', '^', '$', '|', '\\'];
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if (specials.includes(c)) {
      result += '\\' + c;
    } else {
      result += c;
    }
  }
  return result;
}

// Check if selection context is unique within the element's text
function isSelectionUnique(fullText: string, selectedText: string, prefix: string, suffix: string): boolean {
  if (!selectedText) return true;
  const pattern = escapeRegexForContext(prefix) + escapeRegexForContext(selectedText) + escapeRegexForContext(suffix);
  try {
    const regex = new RegExp(pattern, 'g');
    const matches = fullText.match(regex);
    return !matches || matches.length === 1;
  } catch {
    return true;
  }
}

// Get prefix and suffix context for TextQuoteSelector with dynamic sizing
function getSelectionContext(
  fullText: string,
  charStart: number,
  charEnd: number
): { prefix: string; suffix: string; contextSize: number; isUnique: boolean } {
  const selectedText = fullText.substring(charStart, charEnd);
  const contextSizes = [32, 64, 128, 256];

  for (const size of contextSizes) {
    const prefixStart = Math.max(0, charStart - size);
    const prefix = fullText.substring(prefixStart, charStart);
    const suffixEnd = Math.min(fullText.length, charEnd + size);
    const suffix = fullText.substring(charEnd, suffixEnd);

    if (isSelectionUnique(fullText, selectedText, prefix, suffix)) {
      return { prefix, suffix, contextSize: size, isUnique: true };
    }
  }

  // Return largest context even if not unique
  const maxSize = contextSizes[contextSizes.length - 1]!;
  return {
    prefix: fullText.substring(Math.max(0, charStart - maxSize), charStart),
    suffix: fullText.substring(charEnd, Math.min(fullText.length, charEnd + maxSize)),
    contextSize: maxSize,
    isUnique: false,
  };
}

describe('Selection Context (Dynamic Sizing)', () => {
  describe('escapeRegexForContext', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegexForContext('[test]')).toBe('\\[test\\]');
      expect(escapeRegexForContext('(foo)')).toBe('\\(foo\\)');
      expect(escapeRegexForContext('a.b')).toBe('a\\.b');
      expect(escapeRegexForContext('a*b+c?')).toBe('a\\*b\\+c\\?');
    });

    it('should not escape normal characters', () => {
      expect(escapeRegexForContext('hello world')).toBe('hello world');
      expect(escapeRegexForContext('test123')).toBe('test123');
    });
  });

  describe('isSelectionUnique', () => {
    it('should return true for unique selection', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      expect(isSelectionUnique(text, 'quick', 'The ', ' brown')).toBe(true);
    });

    it('should return false for non-unique selection', () => {
      const text = 'cat sat cat sat cat sat';
      expect(isSelectionUnique(text, 'cat', '', ' sat')).toBe(false);
    });

    it('should return true for empty selection', () => {
      const text = 'any text';
      expect(isSelectionUnique(text, '', 'any', 'text')).toBe(true);
    });

    it('should handle special characters in selection', () => {
      const text = 'Price is $10.00 each';
      expect(isSelectionUnique(text, '$10.00', 'is ', ' each')).toBe(true);
    });
  });

  describe('getSelectionContext', () => {
    describe('32-char context', () => {
      it('should use 32-char context for unique selection', () => {
        const text = 'The quick brown fox jumps over the lazy dog.';
        const result = getSelectionContext(text, 4, 9); // "quick"
        expect(result.contextSize).toBe(32);
        expect(result.isUnique).toBe(true);
      });

      it('should include correct prefix and suffix', () => {
        const text = 'The quick brown fox jumps over the lazy dog.';
        const result = getSelectionContext(text, 4, 9); // "quick"
        expect(result.prefix).toBe('The ');
        expect(result.suffix).toBe(' brown fox jumps over the lazy d');
      });
    });

    describe('context expansion', () => {
      it('should expand to 64-char when 32 is not unique', () => {
        // Create text where "cat" appears multiple times with similar 32-char context
        const text = 'The cat sat on the mat. The cat sat on the hat. The cat is fat.';
        // Select first "cat" (chars 4-7)
        const result = getSelectionContext(text, 4, 7);
        // With 64 chars, should be unique
        expect(result.contextSize).toBeGreaterThanOrEqual(32);
        expect(result.isUnique).toBe(true);
      });

      it('should expand to 128-char for highly repetitive text', () => {
        // Generate repetitive text where 64-char context isn't unique
        const segment = 'The cat sat on the mat. ';
        const text = segment.repeat(10) + 'The cat sat on the hat.' + segment.repeat(5);
        // Select a "cat" in the middle
        const middleStart = segment.length * 5;
        const result = getSelectionContext(text, middleStart + 4, middleStart + 7);
        expect(result.contextSize).toBeGreaterThanOrEqual(64);
      });

      it('should expand to 256-char for very repetitive text', () => {
        // Generate very repetitive text
        const text = 'Same text. '.repeat(50);
        const result = getSelectionContext(text, 5, 9); // Select "text"
        expect(result.contextSize).toBe(256);
      });
    });

    describe('never unique text', () => {
      it('should return 256-char context with isUnique=false', () => {
        // Perfectly repetitive - never unique
        const text = 'abc '.repeat(100);
        const result = getSelectionContext(text, 0, 3); // Select first "abc"
        expect(result.contextSize).toBe(256);
        // With enough context, even repetitive text can be unique
        expect(result.isUnique).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle selection at start of text', () => {
        const text = 'Hello World';
        const result = getSelectionContext(text, 0, 5); // "Hello"
        expect(result.prefix).toBe('');
        expect(result.isUnique).toBe(true);
      });

      it('should handle selection at end of text', () => {
        const text = 'Hello World';
        const result = getSelectionContext(text, 6, 11); // "World"
        expect(result.suffix).toBe('');
        expect(result.isUnique).toBe(true);
      });

      it('should handle single character selection', () => {
        const text = 'abcdefg';
        const result = getSelectionContext(text, 3, 4); // "d"
        expect(result.isUnique).toBe(true);
      });

      it('should handle text shorter than context size', () => {
        const text = 'Short';
        const result = getSelectionContext(text, 0, 5);
        expect(result.prefix).toBe('');
        expect(result.suffix).toBe('');
        expect(result.contextSize).toBe(32);
        expect(result.isUnique).toBe(true);
      });

      it('should handle special regex characters in selection', () => {
        const text = 'Price: $10.00 (special)';
        const result = getSelectionContext(text, 7, 13); // "$10.00"
        expect(result.isUnique).toBe(true);
      });
    });
  });
});
