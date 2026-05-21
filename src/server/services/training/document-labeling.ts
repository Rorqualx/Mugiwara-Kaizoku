/**
 * Document Labeling Service
 *
 * Infers document-level labels from existing token features and BIO labels.
 * Provides automated categorization, quality tier assignment, and use case inference.
 *
 * @module training/document-labeling
 */


import type { BIOTag } from '@/server/ml/features/bio-types';
import { parseBIOTag } from '@/server/ml/features/bio-types';
import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';

import type { AnnotatedPage } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export type DocumentCategory =
  | 'SYNOPSIS'
  | 'REVIEW'
  | 'ANALYSIS'
  | 'NEWS'
  | 'REFERENCE'
  | 'DISCUSSION'
  | 'METADATA'
  | 'MIXED';

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'EXCLUDE';

export type UseCaseLabel =
  | 'INSTRUCTION_TUNING'
  | 'SUMMARIZATION'
  | 'QA'
  | 'CLASSIFICATION'
  | 'ENTITY_EXTRACTION'
  | 'RECOMMENDATION'
  | 'TRANSLATION';

export interface DocumentLabels {
  category: DocumentCategory;
  qualityTier: QualityTier;
  useCases: UseCaseLabel[];
}

export interface LabelingContext {
  tokens: LinearizedToken[];
  labels: BIOTag[];
  confidence?: number | undefined;
  autoQualityScore?: number | undefined;
  entityCounts?: Record<string, number> | undefined;
}

// ============================================================================
// Main Labeling Functions
// ============================================================================

/**
 * Infer document-level labels from annotated page data
 */
export function inferDocumentLabels(
  page: AnnotatedPage,
  context?: Partial<LabelingContext>
): DocumentLabels {
  const labelingContext = buildLabelingContext(page, context);

  const category = inferCategory(labelingContext);
  const qualityTier = inferQualityTier(labelingContext);
  const useCases = inferUseCases(labelingContext);

  return { category, qualityTier, useCases };
}

/**
 * Build labeling context from page and optional overrides
 */
function buildLabelingContext(
  page: AnnotatedPage,
  overrides?: Partial<LabelingContext>
): LabelingContext {
  const rawTokens = page.tokens as unknown;
  const rawLabels = page.labels as unknown;

  const tokens = Array.isArray(rawTokens) ? (rawTokens as LinearizedToken[]) : [];
  const labels = Array.isArray(rawLabels) ? (rawLabels as BIOTag[]) : [];

  // Access new fields with type assertion
  const pageExt = page as AnnotatedPage & {
    autoQualityScore?: number | null;
    entityCounts?: Record<string, number> | null;
  };

  const rawEntityCounts = pageExt.entityCounts as unknown;
  const entityCounts = rawEntityCounts && typeof rawEntityCounts === 'object'
    ? (rawEntityCounts as Record<string, number>)
    : undefined;

  return {
    tokens,
    labels,
    confidence: page.confidence ?? undefined,
    autoQualityScore: pageExt.autoQualityScore ?? undefined,
    entityCounts,
    ...overrides,
  };
}

// ============================================================================
// Category Inference
// ============================================================================

/**
 * Infer document category from content patterns
 */
function inferCategory(context: LabelingContext): DocumentCategory {
  const { tokens, labels } = context;

  const features = extractCategoryFeatures(tokens, labels);

  // Scoring system for each category
  const scores: Record<DocumentCategory, number> = {
    SYNOPSIS: 0,
    REVIEW: 0,
    ANALYSIS: 0,
    NEWS: 0,
    REFERENCE: 0,
    DISCUSSION: 0,
    METADATA: 0,
    MIXED: 0,
  };

  // Synopsis indicators
  if (features.hasSummary) scores['SYNOPSIS'] += 3;
  if (features.summaryRatio > 0.2) scores['SYNOPSIS'] += 2;

  // Reference indicators
  if (features.hasInfobox) scores['REFERENCE'] += 3;
  if (features.hasTables) scores['REFERENCE'] += 2;
  if (features.headerCount > 5) scores['REFERENCE'] += 1;

  // Review indicators
  if (features.hasReviewKeywords) scores['REVIEW'] += 3;
  if (features.hasOpinionIndicators) scores['REVIEW'] += 2;

  // News indicators
  if (features.hasDateEntity) scores['NEWS'] += 2;
  if (features.hasNewsKeywords) scores['NEWS'] += 2;

  // Metadata indicators
  if (features.metadataRatio > 0.5) scores['METADATA'] += 3;
  if (features.hasInfobox && !features.hasSummary) scores['METADATA'] += 2;

  // Analysis indicators
  if (features.hasAnalysisKeywords) scores['ANALYSIS'] += 2;
  if (features.headerCount > 3 && features.wordCount > 500) scores['ANALYSIS'] += 1;

  // Find highest scoring category
  let maxScore = 0;
  let bestCategory: DocumentCategory = 'MIXED';

  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat as DocumentCategory;
    }
  }

  // Default to MIXED if scores are too low
  return maxScore >= 2 ? bestCategory : 'MIXED';
}

interface CategoryFeatures {
  hasSummary: boolean;
  summaryRatio: number;
  hasInfobox: boolean;
  hasTables: boolean;
  headerCount: number;
  wordCount: number;
  hasReviewKeywords: boolean;
  hasOpinionIndicators: boolean;
  hasDateEntity: boolean;
  hasNewsKeywords: boolean;
  hasAnalysisKeywords: boolean;
  metadataRatio: number;
}

function extractCategoryFeatures(
  tokens: LinearizedToken[],
  labels: BIOTag[]
): CategoryFeatures {
  const summaryLabels = labels.filter(l => l.includes('SUMMARY')).length;
  const metadataLabels = labels.filter(l =>
    l.includes('TITLE') || l.includes('AUTHOR') || l.includes('GENRE') || l.includes('STATUS')
  ).length;

  const text = tokens.map(t => t.text.toLowerCase()).join(' ');

  return {
    hasSummary: summaryLabels > 0,
    summaryRatio: labels.length > 0 ? summaryLabels / labels.length : 0,
    hasInfobox: tokens.some(t => t.isInInfobox),
    hasTables: tokens.some(t => t.isInTable),
    headerCount: tokens.filter(t => t.isHeader).length,
    wordCount: tokens.filter(t => t.tokenType === 'word').length,
    hasReviewKeywords: containsKeywords(text, ['review', 'rating', 'score', 'recommend']),
    hasOpinionIndicators: containsKeywords(text, ['i think', 'in my opinion', 'personally']),
    hasDateEntity: labels.some(l => l.includes('RELEASE_DATE')),
    hasNewsKeywords: containsKeywords(text, ['announced', 'released', 'update', 'new chapter']),
    hasAnalysisKeywords: containsKeywords(text, ['analysis', 'breakdown', 'explained', 'deep dive']),
    metadataRatio: labels.length > 0 ? metadataLabels / labels.length : 0,
  };
}

function containsKeywords(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

// ============================================================================
// Quality Tier Inference
// ============================================================================

/**
 * Infer quality tier from confidence and auto quality scores
 */
function inferQualityTier(context: LabelingContext): QualityTier {
  const { confidence, autoQualityScore, labels, tokens } = context;

  // Calculate composite score
  let score = 0;
  let factors = 0;

  if (confidence !== undefined) {
    score += confidence;
    factors++;
  }

  if (autoQualityScore !== undefined) {
    score += autoQualityScore;
    factors++;
  }

  // Add basic quality indicators
  const labeledRatio = labels.filter(l => l !== 'O').length / Math.max(labels.length, 1);
  const hasStructuredContent = tokens.some(t => t.isInInfobox || t.isInTable);

  score += labeledRatio * 0.5;
  factors += 0.5;

  if (hasStructuredContent) {
    score += 0.2;
    factors += 0.2;
  }

  // Normalize
  const normalizedScore = factors > 0 ? score / factors : 0;

  // Map to tier
  if (normalizedScore >= 0.75) return 'HIGH';
  if (normalizedScore >= 0.5) return 'MEDIUM';
  if (normalizedScore >= 0.25) return 'LOW';
  return 'EXCLUDE';
}

// ============================================================================
// Use Case Inference
// ============================================================================

/**
 * Infer applicable use cases from entity distribution and content
 */
// eslint-disable-next-line complexity -- Use case inference checks multiple content patterns: entities, structure, chapter counts, etc.
function inferUseCases(context: LabelingContext): UseCaseLabel[] {
  const { tokens, labels, entityCounts } = context;
  const useCases: UseCaseLabel[] = [];

  // Entity extraction is always applicable if we have labels
  const hasEntities = labels.some(l => l !== 'O');
  if (hasEntities) {
    useCases.push('ENTITY_EXTRACTION');
  }

  // Instruction tuning for structured Q&A-like content
  if (tokens.some(t => t.isInInfobox) || tokens.some(t => t.isInTable)) {
    useCases.push('INSTRUCTION_TUNING');
  }

  // Summarization if has summary content
  const hasSummary = entityCounts?.['SERIES_SUMMARY'] ?? labels.some(l => l.includes('SUMMARY'));
  if (hasSummary) {
    useCases.push('SUMMARIZATION');
  }

  // Q&A if has diverse entity types
  const entityTypes = countEntityTypes(labels);
  if (entityTypes >= 3) {
    useCases.push('QA');
  }

  // Classification if has genres/tags
  const hasClassificationData =
    entityCounts?.['GENRE'] ??
    entityCounts?.['TAGS'] ??
    entityCounts?.['THEMES'] ??
    labels.some(l => l.includes('GENRE') || l.includes('TAG') || l.includes('THEME'));
  if (hasClassificationData) {
    useCases.push('CLASSIFICATION');
  }

  // Recommendation if has enough metadata
  const hasGenre = entityCounts?.['GENRE'] ?? labels.some(l => l.includes('GENRE'));
  const hasSummaryForRec = entityCounts?.['SERIES_SUMMARY'] ?? labels.some(l => l.includes('SUMMARY'));
  const hasRecommendationData = entityTypes >= 4 && hasGenre && hasSummaryForRec;
  if (hasRecommendationData) {
    useCases.push('RECOMMENDATION');
  }

  return useCases;
}

function countEntityTypes(labels: BIOTag[]): number {
  const types = new Set<string>();

  for (const label of labels) {
    const parsed = parseBIOTag(label);
    if (parsed?.entity) {
      types.add(parsed.entity);
    }
  }

  return types.size;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Infer labels for multiple pages
 */
export function inferBatchDocumentLabels(
  pages: AnnotatedPage[]
): Map<string, DocumentLabels> {
  const results = new Map<string, DocumentLabels>();

  for (const page of pages) {
    const labels = inferDocumentLabels(page);
    results.set(page.id, labels);
  }

  return results;
}

/**
 * Filter pages by category
 */
export function filterByCategory(
  pages: AnnotatedPage[],
  categories: DocumentCategory[]
): AnnotatedPage[] {
  return pages.filter(page => {
    const { category } = inferDocumentLabels(page);
    return categories.includes(category);
  });
}

/**
 * Filter pages by quality tier
 */
export function filterByQualityTier(
  pages: AnnotatedPage[],
  minTier: QualityTier
): AnnotatedPage[] {
  const tierOrder: Record<QualityTier, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
    EXCLUDE: 0,
  };

  const minValue = tierOrder[minTier];

  return pages.filter(page => {
    const { qualityTier } = inferDocumentLabels(page);
    return tierOrder[qualityTier] >= minValue;
  });
}

/**
 * Filter pages by use case
 */
export function filterByUseCase(
  pages: AnnotatedPage[],
  useCase: UseCaseLabel
): AnnotatedPage[] {
  return pages.filter(page => {
    const { useCases } = inferDocumentLabels(page);
    return useCases.includes(useCase);
  });
}
