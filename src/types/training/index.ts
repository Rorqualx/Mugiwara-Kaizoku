/**
 * Training Data Types - Barrel Export
 *
 * Exports all training-related types for LLM data preparation.
 *
 * @module types/training
 */

// Document Labels
export type {
  DocumentCategory,
  QualityTier,
  UseCaseLabel,
  DocumentLabels,
  DocumentLabelsWithMeta,
  DocumentLabelFilter,
} from './document-labels';

export {
  DOCUMENT_CATEGORY_INFO,
  QUALITY_TIER_INFO,
  QUALITY_TIER_ORDER,
  USE_CASE_INFO,
  meetsQualityThreshold,
  getTiersAboveThreshold,
  getTierFromScore,
} from './document-labels';

// Image Labels
export type {
  ImageType,
  ImageQuality,
  ImageContentType,
  ImageLabel,
  ImageStats,
  ImageLabelContext,
  InferredImageLabel,
  ImageLabelFilter,
  ImageLabelUpdate,
} from './image-labels';
