/**
 * Pattern Propagation for Bootstrap Labeling
 *
 * Converts detected label patterns (e.g., "Author:", "Genres:") directly into
 * entity labels by propagating to following tokens. This works independently
 * of CSS selector extraction, providing labels when patterns are detected
 * but no extracted values exist.
 *
 * @module ml/training/bootstrap-labeler/pattern-propagation
 */

import type { EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';
import { logger } from '@/utils/logger';

import { detectPageType, type PageType } from './entity-labelers';
import { isNavigationPattern } from './prose-extractors';
import { isInTableOfContents, isNavboxSectionRangeHeader } from './source-rules';

import type { PatternDetectionResult, PatternSignal } from './pattern-detector';
import type { TokenSpan } from './types';

// ============================================================================
// Page-Type Aware Entity Type Mapping
// ============================================================================

/**
 * Adjust entity types based on page type.
 * On chapter pages:
 *   - SERIES_SUMMARY → CHAPTER_SUMMARY
 *   - RELEASE_DATE → CHAPTER_RELEASE_DATE
 * On volume pages:
 *   - SERIES_SUMMARY → VOLUME_SUMMARY
 *   - RELEASE_DATE → VOLUME_RELEASE_DATE
 */
function adjustEntityTypeForPageType(entityType: EntityType, pageType: PageType): EntityType {
  switch (pageType) {
    case 'chapter':
      if (entityType === 'SERIES_SUMMARY') return 'CHAPTER_SUMMARY';
      if (entityType === 'RELEASE_DATE') return 'CHAPTER_RELEASE_DATE';
      if (entityType === 'VOLUME_COUNT') return 'CHAPTER_BELONGS_TO_VOLUME';
      if (entityType === 'CHAPTER_COUNT') return 'CHAPTER_NUMBER';
      return entityType;
    case 'volume':
      if (entityType === 'SERIES_SUMMARY') return 'VOLUME_SUMMARY';
      if (entityType === 'RELEASE_DATE') return 'VOLUME_RELEASE_DATE';
      return entityType;
    default:
      return entityType;
  }
}

// Keep old name as alias for backward compatibility
const adjustSummaryEntityType = adjustEntityTypeForPageType;

// ============================================================================
// Types
// ============================================================================

export interface PropagationRule {
  /** Entity type this rule applies to */
  entityType: EntityType;
  /** Maximum number of tokens to propagate after the label */
  maxTokens: number;
  /** Base confidence for propagated labels */
  confidence: number;
  /** Stop conditions - functions that return true when propagation should stop */
  stopConditions: Array<(token: LinearizedToken, index: number, context: PropagationContext) => boolean>;
  /** Additional filter - only propagate to tokens matching this condition */
  tokenFilter?: (token: LinearizedToken) => boolean;
}

export interface PropagationContext {
  tokens: LinearizedToken[];
  patternStartIndex: number;
  labelText: string;
}

export interface PropagationResult {
  spans: TokenSpan[];
  /** Tokens that were propagated to, for tracking */
  propagatedIndices: Set<number>;
}

// ============================================================================
// Stop Condition Helpers
// ============================================================================

/** Stop when encountering another label (text ending with colon) */
function isAnotherLabel(token: LinearizedToken): boolean {
  return token.text.trim().endsWith(':');
}

/** Stop when encountering a header */
function isHeader(token: LinearizedToken): boolean {
  return token.isHeader;
}

/** Stop when element changes (different parent) */
function elementChanged(
  token: LinearizedToken,
  _index: number,
  context: PropagationContext
): boolean {
  const startToken = context.tokens[context.patternStartIndex];
  if (!startToken) return false;
  return token.parentId !== null &&
    startToken.parentId !== null &&
    token.parentId !== startToken.parentId &&
    !token.isInInfobox; // Allow crossing parents within infobox
}

/** Stop when token is only whitespace or punctuation */
function isEmptyOrPunctuation(token: LinearizedToken): boolean {
  const text = token.text.trim();
  return text.length === 0 || /^[.,;!?()[\]{}]+$/.test(text);
}

/** Stop when entering a different section */
function sectionChanged(
  token: LinearizedToken,
  _index: number,
  context: PropagationContext
): boolean {
  const startToken = context.tokens[context.patternStartIndex];
  if (!startToken) return false;
  return token.sectionType !== startToken.sectionType;
}

/** Stop when token is non-numeric (for count fields) */
function isNonNumeric(token: LinearizedToken): boolean {
  return !token.isNumeric && !/^\d+$/.test(token.text.trim());
}

/** Stop when token doesn't match date pattern (for date fields) */
function isNonDate(token: LinearizedToken): boolean {
  // Accept date patterns, numbers, month names, separators
  const text = token.text.trim().toLowerCase();
  const isDateLike = token.matchesDatePattern ||
    /^\d+$/.test(text) ||
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text) ||
    /^[/\-,]$/.test(text);
  return !isDateLike;
}

/** Check if token is in Trivia/Notes/References section - should not be labeled */
function isInTriviaSection(tokens: LinearizedToken[], index: number): boolean {
  let mostRecentHeader: string | null = null;
  const lookback = Math.min(index, 150);
  for (let i = index - 1; i >= index - lookback && i >= 0; i--) {
    const t = tokens[i];
    if (!t) continue;
    if (t.isHeader) {
      const headerText = t.text.trim().toLowerCase();
      // Skip punctuation-only or single-char tokens (brackets, colons from edit links)
      // These are artifacts of Fandom header structure, not actual section names
      if (headerText.length <= 2 && /^[[\](){}<>:;\-–—·•,.\s]*$/.test(headerText)) {
        continue;
      }
      mostRecentHeader = headerText;
      break;
    }
  }
  if (!mostRecentHeader) return false;
  const normalized = mostRecentHeader
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/:\s*$/, '')
    .trim();
  return /^(trivia|notes|references|see\s*also|external\s*links|gallery)$/i.test(normalized);
}

// ============================================================================
// Propagation Rules by Entity Type
// ============================================================================

const PROPAGATION_RULES: PropagationRule[] = [
  // Author - up to 5 tokens, stop at next label or header
  {
    entityType: 'AUTHOR',
    maxTokens: 5,
    confidence: 0.75,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged, elementChanged],
  },

  // Artist - same as author
  {
    entityType: 'ARTIST',
    maxTokens: 5,
    confidence: 0.75,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged, elementChanged],
  },

  // Genres - up to 10 tokens (genres often listed with commas)
  {
    entityType: 'GENRE',
    maxTokens: 10,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged, (t: LinearizedToken): boolean => t.isTableHeader],
    tokenFilter: (t: LinearizedToken): boolean => {
      // Exclude page title elements
      if (t.classes.some((c) => c.includes('page-title') || c.includes('firstHeading'))) return false;
      // Exclude navigation-like words and media type sub-headers
      const navWords = ['volume', 'chapter', 'episode', 'characters', 'wiki', 'category', 'manga', 'anime', 'light novel'];
      if (navWords.includes(t.text.toLowerCase())) return false;
      return true;
    },
  },

  // Volume Count - up to 3 tokens, stop at non-numeric
  {
    entityType: 'VOLUME_COUNT',
    maxTokens: 3,
    confidence: 0.8,
    stopConditions: [isAnotherLabel, isNonNumeric],
    tokenFilter: (t) => t.isNumeric || /^\d+$/.test(t.text.trim()),
  },

  // Chapter Count - same as volume count
  {
    entityType: 'CHAPTER_COUNT',
    maxTokens: 3,
    confidence: 0.8,
    stopConditions: [isAnotherLabel, isNonNumeric],
    tokenFilter: (t) => t.isNumeric || /^\d+$/.test(t.text.trim()),
  },

  // Chapter Belongs To Volume - which volume a chapter belongs to (on chapter pages)
  {
    entityType: 'CHAPTER_BELONGS_TO_VOLUME',
    maxTokens: 3,
    confidence: 0.8,
    stopConditions: [isAnotherLabel, isNonNumeric],
    tokenFilter: (t) => t.isNumeric || /^\d+$/.test(t.text.trim()),
  },

  // NOTE: CHAPTER_NUMBER, CHAPTER_ALT_TITLE, VOLUME_NUMBER, ISBN, VOLUME_RELEASE_DATE, and CHAPTER_TITLE
  // intentionally do NOT have propagation rules. For these table/list-related
  // entity types, the Wikipedia detector creates patterns with exact valueTokenIndices,
  // and we want to use those directly via createSpanFromPatternIndices()
  // rather than propagating beyond the detected bounds.

  // Status - up to 3 tokens
  {
    entityType: 'STATUS',
    maxTokens: 3,
    confidence: 0.8,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Release Date - up to 5 tokens for full date
  {
    entityType: 'RELEASE_DATE',
    maxTokens: 5,
    confidence: 0.75,
    stopConditions: [isAnotherLabel, isHeader, isNonDate],
  },

  // Publisher - up to 5 tokens
  {
    entityType: 'PUBLISHER',
    maxTokens: 5,
    confidence: 0.75,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Magazine - up to 5 tokens
  {
    entityType: 'MAGAZINE',
    maxTokens: 5,
    confidence: 0.75,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Demographic - up to 3 tokens
  {
    entityType: 'DEMOGRAPHIC',
    maxTokens: 3,
    confidence: 0.8,
    stopConditions: [isAnotherLabel, isHeader],
  },

  // Format - up to 3 tokens
  {
    entityType: 'FORMAT',
    maxTokens: 3,
    confidence: 0.75,
    stopConditions: [isAnotherLabel, isHeader],
  },

  // Tags - up to 10 tokens (tags often listed)
  {
    entityType: 'TAGS',
    maxTokens: 10,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Themes - same as tags
  {
    entityType: 'THEMES',
    maxTokens: 10,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Alt Title - up to 5 tokens
  {
    entityType: 'ALT_TITLE',
    maxTokens: 5,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Series Summary - up to 200 tokens (summaries are long prose)
  {
    entityType: 'SERIES_SUMMARY',
    maxTokens: 200,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Chapter Summary - same as series summary (page-type adjusted)
  {
    entityType: 'CHAPTER_SUMMARY',
    maxTokens: 200,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },

  // Volume Summary - same as series summary (page-type adjusted)
  {
    entityType: 'VOLUME_SUMMARY',
    maxTokens: 200,
    confidence: 0.7,
    stopConditions: [isAnotherLabel, isHeader, sectionChanged],
  },
];

// Build lookup map for quick access
const RULE_BY_ENTITY = new Map<EntityType, PropagationRule>(
  PROPAGATION_RULES.map((r) => [r.entityType, r])
);

// ============================================================================
// Main Propagation Function
// ============================================================================

/**
 * Convert detected patterns to token spans via propagation.
 *
 * This is the main entry point for pattern propagation. It takes the
 * pattern detection result and converts each detected pattern into
 * a TokenSpan by propagating to following tokens based on entity-specific rules.
 *
 * @param tokens - Linearized tokens from DOM
 * @param patternResult - Pattern detection result
 * @param usedIndices - Already claimed token indices
 * @param url - Optional URL for page type detection (affects summary entity type)
 */
export function propagatePatterns(
  tokens: LinearizedToken[],
  patternResult: PatternDetectionResult,
  usedIndices?: Set<number>,
  url?: string
): PropagationResult {
  const spans: TokenSpan[] = [];
  const propagatedIndices = new Set<number>();
  const claimedIndices = usedIndices ?? new Set<number>();

  // Detect page type for context-aware summary labeling
  const pageType = url ? detectPageType(url) : 'series';

  for (const pattern of patternResult.patterns) {
    // Skip TOC tokens and navbox section range headers early - they should never be labeled
    const startIdx = Math.min(...pattern.valueTokenIndices);
    if (startIdx >= 0 && startIdx < tokens.length) {
      const startToken = tokens[startIdx];
      if (startToken && isInTableOfContents(startToken)) continue;
      if (startToken && isNavboxSectionRangeHeader(startToken)) continue;
    }

    // Skip misleading patterns on chapter/issue pages:
    // - TITLE/VOLUME_NUMBER from tables: ComicVine issue details tables have
    //   "Name"/"Volume" headers that produce garbage (e.g., "Volume 1 Name Name of this issue.")
    // - SERIES_SUMMARY from label:value: "Story:" labels match placeholder text
    if (pageType === 'chapter') {
      if (pattern.type === 'table_header_value' &&
          (pattern.entityType === 'TITLE' || pattern.entityType === 'VOLUME_NUMBER')) {
        continue;
      }
      if (pattern.entityType === 'SERIES_SUMMARY') {
        continue;
      }
    }

    const span = propagatePatternToSpan(tokens, pattern, claimedIndices, pageType);
    if (!span) continue;

    // Debug: Log VOLUME_COUNT and CHAPTER_COUNT propagation
    const isCountType = span.entityType === 'VOLUME_COUNT' || span.entityType === 'CHAPTER_COUNT';
    if (isCountType) {
      logger.debug('[pattern-propagation] Created count span', {
        entityType: span.entityType,
        start: span.start,
        end: span.end,
        patternLabelText: pattern.labelText,
      });
    }

    spans.push(span);
    // Mark indices as claimed and propagated
    for (let i = span.start; i <= span.end; i++) {
      claimedIndices.add(i);
      propagatedIndices.add(i);
    }
  }

  return { spans, propagatedIndices };
}

/**
 * Convert a single pattern to a token span.
 */
function propagatePatternToSpan(
  tokens: LinearizedToken[],
  pattern: PatternSignal,
  claimedIndices: Set<number>,
  pageType: PageType
): TokenSpan | null {
  const { entityType, valueTokenIndices } = pattern;

  // Pattern must have an entity type and value indices
  if (!entityType || valueTokenIndices.length === 0) {
    return null;
  }

  // Adjust summary entity types based on page type
  const adjustedEntityType = adjustSummaryEntityType(entityType, pageType);

  // Find the start of value tokens (first value index from pattern)
  const startIndex = Math.min(...valueTokenIndices);
  if (startIndex < 0 || startIndex >= tokens.length) {
    return null;
  }

  // CRITICAL: Skip Trivia/Notes/References sections EARLY - before any span creation
  // This must be checked before createSpanFromPatternIndices fallback
  if (isInTriviaSection(tokens, startIndex)) {
    return null;
  }

  // Get propagation rule for this entity type (use original for rule lookup)
  const rule = RULE_BY_ENTITY.get(entityType);
  if (!rule) {
    // No rule defined - use default behavior from pattern detection
    return createSpanFromPatternIndices(pattern, claimedIndices, adjustedEntityType);
  }

  // Check if start is already claimed
  if (claimedIndices.has(startIndex)) {
    return null;
  }

  // Check if the span text matches navigation patterns (shouldn't be labeled)
  const startToken = tokens[startIndex];
  if (!startToken) {
    return null;
  }
  if (isNavigationPattern(startToken.text)) {
    return null;
  }

  // Skip TOC (Table of Contents) content - these are navigation elements, not entity values
  if (startToken.sectionType === 'sidebar' || startToken.classes.some((c) => c.toLowerCase().includes('toc'))) {
    return null;
  }

  // Note: isInTriviaSection check already done above before createSpanFromPatternIndices fallback

  // Create propagation context
  const context: PropagationContext = {
    tokens,
    patternStartIndex: startIndex,
    labelText: pattern.labelText,
  };

  // Propagate to find span end
  const endIndex = findPropagationEnd(tokens, startIndex, rule, context, claimedIndices);

  if (endIndex < startIndex) {
    return null;
  }

  // Check if the combined span text matches navigation patterns
  const spanText = tokens.slice(startIndex, endIndex + 1).map(t => t.text).join(' ');
  if (isNavigationPattern(spanText)) {
    return null;
  }

  return {
    start: startIndex,
    end: endIndex,
    entityType: adjustedEntityType,
    confidence: rule.confidence * pattern.confidence,
    matchType: 'propagation',
  };
}

/**
 * Find the end index for propagation based on rule conditions.
 */
function findPropagationEnd(
  tokens: LinearizedToken[],
  startIndex: number,
  rule: PropagationRule,
  context: PropagationContext,
  claimedIndices: Set<number>
): number {
  // Initialize to startIndex - 1 so that if no tokens pass the filter,
  // endIndex < startIndex and the span will be rejected
  let endIndex = startIndex - 1;
  const maxIndex = Math.min(startIndex + rule.maxTokens, tokens.length);

  for (let i = startIndex; i < maxIndex; i++) {
    const token = tokens[i];
    if (!token) break;

    // Check if already claimed
    if (claimedIndices.has(i) && i !== startIndex) {
      break;
    }

    // Skip empty tokens but don't break
    if (isEmptyOrPunctuation(token)) {
      continue;
    }

    // Check token filter if defined - if first token fails, no span is created
    if (rule.tokenFilter && !rule.tokenFilter(token)) {
      break;
    }

    // Check stop conditions
    let shouldStop = false;
    for (const stopCondition of rule.stopConditions) {
      if (stopCondition(token, i, context)) {
        shouldStop = true;
        break;
      }
    }

    if (shouldStop) {
      break;
    }

    endIndex = i;
  }

  return endIndex;
}

/**
 * Create a span directly from pattern's value token indices.
 * Used when no specific propagation rule exists.
 *
 * @param pattern - Pattern signal from detection
 * @param claimedIndices - Already claimed token indices
 * @param adjustedEntityType - Entity type adjusted for page context (e.g., CHAPTER_SUMMARY on chapter pages)
 */
function createSpanFromPatternIndices(
  pattern: PatternSignal,
  claimedIndices: Set<number>,
  adjustedEntityType: EntityType
): TokenSpan | null {
  const { valueTokenIndices, confidence } = pattern;

  if (valueTokenIndices.length === 0) {
    return null;
  }

  // Filter out already claimed indices
  const availableIndices = valueTokenIndices.filter((i) => !claimedIndices.has(i));
  if (availableIndices.length === 0) {
    return null;
  }

  const start = Math.min(...availableIndices);
  const end = Math.max(...availableIndices);

  // Debug: Log large spans that might indicate a problem
  const spanSize = end - start + 1;
  if (spanSize > 50) {
    console.error('[SPAN-DEBUG] Large span from pattern', {
      entityType: adjustedEntityType,
      patternSource: pattern.source,
      start,
      end,
      spanSize,
      valueIndicesCount: valueTokenIndices.length,
      availableIndicesCount: availableIndices.length,
    });
  }

  return {
    start,
    end,
    entityType: adjustedEntityType,
    confidence: confidence * 0.7, // Slight penalty for default handling
    matchType: 'propagation',
  };
}

// ============================================================================
// Exports
// ============================================================================

export { PROPAGATION_RULES };
