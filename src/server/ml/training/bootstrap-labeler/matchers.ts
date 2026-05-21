/**
 * Token Matching Utilities for Bootstrap Labeling
 *
 * Provides functions to match extracted values to token positions.
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import { DEFAULT_BOOTSTRAP_OPTIONS } from './types';

import type { TokenMatch, BootstrapOptions } from './types';

// ============================================================================
// Text Normalization & CJK Support
// ============================================================================

/**
 * CJK Unicode ranges for Japanese, Chinese, Korean characters
 * - CJK Unified Ideographs: U+4E00-U+9FFF (common Chinese/Japanese kanji)
 * - Hiragana: U+3040-U+309F
 * - Katakana: U+30A0-U+30FF
 * - Korean Hangul: U+AC00-U+D7AF
 * - CJK Extension A: U+3400-U+4DBF
 * - CJK Extension B-F: U+20000-U+2A6DF, etc.
 */
const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u3400-\u4DBF]/;

/**
 * Detect if text contains CJK (Chinese, Japanese, Korean) characters
 */
export function hasCJKCharacters(text: string): boolean {
  return CJK_REGEX.test(text);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u3400-\u4DBF]/g, '');
}

/**
 * Tokenize text with support for CJK languages
 *
 * For CJK text: splits into individual characters (standard for Chinese/Japanese)
 * For non-CJK: splits on whitespace
 * For mixed: combines both approaches
 */
export function tokenize(text: string): string[] {
  const trimmed = text.toLowerCase().trim();
  if (trimmed.length === 0) return [];

  // Check if text contains CJK characters
  if (!hasCJKCharacters(trimmed)) {
    // Pure non-CJK: whitespace split
    return trimmed
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }

  // For CJK or mixed text: split into tokens preserving both CJK characters
  // and whitespace-separated words
  return tokenizeMixed(trimmed);
}

/**
 * Tokenize mixed CJK and non-CJK text
 * - CJK characters are split individually
 * - Non-CJK sequences are kept together as words
 */
function tokenizeMixed(text: string): string[] {
  const tokens: string[] = [];
  let currentWord = '';

  for (const char of text) {
    if (CJK_REGEX.test(char)) {
      // CJK character: flush current word, add CJK as individual token
      if (currentWord.trim().length > 0) {
        tokens.push(currentWord.trim());
        currentWord = '';
      }
      tokens.push(char);
    } else if (/\s/.test(char)) {
      // Whitespace: flush current word
      if (currentWord.trim().length > 0) {
        tokens.push(currentWord.trim());
        currentWord = '';
      }
    } else {
      // Non-CJK, non-whitespace: accumulate
      currentWord += char;
    }
  }

  // Don't forget the last word
  if (currentWord.trim().length > 0) {
    tokens.push(currentWord.trim());
  }

  return tokens;
}

// ============================================================================
// Exact Token Matching
// ============================================================================

export function findExactMatch(
  tokens: LinearizedToken[],
  value: string
): TokenMatch | null {
  const normalizedValue = normalizeText(value);
  if (normalizedValue.length === 0) return null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.normalizedText === normalizedValue) {
      return {
        tokenIndex: i,
        startCharIndex: 0,
        endCharIndex: token.text.length,
        matchedText: token.text,
        matchType: 'exact',
      };
    }
  }

  return null;
}

// ============================================================================
// Multi-Token Matching
// ============================================================================

interface SequenceSearchState {
  matches: TokenMatch[];
  wordIndex: number;
  startTokenIndex: number;
}

function createInitialState(): SequenceSearchState {
  return { matches: [], wordIndex: 0, startTokenIndex: -1 };
}

function resetState(state: SequenceSearchState): void {
  state.matches.length = 0;
  state.wordIndex = 0;
  state.startTokenIndex = -1;
}

function processTokenWord(
  tw: string,
  targetWord: string,
  token: LinearizedToken,
  tokenIndex: number,
  state: SequenceSearchState
): boolean {
  if (tw !== targetWord) return false;

  if (state.wordIndex === 0) {
    state.startTokenIndex = tokenIndex;
  }

  state.matches.push({
    tokenIndex,
    startCharIndex: 0,
    endCharIndex: token.text.length,
    matchedText: token.text,
    matchType: 'multi-token',
  });

  state.wordIndex++;
  return true;
}

function processTokenForSequence(
  token: LinearizedToken,
  tokenIndex: number,
  words: string[],
  maxSpan: number,
  state: SequenceSearchState
): boolean {
  const tokenWords = tokenize(token.text);

  for (const tw of tokenWords) {
    const targetWord = words[state.wordIndex] ?? '';
    if (!targetWord) continue;

    const matched = processTokenWord(tw, targetWord, token, tokenIndex, state);

    if (matched && state.wordIndex >= words.length) {
      return true; // Found complete sequence
    }

    if (!matched && state.wordIndex > 0) {
      const spanTooLong = tokenIndex - state.startTokenIndex > maxSpan;
      if (spanTooLong) {
        resetState(state);
      }
    }
  }

  return false;
}

function searchForWordSequence(
  tokens: LinearizedToken[],
  words: string[],
  maxSpan: number
): TokenMatch[] {
  const state = createInitialState();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const complete = processTokenForSequence(token, i, words, maxSpan, state);
    if (complete) break;
  }

  return state.matches;
}

export function findMultiTokenMatch(
  tokens: LinearizedToken[],
  value: string,
  maxSpan: number = 10
): TokenMatch[] | null {
  const valueWords = tokenize(value);
  if (valueWords.length === 0) return null;
  if (valueWords.length === 1) {
    const exact = findExactMatch(tokens, value);
    return exact ? [exact] : null;
  }

  const matches = searchForWordSequence(tokens, valueWords, maxSpan);
  return matches.length === valueWords.length ? matches : null;
}

// ============================================================================
// Substring Matching
// ============================================================================

function calculateOverlap(a: string, b: string): number {
  const shorter = a.length < b.length ? a : b;
  const longer = a.length >= b.length ? a : b;

  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  // Jaccard similarity on character sets
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = [...setA].filter((c) => setB.has(c)).length;
  const union = new Set([...setA, ...setB]).size;

  return union > 0 ? intersection / union : 0;
}

export function findSubstringMatch(
  tokens: LinearizedToken[],
  value: string,
  minOverlap: number = 0.7
): TokenMatch | null {
  const normalizedValue = normalizeText(value);
  if (normalizedValue.length < 3) return null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const overlap = calculateOverlap(token.normalizedText, normalizedValue);

    if (overlap >= minOverlap) {
      return {
        tokenIndex: i,
        startCharIndex: 0,
        endCharIndex: token.text.length,
        matchedText: token.text,
        matchType: 'substring',
      };
    }
  }

  return null;
}

// ============================================================================
// Combined Matcher
// ============================================================================

export interface MatchResult {
  matches: TokenMatch[];
  type: 'exact' | 'multi-token' | 'substring' | 'none';
  confidence: number;
}

export function findBestMatch(
  tokens: LinearizedToken[],
  value: string,
  options: Partial<BootstrapOptions> = {}
): MatchResult {
  const opts = { ...DEFAULT_BOOTSTRAP_OPTIONS, ...options };

  if (!value || value.trim().length === 0) {
    return { matches: [], type: 'none', confidence: 0 };
  }

  // Try exact match first
  const exact = findExactMatch(tokens, value);
  if (exact) {
    return { matches: [exact], type: 'exact', confidence: 1.0 };
  }

  // Try multi-token match
  const multiToken = findMultiTokenMatch(tokens, value, opts.maxMultiTokenSpan);
  if (multiToken) {
    return { matches: multiToken, type: 'multi-token', confidence: 0.9 };
  }

  // Try substring match if enabled
  if (opts.enableFuzzyMatch) {
    const substring = findSubstringMatch(tokens, value);
    if (substring) {
      return { matches: [substring], type: 'substring', confidence: 0.7 };
    }
  }

  return { matches: [], type: 'none', confidence: 0 };
}

// ============================================================================
// Span Utilities
// ============================================================================

export function matchesToSpan(
  matches: TokenMatch[]
): { start: number; end: number } | null {
  if (matches.length === 0) return null;

  const indices = matches.map((m) => m.tokenIndex);
  return {
    start: Math.min(...indices),
    end: Math.max(...indices),
  };
}
