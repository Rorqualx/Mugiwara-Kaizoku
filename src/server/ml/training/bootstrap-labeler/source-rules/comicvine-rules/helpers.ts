/**
 * ComicVine Rules Helper Functions
 *
 * Shared utilities and constants for ComicVine source-specific rules.
 *
 * @module ml/training/bootstrap-labeler/source-rules/comicvine-rules/helpers
 */

import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  findSpanEnd,
  hasClassPattern,
  isInEditorialMetadataContext,
  isLargeImage,
} from '../types';

import type { SourceRuleContext } from '../types';

// Re-export commonly used functions from types
export { findSpanEnd, hasClassPattern, isInEditorialMetadataContext, isLargeImage };

// ============================================================================
// ComicVine Page Type Detection
// ============================================================================

/**
 * ComicVine page types based on URL path segments.
 *
 * ComicVine uses API-style resource IDs in URLs:
 *   /volume/4050-{id}/   → volume (series) page
 *   /issue/4000-{id}/    → issue (chapter) page
 *   /character/4005-{id}/ → character page (not relevant for manga labeling)
 *   /person/4040-{id}/   → person/creator page
 *   /publisher/4010-{id}/ → publisher page
 *   /team/4060-{id}/     → team page
 *   /concept/4015-{id}/  → concept page
 *   /location/4020-{id}/ → location page
 *   /object/4055-{id}/   → object page
 *   /story_arc/4045-{id}/ → story arc page
 */
export type ComicVinePageType =
  | 'volume'     // Series/volume page — primary target for labeling
  | 'issue'      // Issue/chapter page — secondary target
  | 'character'  // Character page — skip labeling
  | 'person'     // Creator/person page — skip labeling
  | 'publisher'  // Publisher page — skip labeling
  | 'other'      // Team, concept, location, object, story_arc, etc. — skip labeling
  | 'unknown';   // Unrecognized URL structure

/** URL path patterns for each ComicVine page type */
const COMICVINE_PAGE_PATTERNS: Array<{ pattern: RegExp; type: ComicVinePageType }> = [
  { pattern: /\/volume\/4050-/i, type: 'volume' },
  { pattern: /\/issue\/4000-/i, type: 'issue' },
  { pattern: /\/character\/4005-/i, type: 'character' },
  { pattern: /\/person\/4040-/i, type: 'person' },
  { pattern: /\/publisher\/4010-/i, type: 'publisher' },
  { pattern: /\/team\/4060-/i, type: 'team' as ComicVinePageType },
  { pattern: /\/concept\/4015-/i, type: 'other' },
  { pattern: /\/location\/4020-/i, type: 'other' },
  { pattern: /\/object\/4055-/i, type: 'other' },
  { pattern: /\/story_arc\/4045-/i, type: 'other' },
  // Fallback: match just the ComicVine API ID prefix in URL path
  // (e.g., /vinland-saga-1-volume-1/4000-303557/ contains 4000- but not /issue/)
  { pattern: /\/4050-\d+/, type: 'volume' },
  { pattern: /\/4000-\d+/, type: 'issue' },
  { pattern: /\/4005-\d+/, type: 'character' },
  { pattern: /\/4040-\d+/, type: 'person' },
  { pattern: /\/4010-\d+/, type: 'publisher' },
  { pattern: /\/4060-\d+/, type: 'other' },   // team
  { pattern: /\/4015-\d+/, type: 'other' },   // concept
  { pattern: /\/4020-\d+/, type: 'other' },   // location
  { pattern: /\/4055-\d+/, type: 'other' },   // object
  { pattern: /\/4045-\d+/, type: 'other' },   // story_arc
  // Fallback: match resource type from URL path without API ID
  { pattern: /\/volumes?\//i, type: 'volume' },
  { pattern: /\/issues?\//i, type: 'issue' },
  { pattern: /\/characters?\//i, type: 'character' },
  { pattern: /\/person\//i, type: 'person' },
  { pattern: /\/publisher\//i, type: 'publisher' },
];

/**
 * Detect the ComicVine page type from a URL.
 */
export function detectComicVinePageType(url?: string): ComicVinePageType {
  if (!url) return 'unknown';
  for (const { pattern, type } of COMICVINE_PAGE_PATTERNS) {
    if (pattern.test(url)) return type;
  }
  return 'unknown';
}

/** Page types where manga/comic labeling rules should fire */
const LABELABLE_PAGE_TYPES = new Set<ComicVinePageType>(['volume', 'issue', 'unknown']);

/**
 * Check if a ComicVine page is relevant for entity labeling.
 * Only volume (series) and issue (chapter) pages should be labeled.
 * Character, person, publisher, team, concept pages are skipped.
 * Unknown pages are labeled as a fallback (may be non-standard ComicVine URLs).
 */
export function isLabelableComicVinePage(url?: string): boolean {
  return LABELABLE_PAGE_TYPES.has(detectComicVinePageType(url));
}

/**
 * Check if the current page is a ComicVine volume (series) page.
 */
export function isComicVineVolumePage(url?: string): boolean {
  const pageType = detectComicVinePageType(url);
  return pageType === 'volume' || pageType === 'unknown';
}

/**
 * Check if the current page is a ComicVine issue (chapter) page.
 */
export function isComicVineIssuePage(url?: string): boolean {
  return detectComicVinePageType(url) === 'issue';
}

// ============================================================================
// ComicVine Class Pattern Constants
// ============================================================================

/** Title-related classes */
export const TITLE_CLASSES = ['wiki-title', 'page-title', 'object-name'];

/** Detail/info section classes */
export const DETAIL_CLASSES = ['wiki-details', 'pod-', 'detail-'];

/** Image classes */
export const IMAGE_CLASSES = ['imgboxart', 'main-image', 'primary-image'];

/** Label/heading classes in detail sections */
export const LABEL_CLASSES = ['label', 'header', 'pod-title'];

/** Value classes */
export const VALUE_CLASSES = ['value', 'wiki-value', 'detail-value'];

/** Label text patterns for specific entity types */
export const LABEL_PATTERNS = {
  author: ['writer', 'written by', 'creator', 'author'],
  artist: ['artist', 'penciler', 'cover artist', 'illustrator'],
  publisher: ['publisher', 'imprint', 'published by'],
  status: ['status'],
  volumes: ['volume', 'volumes', 'issues'],
  chapters: ['issue', 'issues', 'chapters'],
  genre: ['genre', 'genres'],
  themes: ['theme', 'themes'],
  releaseDate: [
    'start year', 'first issue', 'release', 'published', 'year', 'started in', 'started',
    'cover date', 'in store', 'date',
  ],
  altTitle: ['aliases', 'also known as', 'alternate name'],
  format: ['format', 'type'],
  characters: ['characters', 'main characters', 'character'],
};

// ============================================================================
// Month Names (shared across metadata-rules and content-rules)
// ============================================================================

/** Month names for detecting date patterns (e.g., "August 23, 2006" on issue pages) */
export const MONTH_NAMES = new Set([
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]);

// ============================================================================
// Helper Functions
// ============================================================================

export function isDetailSection(token: LinearizedToken): boolean {
  return hasClassPattern(token, DETAIL_CLASSES);
}

export function isLabelElement(token: LinearizedToken): boolean {
  return hasClassPattern(token, LABEL_CLASSES);
}

export function isValueElement(token: LinearizedToken): boolean {
  return hasClassPattern(token, VALUE_CLASSES);
}

export function getLabelText(token: LinearizedToken): string {
  return token.nearestLabelText?.toLowerCase().trim() ?? '';
}

export function matchesLabelPattern(token: LinearizedToken, patterns: string[]): boolean {
  const labelText = getLabelText(token);
  if (!labelText) return false;
  return patterns.some(p => labelText.includes(p));
}

export function findValueEnd(
  _token: LinearizedToken,
  index: number,
  ctx: SourceRuleContext
): number {
  return findSpanEnd(ctx.tokens, index, 10, (t) =>
    isLabelElement(t) || t.text.endsWith(':') || t.isHeader
  );
}

/**
 * Check if token is in navigation, header, or footer sections.
 */
export function isInNonContentSection(token: LinearizedToken): boolean {
  return token.sectionType === 'navigation' ||
    token.sectionType === 'header' ||
    token.sectionType === 'footer';
}

// ============================================================================
// Issue Grid & Credits Section Detection
// ============================================================================

/**
 * Issue grid header detection words.
 * The linearizer splits "14 issues in this volume" into individual word tokens.
 * We look for the sequence: [number] "issues"/"issue" "in" "this" "volume" as H2 headers.
 */
const ISSUE_GRID_SEQUENCE = ['issues', 'in', 'this', 'volume'];

/**
 * Check if a sequence of tokens starting at `startIdx` matches the issue grid header.
 * Expects: <number> "issues"/"issue" "in" "this" "volume" — all as header tokens.
 */
function isIssueGridHeader(tokens: LinearizedToken[], startIdx: number): boolean {
  const first = tokens[startIdx];
  if (!first || !first.isHeader || !first.isNumeric) return false;
  // Check the next 4 tokens match the sequence
  for (let j = 0; j < ISSUE_GRID_SEQUENCE.length; j++) {
    const t = tokens[startIdx + 1 + j];
    if (!t) return false;
    const actual = t.text.toLowerCase();
    const expected = ISSUE_GRID_SEQUENCE[j];
    // Allow "issue" or "issues" for the first word
    if (j === 0 && (actual === 'issue' || actual === 'issues')) continue;
    if (actual !== expected) return false;
  }
  return true;
}

/** Known section header text that indicates we've left the issue grid area */
const NON_GRID_SECTION_HEADERS = new Set([
  'creators', 'characters', 'teams', 'locations', 'concepts',
  'objects', 'story arcs', 'user reviews', 'volumes',
]);

/**
 * Check if token is in the issue grid section on a ComicVine volume page.
 * The issue grid follows a header like "14 issues in this volume" (split into word tokens).
 * Scans backward for the header sequence. Only stops early at known section headers
 * (not at intermediary UI buttons like "Add Issue", "Reverse sort").
 */
export function isInIssueGridSection(
  _token: LinearizedToken,
  index: number,
  ctx: SourceRuleContext
): boolean {
  const startIdx = Math.max(0, index - 300);
  for (let i = index - 1; i >= startIdx; i--) {
    const t = ctx.tokens[i];
    if (!t) continue;
    // Check if this position starts the issue grid header sequence
    if (isIssueGridHeader(ctx.tokens, i)) return true;
    // Only stop at KNOWN section headers (not UI buttons like "Add Issue")
    if (t.isHeader && t.headerLevel <= 2 && NON_GRID_SECTION_HEADERS.has(t.text.toLowerCase())) {
      return false;
    }
  }
  return false;
}

/** Text patterns indicating the "Most issue credits" section */
const ISSUE_CREDITS_PATTERNS = ['most issue credits', 'issue credits'];

/**
 * Check if token is in the "Most issue credits" section.
 * This section lists aggregate creator stats, not series-level credits.
 */
export function isInIssueCreditsSection(
  index: number,
  ctx: SourceRuleContext
): boolean {
  // Scan backward up to 100 tokens
  const startIdx = Math.max(0, index - 100);
  const recentTokens = ctx.tokens.slice(startIdx, index);
  const recentText = recentTokens.map(t => t.text.toLowerCase()).join(' ');
  return ISSUE_CREDITS_PATTERNS.some(pattern => recentText.includes(pattern));
}

// ============================================================================
// Creator Role Validation
// ============================================================================

/** Roles that exclude a creator from being labeled (when present anywhere in role text) */
const EXCLUDED_CREATOR_ROLES = ['other', 'editor', 'letterer', 'production', 'colorist'];

/**
 * Check if role text contains any excluded role.
 * Used to filter out creators with "other" or support roles.
 */
export function isExcludedCreatorRole(roleText: string): boolean {
  return EXCLUDED_CREATOR_ROLES.some(role => new RegExp(`\\b${role}\\b`, 'i').test(roleText));
}

/**
 * Check if writer/story/author is the PRIMARY role (first mentioned, not after other roles).
 * Returns true only if writer role appears before any comma or is the only role.
 */
export function isPrimaryWriterRole(roleText: string): boolean {
  // Must contain a writer-type role
  if (!/\b(writer|story|author)\b/i.test(roleText)) return false;
  // Check if writer role is primary (before first comma or only role)
  const firstRole = roleText.split(',')[0]?.trim() ?? '';
  return /\b(writer|story|author)\b/i.test(firstRole);
}

/**
 * Check if artist/penciler/cover/illustrator is the PRIMARY role.
 * Returns true only if artist role appears before any comma or is the only role.
 */
export function isPrimaryArtistRole(roleText: string): boolean {
  // Must contain an artist-type role
  if (!/\b(artist|pencil|cover|illustrat)/i.test(roleText)) return false;
  // Check if artist role is primary (before first comma or only role)
  const firstRole = roleText.split(',')[0]?.trim() ?? '';
  return /\b(artist|pencil|cover|illustrat)/i.test(firstRole);
}

/**
 * Check if a token is at a chapter span boundary for ComicVine
 */
export function isComicVineChapterBoundary(
  token: LinearizedToken,
  startIndex: number,
  currentIndex: number
): boolean {
  if ((token.text === 'Chapter' || token.text === 'Special' || token.text === 'Extra') && currentIndex > startIndex) return true;
  if (token.isHeader) return true;
  return false;
}

// ============================================================================
// Span Boundary Detection
// ============================================================================

/** Navigation keywords that indicate we've left content and entered navigation */
const NAVIGATION_KEYWORDS = ['Read', 'View', 'All', 'More', 'See', 'Show', 'Hide', 'Edit'];

/** Content structure keywords that indicate entering a new section */
const STRUCTURE_KEYWORDS = ['Media', 'Size', 'Format', 'Type', 'Hard', 'Soft', 'cover', 'Paperback'];

/**
 * Check if token is at a span boundary for metadata values.
 * Stops at labels, headers, ISBN-like numbers, navigation keywords, and structure keywords.
 */
export function isMetadataSpanBoundary(token: LinearizedToken): boolean {
  // Stop at label elements
  if (isLabelElement(token)) return true;

  // Stop at headers
  if (token.isHeader) return true;

  // Stop at colon-terminated text (new label)
  if (token.text.endsWith(':')) return true;

  // Stop at ISBN-like numbers (10+ digits)
  if (/^\d{10,}$/.test(token.text)) return true;

  // Stop at navigation keywords
  if (NAVIGATION_KEYWORDS.includes(token.text)) return true;

  // Stop at structure keywords (indicate entering product info)
  if (STRUCTURE_KEYWORDS.includes(token.text)) return true;

  return false;
}

/**
 * Find the end of a linked chapter URL span for ComicVine.
 */
export function findComicVineChapterUrlSpanEnd(
  tokens: LinearizedToken[],
  startIndex: number,
  maxLookahead: number
): number {
  let targetHref: string | null = null;
  let lastLinkedIndex = startIndex;
  const maxIndex = Math.min(startIndex + maxLookahead, tokens.length);

  for (let i = startIndex; i < maxIndex; i++) {
    const t = tokens[i];
    if (!t || isComicVineChapterBoundary(t, startIndex, i)) break;

    if (t.isLink && t.linkHref) {
      targetHref ??= t.linkHref;
      if (t.linkHref === targetHref) {
        lastLinkedIndex = i;
      } else {
        break;
      }
    } else if (targetHref !== null) {
      break;
    }
  }
  return lastLinkedIndex;
}

/**
 * Find span end for linked creator names (names may be multi-token)
 */
export function findCreatorNameSpanEnd(
  token: LinearizedToken,
  index: number,
  ctx: SourceRuleContext
): number {
  let end = index;
  const targetHref = token.linkHref;
  for (let i = index + 1; i < Math.min(index + 5, ctx.tokens.length); i++) {
    const t = ctx.tokens[i];
    if (!t || !t.isLink || t.linkHref !== targetHref) break;
    end = i;
  }
  return end;
}
