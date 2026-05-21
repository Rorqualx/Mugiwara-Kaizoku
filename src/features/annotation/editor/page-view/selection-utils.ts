/**
 * Selection Utilities
 *
 * Pure functions for text selection processing, word/sentence boundary detection,
 * and context extraction. These functions are used both in unit tests and
 * as reference implementations for the iframe-injected JavaScript in helpers.ts.
 *
 * Note: The functions in helpers.ts are template literals that get injected into
 * iframes. They cannot import from this module directly but should mirror this logic.
 */

// ============================================================================
// Imports - Shared text processing utilities
// ============================================================================

import {
  ABBREVIATIONS,
  ABBREVIATIONS_UNIFIED,
  isSentenceAbbreviation as sharedIsSentenceAbbreviation,
  isEllipsis as sharedIsEllipsis,
} from '@/lib/text-processing';

// Re-export for backward compatibility
export { ABBREVIATIONS, ABBREVIATIONS_UNIFIED };

// ============================================================================
// Constants
// ============================================================================

/**
 * Context sizes used for dynamic expansion (32 → 64 → 128 → 256 chars)
 */
export const CONTEXT_SIZES = [32, 64, 128, 256] as const;

// ============================================================================
// Types
// ============================================================================

export interface SelectionContextResult {
  /** Prefix text before the selection */
  prefix: string;
  /** Suffix text after the selection */
  suffix: string;
  /** The context size that was used (32, 64, 128, or 256) */
  contextSize: number;
  /** Whether the selection is unique within the full text using this context */
  isUnique: boolean;
}

export interface SentenceContextResult {
  /** The extracted sentence */
  sentence: string;
  /** Start character position of the sentence in the full text */
  sentenceStart: number;
  /** End character position of the sentence in the full text */
  sentenceEnd: number;
}

export interface WordBoundaryResult {
  /** Start character position of the word */
  start: number;
  /** End character position of the word */
  end: number;
}

// ============================================================================
// Selection Context Functions
// ============================================================================

/**
 * Escapes special regex characters in a string for use in context matching.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
export function escapeRegexForContext(str: string): string {
  if (!str) return '';
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

/**
 * Checks if a selection with given context is unique within the full text.
 *
 * @param fullText - The complete text to search within
 * @param selectedText - The selected text
 * @param prefix - The prefix context
 * @param suffix - The suffix context
 * @returns True if the selection with context appears exactly once
 */
export function isSelectionUnique(
  fullText: string,
  selectedText: string,
  prefix: string,
  suffix: string
): boolean {
  if (!selectedText) return true;
  const pattern =
    escapeRegexForContext(prefix) + escapeRegexForContext(selectedText) + escapeRegexForContext(suffix);
  try {
    const regex = new RegExp(pattern, 'g');
    const matches = fullText.match(regex);
    return !matches || matches.length === 1;
  } catch {
    return true;
  }
}

/**
 * Gets prefix and suffix context for a selection with dynamic sizing.
 * Increases context size (32 → 64 → 128 → 256) until selection is unique.
 *
 * @param fullText - The complete text
 * @param charStart - Start character position of the selection
 * @param charEnd - End character position of the selection
 * @returns The context result with prefix, suffix, size, and uniqueness flag
 */
export function getSelectionContext(
  fullText: string,
  charStart: number,
  charEnd: number
): SelectionContextResult {
  const selectedText = fullText.substring(charStart, charEnd);

  for (const size of CONTEXT_SIZES) {
    const prefixStart = Math.max(0, charStart - size);
    const prefix = fullText.substring(prefixStart, charStart);
    const suffixEnd = Math.min(fullText.length, charEnd + size);
    const suffix = fullText.substring(charEnd, suffixEnd);

    if (isSelectionUnique(fullText, selectedText, prefix, suffix)) {
      return { prefix, suffix, contextSize: size, isUnique: true };
    }
  }

  // Return largest context even if not unique
  const maxSize = CONTEXT_SIZES[CONTEXT_SIZES.length - 1] ?? 256;
  return {
    prefix: fullText.substring(Math.max(0, charStart - maxSize), charStart),
    suffix: fullText.substring(charEnd, Math.min(fullText.length, charEnd + maxSize)),
    contextSize: maxSize,
    isUnique: false,
  };
}

// ============================================================================
// Sentence Boundary Functions
// ============================================================================

/**
 * Checks if a period at a given position is part of an abbreviation.
 *
 * @param text - The full text
 * @param dotIndex - The position of the period
 * @returns True if the period is part of an abbreviation
 */
export function isSentenceAbbreviation(text: string, dotIndex: number): boolean {
  return sharedIsSentenceAbbreviation(text, dotIndex, ABBREVIATIONS_UNIFIED);
}

/**
 * Checks if a period at a given position is part of an ellipsis (... or ..).
 *
 * @param text - The full text
 * @param dotIndex - The position of the period
 * @returns True if the period is part of an ellipsis (2+ consecutive dots)
 */
export function isEllipsis(text: string, dotIndex: number): boolean {
  return sharedIsEllipsis(text, dotIndex);
}

/**
 * Extracts the sentence containing a selection, respecting abbreviations and ellipsis.
 *
 * @param fullText - The complete text
 * @param charStart - Start character position of the selection
 * @param charEnd - End character position of the selection
 * @returns The extracted sentence with its boundaries
 */
export function extractSentenceContext(
  fullText: string,
  charStart: number,
  charEnd: number
): SentenceContextResult {
  let sentenceStart = charStart;
  while (sentenceStart > 0) {
    const prevChar = fullText.charAt(sentenceStart - 1);
    if (prevChar === '.' || prevChar === '!' || prevChar === '?') {
      if (prevChar === '.' && isSentenceAbbreviation(fullText, sentenceStart - 1)) {
        sentenceStart--;
        continue;
      }
      if (prevChar === '.' && isEllipsis(fullText, sentenceStart - 1)) {
        sentenceStart--;
        continue;
      }
      break;
    }
    sentenceStart--;
  }

  let sentenceEnd = charEnd;
  while (sentenceEnd < fullText.length) {
    const currChar = fullText.charAt(sentenceEnd);
    if (currChar === '.' || currChar === '!' || currChar === '?') {
      if (currChar === '.' && isSentenceAbbreviation(fullText, sentenceEnd)) {
        sentenceEnd++;
        continue;
      }
      if (currChar === '.' && isEllipsis(fullText, sentenceEnd)) {
        sentenceEnd++;
        continue;
      }
      sentenceEnd++;
      break;
    }
    sentenceEnd++;
  }

  return {
    sentence: fullText.substring(sentenceStart, sentenceEnd).trim(),
    sentenceStart,
    sentenceEnd,
  };
}

// ============================================================================
// Word Boundary Functions
// ============================================================================

/**
 * Extends word end to include abbreviation period and following number.
 * For example, "Vol" + "." + " " + "1" → "Vol. 1"
 *
 * @param text - The full text
 * @param word - The word to check for abbreviation
 * @param end - The current end position (exclusive)
 * @returns The extended end position if abbreviation, otherwise original end
 */
export function extendForAbbreviation(text: string, word: string, end: number): number {
  if (text.charAt(end) !== '.') return end;
  if (!ABBREVIATIONS.includes(word.toLowerCase())) return end;

  let extendedEnd = end + 1; // Include period
  while (extendedEnd < text.length && text.charAt(extendedEnd) === ' ') {
    extendedEnd++; // Skip spaces
  }
  while (extendedEnd < text.length && /\d/.test(text.charAt(extendedEnd))) {
    extendedEnd++; // Include digits
  }
  return extendedEnd;
}

/**
 * Gets word boundaries at a given character offset using regex-based detection.
 * Handles both Latin text (with abbreviation extension) and CJK text.
 *
 * @param text - The full text
 * @param offset - The character offset to find boundaries for
 * @returns The start and end positions of the word
 */
export function getWordBoundaries(text: string, offset: number): WordBoundaryResult {
  let start = offset;
  let end = offset;
  const charAtOffset = text.charAt(offset);

  // CJK character ranges
  const cjkRegex = /[\u3000-\u9fff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/;
  const isCJK = cjkRegex.test(charAtOffset);

  if (isCJK) {
    // For CJK, find contiguous CJK characters
    while (start > 0 && cjkRegex.test(text.charAt(start - 1))) {
      start--;
    }
    while (end < text.length && cjkRegex.test(text.charAt(end))) {
      end++;
    }
  } else {
    // For Latin text, use word character regex with diacritics support
    const wordRegex = /[\w\u00C0-\u024F'-]/;
    while (start > 0 && wordRegex.test(text.charAt(start - 1))) {
      start--;
    }
    while (end < text.length && wordRegex.test(text.charAt(end))) {
      end++;
    }
    // Extend for abbreviations (e.g., "Vol. 1")
    const word = text.substring(start, end);
    end = extendForAbbreviation(text, word, end);
  }

  return { start, end };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if text contains CJK (Chinese, Japanese, Korean) characters.
 *
 * @param text - The text to check
 * @returns True if the text contains CJK characters
 */
export function hasCJKCharacters(text: string): boolean {
  const cjkRegex = /[\u3000-\u9fff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/;
  return cjkRegex.test(text);
}

/**
 * Detects the likely locale of text based on character analysis.
 * Used for selecting appropriate word segmentation rules.
 *
 * @param text - The text to analyze
 * @returns The detected locale code ('ja', 'ko', 'zh', or 'en')
 */
export function detectLocale(text: string): 'ja' | 'ko' | 'zh' | 'en' {
  // Check for Japanese (Hiragana or Katakana presence strongly indicates Japanese)
  const hasHiragana = /[\u3040-\u309f]/.test(text);
  const hasKatakana = /[\u30a0-\u30ff]/.test(text);
  if (hasHiragana || hasKatakana) {
    return 'ja';
  }

  // Check for Korean
  const hasKorean = /[\uac00-\ud7af]/.test(text);
  if (hasKorean) {
    return 'ko';
  }

  // Check for Chinese (Han characters without Kana)
  const hasHan = /[\u4e00-\u9fff]/.test(text);
  if (hasHan) {
    return 'zh';
  }

  return 'en';
}
