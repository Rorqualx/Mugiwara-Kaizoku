/**
 * Sentence Boundary Detection Helpers
 *
 * Shared functions for detecting sentence boundaries, handling abbreviations,
 * and identifying ellipsis patterns. These functions are used by both:
 * - Client: Character-based sentence extraction in selection-utils.ts
 * - Server: Token-based sentence extraction in helpers.ts
 *
 * @module lib/text-processing/sentence-helpers
 */

import { ABBREVIATIONS_UNIFIED } from './abbreviations';

import type { SentenceEndOptions } from './types';

/**
 * Check if a period at a given position is part of an abbreviation.
 *
 * Looks backward from the period to find the preceding word,
 * then checks if it's a known abbreviation.
 *
 * @param text - The full text
 * @param dotIndex - The position of the period
 * @param abbreviations - Optional custom abbreviations set
 * @returns True if the period is part of an abbreviation
 *
 * @example
 * ```ts
 * isSentenceAbbreviation("Dr. Smith", 2); // true (Dr.)
 * isSentenceAbbreviation("Hello.", 5);    // false
 * ```
 */
export function isSentenceAbbreviation(
  text: string,
  dotIndex: number,
  abbreviations: Set<string> = ABBREVIATIONS_UNIFIED
): boolean {
  const wordEnd = dotIndex;
  let wordStart = dotIndex;

  // Walk backward to find word start
  while (wordStart > 0 && /[a-zA-Z]/.test(text.charAt(wordStart - 1))) {
    wordStart--;
  }

  const word = text.substring(wordStart, wordEnd).toLowerCase();
  return abbreviations.has(word);
}

/**
 * Check if a period at a given position is part of an ellipsis.
 *
 * An ellipsis is defined as 2 or more consecutive periods.
 *
 * @param text - The full text
 * @param dotIndex - The position of the period to check
 * @returns True if the period is part of an ellipsis (2+ consecutive dots)
 *
 * @example
 * ```ts
 * isEllipsis("Wait...", 4);  // true
 * isEllipsis("Wait..", 4);   // true
 * isEllipsis("Wait.", 4);    // false
 * ```
 */
export function isEllipsis(text: string, dotIndex: number): boolean {
  let dotCount = 1;

  // Count dots before
  let i = dotIndex - 1;
  while (i >= 0 && text.charAt(i) === '.') {
    dotCount++;
    i--;
  }

  // Count dots after
  i = dotIndex + 1;
  while (i < text.length && text.charAt(i) === '.') {
    dotCount++;
    i++;
  }

  return dotCount >= 2;
}

/**
 * Check if a token ends a sentence (token-based detection).
 *
 * This is the server-side detection logic that considers:
 * - Sentence-ending punctuation (. ! ?)
 * - Ellipsis detection (2+ dots)
 * - Single initials (e.g., "A.")
 * - Known abbreviations with lookahead
 * - Capital letter after period
 *
 * @param tokenText - The text of the current token
 * @param options - Optional configuration
 * @returns True if the token ends a sentence
 *
 * @example
 * ```ts
 * isSentenceEndToken("Hello.");           // true
 * isSentenceEndToken("Dr.", { nextTokenText: "Smith" }); // false
 * isSentenceEndToken("Vol.", { nextTokenText: "1" });    // false
 * ```
 */
export function isSentenceEndToken(
  tokenText: string,
  options: SentenceEndOptions = {}
): boolean {
  const { abbreviations = ABBREVIATIONS_UNIFIED, nextTokenText } = options;
  const trimmed = tokenText.trim();

  // Must end with sentence-ending punctuation
  if (!/[.!?]$/.test(trimmed)) return false;

  // Ellipsis is not a sentence end (2+ dots)
  if (/\.{2,}$/.test(trimmed)) return false;

  // Single character followed by period (e.g., "A.") - likely initial
  if (/^[A-Z]\.$/.test(trimmed)) return false;

  // Check if it's a known abbreviation
  const withoutPunctuation = trimmed.replace(/[.!?]+$/, '').toLowerCase();
  if (abbreviations.has(withoutPunctuation)) {
    // Abbreviation followed by number is not sentence end (e.g., "Vol. 1")
    if (nextTokenText && /^\d/.test(nextTokenText.trim())) {
      return false;
    }
    // Abbreviation followed by lowercase is not sentence end
    if (nextTokenText && /^[a-z]/.test(nextTokenText.trim())) {
      return false;
    }
  }

  // Ends with ! or ? is always sentence end
  if (/[!?]$/.test(trimmed)) return true;

  // Period followed by capital letter indicates sentence end
  if (nextTokenText) {
    const nextTrimmed = nextTokenText.trim();
    // Check for capital letter, possibly preceded by opening quote
    if (/^[A-Z]/.test(nextTrimmed) || /^["'\u201c\u2018]?[A-Z]/.test(nextTrimmed)) {
      return true;
    }
  }

  // Default: assume period ends sentence
  return true;
}

/**
 * Check if a character position represents a sentence boundary (character-based detection).
 *
 * This is the client-side detection logic for character-by-character scanning.
 * Returns true if the character at the given position ends a sentence.
 *
 * @param text - The full text
 * @param charIndex - The character position to check
 * @param abbreviations - Optional custom abbreviations set
 * @returns True if the character ends a sentence
 *
 * @example
 * ```ts
 * isSentenceEndChar("Hello. World", 5);  // true (the period)
 * isSentenceEndChar("Dr. Smith", 2);     // false (abbreviation)
 * ```
 */
export function isSentenceEndChar(
  text: string,
  charIndex: number,
  abbreviations: Set<string> = ABBREVIATIONS_UNIFIED
): boolean {
  const char = text.charAt(charIndex);

  // Must be sentence-ending punctuation
  if (char !== '.' && char !== '!' && char !== '?') {
    return false;
  }

  // Check for abbreviation (only for periods)
  if (char === '.' && isSentenceAbbreviation(text, charIndex, abbreviations)) {
    return false;
  }

  // Check for ellipsis (only for periods)
  if (char === '.' && isEllipsis(text, charIndex)) {
    return false;
  }

  return true;
}
