/**
 * Positional Heuristics for Bootstrap Labeling
 *
 * Applies high-confidence labels based on document position, structure,
 * and token features that strongly indicate entity types.
 *
 * Source-specific rules only - no generic rules to avoid cross-source issues.
 *
 * @module ml/training/bootstrap-labeler/positional-heuristics
 */

import type { EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

import {
  COMICVINE_RULES as COMICVINE_SOURCE_RULES,
  FANDOM_RULES as FANDOM_SOURCE_RULES,
  isInTableOfContents,
  isNavboxSectionRangeHeader,
  WIKIPEDIA_RULES as WIKIPEDIA_SOURCE_RULES,
} from './source-rules';

import type { TokenSpan } from './types';

// ============================================================================
// Types
// ============================================================================

export interface PositionalRule {
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
  /** Condition function that determines if rule applies */
  condition: (token: LinearizedToken, index: number, context: RuleContext) => boolean;
  /** Optional: Get the span end index (defaults to same as start) */
  getSpanEnd?: (token: LinearizedToken, index: number, context: RuleContext) => number;
}

export interface RuleContext {
  tokens: LinearizedToken[];
  sourceType: 'fandom' | 'wikipedia' | 'comicvine' | 'unknown';
  /** Track which token indices have already been labeled */
  usedIndices: Set<number>;
  /** Track which entity types have been matched (for single-value entities) */
  matchedEntities: Set<EntityType>;
  /** The URL of the page being processed (for page type detection) */
  url?: string;
}

export interface PositionalMatch {
  rule: PositionalRule;
  span: TokenSpan;
  tokenIndices: number[];
}

// ============================================================================
// Rule Application Helpers
// ============================================================================

/**
 * Single-value entity types that should only be matched once
 */
const SINGLE_VALUE_ENTITIES = new Set<EntityType>([
  'TITLE',
  'COVER_IMAGE',
  'VOLUME_COUNT',
  'CHAPTER_COUNT',
  'RELEASE_DATE',
  'ORIGINAL_RUN',
  'START_DATE',
  'END_DATE',
  'STATUS',
  'AUTHOR',
  'ARTIST',
  'SERIES_SUMMARY',
  'PUBLISHER',
  'ENGLISH_PUBLISHER',
  'MAGAZINE',
  'DEMOGRAPHIC',
  'FORMAT',
  'ALT_TITLE',
]);

/**
 * Check if a span overlaps with already-used indices
 */
function hasSpanOverlap(start: number, end: number, usedIndices: Set<number>): boolean {
  for (let j = start; j <= end; j++) {
    if (usedIndices.has(j)) return true;
  }
  return false;
}

/**
 * Record a match and mark indices as used
 */
function recordMatch(
  rule: PositionalRule,
  start: number,
  end: number,
  context: RuleContext,
  matches: PositionalMatch[]
): void {
  const span: TokenSpan = {
    start,
    end,
    entityType: rule.entityType,
    confidence: rule.confidence,
    matchType: 'exact',
  };

  const tokenIndices: number[] = [];
  for (let j = start; j <= end; j++) {
    tokenIndices.push(j);
    context.usedIndices.add(j);
  }

  matches.push({ rule, span, tokenIndices });

  if (SINGLE_VALUE_ENTITIES.has(rule.entityType)) {
    context.matchedEntities.add(rule.entityType);
  }
}

/**
 * Check if token should be skipped (global filters)
 */
function shouldSkipToken(token: LinearizedToken, index: number, context: RuleContext): boolean {
  if (context.usedIndices.has(index)) return true;
  if (isInTableOfContents(token)) return true;
  if (isNavboxSectionRangeHeader(token)) return true;
  return false;
}

// ============================================================================
// Rule Retrieval
// ============================================================================

/**
 * Get all rules for a given source type, sorted by priority.
 * Uses source-specific rules only (no generic rules to avoid cross-source issues).
 */
function getRulesForSource(
  sourceType: 'fandom' | 'wikipedia' | 'comicvine' | 'unknown'
): PositionalRule[] {
  let sourceRules: PositionalRule[];

  switch (sourceType) {
    case 'fandom':
      sourceRules = FANDOM_SOURCE_RULES as unknown as PositionalRule[];
      break;
    case 'wikipedia':
      sourceRules = WIKIPEDIA_SOURCE_RULES as unknown as PositionalRule[];
      break;
    case 'comicvine':
      sourceRules = COMICVINE_SOURCE_RULES as unknown as PositionalRule[];
      break;
    case 'unknown':
    default:
      sourceRules = [];
  }

  return sourceRules.sort((a, b) => b.priority - a.priority);
}

// ============================================================================
// Main Application Function
// ============================================================================

/**
 * Apply positional heuristics to tokens and return matched spans
 */
export function applyPositionalHeuristics(
  tokens: LinearizedToken[],
  sourceType: 'fandom' | 'wikipedia' | 'comicvine' | 'unknown',
  url?: string
): PositionalMatch[] {
  const rules = getRulesForSource(sourceType);
  const matches: PositionalMatch[] = [];

  const context: RuleContext = {
    tokens,
    sourceType,
    usedIndices: new Set(),
    matchedEntities: new Set(),
    ...(url !== undefined && { url }),
  };

  for (const rule of rules) {
    // Skip if single-value entity already matched
    if (SINGLE_VALUE_ENTITIES.has(rule.entityType) && context.matchedEntities.has(rule.entityType)) {
      continue;
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || shouldSkipToken(token, i, context)) continue;

      if (!rule.condition(token, i, context)) continue;

      const spanEnd = rule.getSpanEnd?.(token, i, context) ?? i;
      if (hasSpanOverlap(i, spanEnd, context.usedIndices)) continue;

      // Debug logging for CHAPTER_ALT_TITLE matches
      if (rule.entityType === 'CHAPTER_ALT_TITLE') {
        logger.info('[DEBUG] CHAPTER_ALT_TITLE rule matched', {
          ruleId: rule.id,
          tokenIndex: i,
          tokenText: token.text,
          spanEnd,
          spanText: tokens.slice(i, spanEnd + 1).map(t => t.text).join(' ')
        });
      }

      recordMatch(rule, i, spanEnd, context, matches);

      // For single-value entities, stop checking this rule
      if (SINGLE_VALUE_ENTITIES.has(rule.entityType)) break;
    }
  }

  return matches;
}

/**
 * Convert positional matches to token spans for labeling
 */
export function positionalMatchesToSpans(matches: PositionalMatch[]): TokenSpan[] {
  return matches.map(m => m.span);
}

// ============================================================================
// Exports
// ============================================================================

// Re-export source-specific rules from the source-rules module
export {
  FANDOM_RULES,
  WIKIPEDIA_RULES,
  COMICVINE_RULES,
} from './source-rules';
