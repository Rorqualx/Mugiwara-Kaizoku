/**
 * Correction Generator
 *
 * Generates label corrections from detected review issues.
 * Maps correctable issue types to concrete BIO label changes.
 */

import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';

import type {
  AgentCorrections,
  LabelCorrection,
  ReviewIssue,
  LabeledSpan,
  ReviewableToken,
} from './types';
import type { AnnotationSourceType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface PageContext {
  url: string;
  sourceType: AnnotationSourceType;
  tokens: ReviewableToken[];
  labels: BIOTag[];
}

/** Entity type mapping for wrong_page_type_context corrections */
const SUMMARY_TYPE_CORRECTIONS: Record<string, EntityType> = {
  'Change to CHAPTER_SUMMARY': 'CHAPTER_SUMMARY',
  'Change to SERIES_SUMMARY': 'SERIES_SUMMARY',
  'Change to VOLUME_SUMMARY': 'VOLUME_SUMMARY',
};

// ============================================================================
// BIO Label Helpers
// ============================================================================

/**
 * Build proper BIO label sequence for an entity type over a token range.
 * First token gets B- prefix, rest get I- prefix.
 */
export function buildBIOLabels(
  entityType: EntityType,
  tokenStart: number,
  tokenEnd: number
): BIOTag[] {
  const labels: BIOTag[] = [];
  for (let i = tokenStart; i < tokenEnd; i++) {
    labels.push(i === tokenStart ? `B-${entityType}` : `I-${entityType}`);
  }
  return labels;
}

// ============================================================================
// Span Matching
// ============================================================================

/**
 * Find the labeled span that corresponds to an issue's token indices
 */
function findSpanForIssue(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabeledSpan | null {
  if (!issue.tokenIndices || issue.tokenIndices.length === 0) {
    // Fall back to matching by entity type (for issues without token indices)
    if (issue.relatedEntity) {
      return spans.find((s) => s.entityType === issue.relatedEntity) ?? null;
    }
    return null;
  }

  const issueStart = issue.tokenIndices[0];
  const issueEnd = issue.tokenIndices[issue.tokenIndices.length - 1];
  if (issueStart === undefined || issueEnd === undefined) return null;

  // Find span that contains these token indices
  return (
    spans.find((s) => s.startIndex <= issueStart && s.endIndex > issueEnd) ??
    null
  );
}

/**
 * Find all spans matching a given entity type
 */
function findAllSpansForEntity(
  entityType: EntityType,
  spans: LabeledSpan[]
): LabeledSpan[] {
  return spans.filter((s) => s.entityType === entityType);
}

// ============================================================================
// Issue-Specific Correction Generators
// ============================================================================

function generateRemovalCorrection(
  span: LabeledSpan,
  reason: string,
  confidence: number
): LabelCorrection {
  return {
    tokenStart: span.startIndex,
    tokenEnd: span.endIndex,
    text: span.text,
    previousLabel: `B-${span.entityType}`,
    newLabel: 'O',
    reason,
    confidence,
  };
}

function generateNavigationRemoval(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabelCorrection | null {
  const span = findSpanForIssue(issue, spans);
  if (!span) return null;

  return generateRemovalCorrection(
    span,
    `Navigation content incorrectly labeled as ${span.entityType}`,
    0.85
  );
}

function generateSummaryNavigationRemoval(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabelCorrection | null {
  const span = findSpanForIssue(issue, spans);
  if (!span) return null;

  return generateRemovalCorrection(
    span,
    `Summary text is navigation, not actual ${span.entityType}`,
    0.80
  );
}

function generateImpossibleValueRemoval(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabelCorrection | null {
  // Only correct error-severity impossible values (high confidence)
  if (issue.severity !== 'error') return null;

  const span = findSpanForIssue(issue, spans);
  if (!span) return null;

  return generateRemovalCorrection(
    span,
    `Invalid value for ${span.entityType}: ${issue.message}`,
    0.85
  );
}

function generatePageTypeModification(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabelCorrection | null {
  if (!issue.suggestedAction) return null;

  const newEntityType = SUMMARY_TYPE_CORRECTIONS[issue.suggestedAction];
  if (!newEntityType) return null;

  const span = findSpanForIssue(issue, spans);
  if (!span) return null;

  // The newLabel here is just the first token's label (B- prefix).
  // When applied, applyCorrections() will generate proper BIO sequence.
  return {
    tokenStart: span.startIndex,
    tokenEnd: span.endIndex,
    text: span.text,
    previousLabel: `B-${span.entityType}`,
    newLabel: `B-${newEntityType}`,
    reason: `${span.entityType} on wrong page type: ${issue.suggestedAction}`,
    confidence: 0.85,
  };
}

function generatePageTypeMismatchRemoval(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabelCorrection | null {
  const span = findSpanForIssue(issue, spans);
  if (!span) return null;

  return generateRemovalCorrection(
    span,
    `${span.entityType} not valid on this page type`,
    0.70
  );
}

function generateDuplicateRemovals(
  issue: ReviewIssue,
  spans: LabeledSpan[]
): LabelCorrection[] {
  if (!issue.relatedEntity) return [];

  const matchingSpans = findAllSpansForEntity(issue.relatedEntity, spans);
  if (matchingSpans.length <= 1) return [];

  // Keep the first occurrence, remove the rest
  return matchingSpans.slice(1).map((span) =>
    generateRemovalCorrection(
      span,
      `Duplicate ${span.entityType} - keeping first occurrence`,
      0.75
    )
  );
}

// ============================================================================
// Deduplication
// ============================================================================

/**
 * Remove overlapping corrections, keeping the highest-confidence one
 * for each token range
 */
function deduplicateCorrections(corrections: LabelCorrection[]): LabelCorrection[] {
  if (corrections.length <= 1) return corrections;

  // Sort by confidence descending so higher-confidence corrections win
  const sorted = [...corrections].sort((a, b) => b.confidence - a.confidence);
  const claimedTokens = new Set<number>();
  const result: LabelCorrection[] = [];

  for (const correction of sorted) {
    // Check if any token in this range is already claimed
    let hasOverlap = false;
    for (let i = correction.tokenStart; i < correction.tokenEnd; i++) {
      if (claimedTokens.has(i)) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      result.push(correction);
      for (let i = correction.tokenStart; i < correction.tokenEnd; i++) {
        claimedTokens.add(i);
      }
    }
  }

  return result;
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate corrections from detected issues.
 *
 * Only generates corrections for issue types where we can confidently
 * determine the right fix. Ambiguous issues are left for human review.
 */
export function generateCorrections(
  issues: ReviewIssue[],
  spans: LabeledSpan[],
  _page: PageContext
): AgentCorrections {
  const removals: LabelCorrection[] = [];
  const modifications: LabelCorrection[] = [];

  for (const issue of issues) {
    switch (issue.type) {
      case 'navigation_as_content': {
        const correction = generateNavigationRemoval(issue, spans);
        if (correction) removals.push(correction);
        break;
      }

      case 'summary_is_navigation': {
        const correction = generateSummaryNavigationRemoval(issue, spans);
        if (correction) removals.push(correction);
        break;
      }

      case 'impossible_value': {
        const correction = generateImpossibleValueRemoval(issue, spans);
        if (correction) removals.push(correction);
        break;
      }

      case 'wrong_page_type_context': {
        const correction = generatePageTypeModification(issue, spans);
        if (correction) modifications.push(correction);
        break;
      }

      case 'page_type_mismatch': {
        const correction = generatePageTypeMismatchRemoval(issue, spans);
        if (correction) removals.push(correction);
        break;
      }

      case 'duplicate_entity': {
        const duplicateRemovals = generateDuplicateRemovals(issue, spans);
        removals.push(...duplicateRemovals);
        break;
      }

      // Skipped issue types (too ambiguous for rule-based correction):
      // - numeric_collision: unclear what correct label should be
      // - author_attribution_error: could be valid author
      // - wrong_entity_type: unclear what correct type would be
      // - missing_critical_entity: can't add entities without context
      // - low_confidence_span, inconsistent_labeling, overlapping_entities, truncated_entity
      default:
        break;
    }
  }

  return {
    added: [],
    removed: deduplicateCorrections(removals),
    modified: deduplicateCorrections(modifications),
  };
}
