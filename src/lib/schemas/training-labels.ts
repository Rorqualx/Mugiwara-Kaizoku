/**
 * Zod Schemas for Training Data Labels
 *
 * Runtime validation schemas for document and image labels
 * used in LLM training data preparation.
 *
 * @module schemas/training-labels
 */

import { z } from 'zod';

// ============================================================================
// Document Category Schemas
// ============================================================================

/**
 * Document category enum schema
 */
export const DocumentCategorySchema = z.enum([
  'SYNOPSIS',
  'REVIEW',
  'ANALYSIS',
  'NEWS',
  'REFERENCE',
  'DISCUSSION',
  'METADATA',
  'MIXED',
]);

export type DocumentCategoryInput = z.infer<typeof DocumentCategorySchema>;

// ============================================================================
// Quality Tier Schemas
// ============================================================================

/**
 * Quality tier enum schema
 */
export const QualityTierSchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
  'EXCLUDE',
]);

export type QualityTierInput = z.infer<typeof QualityTierSchema>;

/**
 * Quality tier with score validation
 */
export const QualityScoreSchema = z.number().min(0).max(1);

// ============================================================================
// Use Case Label Schemas
// ============================================================================

/**
 * Use case label enum schema
 */
export const UseCaseLabelSchema = z.enum([
  'INSTRUCTION_TUNING',
  'SUMMARIZATION',
  'QA',
  'CLASSIFICATION',
  'ENTITY_EXTRACTION',
  'RECOMMENDATION',
  'TRANSLATION',
]);

export type UseCaseLabelInput = z.infer<typeof UseCaseLabelSchema>;

// ============================================================================
// Combined Document Labels Schema
// ============================================================================

/**
 * Complete document labels schema
 */
export const DocumentLabelsSchema = z.object({
  category: DocumentCategorySchema,
  qualityTier: QualityTierSchema,
  useCases: z.array(UseCaseLabelSchema),
});

export type DocumentLabelsInput = z.infer<typeof DocumentLabelsSchema>;

/**
 * Document labels with metadata schema
 */
export const DocumentLabelsWithMetaSchema = DocumentLabelsSchema.extend({
  labeledAt: z.string(),
  labelSource: z.enum(['inferred', 'manual', 'model']),
  confidence: z.object({
    category: z.number().min(0).max(1),
    qualityTier: z.number().min(0).max(1),
    useCases: z.record(UseCaseLabelSchema, z.number().min(0).max(1)),
  }).optional(),
});

export type DocumentLabelsWithMetaInput = z.infer<typeof DocumentLabelsWithMetaSchema>;

/**
 * Document label filter schema for querying
 */
export const DocumentLabelFilterSchema = z.object({
  categories: z.array(DocumentCategorySchema).optional(),
  minQualityTier: QualityTierSchema.optional(),
  useCases: z.array(UseCaseLabelSchema).optional(),
  requireAllUseCases: z.boolean().optional(),
});

export type DocumentLabelFilterInput = z.infer<typeof DocumentLabelFilterSchema>;

// ============================================================================
// Image Type Schemas
// ============================================================================

/**
 * Image type enum schema
 */
export const ImageTypeSchema = z.enum([
  'COVER',
  'VOLUME_COVER',
  'CHAPTER_COVER',
  'PANEL',
  'CHARACTER',
  'AUTHOR_PHOTO',
  'PROMOTIONAL',
  'SCREENSHOT',
  'LOGO',
  'ICON',
  'BANNER',
  'UNKNOWN',
]);

export type ImageTypeInput = z.infer<typeof ImageTypeSchema>;

/**
 * Image quality enum schema
 */
export const ImageQualitySchema = z.enum([
  'HIGH',
  'MEDIUM',
  'LOW',
  'EXCLUDE',
]);

export type ImageQualityInput = z.infer<typeof ImageQualitySchema>;

/**
 * Image content type enum schema
 */
export const ImageContentTypeSchema = z.enum([
  'ARTWORK',
  'PHOTOGRAPH',
  'DIAGRAM',
  'TEXT_HEAVY',
  'DECORATIVE',
]);

export type ImageContentTypeInput = z.infer<typeof ImageContentTypeSchema>;

// ============================================================================
// Image Label Schemas
// ============================================================================

/**
 * Image label schema for a single token
 */
export const ImageLabelSchema = z.object({
  tokenIndex: z.number().int().nonnegative(),
  tokenId: z.string().optional(),
  imageType: ImageTypeSchema,
  quality: ImageQualitySchema,
  contentType: ImageContentTypeSchema,
  isRelevant: z.boolean(),
  caption: z.string().optional(),
  improvedAlt: z.string().optional(),
  associatedEntity: z.object({
    type: z.string(),
    value: z.string(),
  }).optional(),
  annotatedAt: z.string().optional(),
  annotatedBy: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ImageLabelInput = z.infer<typeof ImageLabelSchema>;

/**
 * Image stats schema
 */
export const ImageStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  byType: z.record(z.string(), z.number().int().nonnegative()).optional().default({}),
  byQuality: z.record(z.string(), z.number().int().nonnegative()).optional().default({}),
  relevant: z.number().int().nonnegative(),
  irrelevant: z.number().int().nonnegative(),
  withCaptions: z.number().int().nonnegative(),
  withImprovedAlt: z.number().int().nonnegative(),
});

export type ImageStatsInput = z.infer<typeof ImageStatsSchema>;

/**
 * Image label filter schema for querying
 */
export const ImageLabelFilterSchema = z.object({
  types: z.array(ImageTypeSchema).optional(),
  qualities: z.array(ImageQualitySchema).optional(),
  contentTypes: z.array(ImageContentTypeSchema).optional(),
  relevantOnly: z.boolean().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
});

export type ImageLabelFilterInput = z.infer<typeof ImageLabelFilterSchema>;

/**
 * Image label update schema
 */
export const ImageLabelUpdateSchema = z.object({
  tokenIndex: z.number().int().nonnegative(),
  updates: ImageLabelSchema.omit({ tokenIndex: true, tokenId: true }).partial(),
});

export type ImageLabelUpdateInput = z.infer<typeof ImageLabelUpdateSchema>;

// ============================================================================
// Image Label Context Schema (for inference)
// ============================================================================

/**
 * Context schema for inferring image labels
 */
export const ImageLabelContextSchema = z.object({
  src: z.string(),
  alt: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  isInInfobox: z.boolean(),
  isInTable: z.boolean(),
  sectionType: z.string(),
  precedingText: z.string().nullable(),
  followingText: z.string().nullable(),
});

export type ImageLabelContextInput = z.infer<typeof ImageLabelContextSchema>;

// ============================================================================
// Batch Operations Schemas
// ============================================================================

/**
 * Batch image label assignment schema
 */
export const BatchImageLabelsSchema = z.object({
  pageId: z.number().int().positive(),
  labels: z.array(ImageLabelSchema),
});

export type BatchImageLabelsInput = z.infer<typeof BatchImageLabelsSchema>;

/**
 * Batch document labels assignment schema
 */
export const BatchDocumentLabelsSchema = z.object({
  pageId: z.number().int().positive(),
  labels: DocumentLabelsWithMetaSchema,
});

export type BatchDocumentLabelsInput = z.infer<typeof BatchDocumentLabelsSchema>;
