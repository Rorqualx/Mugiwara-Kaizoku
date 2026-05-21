/**
 * Review Logic
 *
 * Core logic for reviewing and validating labeled pages.
 */


import type { BIOTag, EntityType } from '@/server/ml/features/bio-types';
import { parseBIOTag } from '@/server/ml/features/bio-types';

import { generateCorrections } from './correction-generator';
import { detectPageType } from './page-type-detector';
import { discoverRelatedUrls } from './url-discovery';
import { validateEntity, getCriticalEntitiesForPageType } from './validation-rules';

import type {
  AgentReviewResult,
  AgentCorrections,
  AgentIssues,
  ReviewIssue,
  ValidationContext,
  ReviewableToken,
  LabeledSpan,
} from './types';
import type { AnnotationSourceType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface PageToReview {
  id: string;
  url: string;
  sourceType: AnnotationSourceType;
  tokens: ReviewableToken[];
  labels: BIOTag[];
}

/**
 * Extract labeled spans from tokens and labels
 */
function extractLabeledSpans(tokens: ReviewableToken[], labels: BIOTag[]): LabeledSpan[] {
  const spans: LabeledSpan[] = [];
  let currentSpan: LabeledSpan | null = null;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const token = tokens[i];
    if (!label || !token) continue;

    const parsed = parseBIOTag(label);

    if (!parsed || parsed.prefix === 'O') {
      // End any current span
      if (currentSpan) {
        spans.push(currentSpan);
        currentSpan = null;
      }
      continue;
    }

    if (parsed.prefix === 'B') {
      // Start new span (end previous if exists)
      if (currentSpan) {
        spans.push(currentSpan);
      }
      currentSpan = {
        entityType: parsed.entity,
        startIndex: i,
        endIndex: i + 1,
        text: token.text,
        tokens: [token],
      };
    } else {
      // Must be 'I' prefix at this point (after filtering O and B)
      if (currentSpan && parsed.entity === currentSpan.entityType) {
        // Continue current span
        currentSpan.endIndex = i + 1;
        currentSpan.text += ' ' + token.text;
        currentSpan.tokens.push(token);
      } else {
        // I tag without matching B tag - treat as new span
        if (currentSpan) {
          spans.push(currentSpan);
        }
        currentSpan = {
          entityType: parsed.entity,
          startIndex: i,
          endIndex: i + 1,
          text: token.text,
          tokens: [token],
        };
      }
    }
  }

  // Don't forget the last span
  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Build validation context for a span
 */
function buildValidationContext(
  span: LabeledSpan,
  page: PageToReview
): ValidationContext {
  const firstToken = span.tokens[0];
  const lastToken = span.tokens[span.tokens.length - 1];
  const pageType = detectPageType(page.url);

  const context: ValidationContext = {
    tokenText: span.text,
    surroundingTokens: span.tokens.map((t) => t.text),
    pageType,
    sourceType: page.sourceType,
    url: page.url,
  };

  // Only add optional properties if they have values
  if (firstToken?.precedingText) {
    context.precedingText = firstToken.precedingText;
  }
  if (lastToken?.followingText) {
    context.followingText = lastToken.followingText;
  }

  return context;
}

/**
 * Validate all labeled spans in a page
 */
function validateAllSpans(
  spans: LabeledSpan[],
  page: PageToReview
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  for (const span of spans) {
    const context = buildValidationContext(span, page);
    const result = validateEntity(span.entityType, span.text, context);

    if (!result.isValid && result.issue) {
      issues.push({
        ...result.issue,
        tokenIndices: Array.from(
          { length: span.endIndex - span.startIndex },
          (_, i) => span.startIndex + i
        ),
      });
    }
  }

  return issues;
}

// ============================================================================
// Missing Entity Detection
// ============================================================================

/**
 * Check for missing critical entities
 */
function checkMissingCriticalEntities(
  spans: LabeledSpan[],
  page: PageToReview
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const pageType = detectPageType(page.url);
  const criticalEntities = getCriticalEntitiesForPageType(pageType);
  const foundEntities = new Set(spans.map((s) => s.entityType));

  for (const entity of criticalEntities) {
    if (!foundEntities.has(entity)) {
      issues.push({
        type: 'missing_critical_entity',
        severity: 'warning',
        message: `Missing critical entity: ${entity}`,
        relatedEntity: entity,
      });
    }
  }

  return issues;
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Check for duplicate entities that should only appear once
 */
function checkDuplicateEntities(spans: LabeledSpan[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const singletonEntities: EntityType[] = ['TITLE', 'SERIES_SUMMARY', 'VOLUME_COUNT', 'CHAPTER_COUNT'];
  const entityCounts = new Map<EntityType, number>();

  for (const span of spans) {
    const count = entityCounts.get(span.entityType) ?? 0;
    entityCounts.set(span.entityType, count + 1);
  }

  for (const entity of singletonEntities) {
    const count = entityCounts.get(entity) ?? 0;
    if (count > 1) {
      issues.push({
        type: 'duplicate_entity',
        severity: 'warning',
        message: `${entity} appears ${count} times (should be 1)`,
        relatedEntity: entity,
      });
    }
  }

  return issues;
}

// ============================================================================
// Main Review Function
// ============================================================================

/**
 * Review a page's labels and generate a review result
 */
export function reviewPage(page: PageToReview): AgentReviewResult {
  const startTime = Date.now();
  const pageType = detectPageType(page.url);

  // Extract labeled spans
  const spans = extractLabeledSpans(page.tokens, page.labels);

  // Collect all issues
  const validationIssues = validateAllSpans(spans, page);
  const missingIssues = checkMissingCriticalEntities(spans, page);
  const duplicateIssues = checkDuplicateEntities(spans);

  const allIssues = [...validationIssues, ...missingIssues, ...duplicateIssues];

  // Categorize issues by severity
  const issues: AgentIssues = {
    errors: allIssues.filter((i) => i.severity === 'error'),
    warnings: allIssues.filter((i) => i.severity === 'warning'),
    suggestions: allIssues.filter((i) => i.severity === 'suggestion'),
  };

  // Discover related URLs
  const tokensWithLinks = page.tokens.map((t, i) => ({
    index: i,
    text: t.text,
    linkHref: t.linkHref ?? null,
    label: page.labels[i] ?? 'O',
  }));

  const discoveredUrls = discoverRelatedUrls({
    pageUrl: page.url,
    pageType,
    tokens: tokensWithLinks,
  });

  // Generate corrections from detected issues
  const corrections = generateCorrections(allIssues, spans, {
    url: page.url,
    sourceType: page.sourceType,
    tokens: page.tokens,
    labels: page.labels,
  });

  // Determine status (accounting for corrections)
  const status = determineReviewStatus(issues, corrections);
  const confidence = calculateConfidence(issues, spans.length, corrections);

  // Build notes
  const notes = buildReviewNotes(issues, spans.length, discoveredUrls.length, corrections);

  return {
    pageId: page.id,
    status,
    confidence,
    corrections,
    issues,
    notes,
    processingTimeMs: Date.now() - startTime,
    modelVersion: 'rule-based-v2',
    detectedPageType: pageType,
    discoveredUrls,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function determineReviewStatus(
  issues: AgentIssues,
  corrections: AgentCorrections
): 'approved' | 'corrected' | 'flagged' {
  const totalCorrections =
    corrections.added.length + corrections.removed.length + corrections.modified.length;
  const totalIssues = issues.errors.length + issues.warnings.length;

  // If all issues have corresponding corrections, mark as corrected
  if (totalCorrections > 0 && totalCorrections >= totalIssues) {
    return 'corrected';
  }

  // Uncorrected errors are always flagged
  if (issues.errors.length > 0) {
    return 'flagged';
  }

  // Too many uncorrected warnings
  if (issues.warnings.length > 3) {
    return 'flagged';
  }

  // Some corrections applied but not all issues resolved
  if (totalCorrections > 0) {
    return 'corrected';
  }

  if (issues.warnings.length > 0) {
    return 'corrected';
  }

  return 'approved';
}

function calculateConfidence(
  issues: AgentIssues,
  spanCount: number,
  corrections: AgentCorrections
): number {
  if (spanCount === 0) {
    return 0.3;
  }

  let confidence = 0.9;

  // Reduce confidence for issues
  confidence -= issues.errors.length * 0.15;
  confidence -= issues.warnings.length * 0.05;
  confidence -= issues.suggestions.length * 0.02;

  // Boost confidence for resolved issues (corrections applied)
  const totalCorrections =
    corrections.added.length + corrections.removed.length + corrections.modified.length;
  if (totalCorrections > 0) {
    confidence += totalCorrections * 0.05;
  }

  return Math.max(0.1, Math.min(1.0, confidence));
}

function buildReviewNotes(
  issues: AgentIssues,
  spanCount: number,
  discoveredUrlCount: number,
  corrections: AgentCorrections
): string {
  const parts: string[] = [];

  parts.push(`Found ${spanCount} labeled entities.`);

  if (issues.errors.length > 0) {
    parts.push(`${issues.errors.length} critical error(s) found.`);
  }

  if (issues.warnings.length > 0) {
    parts.push(`${issues.warnings.length} warning(s) found.`);
  }

  const totalCorrections =
    corrections.added.length + corrections.removed.length + corrections.modified.length;
  if (totalCorrections > 0) {
    parts.push(`Applied ${totalCorrections} correction(s): ${corrections.removed.length} removed, ${corrections.modified.length} modified.`);
  }

  if (discoveredUrlCount > 0) {
    parts.push(`Discovered ${discoveredUrlCount} related page URL(s).`);
  }

  if (issues.errors.length === 0 && issues.warnings.length === 0 && totalCorrections === 0) {
    parts.push('Labels appear valid.');
  }

  return parts.join(' ');
}

// ============================================================================
// Correction Application
// ============================================================================

/**
 * Apply corrections to a labels array.
 * Generates proper BIO tag sequences (B- for first token, I- for rest).
 */
export function applyCorrections(
  labels: BIOTag[],
  corrections: AgentCorrections
): BIOTag[] {
  const newLabels = [...labels];

  // Apply removals (set to 'O')
  for (const removal of corrections.removed) {
    for (let i = removal.tokenStart; i < removal.tokenEnd; i++) {
      newLabels[i] = 'O';
    }
  }

  // Apply modifications with proper BIO sequence
  for (const mod of corrections.modified) {
    const parsed = parseBIOTag(mod.newLabel);
    if (!parsed || parsed.prefix === 'O') {
      // If new label is 'O', just set all tokens to 'O'
      for (let i = mod.tokenStart; i < mod.tokenEnd; i++) {
        newLabels[i] = 'O';
      }
    } else {
      // Generate proper B-/I- sequence
      for (let i = mod.tokenStart; i < mod.tokenEnd; i++) {
        newLabels[i] = i === mod.tokenStart
          ? `B-${parsed.entity}`
          : `I-${parsed.entity}`;
      }
    }
  }

  // Apply additions with proper BIO sequence
  for (const addition of corrections.added) {
    const parsed = parseBIOTag(addition.newLabel);
    if (!parsed || parsed.prefix === 'O') {
      for (let i = addition.tokenStart; i < addition.tokenEnd; i++) {
        newLabels[i] = 'O';
      }
    } else {
      for (let i = addition.tokenStart; i < addition.tokenEnd; i++) {
        newLabels[i] = i === addition.tokenStart
          ? `B-${parsed.entity}`
          : `I-${parsed.entity}`;
      }
    }
  }

  return newLabels;
}
