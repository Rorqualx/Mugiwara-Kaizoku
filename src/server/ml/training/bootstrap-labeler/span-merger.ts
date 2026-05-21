/**
 * Span Merger for Bootstrap Labeling
 *
 * Handles merging of spans from different labeling phases with proper priority.
 * Positional heuristics take priority over pattern propagation, which takes priority over extractors.
 *
 * @module ml/training/bootstrap-labeler/span-merger
 */

import type { BIOTag, EntityType } from '@/server/ml/features/dom-linearizer';

import type { TokenSpan } from './types';

// Single-value entity types - only one span per type should exist
const SINGLE_VALUE_ENTITY_TYPES = new Set<EntityType>([
  'TITLE',
  'AUTHOR',
  'ARTIST',
  'COVER_IMAGE',
  'STATUS',
  'VOLUME_COUNT',
  'CHAPTER_COUNT',
  'RELEASE_DATE',
  'SERIES_SUMMARY',
  'PUBLISHER',
  'ENGLISH_PUBLISHER',
  'MAGAZINE',
  'DEMOGRAPHIC',
  'FORMAT',
  'CHAPTER_TITLE',
  'VOLUME_TITLE',
]);

/**
 * Check if a span conflicts with already claimed indices
 */
function hasConflict(span: TokenSpan, claimedIndices: Set<number>): boolean {
  for (let i = span.start; i <= span.end; i++) {
    if (claimedIndices.has(i)) {
      return true;
    }
  }
  return false;
}

/**
 * Apply BIO labels for a span
 */
function applySpanToLabels(labels: BIOTag[], span: TokenSpan, tokenCount: number): void {
  for (let i = span.start; i <= span.end && i < tokenCount; i++) {
    const prefix = i === span.start ? 'B' : 'I';
    // eslint-disable-next-line no-param-reassign -- Required for label array mutation
    labels[i] = `${prefix}-${span.entityType}` as BIOTag;
  }
}

/**
 * Clear extractor labels for single-value entities where positional has priority.
 * This prevents duplicate labels (e.g., TITLE in both navigation and infobox).
 */
function clearConflictingExtractorLabels(
  labels: BIOTag[],
  positionalSpans: TokenSpan[],
  positionalSingleValueTypes: Set<EntityType>
): void {
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label || label === 'O') continue;

    // Extract entity type from BIO tag (e.g., "B-TITLE" -> "TITLE")
    const entityType = label.substring(2) as EntityType;

    if (positionalSingleValueTypes.has(entityType)) {
      // Check if this index is NOT in any positional span of that type
      const inPositionalSpan = positionalSpans.some(
        (span) => span.entityType === entityType && i >= span.start && i <= span.end
      );
      if (!inPositionalSpan) {
        // Clear this extractor label - positional has priority for this entity type
        // eslint-disable-next-line no-param-reassign
        labels[i] = 'O';
      }
    }
  }
}

/**
 * Merge all spans with priority: positional > propagation > extractor.
 * For single-value entities, positional spans completely override extractor labels.
 */
export function mergeAllSpansWithPriority(
  tokenCount: number,
  positionalSpans: TokenSpan[],
  propagationSpans: TokenSpan[],
  extractorSpans: TokenSpan[],
  extractorLabels: BIOTag[]
): { mergedSpans: TokenSpan[]; mergedLabels: BIOTag[] } {
  // Start with extractor labels as base (they're already applied)
  const mergedLabels: BIOTag[] = [...extractorLabels];
  const mergedSpans: TokenSpan[] = [];

  // Track which tokens are claimed at each priority level
  const claimedIndices = new Set<number>();

  // Track single-value entity types matched by positional spans
  const positionalSingleValueTypes = new Set<EntityType>();
  for (const span of positionalSpans) {
    if (SINGLE_VALUE_ENTITY_TYPES.has(span.entityType)) {
      positionalSingleValueTypes.add(span.entityType);
    }
  }

  // CRITICAL: Clear extractor labels for single-value entities that positional will override
  clearConflictingExtractorLabels(mergedLabels, positionalSpans, positionalSingleValueTypes);

  // Priority 1: Apply positional spans (highest priority)
  for (const span of positionalSpans) {
    mergedSpans.push(span);
    applySpanToLabels(mergedLabels, span, tokenCount);
    for (let i = span.start; i <= span.end && i < tokenCount; i++) {
      claimedIndices.add(i);
    }
  }

  // Priority 2: Apply propagation spans (avoid conflicts with positional)
  // Also skip single-value entities already claimed by positional spans
  for (const span of propagationSpans) {
    if (SINGLE_VALUE_ENTITY_TYPES.has(span.entityType) && positionalSingleValueTypes.has(span.entityType)) {
      continue; // Positional has priority for this single-value entity type
    }
    if (!hasConflict(span, claimedIndices)) {
      mergedSpans.push(span);
      applySpanToLabels(mergedLabels, span, tokenCount);
      for (let i = span.start; i <= span.end && i < tokenCount; i++) {
        claimedIndices.add(i);
      }
    }
  }

  // Priority 3: Add extractor spans (skip single-value entities matched by positional)
  for (const span of extractorSpans) {
    if (SINGLE_VALUE_ENTITY_TYPES.has(span.entityType) && positionalSingleValueTypes.has(span.entityType)) {
      continue; // Positional has priority for this entity type
    }
    if (!hasConflict(span, claimedIndices)) {
      mergedSpans.push(span);
    }
  }

  return { mergedSpans, mergedLabels };
}
