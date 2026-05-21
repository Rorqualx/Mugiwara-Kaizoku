/**
 * Document Label Types for LLM Training Data
 *
 * Document-level classification for training data filtering and use case targeting.
 * These types mirror the Prisma enums but provide additional TypeScript utilities.
 *
 * @module types/training/document-labels
 */

// ============================================================================
// Document Category
// ============================================================================

/**
 * Document category classification
 * Matches Prisma enum DocumentCategory
 */
export type DocumentCategory =
  | 'SYNOPSIS'      // Plot summary, story description
  | 'REVIEW'        // User/critic review with opinions
  | 'ANALYSIS'      // Deep-dive analysis, breakdown
  | 'NEWS'          // News article, announcement
  | 'REFERENCE'     // Wiki-style reference page
  | 'DISCUSSION'    // Forum discussion, comments
  | 'METADATA'      // Pure metadata (release info, etc.)
  | 'MIXED';        // Multiple categories

/**
 * Document category descriptions for UI
 */
export const DOCUMENT_CATEGORY_INFO: Record<DocumentCategory, { label: string; description: string }> = {
  SYNOPSIS: { label: 'Synopsis', description: 'Plot summary or story description' },
  REVIEW: { label: 'Review', description: 'User or critic review with opinions' },
  ANALYSIS: { label: 'Analysis', description: 'Deep-dive analysis or breakdown' },
  NEWS: { label: 'News', description: 'News article or announcement' },
  REFERENCE: { label: 'Reference', description: 'Wiki-style reference page' },
  DISCUSSION: { label: 'Discussion', description: 'Forum discussion or comments' },
  METADATA: { label: 'Metadata', description: 'Pure metadata (release info, etc.)' },
  MIXED: { label: 'Mixed', description: 'Multiple categories combined' },
};

// ============================================================================
// Quality Tier
// ============================================================================

/**
 * Quality tier classification
 * Matches Prisma enum QualityTier
 */
export type QualityTier =
  | 'HIGH'      // Well-written, comprehensive, suitable for training
  | 'MEDIUM'    // Acceptable quality with some issues
  | 'LOW'       // Poor quality, may need filtering
  | 'EXCLUDE';  // Should not be used for training

/**
 * Quality tier descriptions and thresholds
 */
export const QUALITY_TIER_INFO: Record<QualityTier, { label: string; description: string; minScore: number }> = {
  HIGH: { label: 'High Quality', description: 'Well-written, comprehensive', minScore: 0.75 },
  MEDIUM: { label: 'Medium Quality', description: 'Acceptable with some issues', minScore: 0.50 },
  LOW: { label: 'Low Quality', description: 'Poor quality, needs filtering', minScore: 0.25 },
  EXCLUDE: { label: 'Exclude', description: 'Should not be used', minScore: 0 },
};

/**
 * Quality tier ordering for comparisons
 */
export const QUALITY_TIER_ORDER: Record<QualityTier, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  EXCLUDE: 0,
};

// ============================================================================
// Use Case Labels
// ============================================================================

/**
 * Use case classification for training data
 * Matches Prisma enum UseCaseLabel
 */
export type UseCaseLabel =
  | 'INSTRUCTION_TUNING'  // Good for instruction-following training
  | 'SUMMARIZATION'       // Good for summarization tasks
  | 'QA'                  // Good for question-answering
  | 'CLASSIFICATION'      // Good for text classification
  | 'ENTITY_EXTRACTION'   // Good for NER/entity extraction
  | 'RECOMMENDATION'      // Good for recommendation systems
  | 'TRANSLATION';        // Good for translation tasks

/**
 * Use case descriptions for UI
 */
export const USE_CASE_INFO: Record<UseCaseLabel, { label: string; description: string; requiredEntities?: string[] }> = {
  INSTRUCTION_TUNING: {
    label: 'Instruction Tuning',
    description: 'Structured Q&A-like content for instruction following',
  },
  SUMMARIZATION: {
    label: 'Summarization',
    description: 'Documents with summaries for abstractive/extractive summarization',
    requiredEntities: ['SERIES_SUMMARY'],
  },
  QA: {
    label: 'Question Answering',
    description: 'Documents suitable for reading comprehension Q&A',
  },
  CLASSIFICATION: {
    label: 'Classification',
    description: 'Documents with clear genre/category labels',
    requiredEntities: ['GENRE', 'TAG'],
  },
  ENTITY_EXTRACTION: {
    label: 'Entity Extraction',
    description: 'Documents with labeled entities for NER training',
  },
  RECOMMENDATION: {
    label: 'Recommendation',
    description: 'Documents with metadata for recommendation systems',
    requiredEntities: ['GENRE', 'SERIES_SUMMARY'],
  },
  TRANSLATION: {
    label: 'Translation',
    description: 'Documents with multilingual content',
  },
};

// ============================================================================
// Combined Document Labels
// ============================================================================

/**
 * Complete document-level labels
 */
export interface DocumentLabels {
  /** Primary document category */
  category: DocumentCategory;

  /** Quality tier assessment */
  qualityTier: QualityTier;

  /** Applicable use cases */
  useCases: UseCaseLabel[];
}

/**
 * Document labels with metadata
 */
export interface DocumentLabelsWithMeta extends DocumentLabels {
  /** When labels were computed/assigned */
  labeledAt: string;

  /** How labels were assigned: 'inferred' | 'manual' | 'model' */
  labelSource: 'inferred' | 'manual' | 'model';

  /** Confidence scores if inferred */
  confidence?: {
    category: number;
    qualityTier: number;
    useCases: Record<UseCaseLabel, number>;
  } | undefined;
}

// ============================================================================
// Label Filter Options
// ============================================================================

/**
 * Filter options for querying by document labels
 */
export interface DocumentLabelFilter {
  categories?: DocumentCategory[] | undefined;
  minQualityTier?: QualityTier | undefined;
  useCases?: UseCaseLabel[] | undefined;
  requireAllUseCases?: boolean | undefined;
}

// ============================================================================
// Utility Functions Types
// ============================================================================

/**
 * Check if a quality tier meets a minimum threshold
 */
export function meetsQualityThreshold(tier: QualityTier, minTier: QualityTier): boolean {
  return QUALITY_TIER_ORDER[tier] >= QUALITY_TIER_ORDER[minTier];
}

/**
 * Get all tiers that meet a minimum threshold
 */
export function getTiersAboveThreshold(minTier: QualityTier): QualityTier[] {
  const minValue = QUALITY_TIER_ORDER[minTier];
  return (Object.entries(QUALITY_TIER_ORDER) as [QualityTier, number][])
    .filter(([, value]) => value >= minValue)
    .map(([tier]) => tier);
}

/**
 * Get tier from numeric score
 */
export function getTierFromScore(score: number): QualityTier {
  if (score >= QUALITY_TIER_INFO.HIGH.minScore) return 'HIGH';
  if (score >= QUALITY_TIER_INFO.MEDIUM.minScore) return 'MEDIUM';
  if (score >= QUALITY_TIER_INFO.LOW.minScore) return 'LOW';
  return 'EXCLUDE';
}
