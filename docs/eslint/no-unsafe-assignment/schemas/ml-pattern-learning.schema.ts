/**
 * Zod schemas for ML Pattern Learning APIs
 *
 * Used for pattern recognition metrics, suggestions, and feedback
 */

import { z } from 'zod';

/**
 * Extracted data from manga filenames/metadata
 */
export const ExtractedDataSchema = z.object({
  title: z.string().optional(),
  volume: z.number().optional(),
  chapter: z.number().optional(),
  releaseGroup: z.string().optional(),
  year: z.number().optional(),
  language: z.string().optional(),
  quality: z.string().optional(),
  format: z.string().optional(),
});

export type ExtractedData = z.infer<typeof ExtractedDataSchema>;

/**
 * Pattern learning metrics
 */
export const PatternLearningMetricsSchema = z.object({
  totalPatterns: z.number(),
  accuracyRate: z.number().min(0).max(100),
  lastUpdated: z.string().datetime(),
  correctionCount: z.number(),
  successfulExtractions: z.number(),
  failedExtractions: z.number(),
  confidenceThreshold: z.number().min(0).max(1),
});

export type PatternLearningMetrics = z.infer<typeof PatternLearningMetricsSchema>;

/**
 * Correction feedback types
 */
export const CorrectionFeedbackSchema = z.object({
  confidence: z.number().min(0).max(1),
  fieldsCorrected: z.array(z.string()),
  patternMatched: z.string().optional(),
  notes: z.string().optional(),
});

export type CorrectionFeedback = z.infer<typeof CorrectionFeedbackSchema>;

/**
 * Pattern suggestion
 */
export const PatternSuggestionSchema = z.object({
  pattern: z.string(),
  confidence: z.number().min(0).max(1),
  matches: z.number(),
  examples: z.array(z.string()).optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

export type PatternSuggestion = z.infer<typeof PatternSuggestionSchema>;

/**
 * Pattern learning API response
 */
export const PatternLearningResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    extracted: ExtractedDataSchema.optional(),
    suggestions: z.array(PatternSuggestionSchema).optional(),
    metrics: PatternLearningMetricsSchema.optional(),
  }).optional(),
  error: z.string().optional(),
});

export type PatternLearningResponse = z.infer<typeof PatternLearningResponseSchema>;

/**
 * ML metrics dashboard data
 */
export const MLMetricsSchema = z.object({
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1Score: z.number(),
  totalSamples: z.number(),
  trainingDate: z.string().datetime().optional(),
});

export type MLMetrics = z.infer<typeof MLMetricsSchema>;

/**
 * ML time series data point
 */
export const MLTimeSeriesDataPointSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
  label: z.string().optional(),
});

export const MLTimeSeriesDataSchema = z.object({
  metric: z.string(),
  data: z.array(MLTimeSeriesDataPointSchema),
});

export type MLTimeSeriesData = z.infer<typeof MLTimeSeriesDataSchema>;

/**
 * ML feature flags
 */
export const MLFeatureFlagsSchema = z.object({
  patternLearningEnabled: z.boolean(),
  autoCorrectEnabled: z.boolean(),
  confidenceThreshold: z.number().min(0).max(1),
  minSamplesRequired: z.number(),
});

export type MLFeatureFlags = z.infer<typeof MLFeatureFlagsSchema>;

/**
 * Safe parsers
 */
export function parsePatternLearningMetrics(data: unknown): PatternLearningMetrics | null {
  const result = PatternLearningMetricsSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Pattern learning metrics validation failed:', result.error.issues);
  return null;
}

export function parsePatternLearningResponse(data: unknown): PatternLearningResponse | null {
  const result = PatternLearningResponseSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('Pattern learning response validation failed:', result.error.issues);
  return null;
}

export function parseMLMetrics(data: unknown): MLMetrics | null {
  const result = MLMetricsSchema.safeParse(data);
  if (result.success) return result.data;
  console.error('ML metrics validation failed:', result.error.issues);
  return null;
}
