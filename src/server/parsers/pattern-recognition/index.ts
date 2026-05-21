/**
 * Pattern Recognition Engine
 *
 * ML-powered pattern recognition for automatic HTML structure learning.
 * Explicit exports for tree-shaking optimization.
 */

// Core classes - explicit exports
export { PatternRecognitionEngine } from './core/PatternRecognitionEngine';
export { FeatureEngineering } from './core/FeatureEngineering';
export { MLPipeline } from './core/MLPipeline';
export { PatternEvolutionManager } from './core/PatternEvolutionManager';
export { ActiveLearningSystem } from './core/ActiveLearningSystem';

// Types - explicit exports for tree-shaking
export type {
  FeatureVector,
  PatternMetrics,
  PatternFeatures,
  StructuralFeatures,
  SemanticFeatures,
  StatisticalFeatures,
  VisualFeatures,
  ContextualFeatures,
  Pattern,
  PatternType,
  PatternSource,
  PatternMatch,
  MLModel,
  ModelType,
  ModelMetadata,
  Prediction,
  LearningExample,
  UserFeedback,
  LearningMetrics,
  PatternEvolution,
  EvolutionReason,
  EvolutionMetrics,
  CacheEntry,
  EngineConfig,
  MLConfig,
  FeatureConfig,
  PerformanceConfig,
  PatternEvent,
  EventType,
  PatternRecord,
  PatternPerformance,
  ModelRecord,
  ModelPerformance,
  PatternPrediction,
  PatternVariation,
  PatternSignature,
  PatternCategory,
  RecognitionRequest,
  RecognitionOptions,
  RecognitionResponse,
  SystemMetrics,
} from './types';