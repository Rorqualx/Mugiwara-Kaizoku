/**
 * Parser Types Barrel Export
 *
 * Central export point for all parser-related type definitions.
 * This file re-exports types from the pattern-recognition system
 * to provide a clean import path: @/server/parsers/types
 */

// ============================================================================
// Pattern Recognition Types
// ============================================================================

export {
  type PatternFeatures,
  type StructuralFeatures,
  type SemanticFeatures,
  type StatisticalFeatures,
  type VisualFeatures,
  type ContextualFeatures,
  type Pattern,
  type PatternType,
  type PatternMatch,
  type PatternSource,
  type LearningExample,
  type LearningMetrics,
  type UserFeedback,
  type PatternEvolution,
  type EvolutionReason,
  type EvolutionMetrics,
  type MLModel,
  type ModelType,
  type ModelMetadata,
  type Prediction,
  type EngineConfig,
  type MLConfig,
  type FeatureConfig,
  type PerformanceConfig,
  type RecognitionRequest,
  type RecognitionOptions,
  type RecognitionResponse,
  type PatternRecord,
  type PatternPerformance,
  type ModelRecord,
  type ModelPerformance,
  type PatternMetrics,
  type PatternVariation,
  type PatternSignature,
  type PatternCategory,
  type PatternPrediction,
  type CacheEntry,
  type PatternEvent,
  type EventType,
  type SystemMetrics,
  type FeatureVector
} from '../pattern-recognition/types';
