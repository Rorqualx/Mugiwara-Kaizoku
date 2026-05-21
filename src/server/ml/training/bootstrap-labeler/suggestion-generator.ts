/**
 * Suggestion Generator
 *
 * Converts bootstrap labeling results into user-reviewable suggestions.
 * Separates high-confidence auto-applied labels from medium-confidence
 * suggestions that need human review.
 *
 * @module ml/training/bootstrap-labeler/suggestion-generator
 */

import { v4 as uuid } from 'uuid';

import type { BIOTag, EntityType, LinearizedToken } from '@/server/ml/features/dom-linearizer';

import {
  DEFAULT_SUGGESTION_THRESHOLDS,
  type BootstrapResult,
  type BootstrapResultEnhanced,
  type LabelSuggestion,
  type SuggestionSource,
  type SuggestionThresholds,
  type TokenSpan,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract entity type from BIO tag
 */
function getEntityFromBIOTag(tag: BIOTag): EntityType | null {
  if (tag === 'O') return null;
  return tag.substring(2) as EntityType;
}

/**
 * Map match type to suggestion source
 */
function matchTypeToSource(matchType: TokenSpan['matchType']): SuggestionSource {
  switch (matchType) {
    case 'exact':
    case 'substring':
    case 'multi-token':
      return 'pattern';
    case 'propagation':
      return 'propagation';
    default:
      return 'pattern';
  }
}

/**
 * Combine text from multiple tokens
 */
function combineTokenText(tokens: LinearizedToken[], start: number, end: number): string {
  const texts: string[] = [];
  for (let i = start; i <= end && i < tokens.length; i++) {
    const token = tokens[i];
    if (token) {
      texts.push(token.text);
    }
  }
  return texts.join(' ');
}

/**
 * Build token indices array for a span
 */
function buildTokenIndices(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// ============================================================================
// Reasoning Generation
// ============================================================================

/**
 * Get match type description
 */
function getMatchTypeDescription(matchType: TokenSpan['matchType'], tokenCount: number): string {
  switch (matchType) {
    case 'exact':
      return 'via exact text match';
    case 'substring':
      return 'via partial text match';
    case 'multi-token':
      return `spanning ${tokenCount} tokens`;
    case 'propagation':
      return 'via label propagation from nearby pattern';
    default:
      return '';
  }
}

/**
 * Get location context description
 */
function getLocationContext(token: LinearizedToken): string {
  if (token.isInInfobox) return 'in infobox';
  if (token.sectionType === 'main_content') return 'in main content';
  return '';
}

/**
 * Get structural context description
 */
function getStructuralContext(token: LinearizedToken): string[] {
  const parts: string[] = [];
  if (token.isHeader) parts.push(`(H${token.headerLevel} header)`);
  if (token.isBold) parts.push('(bold text)');
  if (token.nearestLabelText) parts.push(`near "${token.nearestLabelText}" label`);
  return parts;
}

/**
 * Generate human-readable reasoning for a suggestion
 */
function generateReasoning(span: TokenSpan, tokens: LinearizedToken[]): string {
  const token = tokens[span.start];
  if (!token) return 'Unknown context';

  const parts: string[] = [`Detected as ${span.entityType}`];

  const matchDesc = getMatchTypeDescription(span.matchType, span.end - span.start + 1);
  if (matchDesc) parts.push(matchDesc);

  const locationCtx = getLocationContext(token);
  if (locationCtx) parts.push(locationCtx);

  parts.push(...getStructuralContext(token));
  parts.push(`(${Math.round(span.confidence * 100)}% confidence)`);

  return parts.join(' ');
}

// ============================================================================
// Span to Suggestion Conversion
// ============================================================================

/**
 * Convert a token span to a label suggestion
 */
function spanToSuggestion(
  span: TokenSpan,
  tokens: LinearizedToken[],
  ruleId?: string
): LabelSuggestion {
  const suggestion: LabelSuggestion = {
    id: uuid(),
    tokenIndices: buildTokenIndices(span.start, span.end),
    entityType: span.entityType,
    confidence: span.confidence,
    source: matchTypeToSource(span.matchType),
    reasoning: generateReasoning(span, tokens),
    text: combineTokenText(tokens, span.start, span.end),
  };

  if (ruleId !== undefined) {
    suggestion.ruleId = ruleId;
  }

  return suggestion;
}

// ============================================================================
// Label Extraction
// ============================================================================

/**
 * Create a suggestion from label extraction
 */
function createLabelSuggestion(
  entity: EntityType,
  start: number,
  end: number,
  tokens: LinearizedToken[]
): LabelSuggestion {
  return {
    id: uuid(),
    tokenIndices: buildTokenIndices(start, end),
    entityType: entity,
    confidence: 0.7,
    source: 'pattern',
    reasoning: `Extracted from existing ${entity} label`,
    text: combineTokenText(tokens, start, end),
  };
}

/**
 * Extract suggestions from existing BIO labels
 */
function extractSuggestionsFromLabels(
  labels: BIOTag[],
  tokens: LinearizedToken[],
  existingSpans: Set<string>
): LabelSuggestion[] {
  const suggestions: LabelSuggestion[] = [];
  let currentEntity: EntityType | null = null;
  let currentStart = -1;

  // Closure to process the end of an entity span
  const closeEntitySpan = (entity: EntityType, start: number, end: number): void => {
    const spanKey = `${start}-${end}-${entity}`;
    if (!existingSpans.has(spanKey)) {
      suggestions.push(createLabelSuggestion(entity, start, end, tokens));
    }
  };

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;

    const entity = getEntityFromBIOTag(label);

    if (label.startsWith('B-') && entity) {
      // Close previous entity if exists
      if (currentEntity !== null && currentStart >= 0) {
        closeEntitySpan(currentEntity, currentStart, i - 1);
      }
      currentEntity = entity;
      currentStart = i;
    } else if (label === 'O' && currentEntity !== null && currentStart >= 0) {
      // End of entity
      closeEntitySpan(currentEntity, currentStart, i - 1);
      currentEntity = null;
      currentStart = -1;
    }
  }

  // Handle entity at end of document
  if (currentEntity !== null && currentStart >= 0) {
    closeEntitySpan(currentEntity, currentStart, labels.length - 1);
  }

  return suggestions;
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Generate suggestions from a bootstrap result.
 */
export function generateSuggestions(
  result: BootstrapResult,
  thresholds: SuggestionThresholds = DEFAULT_SUGGESTION_THRESHOLDS
): BootstrapResultEnhanced {
  const suggestions: LabelSuggestion[] = [];
  const existingSpans = new Set<string>();

  // Convert spans to suggestions
  for (const span of result.spans) {
    existingSpans.add(`${span.start}-${span.end}-${span.entityType}`);
    suggestions.push(spanToSuggestion(span, result.tokens));
  }

  // Extract additional suggestions from labels not in spans
  suggestions.push(...extractSuggestionsFromLabels(result.labels, result.tokens, existingSpans));

  // Filter and sort
  const displayable = suggestions
    .filter(s => s.confidence >= thresholds.minDisplay)
    .sort((a, b) => b.confidence - a.confidence);

  const autoAppliedCount = displayable.filter(s => s.confidence >= thresholds.autoApply).length;
  const pendingReviewCount = displayable.length - autoAppliedCount;

  return {
    ...result,
    suggestions: displayable,
    autoAppliedCount,
    pendingReviewCount,
    autoApplyThreshold: thresholds.autoApply,
  };
}

/**
 * Apply a suggestion to labels, converting it to BIO tags.
 */
export function applySuggestionToLabels(
  labels: BIOTag[],
  suggestion: LabelSuggestion
): BIOTag[] {
  const newLabels = [...labels];
  const { tokenIndices, entityType } = suggestion;

  for (let i = 0; i < tokenIndices.length; i++) {
    const tokenIndex = tokenIndices[i];
    if (tokenIndex !== undefined && tokenIndex < newLabels.length) {
      newLabels[tokenIndex] = i === 0 ? `B-${entityType}` : `I-${entityType}`;
    }
  }

  return newLabels;
}

/**
 * Apply all suggestions above the auto-apply threshold.
 */
export function autoApplySuggestions(
  result: BootstrapResultEnhanced
): BootstrapResultEnhanced {
  let labels = [...result.labels];

  for (const suggestion of result.suggestions) {
    if (suggestion.confidence >= result.autoApplyThreshold) {
      labels = applySuggestionToLabels(labels, suggestion);
    }
  }

  return { ...result, labels };
}

/**
 * Filter suggestions to only show those pending review.
 */
export function getPendingSuggestions(result: BootstrapResultEnhanced): LabelSuggestion[] {
  return result.suggestions.filter(
    s => s.confidence >= DEFAULT_SUGGESTION_THRESHOLDS.minDisplay &&
         s.confidence < result.autoApplyThreshold
  );
}

/**
 * Group suggestions by entity type for panel display.
 */
export function groupSuggestionsByEntity(
  suggestions: LabelSuggestion[]
): Map<EntityType, LabelSuggestion[]> {
  const grouped = new Map<EntityType, LabelSuggestion[]>();

  for (const suggestion of suggestions) {
    const existing = grouped.get(suggestion.entityType) ?? [];
    existing.push(suggestion);
    grouped.set(suggestion.entityType, existing);
  }

  return grouped;
}
