/**
 * Wikipedia Rule Helpers
 *
 * Shared helper functions, constants, and detection logic used by Wikipedia source rules.
 *
 * @module ml/training/bootstrap-labeler/source-rules/wikipedia-rules/wikipedia-helpers
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findSpanEnd,
  hasAncestorClassPattern,
} from '../types';

import type { SourceRuleContext } from '../types';

// ============================================================================
// Wikipedia Class Pattern Constants
// ============================================================================

/** Infobox label row indicator classes */
const INFOBOX_LABEL_CLASSES = ['infobox-label', 'infobox-header'];

/** Infobox data/value classes (excludes infobox-above/below which are sub-headers) */
const INFOBOX_DATA_CLASSES = ['infobox-data'];

/** Label text patterns for specific entity types */
export const LABEL_PATTERNS = {
  author: ['written by', 'author', 'created by', 'original creator'],
  artist: ['illustrated by', 'artist', 'cover artist'],
  publisher: ['published by', 'publisher', 'original publisher'],
  englishPublisher: ['english publisher'],
  magazine: ['magazine', 'serialized'],
  status: ['status'],
  demographic: ['demographic', 'target audience'],
  volumes: ['volumes', 'no. of volumes'],
  chapters: ['chapters', 'no. of chapters'],
  genre: ['genre', 'genres'],
  releaseDate: ['original run', 'published', 'release date'],
  originalRun: ['original run', 'run'],
  altTitle: ['japanese', 'native name', 'original title', 'romaji'],
};

// ============================================================================
// Infobox Helpers
// ============================================================================

export function isInfoboxLabel(token: LinearizedToken): boolean {
  return hasAncestorClassPattern(token, INFOBOX_LABEL_CLASSES);
}

export function isInfoboxData(token: LinearizedToken): boolean {
  return hasAncestorClassPattern(token, INFOBOX_DATA_CLASSES);
}

function getLabelText(token: LinearizedToken): string {
  return token.nearestLabelText?.toLowerCase().trim() ?? '';
}

export function matchesLabelPattern(token: LinearizedToken, patterns: string[]): boolean {
  const labelText = getLabelText(token);
  if (!labelText) return false;
  return patterns.some(p => labelText.includes(p));
}

export function findInfoboxDataEnd(
  _token: LinearizedToken,
  index: number,
  ctx: SourceRuleContext
): number {
  return findSpanEnd(ctx.tokens, index, 10, (t) =>
    isInfoboxLabel(t) || t.text.endsWith(':') || t.isHeader || t.isTableHeader
  );
}

// ============================================================================
// Hatnote / Further Information Helpers
// ============================================================================

/**
 * Check if token is inside a Wikipedia hatnote (e.g., "Further information: ..." or "Main article: ...").
 * These use `<div class="hatnote navigation-not-searchable">`.
 */
export function isInHatnote(token: LinearizedToken): boolean {
  return hasAncestorClassPattern(token, ['hatnote']);
}

// ============================================================================
// Volume Summary Detection Helpers
// ============================================================================

/** Check if a token represents a chapter number pattern (number + period) */
export function isChapterNumberPattern(
  token: LinearizedToken,
  index: number,
  tokens: LinearizedToken[]
): boolean {
  const text = token.text.trim();
  if (!/^\d{1,3}$/.test(text)) return false;
  if (!token.isInList) return false;
  const nextToken = tokens[index + 1];
  return nextToken?.text.trim() === '.';
}

/** Look back from index to find if we're after a volume table with chapters */
export function isAfterVolumeTableWithChapters(
  index: number,
  tokens: LinearizedToken[],
  maxLookback: number = 150
): boolean {
  let sawTable = false;

  for (let i = index - 1; i >= Math.max(0, index - maxLookback); i--) {
    const prevToken = tokens[i];
    if (!prevToken) continue;

    if (prevToken.isInTable) sawTable = true;
    const prevText = prevToken.text.trim();

    // Only count chapter patterns AFTER we've seen a table
    if (sawTable) {
      // Pattern 1: asterisk + number (classic Wikipedia chapter format)
      if (/^\*\d{1,3}/.test(prevText)) return true;
      // Pattern 2: number + period (separate tokens)
      if (isChapterNumberPattern(prevToken, i, tokens)) return true;
      // Pattern 3: Bonus chapter
      if (/^Bonus/i.test(prevText)) return true;
    }

    // Stop at section header
    if (prevToken.isHeader && prevToken.headerLevel && prevToken.headerLevel <= 3) break;
  }
  return false;
}

/**
 * Check if a token is directly after a chapter list in a volume table.
 *
 * Wikipedia volume tables have this structure per volume:
 *   <th>1</th> <td>dates</td> <td>ISBN</td> ...   <- metadata row
 *   <td colspan=5><ul><li>001. "Title"</li>...</ul></td>  <- chapter list row
 *   <td colspan=5>Summary paragraph text...</td>   <- summary row
 *
 * The summary cell comes directly after the chapter list (<ul><li> items).
 * We detect this by scanning backward: the nearest list items should be chapter
 * entries, with NO <th> (table header) in between. A <th> indicates a volume
 * number cell, which separates volumes and metadata rows from summary rows.
 */
export function isDirectlyAfterChapterList(
  index: number,
  tokens: LinearizedToken[]
): boolean {
  for (let i = index - 1; i >= Math.max(0, index - 80); i--) {
    const prev = tokens[i];
    if (!prev) continue;
    // Left the table entirely — not in a summary context
    if (!prev.isInTable) return false;
    // Hit a table header (<th>) — this is a volume number or column header,
    // meaning we're in a metadata row, not a summary cell
    if (prev.isTableHeader) return false;
    // Found a list item — chapter entries are in <ul><li>, so this token
    // is directly after the chapter list -> it's a summary cell
    if (prev.isInList) return true;
  }
  return false;
}

// ============================================================================
// Chapter Detection Helpers
// ============================================================================

/** Check if title token looks like a real chapter title (quoted or capitalized 3+ chars) */
export function isSubstantiveTitle(titleText: string): boolean {
  const isQuoted = titleText.startsWith('"') || titleText.startsWith('\u300C');
  const isCapitalized = /^[A-Z]/.test(titleText) && titleText.length >= 3;
  return isQuoted || isCapitalized;
}

/**
 * Check if there's a chapter number pattern within the lookback range.
 * Used for flexible alt title detection when content is in separate spans.
 */
export function hasChapterNumberNearby(
  index: number,
  ctx: SourceRuleContext,
  maxLookback: number = 15
): boolean {
  for (let i = index - 1; i >= Math.max(0, index - maxLookback); i--) {
    const prev = ctx.tokens[i];
    if (!prev) continue;
    const prevText = prev.text.trim();

    // Found a potential chapter number
    if (/^\d{1,3}$/.test(prevText) && prev.isInTable && prev.isInList) {
      // Check if there's a period after the number
      const nextToken = ctx.tokens[i + 1];
      if (nextToken?.text.trim() === '.') {
        return true;
      }
    }
  }
  return false;
}

/** Scan backwards for the nearest SECTION header (h2+) and check if it's volume/chapter related */
export function isUnderVolumeOrChapterHeader(
  tokens: LinearizedToken[],
  index: number
): boolean {
  // Scan back with no fixed limit — volume tables can have thousands of tokens
  // under a single "Volumes" header. Stop at the first h2+ header found.
  // IMPORTANT: Skip h1 (page title) — it often contains "chapter/manga" but isn't a section header.
  for (let i = index - 1; i >= 0; i--) {
    const prev = tokens[i];
    if (!prev) continue;
    if (prev.isHeader) {
      // Skip h1 page titles — only section headers (h2, h3, etc.) count
      if (prev.headerLevel === 1) continue;
      // Only match specific section names: "Volumes", "Chapters", "Episodes"
      // Don't match generic "manga" or broad patterns that could match page titles
      return /^(volumes?|chapters?|episodes?|chapter\s*list)/i.test(prev.text.trim());
    }
  }
  return false;
}

/**
 * Shared 7-gate check: is this token a chapter number in a Wikipedia volume table?
 *
 * Gate 1: Pure 1-3 digit number WITH LEADING ZERO (001, 002, etc.)
 * Gate 1.5: NOT a year fragment (prev token is not "1" or "2")
 * Gate 2: Inside a table, not sidebar/navigation/TOC
 * Gate 3: Next token is a period "."
 * Gate 4: Title token (after period) must be QUOTED (starts with " or 「) and length >= 2
 * Gate 5: Must be in a list structure (bullet point)
 * Gate 6: Under a volume/chapter section header (h2+)
 *
 * These strict gates prevent matching dates in prose (2005 -> 005) or TOC entries.
 */
export function isChapterNumberToken(
  token: LinearizedToken,
  index: number,
  ctx: SourceRuleContext
): boolean {
  const text = token.text.trim();
  // GATE 1: Must be a valid chapter number format
  // - Leading zero (001, 01) - high confidence chapters
  // - OR 1-3 digit numbers (1-999) - chapters without leading zeros
  // - REJECT 4+ digit numbers (2005, 2024) - these are likely dates
  const hasLeadingZero = /^0\d+$/.test(text);
  const isShortNumber = /^\d{1,3}$/.test(text);
  if (!hasLeadingZero && !isShortNumber) return false;

  // GATE 1.5: Reject year fragments - if previous token is "1" or "2", this is likely
  // part of a year (1xxx, 2xxx) split across tokens, not a chapter number
  // Examples: "2" + "005" = year 2005, "1" + "998" = year 1998
  const prevToken = ctx.tokens[index - 1];
  if (prevToken) {
    const prevText = prevToken.text.trim();
    // If previous token is "1" or "2" (standalone single digit), this is a year fragment
    if (prevText === '1' || prevText === '2') return false;
  }

  // GATE 2: Must be inside a table but NOT in sidebar/navigation
  // Note: TOC tokens have sectionType === 'sidebar', so checking sidebar covers TOC
  if (!token.isInTable) return false;
  if (token.sectionType === 'sidebar' || token.sectionType === 'navigation') return false;
  // GATE 3: Next token must be a period "."
  const nextToken = ctx.tokens[index + 1];
  if (!nextToken || nextToken.text.trim() !== '.') return false;
  // GATE 4: Title token (after period) must be QUOTED — much stricter than "substantive"
  // Also ensure title has meaningful length (at least 2 chars)
  const titleToken = ctx.tokens[index + 2];
  if (!titleToken) return false;
  const titleText = titleToken.text.trim();
  if (titleText.length < 2) return false;
  // Only quoted titles count — this eliminates most false positives
  if (!titleText.startsWith('"') && !titleText.startsWith('\u300C') && !titleText.startsWith('\u201C')) return false;
  // GATE 5: Must be in a list structure (chapter entries are bullet points)
  if (!token.isInList) return false;
  // GATE 6: Must be under a volume/chapter section header (h2+)
  return isUnderVolumeOrChapterHeader(ctx.tokens, index);
}

// ============================================================================
// Volume Metadata Detection Helpers
// ============================================================================

/** Month name pattern for date detection */
export const MONTH_PATTERN = /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i;

/** ISBN-13 start pattern */
export const ISBN_START_PATTERN = /^(978|979)[-\d]/;

/**
 * Check if this token is in the FIRST column that contains a pattern match in its row.
 * Uses `tableCol` to distinguish columns — multiple values in the same cell (same column)
 * are all treated as the same language. Only a match in a DIFFERENT (earlier) column
 * makes this token "not first".
 *
 * This correctly handles Wikipedia tables where one JP cell has multiple editions
 * (e.g., two JP dates or two JP ISBNs stacked in the same column).
 */
export function isFirstPatternInMetadataRow(
  index: number,
  tokens: LinearizedToken[],
  pattern: RegExp
): boolean {
  const currentCol = tokens[index]?.tableCol;
  const row = tokens[index]?.tableRow;
  if (currentCol === null || currentCol === undefined || row === null || row === undefined) return true;

  // Scan backward in the same row — increased limit for cells with multiple editions
  for (let i = index - 1; i >= Math.max(0, index - 40); i--) {
    const prev = tokens[i];
    if (prev?.tableRow !== row) break;
    if (prev.isTableHeader) break; // Hit <th> — no earlier column matches
    // Same column → skip (multiple values in same cell are same language)
    if (prev.tableCol === currentCol) continue;
    // Different column with matching pattern → this is NOT the first column
    if (pattern.test(prev.text.trim())) return false;
  }
  return true;
}

/**
 * Shared guard: token is in a volume table metadata row.
 * Not a list/chapter row, not a header row, under a Volumes/Chapters section.
 */
export function isInVolumeMetadataRow(
  token: LinearizedToken,
  index: number,
  tokens: LinearizedToken[]
): boolean {
  if (!token.isInTable) return false;
  if (token.isInList) return false;
  if (token.isTableHeader) return false;
  // XPath check for deeply nested list items
  const xp = token.xpath.toLowerCase();
  if (xp.includes('/li') || xp.includes('/ul') || xp.includes('/ol')) return false;
  // Must be under a Volumes/Chapters header
  if (!isUnderVolumeOrChapterHeader(tokens, index)) return false;
  return true;
}

