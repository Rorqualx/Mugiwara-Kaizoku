// @file-size-justified: Fandom rules are cohesive entity detection rules that share helpers and constants - splitting would reduce maintainability
/**
 * Fandom Wiki Source-Specific Rules
 *
 * Positional rules leveraging Fandom's portable infobox structure.
 * Fandom uses consistent CSS classes like pi-title, pi-data-label, pi-data-value.
 *
 * @module ml/training/bootstrap-labeler/source-rules/fandom-rules
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';
import { FANDOM_LABEL_PATTERNS } from '@/server/shared/source-knowledge/field-patterns/fandom-patterns';
import { logger } from '@/utils/logger';

import {
  findSpanEnd,
  hasAncestorClass,
  hasAncestorClassPattern,
  hasClassPattern,
  isLargeImage,
} from './types';

import type { SourceRule, SourceRuleContext } from './types';

// ============================================================================
// Fandom Class Pattern Constants
// ============================================================================

/** Portable infobox label classes */
const PI_LABEL_CLASSES = ['pi-data-label', 'pi-header'];

/** Portable infobox value classes */
const PI_VALUE_CLASSES = ['pi-data-value', 'pi-font'];

/** Label text patterns for specific entity types - imported from shared layer */
const LABEL_PATTERNS = FANDOM_LABEL_PATTERNS;

// ============================================================================
// Helper Functions
// ============================================================================

function isPiLabel(token: LinearizedToken): boolean {
  return hasClassPattern(token, PI_LABEL_CLASSES);
}

function isPiValue(token: LinearizedToken): boolean {
  return hasClassPattern(token, PI_VALUE_CLASSES);
}

function getLabelText(token: LinearizedToken): string {
  return token.nearestLabelText?.toLowerCase().trim() ?? '';
}

function matchesLabelPattern(token: LinearizedToken, patterns: string[]): boolean {
  const labelText = getLabelText(token);
  if (!labelText) return false;
  return patterns.some(p => labelText.includes(p));
}

function findPiValueEnd(
  _token: LinearizedToken,
  index: number,
  context: SourceRuleContext
): number {
  return findSpanEnd(context.tokens, index, 10, (t) =>
    isPiLabel(t) || t.text.endsWith(':') || t.isHeader
  );
}

/**
 * Check if there's a range pattern (dash) nearby the given index.
 * Used to distinguish CHAPTER_COUNT from CHAPTER_RANGE.
 */
function hasRangePatternNearby(tokens: LinearizedToken[], index: number, lookahead: number): boolean {
  for (let i = index; i < Math.min(index + lookahead, tokens.length); i++) {
    const t = tokens[i];
    if (t && /^[-–—]$/.test(t.text)) return true;
  }
  return false;
}

/**
 * Check if the token is a navbox section range header like "1-10", "11-20", "21-29".
 * These are navigation section dividers in navbox tables, not actual content to label.
 * Exported for use in positional-heuristics.ts and pattern-propagation.ts.
 */
export function isNavboxSectionRangeHeader(token: LinearizedToken): boolean {
  // Check if token text matches range pattern (X-Y where X and Y are numbers)
  const text = token.text.trim();
  if (!/^\d+[-–—]\d+$/.test(text)) return false;

  // Must be in navigation context (navbox, toccolours, etc.)
  const cssPath = token.cssPath.toLowerCase();
  const classes = token.classes.map(c => c.toLowerCase());

  const isInNavbox = classes.some(c =>
    c.includes('navbox') ||
    c.includes('toccolours') ||
    c.includes('mw-collapsible') ||
    c.includes('navigation')
  ) || cssPath.includes('navbox') ||
    cssPath.includes('toccolours') ||
    cssPath.includes('mw-collapsible');

  // Also check if it's a table header cell (th element) which section headers often are
  const isTableHeader = token.isTableHeader ||
    cssPath.includes('th') ||
    classes.some(c => c.includes('header'));

  return isInNavbox || isTableHeader;
}

/**
 * Check if there's a "Volume X" pattern within the specified range before the given index.
 * Used to detect volume subtitles on list pages.
 */
function hasVolumePatternBefore(tokens: LinearizedToken[], index: number, lookback: number): boolean {
  for (let i = Math.max(0, index - lookback); i < index; i++) {
    const prev = tokens[i];
    if (!prev) continue;
    if (/^volume$/i.test(prev.text)) {
      const nextToVol = tokens[i + 1];
      if (nextToVol && /^\d+$/.test(nextToVol.text)) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Chapter Page Detection Helpers
// ============================================================================

/**
 * Check for strong header-based chapter patterns.
 * Matches "Chapter X" regex in first 50 tokens, H1 headers with "chapter",
 * and "Chapter" + digit in prominent positions.
 */
function hasStrongHeaderChapterPattern(
  ctx: SourceRuleContext,
  token: LinearizedToken,
  index: number
): boolean {
  const text = token.text.toLowerCase();

  // STRONG - token in first 50 starting with "Chapter X" pattern (e.g. "Chapter 18:")
  if (index < 50 && /^chapter\s*\d+/i.test(token.text)) return true;

  // STRONG - H1 header containing "chapter" word
  if (token.isHeader && token.headerLevel === 1 && text.includes('chapter')) return true;

  // STRONG INDICATOR - Token text IS "Chapter" followed by number (e.g., "Chapter" "18" ":")
  if (text === 'chapter' && /^\d+$/.test(ctx.tokens[index + 1]?.text ?? '')) {
    // Check if it's in a prominent position (H1, infobox, early in page)
    // Note - Check cssPath for #firstheading since text inside H1 may not have isHeader flag
    const isInH1 = token.isHeader || token.cssPath.toLowerCase().includes('#firstheading');
    if (isInH1 || token.isInInfobox || index < 100) {
      return true;
    }
  }

  return false;
}

/**
 * Check for "Chapter Number" label patterns in infobox.
 * Consolidates 4 variations - separate tokens, combined text, nearestLabelText checks.
 */
function hasChapterNumberLabel(
  ctx: SourceRuleContext,
  token: LinearizedToken,
  index: number
): boolean {
  if (!token.isInInfobox) return false;

  const text = token.text.toLowerCase();

  // Case 1 - "Chapter" and "Number" as separate tokens
  if (text === 'chapter' && ctx.tokens[index + 1]?.text.toLowerCase() === 'number') {
    return true;
  }

  // Case 2 - "Chapter Number" as combined token or in text
  if (text.includes('chapter') && text.includes('number')) {
    return true;
  }

  // Case 3 - Check nearestLabelText for "chapter number" pattern
  if (token.nearestLabelText?.toLowerCase().includes('chapter number')) {
    return true;
  }

  // Case 4 - Check nearestLabelText for "chapter" combined with "number" nearby
  if (token.nearestLabelText?.toLowerCase() === 'chapter') {
    const nextLabel = ctx.tokens[index + 1]?.nearestLabelText?.toLowerCase();
    if (nextLabel === 'number' || nextLabel === 'chapter number') {
      return true;
    }
  }

  return false;
}

/**
 * Check for "is the Xth chapter" prose pattern.
 * Matches patterns like "is the 20th chapter" or "is the chapter".
 */
function hasChapterProsePattern(ctx: SourceRuleContext, token: LinearizedToken, index: number): boolean {
  const text = token.text.toLowerCase();

  if (text !== 'is') return false;

  const nextToken = ctx.tokens[index + 1];
  if (nextToken?.text !== 'the') return false;

  const afterThe = ctx.tokens[index + 2]?.text.toLowerCase() ?? '';
  const afterThat = ctx.tokens[index + 3]?.text.toLowerCase() ?? '';

  // Direct "is the chapter" pattern
  if (afterThat === 'chapter' || afterThe === 'chapter') {
    return true;
  }

  // Ordinal + chapter pattern like "20th chapter"
  if (/^\d+(st|nd|rd|th)$/.test(afterThe) && afterThat === 'chapter') {
    return true;
  }

  return false;
}

/**
 * Check if the token is inside a Table of Contents (TOC).
 * TOC content should never be labeled as it's navigation, not content.
 * Exported for use in positional-heuristics.ts as a global filter.
 *
 * IMPORTANT: Only match actual TOC elements, not navigation tables/navboxes which are valid content.
 */
// eslint-disable-next-line complexity -- TOC detection requires checking many CSS patterns, IDs, and xpath structures
export function isInTableOfContents(token: LinearizedToken): boolean {
  const cssPath = token.cssPath.toLowerCase();
  const classes = token.classes.map(c => c.toLowerCase());
  const elementId = token.elementId?.toLowerCase() ?? '';

  // Strict TOC patterns - only match actual Table of Contents elements
  // NOT navbox, toccolours, or navigation templates which are valid content
  const strictTocPatterns = [
    'toctext', 'tocnumber', 'mw-toc', 'toclevel', 'article-table-of-contents',
    'fandom-sticky-header__toc', 'page-side-tool__toc', 'wiki-page-toc',
    'article-toc', 'mw-parser-output-toc', 'page-toc',
  ];

  // Check token's own classes for strict TOC patterns
  if (classes.some(c => strictTocPatterns.some(p => c.includes(p)))) return true;

  // Check ancestor classes via cssPath for strict TOC patterns
  if (strictTocPatterns.some(p => cssPath.includes(p))) return true;

  // Check for TOC element ID (common in MediaWiki/Fandom)
  if (elementId === 'toc' || elementId === 'mw-toc' || elementId.includes('table-of-contents')) return true;

  // Check for #toc ID selector in cssPath (MediaWiki classic TOC)
  // The classic TOC has structure: div#toc > ul > li > a > span.toctext
  if (cssPath.includes('#toc')) return true;

  // Check for .toc class in cssPath with various suffixes
  // Matches: .toc, .toc , .toc>, .toc., .toc#, .toc:, .toc[
  if (/\.toc(?:[\s>.#:[\]]|$)/.test(cssPath)) return true;

  // Fandom modern TOC: Check xpath for specific structure
  // The TOC often has class "fandom" + "toc" or is inside article-toc container
  if (cssPath.includes('fandom-toc') || cssPath.includes('page__toc')) return true;

  // Check for li.toclevel pattern (MediaWiki TOC structure)
  if (cssPath.includes('li.toclevel') || classes.some(c => c.startsWith('toclevel'))) return true;

  // Fandom modern TOC: Check for specific structural patterns
  // TOC XPath pattern: /html/body/.../main/.../div[3]/div[2]/div/div[1]/ul/li[...]/a
  // Note: UL may not have bracket notation (e.g., /ul/li[1] vs /ul[1]/li[1])
  const xpath = token.xpath.toLowerCase();
  const hasMainUlLiStructure = xpath.includes('/main') &&
    xpath.includes('/ul') &&
    xpath.includes('/li');

  if (hasMainUlLiStructure) {
    // Check if this is a TOC anchor link (links to #section on same page)
    if (token.isLink && token.linkHref?.startsWith('#')) {
      return true;
    }
    // Check if text matches common TOC section names
    const text = token.text.toLowerCase();
    const tocSectionNames = [
      'history', 'gallery', 'trivia', 'references', 'navigation', 'contents',
      'manga guide', 'volume covers', 'characters', 'plot', 'summary',
      'see also', 'external links', 'notes', 'synopsis', 'overview',
      'background', 'reception', 'production', 'cast', 'episodes',
    ];
    if (tocSectionNames.some(name => text === name || text.startsWith(name))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if there's a "Chapters List:" pattern before the given index.
 * Used to detect volume summary paragraphs that appear after chapter lists.
 */
function hasChaptersListBefore(tokens: LinearizedToken[], index: number, lookback: number): boolean {
  for (let i = Math.max(0, index - lookback); i < index; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (t.text === 'List:' || t.text === 'List') {
      const prev = tokens[i - 1];
      if (prev?.text === 'Chapters') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if the token is after a Trivia/Notes/References section header.
 * This indicates the token is in a prose context, not a chapter listing.
 * Used to prevent "Bonus Story: ..." mentions in Trivia from being labeled as CHAPTER_TITLE.
 */
function isAfterTriviaSection(tokens: LinearizedToken[], index: number, lookback: number = 100): boolean {
  // Track the most recent MEANINGFUL header we find
  // Skip punctuation-only headers (like "[", "]" from edit links)
  let mostRecentHeader: string | null = null;

  for (let i = Math.max(0, index - lookback); i < index; i++) {
    const t = tokens[i];
    if (!t) continue;

    // Track headers as we go - we want the MOST RECENT header before this token
    if (t.isHeader) {
      const headerText = t.text.trim().toLowerCase();
      // Skip punctuation-only or single-char tokens (brackets, colons from edit links)
      // These are artifacts of Fandom header structure, not actual section names
      // Using character class with literal brackets: [ and ] need escaping inside character class
      if (headerText.length <= 2 && /^[[\](){}<>:;\-–—·•,.\s]*$/.test(headerText)) {
        continue;
      }
      mostRecentHeader = headerText;
    }
  }

  // If the most recent header is a trivia/notes section, we're in it
  if (!mostRecentHeader) {
    return false;
  }

  // FIXED: Normalize header text before matching
  // Handles variations like "Trivia []", "Trivia:", "Trivia (1)", etc.
  const normalized = mostRecentHeader
    .replace(/\s*\[.*?\]\s*/g, '') // Remove [edit], [], etc.
    .replace(/\s*\(.*?\)\s*/g, '') // Remove (1), (edit), etc.
    .replace(/^\d+\s+/, '') // Remove leading numbers
    .replace(/:\s*$/, '') // Remove trailing colon
    .trim();

  return /^(trivia|notes|references|see\s*also|external\s*links|gallery)$/i.test(normalized);
}

/**
 * Find the header text for a given table column.
 * Searches for table header tokens with matching tableCol value.
 * Reserved for future use when enhanced table structure analysis is implemented.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function findTableColumnHeader(tokens: LinearizedToken[], tableCol: number): string | null {
  for (const t of tokens) {
    if (t.isTableHeader && t.tableCol === tableCol) {
      return t.text;
    }
  }
  return null;
}

/**
 * Check if a token is a volume cover image based on multiple signals.
 * Used on list pages to identify volume cover images in tables.
 */
// eslint-disable-next-line complexity -- Volume cover detection uses 5 different approaches to handle wiki structure variations
function isVolumeCoverImage(token: LinearizedToken, tokens: LinearizedToken[]): boolean {
  // Approach 1: Image alt text contains "Volume" (e.g., "[IMAGE: Volume 1]")
  if (/volume\s*\d+/i.test(token.text) || /volume\s*\d+/i.test(token.imageAlt ?? '')) {
    return true;
  }

  // Approach 2: Image URL contains volume indicator
  const src = token.imageSrc ?? '';
  if (/vol(ume)?[-_]?\d+/i.test(src)) {
    return true;
  }

  // Approach 3: Check if table has a "Cover" header in the same table
  const tableMatch = token.xpath.match(/table\[\d+\]/);
  const tableId = tableMatch?.[0];

  if (tableId) {
    const hasCoverHeader = tokens.some(t =>
      t.isTableHeader && t.xpath.includes(tableId) && /^cover$/i.test(t.text)
    );
    if (hasCoverHeader) return true;

    // Approach 4: Check if image is in same column as "Volume X" text
    // This handles tables where images and volume labels share a column
    if (token.tableCol !== null) {
      const hasVolumeInSameColumn = tokens.some(t =>
        t.xpath.includes(tableId) &&
        t.tableCol === token.tableCol &&
        /^volume$/i.test(t.text)
      );
      if (hasVolumeInSameColumn) return true;
    }
  }

  // Approach 5: Check if there's a "Volume X" label in nearby tokens (within 20 tokens before/after)
  // This handles cases where volume label and image are visually close but not structurally linked
  const tokenIndex = tokens.indexOf(token);
  if (tokenIndex >= 0) {
    // Look backward
    const lookBack = Math.max(0, tokenIndex - 20);
    for (let i = tokenIndex - 1; i >= lookBack; i--) {
      const t = tokens[i];
      if (!t) continue;
      if (/^volume$/i.test(t.text) && tokens[i + 1]?.isNumeric) {
        return true;
      }
    }
    // Look forward
    const lookForward = Math.min(tokens.length, tokenIndex + 20);
    for (let i = tokenIndex + 1; i < lookForward; i++) {
      const t = tokens[i];
      if (!t) continue;
      if (/^volume$/i.test(t.text) && tokens[i + 1]?.isNumeric) {
        return true;
      }
    }
  }

  // Approach 6: Large image in a table on a page with volume patterns = likely volume cover
  // This is the fallback for tables that don't have structured column headers
  if (isLargeImage(token)) {
    const pageHasVolumePatterns = tokens.some(t => /^volume$/i.test(t.text));
    if (pageHasVolumePatterns) return true;
  }

  // Approach 7: Image inside a figure element in a table = likely volume cover on Fandom
  // Fandom uses figure elements for gallery/cover images
  if (token.xpath.includes('/figure/')) {
    const pageHasVolumes = tokens.some(t => /^volume$/i.test(t.text));
    if (pageHasVolumes) return true;
  }

  // Approach 8: Fallback - image in table on a page with volume patterns
  // On list pages, images in tables are almost always volume covers
  if (token.isInTable) {
    const pageHasVolumes = tokens.some(t => /^volume$/i.test(t.text));
    if (pageHasVolumes) return true;
  }

  // Approach 9: Most permissive - any image on a page with volume patterns
  // The calling rule already filters for list pages, so this is safe
  const pageHasVolumes = tokens.some(t => /^volume$/i.test(t.text));
  if (pageHasVolumes) return true;

  return false;
}

/**
 * Check if there's a "Volume X" pattern nearby an image token.
 * Used to detect volume covers in galleries.
 */
function hasVolumeNumberNearby(tokens: LinearizedToken[], imageIndex: number, range: number): boolean {
  // Helper to check if token is numeric (by flag or text pattern)
  const isNumericToken = (t: LinearizedToken | undefined): boolean =>
    t !== undefined && (t.isNumeric || /^\d+$/.test(t.text));

  // Check forward for "Volume X" (image followed by label)
  const lookForward = Math.min(tokens.length, imageIndex + range);
  for (let i = imageIndex + 1; i < lookForward; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (/^volume$/i.test(t.text)) {
      const next = tokens[i + 1];
      if (isNumericToken(next)) return true;
    }
    if (t.isImage) break; // Stop at next image
  }

  // Check backward for "Volume X" (label followed by image)
  const lookBack = Math.max(0, imageIndex - range);
  for (let i = imageIndex - 1; i >= lookBack; i--) {
    const t = tokens[i];
    if (!t) continue;
    if (/^volume$/i.test(t.text)) {
      const next = tokens[i + 1];
      if (isNumericToken(next)) return true;
    }
    if (t.isImage) break; // Stop at previous image
  }

  return false;
}

/**
 * Check if a parenthesis at the given index is a short parenthetical chapter number.
 * Returns true for patterns like "(6)", "(20)", "(123)" where the content is just 1-3 digits.
 * Returns false for longer content like "(Japanese Title)".
 */
function isShortParentheticalNumber(tokens: LinearizedToken[], parenIdx: number): boolean {
  const nextAfterParen = tokens[parenIdx + 1];
  const nextAfterNext = tokens[parenIdx + 2];

  if (!nextAfterParen || !nextAfterNext) return false;

  // Pattern: ( + 1-3 digit number + )
  const isNumber = /^\d{1,3}$/.test(nextAfterParen.text);
  const hasCloseParen = nextAfterNext.text === ')' || nextAfterNext.text === '）';

  return isNumber && hasCloseParen;
}

/**
 * Check if tokens following index contain "is the X volume/chapter" pattern.
 * Does NOT break on periods since titles like "It's Better To Be Eaten By Zombies If We Can't Relax In The Onsen!"
 * may contain periods or other punctuation.
 */
function hasVolumeDescriptionPattern(tokens: LinearizedToken[], index: number): boolean {
  for (let i = index + 1; i < Math.min(index + 30, tokens.length); i++) {
    const t = tokens[i];
    if (!t) break;
    // Stop at structural boundaries, not at periods (titles can have periods)
    if (t.isHeader || t.sectionType === 'navigation') break;
    if (t.text !== 'is') continue;
    const next = tokens[i + 1];
    if (next?.text !== 'the') continue;
    const afterThe = tokens[i + 2]?.text.toLowerCase() ?? '';
    const afterThat = tokens[i + 3]?.text.toLowerCase() ?? '';
    const isVolumePattern = afterThe === 'volume' || afterThat === 'volume' ||
      afterThe === 'chapter' || afterThat === 'chapter' ||
      /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+)$/i.test(afterThe);
    if (isVolumePattern) return true;
  }
  return false;
}

/**
 * Check if tokens following index contain "is the X chapter" pattern.
 * Used to identify chapter title in prose on chapter pages.
 */
function hasChapterDescriptionPattern(tokens: LinearizedToken[], index: number): boolean {
  for (let i = index + 1; i < Math.min(index + 40, tokens.length); i++) {
    const t = tokens[i];
    if (!t) break;
    if (t.isHeader || t.sectionType === 'navigation') break;
    if (t.text !== 'is') continue;
    const next = tokens[i + 1];
    if (next?.text !== 'the') continue;
    const afterThe = tokens[i + 2]?.text.toLowerCase() ?? '';
    const afterThat = tokens[i + 3]?.text.toLowerCase() ?? '';
    // Match "is the Xth chapter" or "is the X chapter"
    if (afterThat === 'chapter' || afterThe === 'chapter') return true;
    if (/^\d+(st|nd|rd|th)$/.test(afterThe) && afterThat === 'chapter') return true;
  }
  return false;
}

/**
 * Check if token is bold text that's likely a volume title.
 * Volume titles often appear as bold text in the opening paragraph followed by a citation [Fn X] or [1]
 * or directly followed by "is" (e.g., "Title is the Xth volume").
 */
// eslint-disable-next-line complexity -- Title candidate detection requires multiple heuristics to filter structural words, skip invalid contexts, and find citation patterns
function isBoldTitleCandidate(token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean {
  if (!token.isBold) return false;
  // RELAXED: Allow main_content OR infobox (Fandom nests content oddly in portable-infobox wrappers)
  // Only reject navigation and explicit header sections
  if (token.sectionType === 'navigation' || token.sectionType === 'header') return false;
  // Token should have meaningful content (not just punctuation or short words)
  if (token.text.length < 2) return false;
  // Skip structural words (these are field labels, not title content)
  if (/^(Volume|Chapter|Episodes?|Anime|Next|Previous|List|of|\d+)$/i.test(token.text)) return false;
  // Skip table header / metadata field labels
  if (/^(ISBN|Release|Date|Pages?|Chapters?|Cover|Characters?|Information|Guide|Japanese|English|Title|Summary|Plot|Contents?)$/i.test(token.text)) return false;
  // Skip if in cover characters context
  if (isInCoverCharactersContext(token, index, ctx)) return false;
  // Skip demographic terms (Shōnen, Seinen, etc. - with or without trailing punctuation)
  if (/^(Sh[oō]nen|Seinen|Sh[oō]jo|Josei|Kodomo)\)?$/i.test(token.text)) return false;
  // Skip month names (common in date fields)
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(token.text)) return false;
  // Skip tokens ending with colon (field labels like "Release:")
  if (token.text.endsWith(':')) return false;
  // Skip if token is a table header cell
  if (token.isTableHeader) return false;
  // Skip tokens starting with parenthesis (annotations like "(partial)")
  if (token.text.startsWith('(')) return false;
  // Skip if in infobox and near anime/episode labels (navigation context)
  if (token.isInInfobox || token.isInTable) {
    for (let i = Math.max(0, index - 10); i < Math.min(ctx.tokens.length, index + 5); i++) {
      const nearby = ctx.tokens[i];
      if (!nearby) continue;
      const text = nearby.text.toLowerCase();
      if (text === 'anime' || text === 'episodes' || text === 'episode') return false;
      if (text === 'previous' || text === 'next') return false;
    }
  }

  // Look further ahead for citation or "is" pattern (titles can be 20+ tokens long)
  // Increased to 60 tokens - titles can be long and followed by citation then "is"
  for (let i = index + 1; i < Math.min(index + 60, ctx.tokens.length); i++) {
    const t = ctx.tokens[i];
    if (!t) break;
    // Stop at structural boundaries
    if (t.isHeader || t.sectionType === 'navigation') break;
    // Found "is" followed by "the" - good indicator this is before a volume description
    if (t.text === 'is' && ctx.tokens[i + 1]?.text === 'the') return true;
    // Found citation pattern - complete bracket like "[1]" or "[Fn 1]"
    if (/^\[.+\]$/.test(t.text) || /^\[Fn\s*\d+\]$/i.test(t.text)) return true;
    // Found split citation pattern - "[" followed by "Fn" or number (handles tokenized brackets)
    if (t.text === '[') {
      const nextText = ctx.tokens[i + 1]?.text ?? '';
      if (/^(Fn|\d)/.test(nextText)) return true;
    }
  }
  return false;
}

/**
 * Find end of volume subtitle (before "is" or citation bracket).
 */
function findVolumeSubtitleEnd(tokens: LinearizedToken[], index: number): number {
  for (let i = index; i < Math.min(index + 25, tokens.length); i++) {
    const t = tokens[i];
    if (!t) break;
    if (t.text === 'is' || t.text === '[' || t.text === '.') return i - 1;
  }
  return index;
}

/**
 * Check if a token is at a chapter span boundary (structural stop condition)
 */
function isChapterSpanBoundary(token: LinearizedToken, startIndex: number, currentIndex: number): boolean {
  if (token.text === 'Chapter' && currentIndex > startIndex) return true;
  if (token.isHeader || token.isImage) return true;
  if (token.sectionType === 'navigation') return true;
  return false;
}

/**
 * Navigation patterns that indicate Prev/Next chapter navigation in infoboxes.
 * These links should NOT be labeled as CHAPTER_URL.
 */
const CHAPTER_NAV_PATTERNS = ['Next', 'Previous', 'Prev', '←', '→', '⟨', '⟩', '‹', '›', 'Guide', '«', '»'];

/**
 * Check if token is part of a Prev/Next navigation pattern in infobox.
 * These are navigation links, not chapter content links.
 */
function isChapterNavigation(_token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean {
  // Check for navigation indicators in nearby tokens
  const lookAhead = 5;
  const lookBehind = 5;

  // On list pages and volume pages, don't block chapters just because Volume tokens are nearby
  // (list pages naturally have Volume headers with chapters underneath,
  //  volume pages have "Volume X" in their infobox/body near chapter lists)
  const skipVolumeCheck = isListPage(ctx) || isVolumePage(ctx);

  for (let i = Math.max(0, index - lookBehind); i < Math.min(ctx.tokens.length, index + lookAhead); i++) {
    const t = ctx.tokens[i];
    if (t && CHAPTER_NAV_PATTERNS.some(p => t.text.includes(p))) {
      return true;
    }
    // Check for Volume X patterns nearby (chapter guide table)
    // Skip this check on list/volume pages where Volume+Chapter combinations are valid content
    if (!skipVolumeCheck && t && /^Volume\s*$/i.test(t.text)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if token is in a "Cover Characters" context (should not be labeled).
 * Cover characters are listed under "Cover Characters:" or "Characters:" labels in list pages.
 */
function isInCoverCharactersContext(token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean {
  // Check nearestLabelText for "Characters" pattern
  const labelText = token.nearestLabelText?.toLowerCase() ?? '';
  if (labelText.includes('characters')) return true;

  // Check nearby tokens for "Cover" + "Characters" pattern
  for (let i = Math.max(0, index - 5); i < Math.min(ctx.tokens.length, index + 2); i++) {
    const t = ctx.tokens[i];
    if (!t) continue;
    const text = t.text.toLowerCase();
    if (text === 'cover' || text === 'characters' || text === 'characters:') return true;
  }

  return false;
}

/**
 * Check if token is structural "List of" text that should not be labeled.
 * Reserved for future use when improved structural text filtering is implemented.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isStructuralListText(token: LinearizedToken): boolean {
  const text = token.text.toLowerCase();
  return text === 'list' || text === 'of' || text === 'list:';
}

/**
 * Check if H1 header at given index indicates a list page.
 */
function isListPageH1(ctx: SourceRuleContext, index: number): boolean {
  const t = ctx.tokens[index];
  if (!t?.isHeader || t.headerLevel !== 1) return false;

  const text = t.text.toLowerCase();

  // "List of ..." pattern
  if (text === 'list') return true;

  // Combined "Chapters and Volumes" in single token
  if (text.includes('chapters') && text.includes('volumes')) return true;

  // Check for "Chapters and Volumes" split across tokens
  if (text === 'chapters' || text === 'volumes') {
    const next = ctx.tokens[index + 1];
    const afterNext = ctx.tokens[index + 2];
    if (next?.text.toLowerCase() === 'and') {
      const afterText = afterNext?.text.toLowerCase() ?? '';
      if (afterText === 'volumes' || afterText === 'chapters') return true;
    }
  }

  return false;
}

/**
 * Detect if the current page is a "Chapters and Volumes" list page.
 * List pages have H1 headers like "Chapters and Volumes" or "List of Chapters".
 * These are index/listing pages, NOT individual chapter or volume pages.
 */
function isListPage(ctx: SourceRuleContext): boolean {
  const lookRange = Math.min(100, ctx.tokens.length);
  for (let i = 0; i < lookRange; i++) {
    if (isListPageH1(ctx, i)) return true;
  }
  return false;
}

/**
 * Detect if the current page is a manga/series-level page.
 * Manga pages describe the work itself (not a chapter or volume).
 *
 * Detection methods:
 * 1. URL contains "(manga)", "(series)", "(manhwa)", "(manhua)" - most reliable
 * 2. Opening paragraph contains "is a manga", "is a Japanese manga", etc.
 * 3. Infobox has Author/Artist/Publisher labels - fallback
 */
// eslint-disable-next-line complexity -- Manga page detection uses 3 different detection methods with multiple patterns each
export function isMangaPage(ctx: SourceRuleContext): boolean {
  // Method 1: URL-based detection (most reliable)
  // URLs like "/wiki/Vinland_Saga_(manga)" clearly indicate a manga page
  const url = ctx.url?.toLowerCase() ?? '';

  // Handle both decoded and URL-encoded parentheses
  // (manga) or %28manga%29
  const decodedUrl = decodeURIComponent(url);
  if (decodedUrl.includes('(manga)') || decodedUrl.includes('(series)') ||
      decodedUrl.includes('(manhwa)') || decodedUrl.includes('(manhua)') ||
      decodedUrl.includes('(comic)') || decodedUrl.includes('(webcomic)')) {
    return true;
  }

  // Method 2: Opening paragraph pattern detection
  // Manga pages typically have opening text like:
  // "Dorohedoro is a Japanese manga series written and illustrated by..."
  // "One Piece is a manga written by Eiichiro Oda"
  // Check first 400 tokens for these patterns (increased from 150 to handle large infoboxes)
  const openingRange = Math.min(400, ctx.tokens.length);
  const openingText = ctx.tokens.slice(0, openingRange).map(t => t.text).join(' ').toLowerCase();

  // Patterns that strongly indicate a manga page
  const mangaPatterns = [
    /is a (?:japanese )?manga/i,
    /is a (?:japanese )?manhwa/i,
    /is a (?:japanese )?manhua/i,
    /is a (?:web)?comic/i,
    /is a graphic novel/i,
    /manga (?:series )?(?:written|created|by)/i,
    /written and illustrated by/i,
    /serialized in/i,
  ];

  for (const pattern of mangaPatterns) {
    if (pattern.test(openingText)) {
      return true;
    }
  }

  // Method 3: Check for "Author:" label in infobox (very reliable indicator)
  // On manga pages, the infobox ALWAYS has "Author:" as a visible label
  // This is more reliable than checking nearestLabelText which might not be populated
  for (let i = 0; i < Math.min(300, ctx.tokens.length); i++) {
    const t = ctx.tokens[i];
    if (!t) continue;

    // Look for "Author:" or "Author" as a label token (ends with colon or is bold in infobox)
    const text = t.text.toLowerCase().trim();
    if ((text === 'author:' || text === 'author' || text === 'written by:' || text === 'written by') &&
        (t.isInInfobox || hasAncestorClassPattern(t, ['infobox', 'portable-infobox', 'pi-data']))) {
      return true;
    }
  }

  // Method 4: Infobox label detection via nearestLabelText (fallback)
  // Labels that indicate a manga/series-level page (not chapter or volume)
  const mangaIndicators = [
    'author', 'writer', 'written by', 'created by', 'mangaka',
    'artist', 'illustrator', 'illustrated by',
    'publisher', 'published by',
    'demographic', 'target audience',
    'genre', 'genres',
    'status', 'publication status',
    'magazine', 'serialized', 'serialization',
  ];

  const lookRange = Math.min(300, ctx.tokens.length);
  let indicatorCount = 0;
  const foundIndicators: string[] = [];

  for (let i = 0; i < lookRange; i++) {
    const t = ctx.tokens[i];
    if (!t) continue;

    // Check both infobox tokens AND tokens with infobox ancestor classes
    const isInInfoboxContext = t.isInInfobox ||
      hasAncestorClassPattern(t, ['infobox', 'portable-infobox', 'pi-data', 'pi-item']);

    if (!isInInfoboxContext) continue;

    const labelText = t.nearestLabelText?.toLowerCase() ?? '';
    if (!labelText) continue;

    // Check if any manga indicator matches
    for (const indicator of mangaIndicators) {
      if (labelText.includes(indicator)) {
        indicatorCount++;
        foundIndicators.push(`${indicator} (at ${i})`);
        break; // Don't double-count same token
      }
    }

    // If we find 2+ manga-level indicators, this is definitely a manga page
    if (indicatorCount >= 2) {
      return true;
    }
  }

  return false;
}

/**
 * Detect if the current page is a chapter page based on token patterns.
 * Chapter pages typically have "is the Xth chapter" pattern or "Chapter Number" label in infobox.
 */
function isChapterPage(ctx: SourceRuleContext): boolean {
  // CRITICAL - List pages (Chapters and Volumes) are NOT chapter pages
  if (isListPage(ctx)) return false;

  // NOTE - We do NOT check isMangaPage() here because chapter pages may inherit
  // manga-like labels (Author, Status) via nearestLabelText from the infobox.
  // Manga-specific filtering should happen in individual manga-level rules,
  // not as a global exclusion in the chapter page detector.

  // Look for chapter page indicators in the first 200 tokens
  const lookRange = Math.min(200, ctx.tokens.length);

  for (let i = 0; i < lookRange; i++) {
    const t = ctx.tokens[i];
    if (!t) continue;

    if (hasStrongHeaderChapterPattern(ctx, t, i)) return true;
    if (hasChapterNumberLabel(ctx, t, i)) return true;
    if (hasChapterProsePattern(ctx, t, i)) return true;
  }
  return false;
}

/**
 * Info about chapter guide table context for smarter labeling decisions
 */
interface ChapterGuideTableInfo {
  isInChapterGuide: boolean;
  hasNavboxClass: boolean;
  hasNavigationHeader: boolean;
  hasChaptersAndVolumes: boolean;
  volumeCount: number;
}

/**
 * Check if token is inside a chapter guide/navigation table.
 * Returns detailed info to allow smarter decisions about labeling.
 */
function getChapterGuideTableInfo(_token: LinearizedToken, index: number, ctx: SourceRuleContext): ChapterGuideTableInfo {
  const lookRange = 50; // Larger range to catch navigation context
  let volumeCount = 0;
  let hasNavigationHeader = false;
  let hasChaptersAndVolumes = false;
  let hasNavboxClass = false;

  for (let i = Math.max(0, index - lookRange); i < Math.min(ctx.tokens.length, index + lookRange); i++) {
    const t = ctx.tokens[i];
    if (!t) continue;
    const text = t.text.toLowerCase();
    // Check for Navigation header
    if (t.isHeader && text === 'navigation') hasNavigationHeader = true;
    // Check for "Chapters and Volumes" table header
    if (text.includes('chapters') && text.includes('volumes')) hasChaptersAndVolumes = true;
    if (text === 'chapters' && ctx.tokens[i + 1]?.text.toLowerCase() === 'and') hasChaptersAndVolumes = true;
    // Check for navbox classes (common in Fandom navigation tables)
    if (hasClassPattern(t, ['navbox', 'nav-table', 'mw-collapsible', 'navigation-not-searchable'])) {
      hasNavboxClass = true;
    }
    // Count Volume mentions
    if (/^volume$/i.test(t.text)) volumeCount++;
  }

  const isInChapterGuide = hasNavigationHeader || hasChaptersAndVolumes || hasNavboxClass || volumeCount >= 2;

  return {
    isInChapterGuide,
    hasNavboxClass,
    hasNavigationHeader,
    hasChaptersAndVolumes,
    volumeCount,
  };
}

/**
 * Backward-compatible wrapper for isInChapterGuideTable
 */
function isInChapterGuideTable(token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean {
  return getChapterGuideTableInfo(token, index, ctx).isInChapterGuide;
}

/**
 * Check if tokens following the index have an alt title closing pattern.
 * Looks for closing parenthesis or "is" (start of chapter description).
 */
function hasAltTitleClosingPattern(tokens: LinearizedToken[], index: number): boolean {
  for (let i = index + 1; i < Math.min(index + 15, tokens.length); i++) {
    const t = tokens[i];
    if (!t) break;
    const trimmed = t.text.trim();
    if (trimmed === ')' || trimmed === '）') return true;
    if (trimmed.toLowerCase() === 'is') return true;
  }
  return false;
}

/**
 * Find the end of a prose alt title span (CJK + furigana + romanization).
 * Pattern: 北人 (ノルマンニ), Noruman'ni
 */
function findProseAltTitleEnd(tokens: LinearizedToken[], index: number): number {
  let lastValidIndex = index;
  let sawClosingParen = false;

  for (let i = index + 1; i < Math.min(index + 20, tokens.length); i++) {
    const t = tokens[i];
    if (!t) break;
    const trimmed = t.text.trim().toLowerCase();
    // Stop at "is" (start of description)
    if (trimmed === 'is') break;
    // Stop at structural elements
    if (t.isHeader || t.isImage) break;
    // Track closing paren
    if (t.text.trim() === ')' || t.text.trim() === '）') {
      sawClosingParen = true;
      lastValidIndex = i;
      continue;
    }
    // After closing paren, include comma and romanization
    if (sawClosingParen) {
      if (t.text.trim() === ',') { lastValidIndex = i; continue; }
      if (t.isItalic && /^[a-zA-Z']+$/i.test(t.text.trim())) { lastValidIndex = i; continue; }
      // Stop if we hit non-romanization text
      if (trimmed.length > 0 && !/^[,\s]+$/.test(t.text)) break;
    }
    lastValidIndex = i;
  }
  return lastValidIndex;
}

/**
 * Find the end of a linked chapter URL span.
 * Spans all consecutive tokens that share the same linkHref.
 */
function findChapterUrlSpanEnd(tokens: LinearizedToken[], startIndex: number, maxLookahead: number): number {
  let targetHref: string | null = null;
  let lastLinkedIndex = startIndex;
  const maxIndex = Math.min(startIndex + maxLookahead, tokens.length);

  for (let i = startIndex; i < maxIndex; i++) {
    const t = tokens[i];
    if (!t || isChapterSpanBoundary(t, startIndex, i)) break;

    if (t.isLink && t.linkHref) {
      targetHref ??= t.linkHref;
      if (t.linkHref === targetHref) {
        lastLinkedIndex = i;
      } else {
        break; // Different link, stop
      }
    } else if (targetHref !== null) {
      break; // Exited the link span
    }
  }
  return lastLinkedIndex;
}

/**
 * Check if early tokens contain "Chapter X" pattern (more robust detection).
 * Checks regardless of header flags since tokenization may vary.
 */
function hasChapterH1Pattern(ctx: SourceRuleContext): boolean {
  for (let i = 0; i < Math.min(50, ctx.tokens.length); i++) {
    const t = ctx.tokens[i];
    if (!t) continue;
    // Check for "Chapter" token followed by number (tokenized form)
    if (/^chapter$/i.test(t.text)) {
      const next = ctx.tokens[i + 1];
      if (next && /^\d+$/.test(next.text)) {
        return true;
      }
    }
    // Check for combined "Chapter X" in single token
    if (/^chapter\s+\d+/i.test(t.text)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if tokens near the given index contain a range pattern (dash).
 * Used to detect volume pages that have chapter ranges in infobox.
 */
function hasChapterRangeInInfobox(tokens: LinearizedToken[], startIndex: number, lookahead: number): boolean {
  for (let j = startIndex; j < Math.min(startIndex + lookahead, tokens.length); j++) {
    const rangeToken = tokens[j];
    if (rangeToken && /^[-–—]$/.test(rangeToken.text)) return true;
  }
  return false;
}

/**
 * Check if page appears to be a volume page based on early token patterns.
 * Comprehensive detection similar to isChapterPage.
 */
// eslint-disable-next-line complexity -- Volume page detection requires many conditions to handle URL patterns, H1 headers, infobox labels, and various Fandom wiki structures
function isVolumePage(ctx: SourceRuleContext): boolean {
  // CRITICAL: List pages (Chapters and Volumes) are NOT volume pages
  if (isListPage(ctx)) return false;

  // URL-based detection (most reliable)
  // URLs like "/wiki/Volume_1" or "/wiki/Volume_1_(Series_Name)" clearly indicate a volume page
  const url = ctx.url?.toLowerCase() ?? '';
  const decodedUrl = decodeURIComponent(url);
  // Match "Volume_X" or "Volume X" patterns in URL (with optional series name in parens)
  if (/\/volume[_\s]+\d+/i.test(decodedUrl)) return true;

  // Look for volume page indicators in the first 200 tokens
  const lookRange = Math.min(200, ctx.tokens.length);

  for (let i = 0; i < lookRange; i++) {
    const t = ctx.tokens[i];
    if (!t) continue;
    const text = t.text.toLowerCase();

    // STRONG: Token in first 50 starting with "Volume X" pattern (e.g. "Volume 1")
    if (i < 50 && /^volume\s*\d+/i.test(t.text)) return true;

    // Check if token is in H1 context (via isHeader flag or cssPath for Fandom's title structure)
    const cssPath = t.cssPath.toLowerCase();
    const isInH1 = (t.isHeader && t.headerLevel === 1) ||
      cssPath.includes('#firstheading') ||
      cssPath.includes('.page-header__title') ||
      cssPath.includes('.mw-page-title-main');

    // STRONG: H1 header containing "volume" word (but not "List of Volumes")
    if (isInH1 && text.includes('volume') && !text.includes('list')) return true;

    // STRONG INDICATOR: Token text IS "Volume" followed by number
    if (text === 'volume' && /^\d+$/.test(ctx.tokens[i + 1]?.text ?? '')) {
      // Check if it's in a prominent position (H1, infobox, early in page)
      if (isInH1 || t.isInInfobox || i < 30) return true;
    }

    // Check for "Volume Number" label in infobox (strong indicator)
    if (t.isInInfobox && text === 'volume' && ctx.tokens[i + 1]?.text.toLowerCase() === 'number') {
      return true;
    }

    // Check for "Volume Number" as combined token or in nearestLabelText
    if (t.isInInfobox && text.includes('volume') && text.includes('number')) return true;

    // Check nearestLabelText for "volume number" pattern
    if (t.isInInfobox && t.nearestLabelText?.toLowerCase().includes('volume number')) return true;

    // Check for "is the Xth volume" pattern in prose
    if (text === 'is' && ctx.tokens[i + 1]?.text === 'the') {
      const afterThe = ctx.tokens[i + 2]?.text.toLowerCase() ?? '';
      const afterThat = ctx.tokens[i + 3]?.text.toLowerCase() ?? '';
      if (afterThat === 'volume' || afterThe === 'volume') return true;
      // Also check for ordinal + volume: "1st volume"
      if (/^\d+(st|nd|rd|th)$/.test(afterThe) && afterThat === 'volume') return true;
    }

    // Check for "Chapters" label in infobox with range pattern (volume pages have chapter ranges)
    const isChaptersLabel = t.isInInfobox && t.nearestLabelText?.toLowerCase() === 'chapters';
    if (isChaptersLabel && hasChapterRangeInInfobox(ctx.tokens, i, 10)) return true;
  }
  return false;
}

// ============================================================================
// Fandom Rules
// ============================================================================

export const FANDOM_RULES: SourceRule[] = [
  // -------------------------------------------------------------------------
  // Title Rules
  // -------------------------------------------------------------------------
  // Note: Uses hasAncestorClass because text may be in nested elements (h2.pi-title > span)
  {
    id: 'fandom-pi-title',
    entityType: 'TITLE',
    confidence: 0.95,
    priority: 100,
    description: 'Fandom portable infobox title (.pi-title)',
    classPatterns: ['pi-title'],
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Check both token's own classes AND ancestor classes (for h2.pi-title > span structure)
      if (!hasAncestorClass(token, 'pi-title')) return false;
      if (token.text.trim().length === 0) return false;
      if (ctx.matchedEntities.has('TITLE')) return false;
      // CRITICAL: Skip chapter pages - use CHAPTER_TITLE for chapter infobox titles
      if (isChapterPage(ctx)) return false;
      // CRITICAL: Skip list pages - "Chapters and Volumes" is not a series title
      if (isListPage(ctx)) return false;
      // Redundant check: Skip if H1 has "Chapter X" pattern (tokenized)
      if (hasChapterH1Pattern(ctx)) return false;
      // Skip "Volume X" or "Chapter X" patterns - these are not series titles
      if (/^(Volume|Chapter|Episode|Chapters|Volumes)$/i.test(token.text)) return false;
      // Skip common label words (these are labels, not values)
      if (/^(Title|Name|Author|Artist|Status|Genre|Genres|Publisher|Magazine|Format|Kanji|Romaji|Rōmaji|Japanese|English|Information|Info)$/i.test(token.text)) return false;
      // Skip titles starting with "Chapter X:" pattern
      if (/^Chapter\s+\d+/i.test(token.text)) return false;
      // Skip pure numbers (likely volume/chapter numbers)
      if (/^\d+$/.test(token.text)) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, (t) => !hasAncestorClass(t, 'pi-title')),
  },

  // CHAPTER_TITLE from .pi-title on chapter pages (inverse of fandom-pi-title)
  // Note: Uses hasAncestorClass because text may be in nested elements (h2.pi-title > span)
  {
    id: 'fandom-pi-chapter-title-header',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.95,
    priority: 98,
    description: 'Chapter title from portable infobox title (.pi-title) on chapter pages',
    classPatterns: ['pi-title'],
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Check both token's own classes AND ancestor classes (for h2.pi-title > span structure)
      if (!hasAncestorClass(token, 'pi-title')) return false;
      if (token.text.trim().length === 0) return false;
      if (ctx.matchedEntities.has('CHAPTER_TITLE')) return false;
      // ONLY match on chapter pages (inverse of fandom-pi-title)
      if (!isChapterPage(ctx)) return false;
      // Skip common label words
      if (/^(Title|Name|Chapter|Volume|Information|Info)$/i.test(token.text)) return false;
      // Skip pure numbers
      if (/^\d+$/.test(token.text)) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 10, (t) => !hasAncestorClass(t, 'pi-title')),
  },

  {
    id: 'fandom-page-title',
    entityType: 'TITLE',
    confidence: 0.9,
    priority: 95,
    description: 'Fandom page title (H1.page-header__title)',
    classPatterns: ['page-header__title'],
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isHeader || token.headerLevel !== 1) return false;
      if (!hasClassPattern(token, ['page-header__title', 'firstHeading', 'mw-page-title-main'])) return false;
      if (ctx.matchedEntities.has('TITLE')) return false;
      // CRITICAL: Skip chapter pages - H1 contains "Chapter X: Title" which is not the series title
      if (isChapterPage(ctx)) return false;
      // CRITICAL: Skip list pages - "Chapters and Volumes" is not a series title
      if (isListPage(ctx)) return false;
      // Redundant check: Skip if H1 has "Chapter X" pattern (tokenized)
      if (hasChapterH1Pattern(ctx)) return false;
      // Skip "Volume X" or "Chapter X" patterns - these are volume/chapter pages, not series pages
      if (/^(Volume|Chapter|Episode|Chapters|Volumes)$/i.test(token.text)) return false;
      // Skip common label words
      if (/^(Title|Name|Author|Artist|Status|Genre|Genres|Publisher|Magazine|Format|Kanji|Romaji|Rōmaji|Japanese|English|Information|Info)$/i.test(token.text)) return false;
      // Skip if this token is "Chapter" and next is a number (tokenized "Chapter 18")
      const nextToken = ctx.tokens[index + 1];
      if (/^chapter$/i.test(token.text) && /^\d+$/.test(nextToken?.text ?? '')) return false;
      // Skip titles starting with "Chapter X:" or "Volume X:" pattern
      if (/^(Chapter|Volume)\s+\d+/i.test(token.text)) return false;
      // Skip pure numbers
      if (/^\d+$/.test(token.text)) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 8, (t) => !t.isHeader),
  },

  // -------------------------------------------------------------------------
  // Volume Title/Subtitle Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-volume-subtitle',
    entityType: 'VOLUME_TITLE',
    confidence: 0.85,
    priority: 85,
    description: 'Volume subtitle in opening paragraph (bold text before "is the X volume")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (ctx.matchedEntities.has('VOLUME_TITLE')) return false;
      // CRITICAL: Skip chapter pages - they don't have volume titles
      if (isChapterPage(ctx)) return false;
      // Skip volume pages - "is the Xth volume" in page body confuses subtitle detection
      if (isVolumePage(ctx)) return false;
      // Allow detection up to token 200 (infobox uses 80-100+ tokens, title appears after)
      if (token.sectionType !== 'main_content' || index > 200) return false;
      // Skip structural words (field labels, not title content)
      if (/^(Volume|Chapter|Episodes?|Anime|Pages?|Cover|ISBN|Next|Previous|Information|Guide|Release|Date|Characters?|Japanese|English|Title|Summary|Plot|Contents?|List|of)$/i.test(token.text)) return false;
      // Skip pure numbers (e.g., episode numbers, page counts)
      if (/^\d+$/.test(token.text)) return false;
      // Skip punctuation and parenthetical notes (commas, dashes, "(partial)", etc.)
      if (/^[,;:\-–—·•]+$/.test(token.text)) return false;
      if (/^\(/.test(token.text)) return false; // Skip tokens starting with paren
      // Skip demographic terms (Shōnen, Seinen, etc. - with or without trailing punctuation)
      if (/^(Sh[oō]nen|Seinen|Sh[oō]jo|Josei|Kodomo)\)?$/i.test(token.text)) return false;
      // Skip month names (common in date fields)
      if (/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(token.text)) return false;
      // Skip tokens ending with colon (field labels)
      if (token.text.endsWith(':')) return false;
      // Skip table header cells
      if (token.isTableHeader) return false;
      return hasVolumeDescriptionPattern(ctx.tokens, index);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findVolumeSubtitleEnd(ctx.tokens, index),
  },

  // Fallback: Bold text followed by citation or "is" pattern
  {
    id: 'fandom-volume-subtitle-bold',
    entityType: 'VOLUME_TITLE',
    confidence: 0.8,
    priority: 84,
    description: 'Volume subtitle as bold text followed by citation or "is"',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (ctx.matchedEntities.has('VOLUME_TITLE')) return false;
      // CRITICAL: Skip chapter pages - they don't have volume titles
      if (isChapterPage(ctx)) return false;
      // Skip volume pages - "is the Xth volume" in page body confuses subtitle detection
      if (isVolumePage(ctx)) return false;
      // Allow detection up to token 200 (infobox uses 80-100+ tokens, title appears after)
      if (index > 200) return false;
      return isBoldTitleCandidate(token, index, ctx);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span all consecutive bold tokens that are part of the title
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 30, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at "is" (start of description pattern)
        if (t.text === 'is') break;
        // Stop at citation brackets
        if (/^\[/.test(t.text)) break;
        // Stop at infobox field labels (colon-terminated or known field names)
        if (t.text.endsWith(':')) break;
        if (/^(ISBN|Release|Date|Pages?|Chapters?|Cover|Information|Guide|Next|Previous)$/i.test(t.text)) break;
        // Stop at table headers (labels)
        if (t.isTableHeader) break;
        // Continue through bold text
        if (t.isBold) {
          endIndex = i;
        } else {
          // Non-bold token - stop if it's not punctuation within the title
          if (!/^[,;:!?\-—–]$/.test(t.text)) break;
          endIndex = i;
        }
      }
      return endIndex;
    },
  },

  // Volume subtitle on List pages - no position constraint (handles Volume 2, 3, 4...)
  // Works for subtitles both in tables and outside tables
  {
    id: 'fandom-volume-list-subtitle',
    entityType: 'VOLUME_TITLE',
    confidence: 0.8,
    priority: 83,
    description: 'Volume subtitle on List of Chapters/Volumes pages (bold text after Volume X)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip chapter pages - they don't have volume titles
      if (isChapterPage(ctx)) return false;
      // Skip volume pages - subtitle detection is for series/list pages listing volumes
      if (isVolumePage(ctx)) return false;
      // Must be bold
      if (!token.isBold) return false;
      // Must be in main_content
      if (token.sectionType !== 'main_content') return false;
      // Must have reasonable length (subtitle is typically 2+ chars)
      if (token.text.length < 2) return false;
      // Skip structural words (these indicate section headers, not subtitle content)
      if (/^(Volume|Chapter|Pages?|Cover|Characters?|Chapters|List:?|of|ISBN|Japanese|English|Anime|Episodes?|Next|Previous|Release|Date|Information|Guide|Title|Summary|Plot|Contents?)$/i.test(token.text)) return false;
      // Skip numbers
      if (/^\d+$/.test(token.text)) return false;
      // Skip page count references like [Fn 1], [3], etc.
      if (/^\[/.test(token.text)) return false;
      // Skip tokens starting with parenthesis (annotations like "(partial)")
      if (/^\(/.test(token.text)) return false;
      // Skip demographic terms (Shōnen, Seinen, etc. - with or without trailing punctuation)
      if (/^(Sh[oō]nen|Seinen|Sh[oō]jo|Josei|Kodomo)\)?$/i.test(token.text)) return false;
      // Skip month names (common in date fields)
      if (/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(token.text)) return false;
      // Skip tokens ending with colon (field labels)
      if (token.text.endsWith(':')) return false;
      // Skip table header cells
      if (token.isTableHeader) return false;

      // Must have "Volume X" pattern within 20 tokens BEFORE this token
      return hasVolumePatternBefore(ctx.tokens, index, 20);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span bold text until citation bracket or "is"
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 40, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at "is" (description pattern)
        if (t.text === 'is') break;
        // Stop at citation brackets
        if (/^\[/.test(t.text)) break;
        // Stop at infobox field labels (colon-terminated or known field names)
        if (t.text.endsWith(':')) break;
        if (/^(ISBN|Release|Date|Pages?|Chapters?|Cover|Information|Guide|Next|Previous)$/i.test(t.text)) break;
        // Stop at table headers (labels)
        if (t.isTableHeader) break;
        // Stop at structural boundaries
        if (t.isHeader || t.isInTable) break;
        // Continue through bold text
        if (t.isBold) {
          endIndex = i;
        } else if (!/^[,;:!?\-—–']$/.test(t.text)) {
          break;
        } else {
          endIndex = i;
        }
      }
      return endIndex;
    },
  },

  // List page volume number rule - labels generic "Volume X" as VOLUME_NUMBER on list pages
  // Higher priority than fandom-table-volume-title to catch list pages first
  {
    id: 'fandom-list-page-volume-number',
    entityType: 'VOLUME_NUMBER',
    confidence: 0.9,
    priority: 86,
    description: 'Volume number in tables on list pages (e.g., "Volume 1", "Volume 2")',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Only on list pages (e.g., "Chapters and Volumes")
      if (!isListPage(ctx)) return false;

      // Must be in a table
      if (!token.isInTable) return false;

      // Exclude sidebar/navigation sections (but allow main_content)
      // Note: We don't use isInChapterGuideTable here because it would block all volume
      // entries on list pages (since there are many "Volume" mentions nearby)
      if (token.sectionType === 'navigation' || token.sectionType === 'sidebar') return false;
      if (hasClassPattern(token, ['navbox', 'nav-table', 'navigation', 'navigation-not-searchable'])) return false;

      // Match "Volume" text
      if (!/^volume$/i.test(token.text)) return false;

      // Next token should be a number (generic volume pattern)
      const next = ctx.tokens[_index + 1];
      if (!next) return false;
      if (!/^\d+$/.test(next.text)) return false;

      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span "Volume" + number
      const next = ctx.tokens[index + 1];
      if (next && /^\d+$/.test(next.text)) {
        return index + 1;
      }
      return index;
    },
  },

  // Table-specific volume title rule (e.g., "Volume 1", "Volume 2" in table cells)
  // For non-list pages, or when manga has actual volume names
  {
    id: 'fandom-table-volume-title',
    entityType: 'VOLUME_TITLE',
    confidence: 0.85,
    priority: 82,
    description: 'Volume title in table cells (e.g., "Volume 1", "Volume 2")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip chapter pages - they don't have volume titles in tables
      if (isChapterPage(ctx)) return false;

      // Must be in a table
      if (!token.isInTable) return false;

      // Exclude infobox tables — "Volume 25" in a volume page infobox is metadata, not a volume title
      if (token.isInInfobox) return false;

      // CRITICAL FIX: Exclude navigation tables
      if (isInChapterGuideTable(token, index, ctx)) return false;
      if (token.sectionType === 'navigation') return false;
      if (hasClassPattern(token, ['navbox', 'nav-table', 'navigation', 'navigation-not-searchable'])) return false;

      // Match "Volume" text
      if (!/^volume$/i.test(token.text)) return false;

      // Next token should be a number
      const next = ctx.tokens[index + 1];
      if (!next) return false;
      if (!/^\d+$/.test(next.text)) return false;

      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span "Volume" + number
      const next = ctx.tokens[index + 1];
      if (next && /^\d+$/.test(next.text)) {
        return index + 1;
      }
      return index;
    },
  },

  // -------------------------------------------------------------------------
  // Cover Image Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-image-cover',
    entityType: 'COVER_IMAGE',
    confidence: 0.95,
    priority: 95,
    description: 'Fandom portable infobox image (.pi-image)',
    classPatterns: ['pi-image'],
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip volume pages - use VOLUME_COVER rule instead
      if (isVolumePage(ctx)) return false;
      return token.isImage &&
        hasClassPattern(token, ['pi-image']) &&
        !ctx.matchedEntities.has('COVER_IMAGE');
    },
  },

  {
    id: 'fandom-infobox-first-image',
    entityType: 'COVER_IMAGE',
    confidence: 0.85,
    priority: 90,
    description: 'First large image in Fandom infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip volume pages - use VOLUME_COVER rule instead
      if (isVolumePage(ctx)) return false;
      return token.isImage &&
        token.isInInfobox &&
        isLargeImage(token) &&
        !ctx.matchedEntities.has('COVER_IMAGE');
    },
  },

  // Volume cover image in infobox on volume pages (e.g., "Volume 1")
  {
    id: 'fandom-volume-page-infobox-cover',
    entityType: 'VOLUME_COVER',
    confidence: 0.95,
    priority: 96, // Higher than generic COVER_IMAGE rules to match first on volume pages
    description: 'Volume cover image in infobox on volume page',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be an image
      if (!token.isImage) return false;
      // Must be on a volume page
      if (!isVolumePage(ctx)) return false;
      // Only match once
      if (ctx.matchedEntities.has('VOLUME_COVER')) return false;
      // Check if in infobox context (token flag, ancestor class, or portable-infobox ancestor)
      const isInInfoboxContext = token.isInInfobox ||
        hasAncestorClassPattern(token, ['pi-image', 'portable-infobox', 'infobox', 'pi-item']) ||
        hasClassPattern(token, ['pi-image']);
      // On volume pages, the first large image in infobox context is the cover
      // Also accept if it's early in the page (first 100 tokens) and is a large image
      if (isInInfoboxContext) return true;
      if (index < 100 && isLargeImage(token)) return true;
      return false;
    },
  },

  // Volume cover images in tables on list pages (e.g., "Chapters and Volumes")
  {
    id: 'fandom-list-page-volume-cover',
    entityType: 'VOLUME_COVER',
    confidence: 0.9,
    priority: 88,
    description: 'Volume cover image in table on list page',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Must be an image
      if (!token.isImage) return false;
      // Must be on a list page (e.g., "Chapters and Volumes")
      if (!isListPage(ctx)) return false;

      // isVolumeCoverImage handles table/figure/proximity detection
      return isVolumeCoverImage(token, ctx.tokens);
    },
  },

  // Volume cover images in galleries on manga pages (e.g., "Vinland Saga (manga)")
  {
    id: 'fandom-manga-page-volume-cover',
    entityType: 'VOLUME_COVER',
    confidence: 0.85,
    priority: 87, // Slightly lower than list page rule
    description: 'Volume cover image in gallery on manga page',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be an image
      if (!token.isImage) return false;
      // Must be on a manga page (e.g., "Vinland Saga (manga)")
      if (!isMangaPage(ctx)) return false;
      // Skip if in Trivia section
      if (isAfterTriviaSection(ctx.tokens, index)) return false;

      return hasVolumeNumberNearby(ctx.tokens, index, 10);
    },
  },

  // -------------------------------------------------------------------------
  // Author/Artist Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-author',
    entityType: 'AUTHOR',
    confidence: 0.9,
    priority: 85,
    description: 'Author value in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip chapter pages - author is a manga-level entity
      if (isChapterPage(ctx)) return false;
      return isPiValue(token) &&
        matchesLabelPattern(token, LABEL_PATTERNS.author) &&
        token.distanceFromLabel <= 3 &&
        !ctx.matchedEntities.has('AUTHOR');
    },
    getSpanEnd: findPiValueEnd,
  },

  {
    id: 'fandom-pi-artist',
    entityType: 'ARTIST',
    confidence: 0.9,
    priority: 85,
    description: 'Artist value in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip chapter pages - artist is a manga-level entity
      if (isChapterPage(ctx)) return false;
      return isPiValue(token) &&
        matchesLabelPattern(token, LABEL_PATTERNS.artist) &&
        token.distanceFromLabel <= 3 &&
        !ctx.matchedEntities.has('ARTIST');
    },
    getSpanEnd: findPiValueEnd,
  },

  // Prose-based author detection: "written by X" pattern
  {
    id: 'fandom-prose-author',
    entityType: 'AUTHOR',
    confidence: 0.85,
    priority: 80,
    description: 'Author name following "written by" in prose',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (ctx.matchedEntities.has('AUTHOR')) return false;
      // Look for "written" or "by" in previous tokens
      const prev = ctx.tokens[index - 1];
      const prev2 = ctx.tokens[index - 2];
      if (!prev) return false;
      // Pattern: "written by X" or "created by X"
      const byMatch = prev.text.toLowerCase() === 'by' &&
        (prev2?.text.toLowerCase() === 'written' || prev2?.text.toLowerCase() === 'created');
      // Token should be a name (starts with capital, is a link to person page)
      const isName = /^[A-Z]/.test(token.text) && token.text.length > 1;
      return byMatch && isName;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span to next "and" or punctuation (author names are typically 2-3 tokens)
      let endIndex = index;
      for (let i = index; i < Math.min(index + 4, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === 'and' || t.text === ',' || t.text === '.') break;
        if (/^[A-Z]/.test(t.text) || t.text.length <= 2) {
          endIndex = i;
        } else {
          break;
        }
      }
      return endIndex;
    },
  },

  // Prose-based artist detection: "drawn by X" or "illustrated by X" pattern
  {
    id: 'fandom-prose-artist',
    entityType: 'ARTIST',
    confidence: 0.85,
    priority: 80,
    description: 'Artist name following "drawn by" in prose',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (ctx.matchedEntities.has('ARTIST')) return false;
      const prev = ctx.tokens[index - 1];
      const prev2 = ctx.tokens[index - 2];
      if (!prev) return false;
      // Pattern: "drawn by X" or "illustrated by X"
      const byMatch = prev.text.toLowerCase() === 'by' &&
        (prev2?.text.toLowerCase() === 'drawn' || prev2?.text.toLowerCase() === 'illustrated');
      const isName = /^[A-Z]/.test(token.text) && token.text.length > 1;
      return byMatch && isName;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      for (let i = index; i < Math.min(index + 4, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === 'and' || t.text === ',' || t.text === '.') break;
        if (/^[A-Z]/.test(t.text) || t.text.length <= 2) {
          endIndex = i;
        } else {
          break;
        }
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Publisher/Magazine Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-publisher',
    entityType: 'PUBLISHER',
    confidence: 0.9,
    priority: 80,
    description: 'Publisher value in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip chapter pages - publisher is a manga-level entity
      if (isChapterPage(ctx)) return false;
      return isPiValue(token) &&
        matchesLabelPattern(token, LABEL_PATTERNS.publisher) &&
        token.distanceFromLabel <= 3 &&
        !ctx.matchedEntities.has('PUBLISHER');
    },
    getSpanEnd: findPiValueEnd,
  },

  {
    id: 'fandom-pi-magazine',
    entityType: 'MAGAZINE',
    confidence: 0.9,
    priority: 80,
    description: 'Magazine value in Fandom portable infobox',
    // eslint-disable-next-line complexity -- Magazine detection requires checking multiple name patterns, pi-value context, label patterns, and filtering non-magazine tokens
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip chapter pages - magazine is a manga-level entity
      if (isChapterPage(ctx)) return false;
      // Only check tokens that look like magazine names first (for efficiency)
      const text = token.text.toLowerCase();
      const isMagazineName = text.includes('magazine') || text.includes('weekly') ||
        text.includes('monthly') || text.includes('jump') || text.includes('shounen') ||
        text.includes('shonen') || text.includes('seinen') || text.includes('shoujo') ||
        text === 'afternoon' || text === 'morning' || text === 'evening';
      if (!isMagazineName) return false;

      // Check if token is in pi-value (directly or via ancestor)
      const hasPiValue = isPiValue(token) || hasAncestorClassPattern(token, PI_VALUE_CLASSES);
      if (!hasPiValue) return false;

      // Accept various label patterns including partial matches
      // The nearestLabel might be "by:" instead of "Published by:" due to tokenization
      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      const hasLabel = matchesLabelPattern(token, LABEL_PATTERNS.magazine) ||
        matchesLabelPattern(token, LABEL_PATTERNS.publisher) ||
        labelText === 'by:' || labelText.includes('published');
      if (!hasLabel) return false;

      // Allow larger distance since multiple magazines can be listed (e.g., "Afternoon" is 13 tokens away)
      if (token.distanceFromLabel > 20) return false;
      // Skip dates and parentheses (part of publication range)
      if (token.matchesDatePattern || token.isNumeric) return false;
      if (token.text === '(' || token.text === ')' || token.text === '-' || token.text === '–') return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Magazine name spans until we hit a date, parenthesis, or separator
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 5, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at dates, parentheses, or separators
        if (t.matchesDatePattern || t.isNumeric) break;
        if (t.text === '(' || t.text === '-' || t.text === '–') break;
        if (isPiLabel(t)) break;
        // Only include word tokens (skip "Magazine" if it's a separate token)
        if (t.text.toLowerCase() === 'magazine') {
          endIndex = i;
          break;
        }
        endIndex = i;
      }
      return endIndex;
    },
  },

  // Original Run date range (e.g., "April 13, 2005 – July 25, 2025")
  {
    id: 'fandom-pi-original-run',
    entityType: 'ORIGINAL_RUN',
    confidence: 0.9,
    priority: 82, // Higher than magazine to match first
    description: 'Original run date range in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip chapter pages - original run is a manga-level entity
      if (isChapterPage(ctx)) return false;
      // Check if token is in pi-value (directly or via ancestor)
      if (!isPiValue(token) && !hasAncestorClassPattern(token, PI_VALUE_CLASSES)) return false;
      // Must be near "Original Run:" label
      if (!matchesLabelPattern(token, LABEL_PATTERNS.originalRun)) return false;
      if (token.distanceFromLabel > 3) return false;
      // Skip if already matched
      if (ctx.matchedEntities.has('ORIGINAL_RUN')) return false;
      // Must be date-like (month name, numeric, or date pattern)
      const isMonthName = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(token.text);
      if (!token.matchesDatePattern && !token.isNumeric && !isMonthName) return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Date range spans until we leave the pi-value or hit a new label
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at labels or headers
        if (isPiLabel(t) || t.isHeader) break;
        // Stop if we leave the pi-value container
        if (!isPiValue(t) && !hasAncestorClassPattern(t, PI_VALUE_CLASSES)) break;
        endIndex = i;
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Status/Demographic Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-status',
    entityType: 'STATUS',
    confidence: 0.9,
    priority: 80,
    description: 'Status value in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isPiValue(token) &&
      matchesLabelPattern(token, LABEL_PATTERNS.status) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('STATUS'),
    getSpanEnd: (
      _token: LinearizedToken,
      index: number,
      ctx: SourceRuleContext
    ): number => findSpanEnd(ctx.tokens, index, 3, (t) => isPiLabel(t)),
  },

  {
    id: 'fandom-pi-demographic',
    entityType: 'DEMOGRAPHIC',
    confidence: 0.9,
    priority: 80,
    description: 'Demographic value in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean =>
      isPiValue(token) &&
      matchesLabelPattern(token, LABEL_PATTERNS.demographic) &&
      token.distanceFromLabel <= 3 &&
      !ctx.matchedEntities.has('DEMOGRAPHIC'),
    getSpanEnd: (
      _token: LinearizedToken,
      index: number,
      ctx: SourceRuleContext
    ): number => findSpanEnd(ctx.tokens, index, 3, (t) => isPiLabel(t)),
  },

  // -------------------------------------------------------------------------
  // Volume/Chapter Count Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-volume-count',
    entityType: 'VOLUME_COUNT',
    confidence: 0.9,
    priority: 80,
    description: 'Volume count in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip manga pages - volume counts on manga pages refer to total volumes,
      // not individual volume entries. These pages describe the series, not volume content.
      if (isMangaPage(ctx)) {
        return false;
      }
      return isPiValue(token) &&
        token.isNumeric &&
        matchesLabelPattern(token, LABEL_PATTERNS.volumes) &&
        token.distanceFromLabel <= 3 &&
        !ctx.matchedEntities.has('VOLUME_COUNT');
    },
    // Return only the current token to prevent span expansion to adjacent tokens like "("
    getSpanEnd: (_token: LinearizedToken, index: number, _ctx: SourceRuleContext): number => index,
  },

  {
    id: 'fandom-pi-chapter-count',
    entityType: 'CHAPTER_COUNT',
    confidence: 0.9,
    priority: 80,
    description: 'Chapter count in Fandom portable infobox (includes ranges like "12 - 15")',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip manga pages - chapter counts on manga pages refer to total chapters,
      // not individual chapter entries. These pages describe the series, not chapter content.
      if (isMangaPage(ctx)) {
        return false;
      }
      // Must be in portable infobox value area (pi-data-value or pi-font class)
      if (!isPiValue(token)) return false;
      if (!token.isNumeric) return false;
      // Exclude TOC items - check both direct classes and ancestor classes (TOC container has 'toc' class)
      if (hasAncestorClassPattern(token, ['toc', 'toctext', 'tocnumber', 'toclevel'])) return false;
      if (token.sectionType === 'sidebar') return false; // TOC is in sidebar section
      // Must be near "Chapters" label in infobox
      if (!matchesLabelPattern(token, LABEL_PATTERNS.chapters)) return false;
      if (token.distanceFromLabel > 3) return false;
      return !ctx.matchedEntities.has('CHAPTER_COUNT');
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Handle ranges like "12 - 15" where each number may be a link
      // Pattern: number [-–—] number (with possible links)
      let endIndex = index;
      let foundDash = false;
      let foundSecondNumber = false;

      // Increased lookahead from 12 to 15 tokens for better range detection
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        const text = t.text.trim();

        // Stop at labels or headers
        if (isPiLabel(t) || t.isHeader) break;
        // Stop at known field names that indicate next section
        if (/^(Pages?|Release|ISBN|Information|Navigation|Cover)$/i.test(text)) break;

        // Include dash tokens (-, –, —)
        if (/^[-–—]+$/.test(text)) {
          endIndex = i;
          foundDash = true;
          continue;
        }

        // Include numbers (may be links to chapters) - continue even if it's a link
        if (/^\d+$/.test(text)) {
          endIndex = i;
          if (foundDash) foundSecondNumber = true;
          continue;
        }

        // Include combined dash-number tokens like "- 15" or "-15"
        if (/^[-–—]\s*\d+$/.test(text)) {
          endIndex = i;
          foundSecondNumber = true;
          break; // Found end of range
        }

        // If we have complete range (dash + second number), we're done
        if (foundDash && foundSecondNumber) break;

        // If we found dash but not second number yet, allow continuing
        // (to handle whitespace or link boundary tokens between dash and number)
        if (foundDash && !foundSecondNumber) continue;

        // Stop at chapter title text (like "Show" from "Show Club of the Dead")
        // Only stop if it's clearly title text (capitalized word > 2 chars)
        if (/^[A-Z][a-z]+/.test(text) && text.length > 2) break;

        // Stop at anything else unexpected
        break;
      }
      return endIndex;
    },
  },

  // Fallback: Chapter range/count in volume infobox (without pi-data-value requirement)
  // This handles infoboxes that use different CSS classes than standard pi-data-value
  {
    id: 'fandom-volume-chapter-range-fallback',
    entityType: 'CHAPTER_COUNT', // Will be converted to CHAPTER_RANGE by page-type-adjustments if range detected
    confidence: 0.85,
    priority: 89, // Higher than nav-chapter-link (88) and VOLUME_TITLE rules (82-85)
    description: 'Chapter range/count in volume infobox (fallback without pi-data-value)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // STRICT GATE: Must be in table or infobox FIRST (like chapter rules)
      if (!token.isInTable && !token.isInInfobox) return false;
      // Skip chapter pages (volume pages only)
      if (isChapterPage(ctx)) return false;
      // Skip list pages - numeric tokens near "Chapters" are chapter numbers, not counts
      if (isListPage(ctx)) return false;
      // Skip if already matched
      if (ctx.matchedEntities.has('CHAPTER_COUNT')) return false;
      // Must be numeric
      if (!token.isNumeric) return false;
      // Exclude TOC items - check both direct classes and ancestor classes
      if (hasAncestorClassPattern(token, ['toc', 'toctext', 'tocnumber', 'toclevel'])) return false;
      if (token.sectionType === 'sidebar') return false; // TOC is in sidebar section
      // Must be near "Chapters" label (tighter tolerance like chapter rules)
      if (!matchesLabelPattern(token, LABEL_PATTERNS.chapters)) return false;
      if (token.distanceFromLabel > 3) return false;
      // All conditions passed
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Handle ranges like "1 - 5" where each number may be a link
      // Pattern: number [-–—] number (with possible links)
      let endIndex = index;
      let foundDash = false;
      let foundSecondNumber = false;

      // Lookahead for range detection
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        const text = t.text.trim();

        // Stop at labels or headers
        if (isPiLabel(t) || t.isHeader) break;
        // Stop at known field names that indicate next section
        if (/^(Pages?|Release|ISBN|Information|Navigation|Cover)$/i.test(text)) break;

        // Include dash tokens (-, –, —)
        if (/^[-–—]+$/.test(text)) {
          endIndex = i;
          foundDash = true;
          continue;
        }

        // Include numbers (may be links to chapters)
        if (/^\d+$/.test(text)) {
          endIndex = i;
          if (foundDash) foundSecondNumber = true;
          continue;
        }

        // Include combined dash-number tokens like "- 5" or "-5"
        if (/^[-–—]\s*\d+$/.test(text)) {
          endIndex = i;
          foundSecondNumber = true;
          break; // Found end of range
        }

        // If we have complete range (dash + second number), we're done
        if (foundDash && foundSecondNumber) break;

        // If we found dash but not second number yet, allow continuing
        if (foundDash && !foundSecondNumber) continue;

        // Stop at chapter title text (capitalized word > 2 chars)
        if (/^[A-Z][a-z]+/.test(text) && text.length > 2) break;

        // Stop at anything else unexpected
        break;
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Manga Page Specific Rules
  // -------------------------------------------------------------------------
  // On manga/series pages, the infobox often shows "Volumes: (220 Chapters)"
  // where "220" should be labeled as CHAPTER_COUNT (total chapters in series)
  {
    id: 'fandom-manga-page-chapter-count',
    entityType: 'CHAPTER_COUNT',
    confidence: 0.9,
    priority: 90, // High priority to match before other rules
    description: 'Chapter count in manga page infobox (pattern: X Chapters)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // ONLY apply on manga pages
      if (!isMangaPage(ctx)) return false;
      // Must be numeric
      if (!token.isNumeric) return false;
      // Must be in infobox
      if (!token.isInInfobox && !isPiValue(token)) return false;
      // Skip if already matched
      if (ctx.matchedEntities.has('CHAPTER_COUNT')) return false;
      // Check if next token contains "Chapters" (e.g., "Chapters)" or "Chapters")
      const nextToken = ctx.tokens[index + 1];
      if (!nextToken) return false;
      const nextText = nextToken.text.toLowerCase();
      return nextText.includes('chapter');
    },
  },

  // On manga/series pages, the infobox often shows "Volumes: 29 (220 Chapters)"
  // where "29" should be labeled as VOLUME_COUNT (total volumes in series)
  {
    id: 'fandom-manga-page-volume-count',
    entityType: 'VOLUME_COUNT',
    confidence: 0.9,
    priority: 91, // Higher than chapter count to match first
    description: 'Volume count in manga page infobox (near Volumes: label)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // ONLY apply on manga pages
      if (!isMangaPage(ctx)) return false;
      // Must be numeric
      if (!token.isNumeric) return false;
      // Must be in infobox or pi-value
      if (!token.isInInfobox && !isPiValue(token) && !hasAncestorClassPattern(token, PI_VALUE_CLASSES)) return false;
      // Skip if already matched
      if (ctx.matchedEntities.has('VOLUME_COUNT')) return false;
      // Must be near "Volumes:" label
      if (!matchesLabelPattern(token, LABEL_PATTERNS.volumes)) return false;
      if (token.distanceFromLabel > 3) return false;
      // Must NOT be followed by "Chapters" (that would be chapter count)
      const nextToken = ctx.tokens[index + 1];
      if (nextToken?.text.toLowerCase().includes('chapter')) return false;
      logger.debug('[fandom-manga-page-volume-count] MATCHED', {
        token: token.text,
        index,
        nearestLabel: token.nearestLabelText,
        url: ctx.url,
      });
      return true;
    },
  },

  // Fallback: Page count in volume infobox (without pi-data-value requirement)
  // This handles infoboxes that use different CSS classes than standard pi-data-value
  {
    id: 'fandom-volume-page-count-fallback',
    entityType: 'VOLUME_PAGE_COUNT',
    confidence: 0.85,
    priority: 89, // Higher than nav-chapter-link (88) and VOLUME_TITLE rules (82-85)
    description: 'Page count in volume infobox (fallback without pi-data-value)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // STRICT GATE: Must be in table or infobox FIRST
      if (!token.isInTable && !token.isInInfobox) return false;
      // Must NOT be on a chapter page
      if (isChapterPage(ctx)) return false;
      // Skip if already matched
      if (ctx.matchedEntities.has('VOLUME_PAGE_COUNT')) return false;
      // Must be numeric
      if (!token.isNumeric) return false;
      // Exclude TOC items - check ancestor classes
      if (hasAncestorClassPattern(token, ['toc', 'toctext', 'tocnumber', 'toclevel'])) return false;
      // Must be near "Pages" label (tighter tolerance)
      if (!matchesLabelPattern(token, LABEL_PATTERNS.pages)) return false;
      if (token.distanceFromLabel > 3) return false;
      // All conditions passed
      return true;
    },
  },

  // -------------------------------------------------------------------------
  // Volume Page Chapter Count Rule (from Chapters section)
  // -------------------------------------------------------------------------

  // CHAPTER_COUNT - Count chapters from the Chapters section on volume pages
  // This counts actual chapter list items, not the info box range
  {
    id: 'fandom-volume-chapters-section-count',
    entityType: 'CHAPTER_COUNT',
    confidence: 0.85,
    priority: 75, // Lower priority than pi-chapter-count to allow infobox to take precedence
    description: 'Chapter count from Chapters section on volume pages (counts list items)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Only on volume pages
      if (!isVolumePage(ctx)) return false;
      // Only if we haven't already matched CHAPTER_COUNT from infobox
      if (ctx.matchedEntities.has('CHAPTER_COUNT')) return false;
      // Must be numeric (the count value)
      if (!token.isNumeric) return false;
      // Must be in main content (not TOC)
      if (token.sectionType !== 'main_content') return false;
      // Exclude TOC items - check ancestor classes too (TOC container has 'toc' class)
      if (hasAncestorClassPattern(token, ['toc', 'toctext', 'tocnumber', 'toclevel'])) return false;

      // Look for "Chapters" header followed by list/table of chapter entries
      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      if (!labelText.includes('chapter') || token.distanceFromLabel > 5) return false;

      // Check if there's a range pattern nearby - if so, this is CHAPTER_RANGE, not COUNT
      return !hasRangePatternNearby(ctx.tokens, index, 5);
    },
  },

  // -------------------------------------------------------------------------
  // Chapter Page Infobox Rules (Volume Number, Chapter Number, Title)
  // -------------------------------------------------------------------------

  // CHAPTER_BELONGS_TO_VOLUME - "Volume Number" or "Volume" label in chapter page infobox
  {
    id: 'fandom-pi-chapter-volume',
    entityType: 'CHAPTER_BELONGS_TO_VOLUME',
    confidence: 0.9,
    priority: 82,
    description: 'Volume number that a chapter belongs to (from "Volume Number" label in infobox)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Must be in infobox and on a chapter page
      if (!token.isInInfobox) return false;
      if (!isChapterPage(ctx)) return false;
      if (!token.isNumeric) return false;
      // Must be near "Volume" or "Volume Number" label
      if (!matchesLabelPattern(token, LABEL_PATTERNS.volumeNumber)) return false;
      if (token.distanceFromLabel > 3) return false;
      return !ctx.matchedEntities.has('CHAPTER_BELONGS_TO_VOLUME');
    },
  },

  // CHAPTER_NUMBER - "Chapter Number" label in chapter page infobox
  {
    id: 'fandom-pi-chapter-number',
    entityType: 'CHAPTER_NUMBER',
    confidence: 0.9,
    priority: 82,
    description: 'Chapter number from "Chapter Number" label in infobox',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Must be in infobox and on a chapter page
      if (!token.isInInfobox) return false;
      if (!isChapterPage(ctx)) return false;
      if (!token.isNumeric) return false;
      // Must be near "Chapter Number" label
      if (!matchesLabelPattern(token, LABEL_PATTERNS.chapterNumber)) return false;
      if (token.distanceFromLabel > 3) return false;
      return !ctx.matchedEntities.has('CHAPTER_NUMBER');
    },
  },

  // CHAPTER_NUMBER - "Chapter X" pattern in early tokens (H1 area)
  // Handles both separate tokens ("Chapter", "18") and combined ("Chapter 18")
  {
    id: 'fandom-h1-chapter-number',
    entityType: 'CHAPTER_NUMBER',
    confidence: 0.95,
    priority: 92,
    description: 'Chapter number from "Chapter X:" pattern in page header',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Should be in first 100 tokens
      if (index > 100) return false;
      // Don't match in navigation tables
      if (token.sectionType === 'navigation') return false;
      if (token.isInTable) return false;
      if (ctx.matchedEntities.has('CHAPTER_NUMBER')) return false;

      // Case 1: Separate tokens - token is just a number, previous is "Chapter"
      if (/^\d+$/.test(token.text)) {
        const prevToken = ctx.tokens[index - 1];
        if (prevToken && /^chapter$/i.test(prevToken.text)) {
          return true;
        }
      }

      // Case 2: Combined token - "Chapter 18" or "Chapter 18:"
      if (/^chapter\s+\d+/i.test(token.text)) {
        return true;
      }

      return false;
    },
    getSpanEnd: (token: LinearizedToken, index: number, _ctx: SourceRuleContext): number => {
      // If combined token, return same index
      if (/^chapter\s+\d+/i.test(token.text)) {
        return index;
      }
      // If separate tokens, just the number
      return index;
    },
  },

  // CHAPTER_TITLE from H1 title portion after "Chapter X:"
  {
    id: 'fandom-h1-chapter-title',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.9,
    priority: 91,
    description: 'Chapter title from H1 after "Chapter X:" pattern',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be in H1 page title. Note: getCSSPath uses #id format when element has ID,
      // so we check cssPath for #firstheading (ID) rather than .page-header__title (class)
      const cssPath = token.cssPath.toLowerCase();
      const isInH1 = token.isHeader && token.headerLevel === 1 ||
        cssPath.includes('#firstheading') ||
        cssPath.includes('.page-header__title') ||
        cssPath.includes('.mw-page-title-main');
      if (!isInH1) return false;
      if (index > 150) return false;
      // NOTE: Don't check matchedEntities.has('CHAPTER_TITLE') - CHAPTER_TITLE is not
      // a single-value entity. We want to label BOTH the H1 title AND the infobox title.
      // Must be on a chapter page
      if (!isChapterPage(ctx)) return false;
      // Don't match in navigation or tables
      if (token.sectionType === 'navigation') return false;
      if (token.isInTable) return false;
      // Skip structural tokens
      if (/^(Chapter|:|\d+)$/i.test(token.text)) return false;
      // Skip empty or very short tokens
      if (token.text.trim().length < 2) return false;
      // Must follow "Chapter X :" pattern - look back for it
      let foundChapterPattern = false;
      for (let i = index - 1; i >= Math.max(0, index - 5); i--) {
        const t = ctx.tokens[i];
        if (!t) continue;
        if (t.text === ':') {
          // Check if there's a number before the colon
          const prev = ctx.tokens[i - 1];
          if (prev && /^\d+$/.test(prev.text)) {
            foundChapterPattern = true;
            break;
          }
        }
      }
      return foundChapterPattern;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // H1 chapter title is typically a single word/phrase before navigation elements
      // Stop at common navigation words that appear in page headers
      const navigationWords = new Set(['sign', 'edit', 'history', 'purge', 'talk', 'view', 'source']);
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 10, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at navigation section
        if (t.sectionType === 'navigation') break;
        // Stop at navigation words
        if (navigationWords.has(t.text.toLowerCase())) break;
        // Stop at edit icons, etc.
        if (hasClassPattern(t, ['mw-editsection', 'edit-page'])) break;
        // Stop at header boundary
        if (t.isHeader && t.headerLevel !== ctx.tokens[index]?.headerLevel) break;
        // Only extend if it looks like part of a title (not punctuation only)
        if (/^[a-zA-Z]/.test(t.text)) {
          endIndex = i;
        } else {
          break; // Stop at punctuation or numbers
        }
      }
      return endIndex;
    },
  },

  // CHAPTER_TITLE - "Title" label in chapter page infobox
  {
    id: 'fandom-pi-chapter-title',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.9,
    priority: 90,
    description: 'Chapter title from "Title" label in infobox on chapter pages',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be in infobox and on a chapter page
      if (!token.isInInfobox) return false;
      if (!isChapterPage(ctx)) return false;
      // Skip empty or very short tokens
      if (token.text.trim().length < 2) return false;
      // Skip if it's just a number (that's likely chapter number)
      if (/^\d+$/.test(token.text)) return false;
      // Skip "Chapter X:" prefix - the "Chapter" word, numbers, and colons
      if (/^chapter$/i.test(token.text)) return false;
      if (token.text === ':') return false;
      // CRITICAL: Skip if nearestLabelText is Kanji/Rōmaji/Japanese (those are alt titles)
      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      if (/kanji|romaji|rōmaji|japanese|hiragana|katakana/.test(labelText)) return false;
      // Also check if the token itself is a label word
      if (/^(kanji|romaji|rōmaji|title|name|chapter|volume|information|info|japanese|english)$/i.test(token.text)) return false;
      // Check if nearestLabelText is specifically "title" or "name"
      const isTitleLabel = /^(title|name)$/i.test(labelText);
      // Check if a preceding token (within reasonable range) is "Title" label
      let hasTitleLabel = false;
      for (let j = index - 1; j >= Math.max(0, index - 5); j--) {
        const prevTok = ctx.tokens[j];
        if (!prevTok) continue;
        if (/^(title|name)$/i.test(prevTok.text) && prevTok.isInInfobox) {
          hasTitleLabel = true;
          break;
        }
        // Stop if we hit a different label (Kanji, Rōmaji, etc.)
        if (/^(kanji|romaji|rōmaji)$/i.test(prevTok.text)) break;
      }
      if (!isTitleLabel && !hasTitleLabel) return false;
      if (token.distanceFromLabel > 4 && !hasTitleLabel) return false;
      return !ctx.matchedEntities.has('CHAPTER_TITLE');
    },
    getSpanEnd: findPiValueEnd,
  },

  // Fallback: Chapter title after "Title" label token in chapter page infobox
  {
    id: 'fandom-chapter-title-after-label',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 89,
    description: 'Chapter title following "Title" label token in infobox',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox) return false;
      if (!isChapterPage(ctx)) return false;
      if (ctx.matchedEntities.has('CHAPTER_TITLE')) return false;
      if (token.text.trim().length < 2) return false;
      // Skip "Chapter X:" prefix parts
      if (/^\d+$/.test(token.text)) return false;
      if (/^chapter$/i.test(token.text)) return false;
      if (token.text === ':') return false;
      // Skip if nearestLabelText is Kanji/Rōmaji (those are alt titles)
      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      if (/kanji|romaji|rōmaji|japanese/.test(labelText)) return false;
      // Skip if the token itself is a label word
      if (/^(kanji|romaji|rōmaji|title|name|chapter|volume|information|info|japanese|english)$/i.test(token.text)) return false;
      // Check if "Title" or "Name" label exists within preceding tokens
      let hasTitleLabel = false;
      for (let j = index - 1; j >= Math.max(0, index - 5); j--) {
        const prevTok = ctx.tokens[j];
        if (!prevTok) continue;
        if (/^(title|name)$/i.test(prevTok.text) && prevTok.isInInfobox) {
          hasTitleLabel = true;
          break;
        }
        // Stop if we hit a different label
        if (/^(kanji|romaji|rōmaji)$/i.test(prevTok.text)) break;
      }
      return hasTitleLabel;
    },
    getSpanEnd: findPiValueEnd,
  },

  // CHAPTER_ALT_TITLE - Kanji/Rōmaji labels in chapter page infobox
  {
    id: 'fandom-pi-chapter-alt-title-kanji-romaji',
    entityType: 'CHAPTER_ALT_TITLE',
    confidence: 0.9,
    priority: 88,
    description: 'Chapter alt title from Kanji/Rōmaji label in infobox on chapter pages',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox) return false;
      if (!isChapterPage(ctx)) return false;
      if (token.text.trim().length < 2) return false;
      // Skip if it's just a label word
      if (/^(kanji|romaji|rōmaji|japanese|title|name|chapter|volume|english|info|information)$/i.test(token.text)) return false;
      // Must be near a Kanji/Rōmaji label
      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      const isAltTitleLabel = /kanji|romaji|rōmaji|japanese|hiragana|katakana/.test(labelText);
      // Also check preceding token for Kanji/Rōmaji label
      let hasAltTitleLabel = false;
      for (let j = index - 1; j >= Math.max(0, index - 3); j--) {
        const prevTok = ctx.tokens[j];
        if (!prevTok) continue;
        if (/^(kanji|romaji|rōmaji)$/i.test(prevTok.text) && prevTok.isInInfobox) {
          hasAltTitleLabel = true;
          break;
        }
      }
      if (!isAltTitleLabel && !hasAltTitleLabel) return false;
      if (token.distanceFromLabel > 3 && !hasAltTitleLabel) return false;
      return true;
    },
    getSpanEnd: findPiValueEnd,
  },

  // CHAPTER_TITLE from bold text at start of prose on chapter pages
  {
    id: 'fandom-prose-chapter-title',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 85,
    description: 'Chapter title as bold text at start of prose on chapter pages',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (ctx.matchedEntities.has('CHAPTER_TITLE')) return false;
      if (!isChapterPage(ctx)) return false;
      // Must be bold
      if (!token.isBold) return false;
      // Must be in main content, not sidebar/nav
      if (token.sectionType !== 'main_content') return false;
      // Should be within first 250 tokens (after infobox)
      if (index > 250) return false;
      // Skip structural/label words
      if (/^(Chapter|Volume|Episode|\d+|:)$/i.test(token.text)) return false;
      // Must have meaningful length
      if (token.text.length < 2) return false;
      // Check if followed by "is the Xth chapter" pattern
      return hasChapterDescriptionPattern(ctx.tokens, index);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span bold text until citation or "is"
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 30, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === 'is') break;
        if (/^\[/.test(t.text)) break;
        // Stop at opening parenthesis (starts citations/notes)
        if (t.text === '(') break;
        if (t.isBold) {
          endIndex = i;
        } else if (!/^[,;:!?\-—–]$/.test(t.text)) {
          // Only allow internal punctuation (comma, colon, hyphen, etc.)
          // NOT opening brackets/parentheses
          break;
        } else {
          endIndex = i;
        }
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Page Count Rules
  // -------------------------------------------------------------------------

  // Chapter page count - "Pages" label in chapter page infobox
  {
    id: 'fandom-pi-chapter-page-count',
    entityType: 'PAGE_COUNT',
    confidence: 0.9,
    priority: 80,
    description: 'Page count in chapter page infobox (e.g., "Pages: 40")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be on a chapter page
      if (!isChapterPage(ctx)) return false;
      // Must be in infobox (either with pi-data-value class or isInInfobox flag)
      if (!isPiValue(token) && !token.isInInfobox) return false;
      // Must be a number (check both isNumeric flag and regex)
      if (!token.isNumeric && !/^\d+$/.test(token.text)) return false;
      // Check if nearestLabelText matches OR if preceding token is "Pages"
      const matchesLabel = matchesLabelPattern(token, LABEL_PATTERNS.pages);
      const prevToken = ctx.tokens[index - 1];
      const prevIsPages = prevToken?.text.toLowerCase() === 'pages';
      if (!matchesLabel && !prevIsPages) return false;
      if (token.distanceFromLabel > 5 && !prevIsPages) return false;
      return !ctx.matchedEntities.has('PAGE_COUNT');
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Handle patterns like "40 (JP)[1] 40 (EN)[2]"
      let endIndex = index;
      let lastNumericIndex = index;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (isPiLabel(t) || t.isHeader) break;
        if (t.isNumeric) lastNumericIndex = i;
        if (/^[()[\]0-9]$/.test(t.text) || /^\([A-Z]{2}\)$/i.test(t.text)) {
          endIndex = i;
          continue;
        }
        if (t.text === ',' || t.text === '/' || /^[A-Z]{2}$/.test(t.text)) {
          endIndex = i;
          continue;
        }
      }
      return Math.max(endIndex, lastNumericIndex);
    },
  },

  // Fallback: Page count after "Pages" label token in chapter page infobox
  {
    id: 'fandom-chapter-page-count-after-label',
    entityType: 'PAGE_COUNT',
    confidence: 0.85,
    priority: 79,
    description: 'Page count following "Pages" label token in chapter infobox',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox) return false;
      if (!isChapterPage(ctx)) return false;
      if (ctx.matchedEntities.has('PAGE_COUNT')) return false;
      // Must be a number
      if (!/^\d+$/.test(token.text)) return false;
      // Check if previous token is "Pages" label
      const prev = ctx.tokens[index - 1];
      if (!prev || prev.text.toLowerCase() !== 'pages') return false;
      if (!prev.isInInfobox) return false;
      return true;
    },
  },

  // Volume page count - "Pages" label in volume page infobox
  {
    id: 'fandom-pi-volume-page-count',
    entityType: 'VOLUME_PAGE_COUNT',
    confidence: 0.9,
    priority: 80,
    description: 'Page count in volume page infobox (e.g., "Pages: 192")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must NOT be on a chapter page (volume or series pages)
      if (isChapterPage(ctx)) return false;
      // Must be in infobox (either with pi-data-value class or isInInfobox flag)
      if (!isPiValue(token) && !token.isInInfobox) return false;
      // Must be a number (check both isNumeric flag and regex)
      if (!token.isNumeric && !/^\d+$/.test(token.text)) return false;
      // Check if nearestLabelText matches OR if preceding token is "Pages"
      const matchesLabel = matchesLabelPattern(token, LABEL_PATTERNS.pages);
      const prevToken = ctx.tokens[index - 1];
      const prevIsPages = prevToken?.text.toLowerCase() === 'pages';
      if (!matchesLabel && !prevIsPages) return false;
      if (token.distanceFromLabel > 5 && !prevIsPages) return false;
      return !ctx.matchedEntities.has('VOLUME_PAGE_COUNT');
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Handle patterns like "192 (JP)[1] 200 (EN)[2]"
      let endIndex = index;
      let lastNumericIndex = index;
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (isPiLabel(t) || t.isHeader) break;
        if (t.isNumeric) lastNumericIndex = i;
        if (/^[()[\]0-9]$/.test(t.text) || /^\([A-Z]{2}\)$/i.test(t.text)) {
          endIndex = i;
          continue;
        }
        if (t.text === ',' || t.text === '/' || /^[A-Z]{2}$/.test(t.text)) {
          endIndex = i;
          continue;
        }
      }
      return Math.max(endIndex, lastNumericIndex);
    },
  },

  // Fallback: Page count after "Pages" label token in volume page infobox
  {
    id: 'fandom-volume-page-count-after-label',
    entityType: 'VOLUME_PAGE_COUNT',
    confidence: 0.85,
    priority: 79,
    description: 'Page count following "Pages" label token in volume infobox',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox) return false;
      if (isChapterPage(ctx)) return false; // Not a chapter page
      if (ctx.matchedEntities.has('VOLUME_PAGE_COUNT')) return false;
      // Must be a number
      if (!/^\d+$/.test(token.text)) return false;
      // Check if previous token is "Pages" label
      const prev = ctx.tokens[index - 1];
      if (!prev || prev.text.toLowerCase() !== 'pages') return false;
      if (!prev.isInInfobox) return false;
      return true;
    },
  },

  // -------------------------------------------------------------------------
  // ISBN Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-isbn',
    entityType: 'ISBN',
    confidence: 0.9,
    priority: 80,
    description: 'ISBN in Fandom portable infobox (handles multiple like JP/EN)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be in infobox
      if (!token.isInInfobox) return false;

      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      const isNearIsbnLabel = labelText.includes('isbn');

      // Helper: search backwards for "ISBN" text token
      const hasIsbnTokenNearby = (): boolean => {
        for (let i = Math.max(0, index - 5); i < index; i++) {
          if (ctx.tokens[i]?.text === 'ISBN') return true;
        }
        return false;
      };

      // Match "ISBN" text itself (the word in the value area)
      if (token.text === 'ISBN') {
        return isNearIsbnLabel || token.distanceFromLabel <= 5 || hasIsbnTokenNearby();
      }
      // Match ISBN numbers (978-X-XXXX-XXXX-X or 979-X-XXXX-XXXX-X format)
      if (/^(978|979)[-\d]/.test(token.text)) {
        // Accept if near ISBN label OR if "ISBN" text token is nearby
        return isNearIsbnLabel || token.distanceFromLabel <= 8 || hasIsbnTokenNearby();
      }
      // Check if previous token was "ISBN" and this is the number part
      const prev = ctx.tokens[index - 1];
      if (prev?.text === 'ISBN' && /^[\d\-X]+$/.test(token.text)) {
        return true;
      }
      // Check for ISBN-like number patterns (10+ digits when dashes removed)
      const digitsOnly = token.text.replace(/[-X]/gi, '');
      if (/^\d{10,13}$/.test(digitsOnly)) {
        // Accept if near ISBN label OR if "ISBN" text is nearby
        return isNearIsbnLabel || hasIsbnTokenNearby();
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Handle patterns like "ISBN 978-4-0915-7575-3 (JP) ISBN 978-1-9747-2067-5 (EN)"
      let endIndex = index;
      for (let i = index + 1; i < Math.min(index + 30, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at labels or headers (but not ISBN text in value)
        if ((isPiLabel(t) && t.text !== 'ISBN') || t.isHeader) break;
        // Stop at Navigation section
        if (t.text === 'Navigation') break;
        // Continue through ISBN text markers
        if (t.text === 'ISBN') {
          endIndex = i;
          continue;
        }
        // Continue through ISBN components (numbers, dashes, X)
        if (/^[\d\-X]+$/.test(t.text)) {
          endIndex = i;
          continue;
        }
        // Continue through country codes like (JP), (EN), JP, EN
        if (/^\(?[A-Z]{2}\)?$/i.test(t.text)) {
          endIndex = i;
          continue;
        }
        // Continue through parentheses
        if (t.text === '(' || t.text === ')') {
          endIndex = i;
          continue;
        }
        // Continue through bracketed references [1], [2]
        if (/^\[\d+\]$/.test(t.text)) {
          endIndex = i;
          continue;
        }
      }
      return endIndex;
    },
  },

  // Table-specific ISBN rule (e.g., "978-4-0915-7561-6" in volume table cells)
  {
    id: 'fandom-table-isbn',
    entityType: 'ISBN',
    confidence: 0.9,
    priority: 81,
    description: 'ISBN in volume table cells (e.g., "978-4-0915-7561-6")',
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      // Must be in a table (not infobox - that's handled by fandom-pi-isbn)
      if (!token.isInTable) return false;
      if (token.isInInfobox) return false;

      // Match ISBN-13 format starting with 978 or 979
      if (/^(978|979)[-\d]/.test(token.text)) return true;

      // Match ISBN-10 format (10 digits with possible dashes)
      const digitsOnly = token.text.replace(/-/g, '');
      if (/^\d{10}$/.test(digitsOnly)) return true;

      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // ISBN may be split across tokens with hyphens
      let lastIsbnToken = index;
      const startCol = ctx.tokens[index]?.tableCol;

      for (let i = index + 1; i < Math.min(index + 10, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop if we leave this table cell
        if (t.tableCol !== startCol) break;
        // Continue if hyphen or digit group
        if (/^[-\d]+$/.test(t.text)) {
          lastIsbnToken = i;
        } else {
          break;
        }
      }
      return lastIsbnToken;
    },
  },

  // -------------------------------------------------------------------------
  // Genre Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-genre',
    entityType: 'GENRE',
    confidence: 0.85,
    priority: 75,
    description: 'Genre values in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      // Check if token is in a pi-data-value container (may be nested inside links)
      const hasPiValue = isPiValue(token) || hasAncestorClassPattern(token, PI_VALUE_CLASSES);
      if (!hasPiValue) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.genre)) return false;
      if (token.distanceFromLabel > 5) return false;
      // Exclude label tokens themselves (e.g., "Genre:" which may have pi-data-value class)
      if (token.text.endsWith(':')) return false;
      // Debug: Log matched genre token
      logger.debug('[GENRE] Matched token', { text: token.text, index: _index, cssPath: token.cssPath, nearestLabel: token.nearestLabelText, distanceFromLabel: token.distanceFromLabel });
      // Filter out navigation-like text (e.g., "Volumes" breadcrumb, "Volume" page title)
      const navPatterns = ['volume', 'volumes', 'chapter', 'chapters', 'characters', 'episodes', 'wiki', 'category', 'episode'];
      if (navPatterns.includes(token.text.toLowerCase())) return false;
      // Filter out category links
      if (token.linkHref?.includes('Category:')) return false;
      // Filter out page title elements
      if (hasClassPattern(token, ['mw-page-title-main', 'page-header__title'])) return false;
      // Skip separator tokens like "/" to only match genre names
      if (token.text === '/' || token.text === '|' || token.text === ',') return false;
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Increased lookahead to 20 tokens to capture long genre lists like
      // "Action / Adventure / Drama / Historical / Psychological / Seinen"
      let endIndex = index;
      const maxLook = Math.min(index + 20, ctx.tokens.length);

      for (let i = index + 1; i < maxLook; i++) {
        const t = ctx.tokens[i];
        if (!t) break;

        // Stop at labels or headers
        if (isPiLabel(t) || t.isHeader) break;

        // Stop at opening parenthesis (alt title boundary)
        if (t.text === '(') break;

        // Stop at CJK text (alt title in Japanese/Chinese/Korean)
        if (/[\u3000-\u9fff\uac00-\ud7af]/.test(t.text)) break;

        // Stop at category links (next field)
        if (t.linkHref?.includes('Category:')) break;

        // Stop if we leave the pi-data-value container (exit the infobox field)
        if (!isPiValue(t) && !hasAncestorClassPattern(t, PI_VALUE_CLASSES)) break;

        endIndex = i;
      }
      // Debug: Log span end calculation
      const spanTokens = ctx.tokens.slice(index, endIndex + 1).map(t => t.text);
      logger.debug('[GENRE] getSpanEnd', { startIndex: index, endIndex, spanLength: endIndex - index + 1, spanTokens });
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Release Date Rules
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-release-date',
    entityType: 'RELEASE_DATE',
    confidence: 0.85,
    priority: 75,
    description: 'Release date in Fandom portable infobox',
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      if (!isPiValue(token)) return false;
      if (!matchesLabelPattern(token, LABEL_PATTERNS.releaseDate)) return false;
      if (token.distanceFromLabel > 3) return false;
      // Check for date-like content: date pattern, numeric, or month name
      const isMonthName = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(token.text);
      return token.matchesDatePattern || token.isNumeric || isMonthName;
    },
    getSpanEnd: (
      _token: LinearizedToken,
      index: number,
      ctx: SourceRuleContext
    ): number => findSpanEnd(ctx.tokens, index, 8, (t) => {
      // Stop at another label or header
      if (isPiLabel(t) || t.isHeader) return true;
      // Continue if date-like or punctuation
      const isDateLike = t.matchesDatePattern || t.isNumeric ||
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t.text) ||
        /^[/\-,()]$/.test(t.text) || /^\([a-z]{2}\)$/i.test(t.text); // (JP), (EN), etc.
      // Stop at non-date-like content (except for country codes like "(JP)")
      return !isDateLike;
    }),
  },

  // Fallback: text following "Release Date" label token in infobox
  {
    id: 'fandom-release-date-after-label',
    entityType: 'RELEASE_DATE',
    confidence: 0.8,
    priority: 70,
    description: 'Release date following label token',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox || ctx.matchedEntities.has('RELEASE_DATE')) return false;
      // Skip label words - these are field names, not dates
      if (/^(information|info|details|data|release|date|published|kanji|romaji|title|name)$/i.test(token.text)) return false;
      // Must be date-like content
      const isMonthName = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(token.text);
      if (!token.matchesDatePattern && !token.isNumeric && !isMonthName) return false;
      // Check previous tokens for "Release" + "Date" or "Release Date"
      const prev = ctx.tokens[index - 1];
      const prev2 = ctx.tokens[index - 2];
      if (prev?.text.toLowerCase() === 'date' && prev2?.text.toLowerCase() === 'release') return true;
      if (prev?.text.toLowerCase().includes('release')) return true;
      return false;
    },
    getSpanEnd: (_t: LinearizedToken, i: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, i, 8, (t) => isPiLabel(t) || t.isHeader || t.text === 'Anime'),
  },

  // Table-specific release date rule (e.g., "March 19, 2019" in volume table cells)
  {
    id: 'fandom-table-release-date',
    entityType: 'VOLUME_RELEASE_DATE',
    confidence: 0.85,
    priority: 76,
    description: 'Release date in volume table cells (e.g., "March 19, 2019")',
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      // Must be in a table, not infobox
      if (!token.isInTable) return false;
      if (token.isInInfobox) return false;

      // Match date patterns:
      // "March", "January", etc. (start of "Month DD, YYYY")
      // "2019", "2020", etc. (year tokens)
      // ISO format "2019-03-19"
      const isMonthName = /^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(token.text);
      const isIsoDate = /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(token.text);

      return isMonthName || isIsoDate;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span to include full date: "March 19" + ", " + "2019"
      // Allow superscript refs like [3] AFTER the year but don't include them
      const startCol = ctx.tokens[index]?.tableCol;
      const startRow = ctx.tokens[index]?.tableRow;
      let endIndex = index;
      let foundYear = false;

      for (let i = index + 1; i < Math.min(index + 10, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at next cell or row boundary
        if (t.tableCol !== startCol || t.tableRow !== startRow) break;
        // Include day numbers, commas, and year
        if (/^\d{1,2}$/.test(t.text) || t.text === ',' || /^\d{4}$/.test(t.text)) {
          endIndex = i;
          if (/^\d{4}$/.test(t.text)) foundYear = true;
        }
        // Allow (but don't include) superscript refs like [3] AFTER year
        else if (/^\[\d+\]$/.test(t.text) && foundYear) {
          break; // Stop here, don't include ref
        }
        else {
          break;
        }
      }
      return endIndex;
    },
  },

  // -------------------------------------------------------------------------
  // Alt Title Rules (ALT_TITLE = series only, VOLUME_ALT_TITLE = volume pages)
  // -------------------------------------------------------------------------
  {
    id: 'fandom-pi-alt-title',
    entityType: 'ALT_TITLE',
    confidence: 0.85,
    priority: 70,
    description: 'Alternative title in Fandom portable infobox (series pages only)',
    condition: (token: LinearizedToken, _index: number, ctx: SourceRuleContext): boolean => {
      // Skip chapter pages - they use CHAPTER_ALT_TITLE
      if (isChapterPage(ctx)) return false;
      if (hasChapterH1Pattern(ctx)) return false;
      // Skip volume pages - they use VOLUME_ALT_TITLE
      if (isVolumePage(ctx)) return false;
      return isPiValue(token) &&
        matchesLabelPattern(token, LABEL_PATTERNS.altTitle) &&
        token.distanceFromLabel <= 3;
    },
    getSpanEnd: findPiValueEnd,
  },

  // Fallback: text immediately following Rōmaji/Kana/Kanji label token in infobox (series only)
  {
    id: 'fandom-alt-title-after-label',
    entityType: 'ALT_TITLE',
    confidence: 0.85,
    priority: 75,
    description: 'Alt title following Rōmaji/Kana label token (series pages only)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox || token.text.length < 2) return false;
      // Skip chapter and volume pages
      if (isChapterPage(ctx)) return false;
      if (hasChapterH1Pattern(ctx)) return false;
      if (isVolumePage(ctx)) return false;
      const prev = ctx.tokens[index - 1];
      if (!prev) return false;
      const labels = ['rōmaji', 'romaji', 'kana', 'kanji', 'japanese'];
      return labels.includes(prev.text.toLowerCase());
    },
    getSpanEnd: (_t: LinearizedToken, i: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, i, 8, (t) => isPiLabel(t) || t.isHeader ||
        ['release', 'anime', 'chapter'].includes(t.text.toLowerCase())),
  },

  // VOLUME_ALT_TITLE - Kanji/Rōmaji labels on volume pages
  {
    id: 'fandom-pi-volume-alt-title',
    entityType: 'VOLUME_ALT_TITLE',
    confidence: 0.9,
    priority: 88,
    description: 'Volume alt title from Kanji/Rōmaji label in infobox on volume pages',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!token.isInInfobox) return false;
      if (token.text.trim().length < 2) return false;
      // Must NOT be a chapter page
      if (isChapterPage(ctx)) return false;
      if (hasChapterH1Pattern(ctx)) return false;
      // Must BE a volume page
      if (!isVolumePage(ctx)) return false;
      // Skip if it's just a label word
      if (/^(kanji|romaji|rōmaji|japanese|title|name|volume)$/i.test(token.text)) return false;
      // Must be near a Kanji/Rōmaji label
      const labelText = token.nearestLabelText?.toLowerCase() ?? '';
      const isAltTitleLabel = /kanji|romaji|rōmaji|japanese|hiragana|katakana/.test(labelText);
      // Also check preceding token
      let hasAltTitleLabel = false;
      for (let j = index - 1; j >= Math.max(0, index - 3); j--) {
        const prevTok = ctx.tokens[j];
        if (!prevTok) continue;
        if (/^(kanji|romaji|rōmaji)$/i.test(prevTok.text) && prevTok.isInInfobox) {
          hasAltTitleLabel = true;
          break;
        }
      }
      if (!isAltTitleLabel && !hasAltTitleLabel) return false;
      if (token.distanceFromLabel > 3 && !hasAltTitleLabel) return false;
      return true;
    },
    getSpanEnd: findPiValueEnd,
  },

  // -------------------------------------------------------------------------
  // Volume Summary Rules (for table cells)
  // -------------------------------------------------------------------------
  {
    id: 'fandom-table-volume-summary',
    entityType: 'VOLUME_SUMMARY',
    confidence: 0.75,
    priority: 65,
    description: 'Volume summary/description text in table cells',
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      // Must be in a table
      if (!token.isInTable) return false;

      // Look for paragraph-like text (multiple words, not a label/header)
      if (token.text.length < 15) return false;
      if (token.isTableHeader) return false;

      // Should be prose text (contains spaces, punctuation)
      if (!/\s/.test(token.text)) return false;

      // Check if this looks like narrative text (starts with capital, has sentence structure)
      if (!/^[A-Z]/.test(token.text)) return false;

      // Avoid matching dates, ISBNs, chapter lists, or short fragments
      if (/^\d/.test(token.text)) return false;
      if (/^(Chapter|Vol|ISBN|#\d|Volume\s+\d)/i.test(token.text)) return false;

      // Should have sentence-like characteristics (multiple words)
      const wordCount = token.text.split(/\s+/).length;
      if (wordCount < 4) return false;

      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span until we hit a structural boundary or different content type
      const startCol = token.tableCol;
      const startRow = token.tableRow;

      for (let i = index; i < Math.min(index + 100, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;

        // Stop if we leave this table cell
        if (t.tableCol !== startCol || t.tableRow !== startRow) return i - 1;

        // Stop at headers or images
        if (t.isHeader || t.isImage) return i - 1;
      }
      return index;
    },
  },

  // Volume summary rule - detects start of summary paragraph (word-by-word tokenized)
  // Works for summaries in tables (Fandom list pages) or outside tables
  {
    id: 'fandom-volume-summary-start',
    entityType: 'VOLUME_SUMMARY',
    confidence: 0.7,
    priority: 64,
    description: 'Volume summary prose text (word-by-word tokenized)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (token.sectionType !== 'main_content') return false;
      if (token.isInInfobox) return false;
      if (token.isHeader) return false;
      if (token.isBold) return false; // Summaries are not bold

      // CRITICAL: Exclude TOC (Table of Contents) items
      // TOC has toctext, tocnumber, toclevel classes - should NOT be labeled as summary
      if (hasAncestorClassPattern(token, ['toc', 'toctext', 'tocnumber', 'toclevel', 'toc-item'])) return false;
      // Also check cssPath for .toc container (catches cases where class is on parent)
      if (token.cssPath.toLowerCase().includes('.toc')) return false;

      // Must start with capital letter (sentence start)
      if (!/^[A-Z]/.test(token.text)) return false;

      // Skip structural tokens
      const structuralPattern = /^(Chapter|Volume|#\d|ISBN|Pages?:|Cover|Characters|Japanese|English|List:?)$/i;
      if (structuralPattern.test(token.text)) return false;

      // Must have "Chapters List:" within 50 tokens BEFORE (indicates we're after chapter list)
      if (!hasChaptersListBefore(ctx.tokens, index, 50)) return false;

      // Check that previous token isn't part of chapter entries
      const prevToken = ctx.tokens[index - 1];
      if (prevToken?.text === ')' || prevToken?.text === '）') return false;
      if (prevToken?.isItalic) return false;

      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span until next Volume indicator or structural boundary
      for (let i = index; i < Math.min(index + 200, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at next Volume X pattern
        if (/^volume$/i.test(t.text) && ctx.tokens[i + 1]?.isNumeric) return i - 1;
        // Stop at headers
        if (t.isHeader) return i - 1;
        // Stop at next "Chapters List:" pattern
        if (t.text === 'Chapters' && ctx.tokens[i + 1]?.text.startsWith('List')) return i - 1;
      }
      return Math.min(index + 199, ctx.tokens.length - 1);
    },
  },

  // -------------------------------------------------------------------------
  // Chapter Title Rules (for category/list pages)
  // -------------------------------------------------------------------------

  // Side Story / Bonus Chapter rule - must be higher priority than AUTHOR rules (85)
  // to prevent "Side Story: Dogland Saga" from being labeled as AUTHOR due to "story" keyword
  {
    id: 'fandom-list-page-side-story',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.9,
    priority: 89, // Higher than AUTHOR rules (85) to prevent "Story" keyword match
    description: 'Side story/bonus chapter entries on list pages',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Only on list pages (e.g., "Chapters and Volumes")
      if (!isListPage(ctx)) return false;

      // Match "Side" when followed by "Story" or "Story:"
      // Note: Removed table/list requirement - side stories can appear in various contexts
      if (!/^side$/i.test(token.text)) return false;

      const next = ctx.tokens[index + 1];
      if (!next) return false;

      // Next token should be "Story" or "Story:" (tokenizer may or may not include colon)
      if (!/^story:?$/i.test(next.text)) return false;

      return true;
    },
    getSpanEnd: (token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Include the full side story title: "Side Story: Dogland Saga"
      // Look for end markers: next structural element, Volume pattern, or Chapter pattern
      let endIndex = index;
      const maxLook = Math.min(index + 15, ctx.tokens.length);
      const startTableRow = token.tableRow;

      for (let i = index + 1; i < maxLook; i++) {
        const t = ctx.tokens[i];
        if (!t) break;

        // Stop at structural boundaries
        if (t.isHeader || t.isImage) break;

        // Stop at next chapter/volume pattern
        if (/^(chapter|volume)$/i.test(t.text)) break;

        // Stop at section type changes
        if (t.sectionType === 'navigation') break;

        // Stop at table row changes (if in table)
        if (token.isInTable && t.tableRow !== startTableRow) break;

        // Stop if we transition from list to non-list context
        if (token.isInList && !t.isInList) break;

        endIndex = i;
      }

      return endIndex;
    },
  },

  {
    id: 'fandom-chapter-link-start',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.9,
    priority: 85,
    description: 'Chapter link starting with "Chapter" followed by number',
    // eslint-disable-next-line complexity -- Chapter detection requires many conditions to avoid false positives from navigation
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be text "Chapter"
      if (token.text !== 'Chapter') return false;

      // Skip actual chapter pages - they use fandom-pi-chapter-title rule instead
      if (isChapterPage(ctx)) return false;

      // CRITICAL: Skip manga pages - "Chapter" mentions in prose are not chapter titles
      // But exempt volume pages — they legitimately contain chapter lists
      if (isMangaPage(ctx) && !isVolumePage(ctx)) return false;

      // Exclude navigation sections
      if (token.sectionType === 'navigation' || token.sectionType === 'header' || token.sectionType === 'footer') {
        return false;
      }

      // Exclude Prev/Next navigation patterns in infoboxes
      if (isChapterNavigation(token, index, ctx)) {
        return false;
      }

      // Check chapter guide table context for smart labeling decisions
      const guideTableInfo = getChapterGuideTableInfo(token, index, ctx);
      if (guideTableInfo.isInChapterGuide) {
        const isInMainContent = token.sectionType === 'main_content' || token.sectionType === 'sidebar';
        const isActualNavigation = guideTableInfo.hasNavboxClass || guideTableInfo.hasNavigationHeader;

        if (!isInMainContent) {
          // Not in main content - always exclude
          return false;
        }

        // In main_content: only require separator if we're in actual navigation structure
        // (navbox or navigation header), not just because "chapters and volumes" text is nearby
        if (isActualNavigation) {
          const next2 = ctx.tokens[index + 2]?.text ?? '';
          const hasTitleSeparator = ['-', ':', '\u2013', '\u2014'].includes(next2);
          if (!hasTitleSeparator) return false;
        }
        // If in main_content without navbox/nav header (e.g., actual list page), be lenient
        // and continue to check other conditions without requiring separator
      }

      // Look ahead for a number within next 2 tokens
      const nextToken = ctx.tokens[index + 1];
      if (!nextToken) return false;

      // Next token should be a number (chapter number)
      // Also handle "28-" format where dash is attached to number
      const isNumeric = /^\d+$/.test(nextToken.text);
      const isNumericWithDash = /^\d+-?$/.test(nextToken.text);
      if (!isNumeric && !isNumericWithDash) return false;

      // If number has dash attached (like "28-"), that counts as having a dash
      const numberHasDash = nextToken.text.endsWith('-');

      // Also check that following tokens look like a chapter title (has dash or quote)
      // This helps filter out navigation that happens to say "Chapter 01"
      const next2Text = ctx.tokens[index + 2]?.text ?? '';
      const next3Text = ctx.tokens[index + 3]?.text ?? '';

      // Check for dash (including en-dash, em-dash, hyphen variants)
      // Unicode: - = U+002D, – = U+2013, — = U+2014, ‐ = U+2010
      const dashChars = ['-', '\u2013', '\u2014', '\u2010', ':'];
      const hasDash = numberHasDash || dashChars.includes(next2Text) || dashChars.includes(next3Text);

      // Check for quotes (including curly/smart quotes)
      // Unicode: " = \u201C, " = \u201D, ' = \u2018, ' = \u2019
      const quoteChars = ['"', "'", '\u201C', '\u201D', '\u2018', '\u2019', '\u300C', '\u300E'];
      const hasQuote = quoteChars.some(q => next2Text.startsWith(q) || next3Text.startsWith(q));

      // Check for navigation patterns that should be excluded
      // e.g., "Chapter 01 Manga Community Portal"
      const navPatterns = ['Manga', 'Community', 'Wiki', 'Portal', 'Blog', 'Forum', 'Recent', 'Posts'];
      const next4Text = ctx.tokens[index + 4]?.text ?? '';
      const hasNavPattern = navPatterns.some(p =>
        next2Text === p || next3Text === p || next4Text === p
      );

      // If it looks like navigation, require dash or quote
      if (hasNavPattern) {
        return hasDash || hasQuote;
      }

      // For chapters in main_content without nav patterns, be more lenient
      const isInMainContent = token.sectionType === 'main_content' || token.sectionType === 'sidebar';

      return hasDash || hasQuote || isInMainContent;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span to include "Chapter XX - 'Title'" pattern
      // Also include parenthetical chapter numbers like "(6)" or "(20)"
      let endIndex = index;
      const maxIndex = Math.min(index + 18, ctx.tokens.length);
      let tokensSeen = 0;

      for (let i = index + 1; i < maxIndex; i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        tokensSeen++;

        // Check for opening parenthesis
        if (t.text === '(' || t.text === '（') {
          // Check if this is a short parenthetical number like "(6)" - include it
          if (isShortParentheticalNumber(ctx.tokens, i)) {
            // Include the paren, number, and close paren (3 tokens total)
            endIndex = Math.min(i + 2, ctx.tokens.length - 1);
            break;
          }
          // Not a short number, stop before the paren (alt title boundary)
          break;
        }

        // Stop at next "Chapter" (new chapter entry) - but not the first one
        if (t.text === 'Chapter' && tokensSeen > 2) break;
        // Stop at certain structural elements
        if (t.isHeader || t.isImage) break;
        // Stop if we hit navigation text
        if (t.sectionType === 'navigation') break;
        // Stop at pagination/navigation markers
        if (t.text === 'All' || t.text === 'items' || t.text === '#') break;
        // Stop at "Cover" or "Characters:" - these indicate field labels, not title content
        if (t.text === 'Cover' || t.text === 'Characters:' || t.text === 'Characters') break;

        endIndex = i;
      }

      return endIndex;
    },
  },

  {
    id: 'fandom-chapter-url',
    entityType: 'CHAPTER_URL',
    confidence: 0.9,
    priority: 84, // Lower than CHAPTER_TITLE (85) - URLs extracted via extractChapterUrlsFromSpans instead
    description: 'Extract URL from linked chapter titles (fallback when CHAPTER_TITLE not matched)',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be text "Chapter"
      if (token.text !== 'Chapter') return false;

      // Exclude navigation sections
      if (token.sectionType === 'navigation' || token.sectionType === 'header' || token.sectionType === 'footer') {
        return false;
      }

      // Exclude Prev/Next navigation patterns in infoboxes
      if (isChapterNavigation(token, index, ctx)) {
        return false;
      }

      // Look ahead for a number within first few tokens
      const nextToken = ctx.tokens[index + 1];
      if (!nextToken) return false;
      const isNumeric = /^\d+-?$/.test(nextToken.text);
      if (!isNumeric) return false;

      // Scan up to 12 tokens (same as CHAPTER_TITLE span) for ANY link
      for (let i = index; i < Math.min(index + 12, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at structural boundaries
        if (t.text === 'Chapter' && i > index) break; // Next chapter
        if (t.isHeader || t.isImage) break;
        if (t.sectionType === 'navigation') break;
        // Found a link!
        if (t.isLink && t.linkHref) return true;
      }
      return false;
    },
    // Return the last linked token in the chapter span (span entire hyperlink)
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findChapterUrlSpanEnd(ctx.tokens, index, 12),
  },

  {
    id: 'fandom-chapter-gallery-url',
    entityType: 'CHAPTER_URL',
    confidence: 0.88,
    priority: 84, // Lower than CHAPTER_TITLE (85) - URLs extracted via extractChapterUrlsFromSpans instead
    description: 'Extract URL from Fandom gallery/category chapter links (fallback when CHAPTER_TITLE not matched)',
    classPatterns: ['category-page__member-link', 'gallerytext'],
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // Must be text "Chapter" (same as chapter-link-start rule)
      if (token.text !== 'Chapter') return false;

      // Exclude navigation sections
      if (token.sectionType === 'navigation' || token.sectionType === 'header' || token.sectionType === 'footer') {
        return false;
      }

      // Exclude Prev/Next navigation patterns in infoboxes
      if (isChapterNavigation(token, index, ctx)) {
        return false;
      }

      // Look ahead for a number
      const nextToken = ctx.tokens[index + 1];
      if (!nextToken) return false;
      const isNumeric = /^\d+-?$/.test(nextToken.text);
      if (!isNumeric) return false;

      // Scan the chapter span for ANY token with a link-related class or isLink
      const linkClasses = ['category-page__member-link', 'lightbox-caption', 'gallerytext', 'image-link'];
      for (let i = index; i < Math.min(index + 12, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === 'Chapter' && i > index) break;
        if (t.isHeader) break;
        if (t.sectionType === 'navigation') break;
        // Check for link via isLink property
        if (t.isLink && t.linkHref) return true;
        // Check for link via class patterns (Fandom often uses these)
        if (hasClassPattern(t, linkClasses)) return true;
      }
      return false;
    },
    // Return the last linked token in the chapter span (span entire hyperlink)
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findChapterUrlSpanEnd(ctx.tokens, index, 12),
  },

  // Chapter number links in navigation tables (e.g., "1 · 2 · 3")
  {
    id: 'fandom-nav-chapter-link',
    entityType: 'CHAPTER_URL',
    confidence: 0.85,
    priority: 88,
    description: 'Chapter number links in navigation tables (e.g., "1 · 2 · 3")',
    // eslint-disable-next-line complexity -- Chapter link detection requires checking TOC, Trivia, navigation context, volume precedence, and anime exclusion
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip Table of Contents (TOC) - navigation, not content
      if (isInTableOfContents(token)) return false;
      // CRITICAL: Skip if in Trivia section (these are prose references, not navigation)
      if (isAfterTriviaSection(ctx.tokens, index)) return false;

      // Must be a link with numeric text
      if (!token.isLink || !token.linkHref) return false;
      if (!/^\d+$/.test(token.text.trim())) return false;

      // CRITICAL: Skip if immediately preceded by "Volume" - this is a volume number, not chapter
      // e.g., "Volume 1" should have "1" labeled as VOLUME_URL, not CHAPTER_URL
      if (index > 0) {
        const prevToken = ctx.tokens[index - 1];
        if (prevToken && /^volume$/i.test(prevToken.text.trim())) {
          return false;
        }
      }

      // Must be in navigation context (navbox, toccolours, or navigation section)
      // Use hasAncestorClassPattern to check parent containers (class is on wrapper, not links)
      // Note: Fandom uses 'toccolours' and 'mw-collapsible' for navigation templates
      const isNavigation = token.sectionType === 'navigation' ||
        hasAncestorClassPattern(token, ['navbox', 'nav-table', 'navigation-not-searchable', 'toccolours', 'mw-collapsible']);
      const inChapterGuide = isInChapterGuideTable(token, index, ctx);

      // On list pages, ONLY allow in explicit navigation sections (navbox/toccolours)
      // This preserves CHAPTER_TITLE labeling for main content while allowing nav links
      if (isListPage(ctx)) {
        if (!isNavigation) return false;
      } else {
        // On non-list pages, require navigation context
        if (!inChapterGuide && !isNavigation) return false;
      }

      // Must be in a table
      if (!token.isInTable) return false;

      // Exclude anime episode links - check nearby tokens for "Anime" or "Episodes" context
      // This handles cases where the label isn't detected as pi-label but is nearby
      for (let i = Math.max(0, index - 10); i < index; i++) {
        const nearby = ctx.tokens[i];
        if (!nearby) continue;
        const text = nearby.text.toLowerCase();
        if (text === 'anime' || text === 'episodes' || text === 'episode') {
          // Check if it's reasonably close (within same table row)
          if (nearby.isInTable && nearby.tableRow === token.tableRow) {
            return false;
          }
          // Also exclude if it's just a few tokens before
          if (index - i <= 5) {
            return false;
          }
        }
      }

      const href = token.linkHref.toLowerCase();
      // Check if href indicates a chapter/episode page
      if (href.includes('chapter') || href.includes('episode')) return true;

      // For navbox links, also accept wiki links if in volume context
      // This handles cases where chapter URLs are just numbers like "/wiki/1"
      if (isNavigation && href.includes('/wiki/')) {
        // Check if nearby tokens have volume context
        for (let j = Math.max(0, index - 15); j < index; j++) {
          const nearby = ctx.tokens[j];
          if (nearby && /^volume$/i.test(nearby.text)) return true;
        }
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, _ctx: SourceRuleContext): number => index, // Single token
  },

  // Named/bonus chapter links in navigation tables (e.g., "Ylva at Work")
  {
    id: 'fandom-nav-named-chapter-link',
    entityType: 'CHAPTER_URL',
    confidence: 0.8,
    priority: 87, // Between nav-chapter-link (88) and chapter-url (86)
    description: 'Named bonus/special chapter links in navigation tables (e.g., "Ylva at Work")',
    // eslint-disable-next-line complexity -- Named chapter link detection requires checking TOC, Trivia, prose context filtering, navigation context, and list page handling
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip Table of Contents (TOC) - navigation, not content
      if (isInTableOfContents(token)) return false;
      // CRITICAL: Skip if in Trivia section (these are prose references, not navigation)
      if (isAfterTriviaSection(ctx.tokens, index)) return false;

      // Must be a link with href
      if (!token.isLink || !token.linkHref) return false;

      // Check if in navigation context FIRST (before manga page check)
      const isInNavSection = token.sectionType === 'navigation' ||
        hasAncestorClassPattern(token, ['navbox', 'nav-table', 'navigation-not-searchable', 'toccolours', 'mw-collapsible']);

      // CRITICAL: On manga pages, ONLY allow in explicit navigation sections
      // This prevents prose links like "the War Arc" from being labeled while allowing
      // navigation table links like "Ylva at Work"
      if (isMangaPage(ctx) && !isInNavSection) return false;

      // CRITICAL: Skip if token TEXT is an article/preposition (even inside links)
      // e.g., In "<a>the War Arc</a>", the "the" token is a link but should be skipped
      // This handles cases where the entire phrase (including article) is wrapped in one link
      if (/^(the|a|an|is|as|or|and|in|on|of|to|for|with|by)$/i.test(token.text.trim())) {
        return false;
      }

      // CRITICAL: Skip if preceded by articles/prepositions (indicates prose context)
      // e.g., "the War Arc" in prose should NOT be labeled as CHAPTER_URL
      if (index > 0) {
        const prevToken = ctx.tokens[index - 1];
        if (prevToken && /^(the|a|an|is|as|or|and|in|on|of|to|for|with|by)$/i.test(prevToken.text)) {
          return false;
        }
      }

      // Must be in navigation context (navbox, toccolours, or navigation section)
      // Use hasAncestorClassPattern to check parent containers (class is on wrapper, not links)
      // Note: Fandom uses 'toccolours' and 'mw-collapsible' for navigation templates
      const isNavigation = token.sectionType === 'navigation' ||
        hasAncestorClassPattern(token, ['navbox', 'nav-table', 'navigation-not-searchable', 'toccolours', 'mw-collapsible']);
      const inChapterGuide = isInChapterGuideTable(token, index, ctx);

      // On list pages, ONLY allow in explicit navigation sections (navbox/toccolours)
      // This preserves CHAPTER_TITLE labeling for main content while allowing nav links
      if (isListPage(ctx)) {
        if (!isNavigation) return false;
      } else {
        // On non-list pages, require navigation context
        if (!inChapterGuide && !isNavigation) return false;
      }

      // Must be in a table
      if (!token.isInTable) return false;

      // Text should NOT be purely numeric (those are handled by fandom-nav-chapter-link)
      if (/^\d+$/.test(token.text.trim())) return false;

      // Skip structural/label words
      if (
        /^(volume|chapter|pages?|cover|isbn|volumes?|chapters?|manga|anime|list|of|characters?)$/i.test(token.text.trim())
      ) {
        return false;
      }

      // Skip single-character tokens (separators like "·", "-", etc.)
      if (token.text.trim().length < 2) return false;

      // Skip common navigation words
      if (/^(next|previous|prev|all|items|hide|show|edit|view)$/i.test(token.text.trim())) {
        return false;
      }

      // Skip cover characters - links in "Cover Characters" context
      if (isInCoverCharactersContext(token, index, ctx)) return false;

      // Link should be to wiki content (Fandom internal link)
      // Note: Named chapters like "Ylva at Work" may link to pages like "/wiki/Ylfa_Gaiden"
      // which don't contain "chapter" in the URL
      const href = token.linkHref.toLowerCase();
      // Accept internal wiki links (fandom.com/wiki/*)
      if (href.includes('/wiki/')) return true;
      // Also accept explicit chapter/episode URLs
      return href.includes('chapter') || href.includes('episode');
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span all consecutive tokens with the same linkHref
      const targetHref = ctx.tokens[index]?.linkHref;
      if (!targetHref) return index;

      let lastLinkedIndex = index;
      for (let i = index + 1; i < Math.min(index + 10, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.linkHref === targetHref) {
          lastLinkedIndex = i;
        } else {
          break;
        }
      }
      return lastLinkedIndex;
    },
  },

  // Volume links in navigation tables (e.g., "Volume 1:")
  {
    id: 'fandom-nav-volume-link',
    entityType: 'VOLUME_URL',
    confidence: 0.8,
    priority: 81,
    description: 'Volume links in navigation tables (e.g., "Volume 1:")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip volume pages - "Volume X" on a volume page is the current volume, not a nav link
      if (isVolumePage(ctx)) return false;
      // CRITICAL: Skip Table of Contents (TOC) - navigation, not content
      if (isInTableOfContents(token)) return false;
      // CRITICAL: Skip if in Trivia section (these are prose references, not navigation)
      if (isAfterTriviaSection(ctx.tokens, index)) return false;

      if (!/^volume$/i.test(token.text)) return false;
      // Must be in navigation context
      const isNavigation = token.sectionType === 'navigation' ||
        hasAncestorClassPattern(token, ['navbox', 'nav-table', 'navigation-not-searchable', 'toccolours', 'mw-collapsible']);
      if (!isInChapterGuideTable(token, index, ctx) && !isNavigation) return false;
      // Relaxed: Allow even if not strictly in table (navbox cells might not have isInTable)
      // if (!token.isInTable) return false;

      const next = ctx.tokens[index + 1];
      if (!next || !/^\d+:?$/.test(next.text)) return false;
      // Relaxed: Don't require link - "Volume 1:" in navbox header cells are often plain text
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      let endIndex = index;
      const next = ctx.tokens[index + 1];
      if (next && /^\d+:?$/.test(next.text)) {
        endIndex = index + 1;
        if (ctx.tokens[index + 2]?.text === ':') endIndex = index + 2;
      }
      return endIndex;
    },
  },

  // "Chapters and Volumes" link in "Main article:" sections (CHAPTERS_LIST_URL)
  {
    id: 'fandom-chapters-list-url',
    entityType: 'CHAPTERS_LIST_URL',
    confidence: 0.9,
    priority: 85,
    description: 'Link to Chapters and Volumes list page (e.g., "Main article: Chapters and Volumes")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip Table of Contents (TOC) - navigation, not content
      if (isInTableOfContents(token)) return false;

      const text = token.text.toLowerCase();

      // Direct match: token text contains both "chapters" and "volumes"
      if (text.includes('chapters') && text.includes('volumes')) {
        return true;
      }

      // Check for "Chapters and Volumes" split across tokens
      const next = ctx.tokens[index + 1];
      const afterNext = ctx.tokens[index + 2];
      const isChaptersToken = text === 'chapters';
      const nextIsAnd = next && (next.text.toLowerCase() === 'and' || next.text.toLowerCase() === '&');
      const afterNextIsVolumes = afterNext && afterNext.text.toLowerCase() === 'volumes';

      if (isChaptersToken && nextIsAnd && afterNextIsVolumes) {
        return true;
      }

      // Check link href for chapters-and-volumes or chapters_and_volumes pattern
      // Require token text to mention "chapter" — "Volumes" links to same URL should not match
      if (token.linkHref && text.includes('chapter')) {
        const href = token.linkHref.toLowerCase();
        if (href.includes('chapters_and_volumes') || href.includes('chapters-and-volumes')) {
          return true;
        }
      }

      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      const token = ctx.tokens[index];
      if (!token) return index;

      const text = token.text.toLowerCase();

      // If combined in one token, just return this index
      if (text.includes('chapters') && text.includes('volumes')) return index;

      // If starts with "Chapters", look for "and Volumes"
      if (text !== 'chapters') return index;

      const next = ctx.tokens[index + 1];
      const afterNext = ctx.tokens[index + 2];
      const nextIsAnd = next && (next.text.toLowerCase() === 'and' || next.text.toLowerCase() === '&');

      if (!nextIsAnd) return index;

      if (afterNext && afterNext.text.toLowerCase() === 'volumes') {
        return index + 2;
      }
      return index + 1;
    },
  },

  // Chapter entries in "#12." format (common in Fandom chapter lists)
  // Handles both split tokens ("#" + "1" + ".") and combined tokens ("#1.")
  {
    id: 'fandom-chapter-hash-number',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 83,
    description: 'Chapter entry starting with #number format (e.g., "#12. Sushi of the Dead")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (token.sectionType !== 'main_content') return false;
      // Exclude TOC items
      if (hasClassPattern(token, ['toctext', 'tocnumber', 'toclevel'])) return false;
      // Exclude table headers (like volume/chapter list column headers)
      if (token.isTableHeader) return false;
      // Exclude list pages - the "#" column header is not a chapter title
      if (isListPage(ctx)) return false;
      // Match combined format: "#1." or "#2." or "#3.5" (tokenizer often combines these)
      if (/^#\d+(\.\d+)?\.?$/.test(token.text)) return true;
      // Match separate "#" token only if followed by a number (split tokenization)
      if (token.text === '#') {
        const next = ctx.tokens[index + 1];
        return next !== undefined && /^\d+$/.test(next.text);
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span through title until opening parenthesis (alt title starts there)
      let lastValidIndex = index;
      for (let i = index + 1; i < Math.min(index + 30, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at opening parenthesis (alt title starts there)
        if (t.text === '(' || t.text === '（') return lastValidIndex;
        // Stop at next chapter entry (combined format like "#2." or separate "#")
        if (/^#\d+(\.\d+)?\.?$/.test(t.text)) return lastValidIndex;
        if (t.text === '#' && i > index + 2) return lastValidIndex;
        // Stop at structural elements
        if (t.isHeader || t.isImage) return lastValidIndex;
        // Stop at navigation
        if (t.sectionType === 'navigation') return lastValidIndex;
        // Stop at line breaks
        if (t.text.includes('\n')) return lastValidIndex;
        // CONTINUE through links (even different destinations) - captures "Dead"
        lastValidIndex = i;
      }
      return lastValidIndex;
    },
  },

  {
    id: 'fandom-chapter-gallery-item',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 80,
    description: 'Chapter title in Fandom gallery/category page',
    classPatterns: ['category-page__member-link', 'category-page__member'],
    condition: (token: LinearizedToken, _index: number, _ctx: SourceRuleContext): boolean => {
      // Match category page member links that contain chapter text
      if (!hasClassPattern(token, ['category-page__member-link', 'category-page__member', 'gallerytext'])) {
        return false;
      }
      // Must contain chapter-related text
      const text = token.text.toLowerCase();
      return text.includes('chapter') || /^ch\s*\d+/i.test(text);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 15, (t) =>
        hasClassPattern(t, ['category-page__member-link', 'category-page__member']) ||
        t.isImage || t.isHeader
      ),
  },

  {
    id: 'fandom-gallery-caption-chapter',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 80,
    description: 'Chapter title in Fandom gallery caption',
    classPatterns: ['lightbox-caption', 'gallerytext'],
    condition: (token: LinearizedToken): boolean => {
      // Match gallery captions with chapter text
      if (!hasClassPattern(token, ['lightbox-caption', 'gallerytext', 'gallery-image-caption'])) {
        return false;
      }
      const text = token.text.toLowerCase();
      return text.includes('chapter') || /^ch\s*\d+/i.test(text);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findSpanEnd(ctx.tokens, index, 15, (t) => t.isImage || t.isHeader),
  },

  // Bonus/Omake/Prologue/Epilogue chapter titles
  {
    id: 'fandom-bonus-chapter',
    entityType: 'CHAPTER_TITLE',
    confidence: 0.85,
    priority: 84,
    description: 'Bonus/Omake/Prologue/Epilogue chapter titles',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Skip manga pages - these are prose mentions, not chapter entries
      if (isMangaPage(ctx)) return false;
      // Match special chapter prefixes (with or without trailing period)
      const bonusPrefixes = /^(Bonus|Omake|Extra|Prologue|Epilogue|Special)\.?$/i;
      if (!bonusPrefixes.test(token.text)) return false;
      // Must be in main content area (NOT sidebar - that includes TOC)
      if (token.sectionType !== 'main_content') return false;
      // Exclude headers (like "Extra Pages" H2 section header)
      if (token.isHeader) return false;
      // Exclude TOC items (have toctext, tocnumber, toclevel classes)
      if (hasClassPattern(token, ['toctext', 'tocnumber', 'toclevel', 'mw-headline'])) return false;
      // CRITICAL: Exclude Trivia/Notes section mentions
      // e.g., "Bonus Story: Ylva at Work" in Trivia is a prose reference, not a chapter entry
      if (isAfterTriviaSection(ctx.tokens, index)) return false;
      // Exclude if preceded by articles/prepositions (indicates prose, not chapter listing)
      // e.g., "...and also the War Arc; the prologue." should NOT match
      if (index > 0) {
        const prevToken = ctx.tokens[index - 1];
        if (prevToken && /^(the|a|an|is|as|or|and)$/i.test(prevToken.text)) return false;
      }
      return true;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span until opening parenthesis (alt title) or next structural boundary
      for (let i = index + 1; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Stop at opening parenthesis (alt title starts there)
        if (t.text === '(' || t.text === '（') return i - 1;
        // Stop at next chapter indicator or structural elements
        if (t.isHeader || t.text === 'Chapter' || t.text === '#') return i - 1;
        // Stop at next bonus chapter indicator
        if (/^(Bonus|Omake|Extra|Prologue|Epilogue|Special)\.?$/i.test(t.text) && i > index) return i - 1;
      }
      // Return last token in range if no stop condition
      return Math.min(index + 14, ctx.tokens.length - 1);
    },
  },

  // -------------------------------------------------------------------------
  // Chapter Alt Title Rules (Japanese text in parentheses)
  // -------------------------------------------------------------------------

  // Prose-specific alt title rule for chapter pages (CJK text after bold chapter title)
  // Handles ruby markup: 北人 (ノルマンニ), Noruman'ni
  {
    id: 'fandom-prose-chapter-alt-title',
    entityType: 'CHAPTER_ALT_TITLE',
    confidence: 0.9,
    priority: 84, // Runs after CHAPTER_TITLE rules (85+) so matchedEntities is set
    description: 'Japanese/alternative title (CJK + furigana + romanization) after bold chapter title',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      if (!isChapterPage(ctx)) return false;
      if (index > 300) return false;
      // Must NOT be in infobox (infobox has separate rules)
      if (token.isInInfobox) return false;
      // Must NOT be in navigation/footer sections
      if (token.sectionType === 'navigation' || token.sectionType === 'footer') return false;
      // Token must contain CJK (kanji/hiragana/katakana)
      if (!/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/.test(token.text)) return false;
      // CHAPTER_TITLE must already be matched (higher priority rules run first)
      if (!ctx.matchedEntities.has('CHAPTER_TITLE')) return false;
      // Must have a following closing pattern (paren or "is")
      return hasAltTitleClosingPattern(ctx.tokens, index);
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number =>
      findProseAltTitleEnd(ctx.tokens, index),
  },

  {
    id: 'fandom-chapter-alt-title',
    entityType: 'CHAPTER_ALT_TITLE',
    confidence: 0.85,
    priority: 75,
    description: 'Japanese/alternative title in parentheses after chapter title',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Only match on chapter pages - manga pages use ALT_TITLE instead
      if (!isChapterPage(ctx)) return false;

      // Must be opening parenthesis (regular or fullwidth)
      if (token.text !== '(' && token.text !== '（') return false;

      // Exclude simple numeric references like "(0)", "(1)", "(2)", "(3)"
      const nextToken = ctx.tokens[index + 1];
      const tokenAfterNext = ctx.tokens[index + 2];
      if (nextToken && /^\d+$/.test(nextToken.text)) {
        // If next is just a number followed by ")", it's a reference, not alt title
        if (tokenAfterNext?.text === ')' || tokenAfterNext?.text === '）') {
          return false;
        }
      }

      // Must contain CJK/Japanese text to be an alt title
      let hasCJK = false;
      let closingParenIndex = -1;
      for (let i = index + 1; i < Math.min(index + 25, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        // Find closing paren
        if (t.text === ')' || t.text === '）') {
          closingParenIndex = i;
          break;
        }
        // Check for CJK characters (Japanese hiragana, katakana, kanji)
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(t.text)) {
          hasCJK = true;
        }
      }

      // Must have CJK content and a closing paren
      return hasCJK && closingParenIndex > index;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span from opening paren to closing paren (include parentheses)
      for (let i = index + 1; i < Math.min(index + 30, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === ')' || t.text === '）') return i;
        // Stop at structural boundaries
        if (t.isHeader || t.isImage || t.text === 'Chapter') return i - 1;
      }
      return index;
    },
  },

  {
    id: 'fandom-chapter-alt-title-romanized',
    entityType: 'CHAPTER_ALT_TITLE',
    confidence: 0.8,
    priority: 74,
    description: 'Romanized Japanese title after CJK text (e.g., "Kyanpingu kā obu zadeddo")',
    condition: (token: LinearizedToken, index: number, ctx: SourceRuleContext): boolean => {
      // CRITICAL: Only match on chapter pages - manga pages use ALT_TITLE instead
      if (!isChapterPage(ctx)) return false;

      // REJECT standalone punctuation and special symbols - these should not be labeled as CHAPTER_ALT_TITLE
      // Includes: basic punctuation, dashes, newline symbol, circled digits (①②③), other non-letter symbols
      if (/^[,;.!?:\-—–↵\u2460-\u2473\u24EA-\u24FF\u3251-\u325F①②③④⑤⑥⑦⑧⑨⑩]+$/.test(token.text)) return false;

      // Also reject tokens that start with comma or are primarily punctuation/symbols
      if (/^[,;]+/.test(token.text)) return false;

      // Skip label words - these are field names, not alt titles
      if (/^(kanji|romaji|rōmaji|japanese|title|name|chapter|volume|english|info|information)$/i.test(token.text)) return false;

      // Look for italic romanized text following CJK characters
      // Pattern: (CJK text,, romanizedText?)
      if (!token.isItalic) return false;

      // Check if preceded by CJK text within 10 tokens
      for (let i = Math.max(0, index - 10); i < index; i++) {
        const t = ctx.tokens[i];
        if (!t) continue;
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(t.text)) {
          return true;
        }
      }
      return false;
    },
    getSpanEnd: (_token: LinearizedToken, index: number, ctx: SourceRuleContext): number => {
      // Span until closing paren or end of italic section
      for (let i = index; i < Math.min(index + 15, ctx.tokens.length); i++) {
        const t = ctx.tokens[i];
        if (!t) break;
        if (t.text === ')' || t.text === '）' || t.text === '?') return i;
        if (!t.isItalic && i > index) return i - 1;
      }
      return index;
    },
  },
];
