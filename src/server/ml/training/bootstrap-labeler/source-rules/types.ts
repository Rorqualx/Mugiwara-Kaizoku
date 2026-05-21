/**
 * Types for Source-Specific Rules
 *
 * Defines the structure for source-specific positional rules that
 * leverage known page structures for Fandom, Wikipedia, AniList, and ComicVine.
 *
 * @module ml/training/bootstrap-labeler/source-rules/types
 */

import type { EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';
import type { SourceType } from '@/server/shared/source-knowledge/types';

// ============================================================================
// Source Type (re-exported from shared)
// ============================================================================

export type { SourceType };

// ============================================================================
// Rule Context
// ============================================================================

export interface SourceRuleContext {
  tokens: LinearizedToken[];
  sourceType: SourceType;
  /** Track which token indices have already been labeled */
  usedIndices: Set<number>;
  /** Track which entity types have been matched (for single-value entities) */
  matchedEntities: Set<EntityType>;
  /** The URL of the page being processed (for page type detection) */
  url?: string;
}

// ============================================================================
// Source Rule Definition
// ============================================================================

export interface SourceRule {
  /** Unique identifier for debugging and metrics */
  id: string;
  /** Entity type to assign if rule matches */
  entityType: EntityType;
  /** Confidence score (0-1) for matches */
  confidence: number;
  /** Rule priority - higher runs first, stops on first match per entity */
  priority: number;
  /** Human-readable description for debugging */
  description: string;
  /** CSS class patterns that indicate this entity */
  classPatterns?: string[];
  /** Element ID patterns that indicate this entity */
  idPatterns?: string[];
  /** XPath patterns that indicate this entity */
  xpathPatterns?: string[];
  /** Condition function that determines if rule applies */
  condition: (token: LinearizedToken, index: number, context: SourceRuleContext) => boolean;
  /** Optional: Get the span end index (defaults to same as start) */
  getSpanEnd?: (token: LinearizedToken, index: number, context: SourceRuleContext) => number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if token has any of the specified class patterns
 */
export function hasClassPattern(token: LinearizedToken, patterns: string[]): boolean {
  return patterns.some(pattern =>
    token.classes.some(c => c.toLowerCase().includes(pattern.toLowerCase()))
  );
}

/**
 * Check if token has exact class match
 */
export function hasExactClass(token: LinearizedToken, className: string): boolean {
  return token.classes.some(c => c === className);
}

/**
 * Check if token's element ID matches any pattern
 */
export function hasIdPattern(token: LinearizedToken, patterns: string[]): boolean {
  if (!token.elementId) return false;
  return patterns.some(pattern =>
    token.elementId?.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if token's XPath contains pattern
 */
export function hasXPathPattern(token: LinearizedToken, patterns: string[]): boolean {
  return patterns.some(pattern =>
    token.xpath.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Check if token or any ancestor element has the specified class.
 * Parses the cssPath to find ancestor classes.
 * This is useful when text is nested (e.g., h2.pi-title > span where span has no classes)
 */
export function hasAncestorClass(token: LinearizedToken, className: string): boolean {
  // First check the token's own classes
  if (token.classes.some((c) => c === className)) return true;
  // Then check the cssPath for ancestor classes
  // cssPath format: "tag.class1.class2 > tag.class > ..."
  const cssPath = token.cssPath.toLowerCase();
  const classPattern = '.' + className.toLowerCase();
  return cssPath.includes(classPattern);
}

/**
 * Check if token or any ancestor element matches any of the class patterns.
 * Uses cssPath to find ancestor classes.
 */
export function hasAncestorClassPattern(token: LinearizedToken, patterns: string[]): boolean {
  // First check token's own classes
  if (hasClassPattern(token, patterns)) return true;
  // Then check cssPath for ancestor classes
  const cssPath = token.cssPath.toLowerCase();
  return patterns.some((pattern) => cssPath.includes(pattern.toLowerCase()));
}

/**
 * Check if token is likely a label (ends with colon or has label class)
 */
export function isLabelToken(token: LinearizedToken): boolean {
  return token.text.trim().endsWith(':') ||
    hasClassPattern(token, ['label', 'header', 'data-label']);
}

/**
 * Find the end of a span based on stop condition
 */
export function findSpanEnd(
  tokens: LinearizedToken[],
  startIndex: number,
  maxTokens: number,
  stopCondition: (token: LinearizedToken) => boolean
): number {
  let endIndex = startIndex;
  const maxIndex = Math.min(startIndex + maxTokens, tokens.length);

  for (let i = startIndex + 1; i < maxIndex; i++) {
    const token = tokens[i];
    if (!token) break;
    if (stopCondition(token)) break;
    endIndex = i;
  }

  return endIndex;
}

/**
 * Check if token is a large image (likely a cover/main image)
 */
export function isLargeImage(token: LinearizedToken): boolean {
  const minWidth = 100;
  const minHeight = 150;
  return token.isImage &&
    (token.imageWidth ?? 0) >= minWidth &&
    (token.imageHeight ?? 0) >= minHeight;
}

/** Editorial metadata patterns - text that indicates wiki edit history, not content */
const EDITORIAL_PATTERNS = ['last edited', 'edited by', 'edit history', 'last modified', 'modified by'];

/** Time pattern for editorial timestamps like "11:00AM" */
const TIME_PATTERN = /^\d{1,2}:\d{2}(?:AM|PM|am|pm)?$/;

/**
 * Check if token is in editorial metadata context (e.g., "last edited by user on date").
 * These dates/times are about when the wiki page was edited, not content metadata.
 */
export function isInEditorialMetadataContext(
  token: LinearizedToken,
  index: number,
  ctx: SourceRuleContext
): boolean {
  // Look back up to 30 tokens for editorial patterns (accounts for usernames, images, etc.)
  const startIdx = Math.max(0, index - 30);
  const recentTokens = ctx.tokens.slice(startIdx, index);
  const recentText = recentTokens.map(t => t.text.toLowerCase()).join(' ');

  // Check if editorial pattern exists in recent context
  const hasEditorialPattern = EDITORIAL_PATTERNS.some(pattern => recentText.includes(pattern));
  if (hasEditorialPattern) return true;

  // Also check if this is a time token following a date token (like "11:00AM" after "01/02/22")
  if (TIME_PATTERN.test(token.text)) {
    const prevToken = ctx.tokens[index - 1];
    if (prevToken?.matchesDatePattern) {
      // Check if the date before us is in editorial context
      const dateRecentText = ctx.tokens.slice(Math.max(0, index - 31), index - 1)
        .map(t => t.text.toLowerCase()).join(' ');
      if (EDITORIAL_PATTERNS.some(pattern => dateRecentText.includes(pattern))) {
        return true;
      }
    }
  }

  return false;
}
