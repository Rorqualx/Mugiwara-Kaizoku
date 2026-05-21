/** Chapter/episode reference detection using naming conventions. */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';
import {
  NAMING_CONVENTIONS,
  CHAPTER_CONVENTION,
  extractChapterNumberFromText,
} from '@/server/parsers/patterns/naming-conventions';

import { PATTERN_CONFIDENCE_BOOSTS, type PatternSignal } from './types';

// ============================================================================
// Types
// ============================================================================

interface ChapterReference {
  tokenIndex: number;
  conventionName: string;
  chapterNumber: number | null;
  titleStartIndex: number | null;
  titleEndIndex: number | null;
}

interface ConventionLike {
  name: string;
  displayName: string;
  patterns: RegExp[];
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Wikipedia-style numbered chapter pattern.
 * Matches: "*001. Title", "002. Title", "003. \"Quoted Title\""
 */
const WIKIPEDIA_NUMBERED_CHAPTER_PATTERN = /^[*•]?\s*(\d{1,4})\.?\s+["「]?(.+?)["」]?(?:\s*\(|$)/;

/**
 * Pattern for number WITH period in same token: "*001.", "002."
 * Period is REQUIRED so "001" alone won't match (falls through to split handling)
 */
const WIKIPEDIA_CHAPTER_NUMBER_ONLY = /^[*•]?\s*(\d{1,4})\.\s*$/;
const STANDALONE_CHAPTER_NUMBER = /^(\d{1,3})$/; // Split tokens: "001" + "." or "1" + "."

/**
 * Detect chapter references in linearized tokens using naming conventions
 *
 * Looks for patterns like:
 * - "Chapter 1", "Ch. 23", "Chapter 1: Title"
 * - "Stage 5", "Mission 7", "Episode 12"
 * - "Case 001", "Round 3", "Act II"
 * - Wikipedia format: "001. Title", "*002. \"Title\""
 */
export function detectChapterReferencePatterns(tokens: LinearizedToken[]): PatternSignal[] {
  const patterns: PatternSignal[] = [];
  const allConventions = [...NAMING_CONVENTIONS, CHAPTER_CONVENTION];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    // Try standard convention detection first
    const signal = detectChapterAtToken(tokens, i, allConventions);
    if (signal) {
      patterns.push(signal);
      continue;
    }

    // Try Wikipedia numbered chapter format (e.g., "001. Title")
    const wikiSignal = detectWikipediaNumberedChapter(tokens, i);
    if (wikiSignal) {
      patterns.push(wikiSignal);
    }
  }

  return patterns;
}

/**
 * Detect Wikipedia-style numbered chapter (e.g., "001. \"Normanni\"")
 * Handles both single-token format and split-token format.
 * IMPORTANT: Requires strong indicators to avoid matching dates/volume numbers.
 */
// eslint-disable-next-line complexity -- chapter pattern detection requires many format-specific branches
function detectWikipediaNumberedChapter(
  tokens: LinearizedToken[],
  tokenIndex: number
): PatternSignal | null {
  const token = tokens[tokenIndex];
  if (!token) return null;
  const text = token.text.trim();

  // Skip TOC items
  if (text === '(Top)' || text === 'Top' || text === 'Contents') return null;
  if (token.sectionType === 'sidebar') return null;
  if (token.classes.some(c => c.toLowerCase().includes('toc'))) return null;

  // Wikipedia numbered chapters MUST be in tables (intro paragraph dates are not in tables)
  if (!token.isInTable) return null;

  // Chapter entries are bulleted lists (* 001. "Title"), date cells are NOT
  // This filters out date fragments like "006" in "August 23, 2006" table cells
  if (!token.isInList) return null;

  // Require strong chapter indicators to avoid matching dates/volume numbers within tables
  // Strong indicators: asterisk prefix (*001.) OR leading zero (001.) OR standalone 2-3 digit + period
  const nextIsPeriod = tokens[tokenIndex + 1]?.text.trim() === '.';
  const hasStrongIndicator = /^[*•]\s*\d{1,4}\./.test(text) || /^0\d{1,3}\./.test(text) ||
    (/^\d{2,3}$/.test(text) && nextIsPeriod);
  if (!hasStrongIndicator) return null;

  // Try full pattern first (number + title in same token)
  let match = WIKIPEDIA_NUMBERED_CHAPTER_PATTERN.exec(text);
  let chapterNumber: number;
  let hasFullMatch = false;

  if (match) {
    chapterNumber = parseInt(match[1] ?? '0', 10);
    const title = match[2]?.trim();
    if (chapterNumber >= 1 && chapterNumber <= 999 && title && title.length >= 2) {
      hasFullMatch = true;
    } else {
      match = null;
    }
  }

  // Try number-only pattern (title in following tokens)
  let titleOffset = 1; // How many tokens ahead to find title
  if (!match) {
    const numberMatch = WIKIPEDIA_CHAPTER_NUMBER_ONLY.exec(text);
    // Handle split tokens: "002" + "." as separate tokens
    if (!numberMatch) {
      const standaloneMatch = STANDALONE_CHAPTER_NUMBER.exec(text);
      if (standaloneMatch && tokens[tokenIndex + 1]?.text.trim() === '.') {
        chapterNumber = parseInt(standaloneMatch[1] ?? '0', 10);
        titleOffset = 2; // Skip the period token
      } else {
        return null;
      }
    } else {
      chapterNumber = parseInt(numberMatch[1] ?? '0', 10);
    }
    if (chapterNumber < 1 || chapterNumber > 999) return null;
    // Verify title token looks like a title
    const titleToken = tokens[tokenIndex + titleOffset];
    if (!titleToken) return null;
    const titleText = titleToken.text.trim();
    if (!titleText.startsWith('"') && !titleText.startsWith('「') && titleText.length < 3) return null;
  } else {
    chapterNumber = parseInt(match[1] ?? '0', 10);
  }

  // Find all tokens that are part of this chapter entry
  // IMPORTANT: Only include chapter number and title, NOT alt title (handled separately by wikipedia-rules)
  const valueIndices: number[] = [tokenIndex];
  // For split tokens, include the period token
  if (titleOffset === 2) valueIndices.push(tokenIndex + 1);

  // Look for title tokens only - STOP at opening paren (alt title start)
  for (let j = tokenIndex + titleOffset; j < Math.min(tokenIndex + 12, tokens.length); j++) {
    const nextToken = tokens[j];
    if (!nextToken) break;
    if (nextToken.isHeader) break;
    const nextText = nextToken.text.trim();
    // Stop at alt title start (opening parenthesis)
    if (nextText === '(') break;
    // Stop at next chapter: "*001." pattern or standalone number + period
    if (/^[*•]?\s*\d{1,4}\./.test(nextText)) break;
    if (STANDALONE_CHAPTER_NUMBER.test(nextText) && tokens[j + 1]?.text.trim() === '.') break;
    if (nextText === '•' || nextText === '*') break;
    if (nextText.length > 0) valueIndices.push(j);
  }

  if (valueIndices.length < 2 && !hasFullMatch) return null;

  return {
    type: 'chapter_reference',
    labelText: `chapter_${chapterNumber}`,
    entityType: 'CHAPTER_TITLE',
    valueTokenIndices: valueIndices,
    confidence: PATTERN_CONFIDENCE_BOOSTS.label_colon_value + 0.05,
    source: `wiki_numbered_chapter:${chapterNumber}`,
  };
}

/**
 * Try to detect a chapter reference at a specific token index
 */
function detectChapterAtToken(
  tokens: LinearizedToken[],
  tokenIndex: number,
  conventions: ConventionLike[]
): PatternSignal | null {
  const token = tokens[tokenIndex];
  if (!token) return null;

  const text = token.text.trim();
  if (text.length < 2) return null;

  for (const convention of conventions) {
    const reference = detectConventionMatch(tokens, tokenIndex, convention, text);
    if (reference) {
      return createChapterReferenceSignal(reference, tokens);
    }
  }

  return null;
}

// ============================================================================
// Detection Helpers
// ============================================================================

/**
 * Check if a token matches a naming convention pattern
 */
function detectConventionMatch(
  tokens: LinearizedToken[],
  tokenIndex: number,
  convention: ConventionLike,
  tokenText: string
): ChapterReference | null {
  // Try pattern-based matching first
  const patternMatch = tryPatternMatch(tokens, tokenIndex, convention, tokenText);
  if (patternMatch) return patternMatch;

  // Try prefix-based matching as fallback
  return tryPrefixMatch(tokens, tokenIndex, convention, tokenText);
}

/**
 * Try to match using convention's regex patterns
 */
function tryPatternMatch(
  tokens: LinearizedToken[],
  tokenIndex: number,
  convention: ConventionLike,
  tokenText: string
): ChapterReference | null {
  for (const pattern of convention.patterns) {
    const regex = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    const match = regex.exec(tokenText);

    if (match) {
      const chapterNumber = extractChapterNumberFromMatch(match);
      const titleRange = findChapterTitleRange(tokens, tokenIndex, tokenText, match);

      return {
        tokenIndex,
        conventionName: convention.name,
        chapterNumber,
        titleStartIndex: titleRange.start,
        titleEndIndex: titleRange.end,
      };
    }
  }

  return null;
}

/**
 * Try to match using convention name prefix
 */
function tryPrefixMatch(
  tokens: LinearizedToken[],
  tokenIndex: number,
  convention: ConventionLike,
  tokenText: string
): ChapterReference | null {
  const conventionPrefix = convention.displayName.toLowerCase();
  const lowerText = tokenText.toLowerCase();

  if (!lowerText.startsWith(conventionPrefix)) return null;

  const afterPrefix = tokenText.slice(convention.displayName.length).trim();
  const numberMatch = afterPrefix.match(/^(\d+(?:\.\d+)?)/);

  if (!numberMatch?.[1]) return null;

  const chapterNumber = parseFloat(numberMatch[1]);
  const titleRange = findChapterTitleRange(tokens, tokenIndex, tokenText, numberMatch);

  return {
    tokenIndex,
    conventionName: convention.name,
    chapterNumber,
    titleStartIndex: titleRange.start,
    titleEndIndex: titleRange.end,
  };
}

/**
 * Extract chapter number from regex match
 */
function extractChapterNumberFromMatch(match: RegExpExecArray): number | null {
  // Try to find a number in the capture groups
  for (let i = 1; i < match.length; i++) {
    const group = match[i];
    if (group && /^\d+(?:\.\d+)?$/.test(group)) {
      return parseFloat(group);
    }
  }

  // Fall back to extracting from the full match
  const numberMatch = match[0].match(/(\d+(?:\.\d+)?)/);
  return numberMatch?.[1] ? parseFloat(numberMatch[1]) : null;
}

/**
 * Find the range of tokens that constitute the chapter title
 */
function findChapterTitleRange(
  tokens: LinearizedToken[],
  tokenIndex: number,
  tokenText: string,
  match: RegExpMatchArray
): { start: number | null; end: number | null } {
  // Check if there's a title separator in the same token
  const inlineTitleRange = findInlineTitle(tokenText, match);
  if (inlineTitleRange) {
    return { start: tokenIndex, end: tokenIndex };
  }

  // Look for title in subsequent tokens
  return findSubsequentTitle(tokens, tokenIndex);
}

/**
 * Check for title in the same token (e.g., "Chapter 1: The Beginning")
 */
function findInlineTitle(tokenText: string, match: RegExpMatchArray): boolean {
  const searchStart = (match.index ?? 0) + match[0].length;
  const colonIndex = tokenText.indexOf(':', searchStart);
  const dashIndex = tokenText.indexOf('-', searchStart);
  const separatorIndex = colonIndex >= 0 ? colonIndex : dashIndex;

  if (separatorIndex >= 0) {
    const afterSeparator = tokenText.slice(separatorIndex + 1).trim();
    return afterSeparator.length > 0;
  }

  return false;
}

/**
 * Look for title in subsequent tokens
 */
function findSubsequentTitle(
  tokens: LinearizedToken[],
  tokenIndex: number
): { start: number | null; end: number | null } {
  const maxLookahead = 5;
  let titleStart: number | null = null;
  let titleEnd: number | null = null;
  const baseToken = tokens[tokenIndex];

  for (let j = tokenIndex + 1; j < Math.min(tokenIndex + maxLookahead, tokens.length); j++) {
    const nextToken = tokens[j];
    if (!nextToken) continue;

    if (shouldStopTitleSearch(nextToken, baseToken)) break;
    if (isSeparatorToken(nextToken)) continue;
    if (looksLikeChapterReference(nextToken.text.trim())) break;

    if (nextToken.text.trim().length > 0) {
      titleStart ??= j;
      titleEnd = j;
    }
  }

  return { start: titleStart, end: titleEnd };
}

/**
 * Check if we should stop searching for title
 */
function shouldStopTitleSearch(
  nextToken: LinearizedToken,
  baseToken: LinearizedToken | undefined
): boolean {
  return nextToken.isHeader || nextToken.isInTable !== baseToken?.isInTable;
}

/**
 * Check if token is a separator
 */
function isSeparatorToken(token: LinearizedToken): boolean {
  const text = token.text.trim();
  return text === ':' || text === '-' || text === '–';
}

/**
 * Check if text looks like a chapter reference
 */
function looksLikeChapterReference(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Check against all conventions
  const allConventions = [...NAMING_CONVENTIONS, CHAPTER_CONVENTION];
  for (const convention of allConventions) {
    if (lowerText.startsWith(convention.displayName.toLowerCase())) {
      const afterName = text.slice(convention.displayName.length).trim();
      if (/^\d/.test(afterName)) return true;
    }
  }

  // Check common patterns
  return /^(ch\.?|chapter|vol\.?|volume)\s*\d/i.test(text);
}

// ============================================================================
// Signal Creation
// ============================================================================

/**
 * Create a pattern signal from a chapter reference
 */
function createChapterReferenceSignal(
  reference: ChapterReference,
  tokens: LinearizedToken[]
): PatternSignal | null {
  const valueIndices: number[] = [reference.tokenIndex];

  // Add title tokens if found
  if (reference.titleStartIndex !== null && reference.titleEndIndex !== null) {
    for (let i = reference.titleStartIndex; i <= reference.titleEndIndex; i++) {
      if (!valueIndices.includes(i)) {
        valueIndices.push(i);
      }
    }
  }

  // Determine confidence based on context
  const confidence = calculateConfidence(reference, tokens);

  return {
    type: 'chapter_reference',
    labelText: reference.conventionName,
    entityType: 'CHAPTER_TITLE',
    valueTokenIndices: valueIndices,
    confidence,
    source: `chapter_ref:${reference.conventionName}:${reference.chapterNumber ?? 'unknown'}`,
  };
}

/**
 * Calculate confidence score for a chapter reference
 */
function calculateConfidence(reference: ChapterReference, tokens: LinearizedToken[]): number {
  let confidence = PATTERN_CONFIDENCE_BOOSTS.label_colon_value;

  const token = tokens[reference.tokenIndex];
  if (token?.isInTable) {
    confidence += 0.1;
  }

  if (reference.chapterNumber !== null) {
    confidence += 0.05;
  }

  return Math.min(confidence, 1.0);
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Extract chapter number from text using all known conventions
 */
export function extractChapterFromText(text: string): number | null {
  const result = extractChapterNumberFromText(text);
  if (result !== null) return result;

  const match = text.match(/\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}
