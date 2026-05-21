/**
 * Type definitions for Pattern Recognition Engine
 */

// ============================================================================
// Core Types
// ============================================================================

export type FeatureVector = number[];

export interface PatternMetrics {
  totalMatches: number;
  successfulExtractions: number;
  averageConfidence: number;
  averageExtractionTime: number;
  lastUsed: Date;
  errorRate: number;
}

export interface PatternFeatures {
  structural: StructuralFeatures;
  semantic: SemanticFeatures;
  statistical: StatisticalFeatures;
  visual: VisualFeatures;
  contextual: ContextualFeatures;
}

export interface StructuralFeatures {
  tagCounts: Record<string, number>;
  maxDepth: number;
  averageDepth: number;
  elementCount: number;
  depth?: number;
  siblingIndex?: number;
  domDepth?: number;
  domPath?: string[];
  siblingCount?: number;
  position?: number;
  tagName?: string;
  classList?: string[];
  parentTag?: string;
  childCount?: number;
  idAttribute?: string;
  attributes?: Record<string, string>;
}

export interface SemanticFeatures {
  keywordDensity: Record<string, number>;
  topicDistribution: Record<string, number>;
  sentimentScore: number;
  readabilityScore: number;
  hasHeading?: boolean;
  hasList?: boolean;
  hasTable?: boolean;
  textContent?: string;
  semanticType?: string | 'title' | 'chapter' | 'volume' | 'author' | 'date' | 'description' | 'metadata';
  textLength?: number;
  wordCount?: number;
  hasNumbers?: boolean;
  hasDate?: boolean;
  hasISBN?: boolean;
  embeddings?: number[];
  namedEntities?: string[];
  languageCode?: string;
}

export interface StatisticalFeatures {
  wordCount: number;
  avgWordLength: number;
  sentenceCount: number;
  avgSentenceLength: number;
  paragraphCount: number;
  textLength?: number;
  entropy?: number;
  patternScore?: number;
  textDensity?: number;
  numericDensity?: number;
  punctuationDensity?: number;
  capitalLetterRatio?: number;
  averageWordLength?: number;
  uniqueWordRatio?: number;
}

export interface VisualFeatures {
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  isVisible: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isAboveFold: boolean;
  zIndex?: number;
}

export interface ContextualFeatures {
  nearbyText: string[];
  tableContext?: {
    isInTable: boolean;
    rowIndex?: number;
    columnIndex?: number;
    headerText?: string;
  };
  listContext?: {
    isInList: boolean;
    listType?: 'ul' | 'ol' | 'dl';
    itemIndex?: number;
  };
  sectionContext?: {
    sectionHeading?: string;
    sectionDepth?: number;
  };
}

// ============================================================================
// Pattern Types
// ============================================================================

export interface Pattern {
  id: string;
  name: string;
  type: PatternType;
  features: PatternFeatures;
  selector: string;
  confidence: number;
  accuracy: number;
  usageCount: number;
  successRate: number;
  lastUsed: Date;
  created: Date;
  version: number;
  source: PatternSource;
  metadata: Record<string, unknown>;
}

export type PatternType = 
  | 'volume'
  | 'chapter'
  | 'title'
  | 'author'
  | 'coverImage'
  | 'description'
  | 'metadata'
  | 'table'
  | 'gallery'
  | 'infobox';

export type PatternSource = 
  | 'manual'
  | 'learned'
  | 'evolved'
  | 'imported'
  | 'synthesized';

export interface PatternMatch {
  pattern: Pattern;
  element: unknown; // Cheerio element
  features: PatternFeatures;
  confidence: number;
  extractedData: unknown;
}

// ============================================================================
// ML Model Types
// ============================================================================

export interface MLModel {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  accuracy: number;
  parameters: Record<string, unknown>;
  weights?: ArrayBuffer;
  metadata: ModelMetadata;
}

export type ModelType = 
  | 'classifier'
  | 'similarity'
  | 'anomaly'
  | 'ensemble';

export interface ModelMetadata {
  trainedOn: Date;
  trainingSamples: number;
  validationAccuracy: number;
  testAccuracy: number;
  features: string[];
  hyperparameters: Record<string, unknown>;
}

export interface Prediction {
  label: string;
  confidence: number;
  probabilities: Record<string, number>;
  features: PatternFeatures;
  modelId: string;
}

// ============================================================================
// Learning Types
// ============================================================================

export interface LearningExample {
  id: string;
  html: string;
  url?: string;
  features: PatternFeatures;
  label: string;
  correct: boolean;
  feedback?: UserFeedback;
  timestamp: Date;
}

export interface UserFeedback {
  correct: boolean;
  correctedLabel?: string;
  comments?: string;
  confidence: number;
}

export interface LearningMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  learningCurve: number[];
}

// ============================================================================
// Evolution Types
// ============================================================================

export interface PatternEvolution {
  id: string;
  originalPattern: Pattern;
  evolvedPattern: Pattern;
  reason: EvolutionReason;
  metrics: EvolutionMetrics;
  timestamp: Date;
}

export type EvolutionReason = 
  | 'performance'
  | 'accuracy'
  | 'merge'
  | 'split'
  | 'adaptation'
  | 'optimization';

export interface EvolutionMetrics {
  accuracyImprovement: number;
  performanceImprovement: number;
  coverageIncrease: number;
  complexityReduction: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
  key: string;
  value: unknown;
  features: PatternFeatures;
  pattern: Pattern;
  timestamp: Date;
  hits: number;
  ttl: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface EngineConfig {
  enableLearning: boolean;
  enableEvolution: boolean;
  enableCaching: boolean;
  mlConfig: MLConfig;
  featureConfig: FeatureConfig;
  performanceConfig: PerformanceConfig;
}

export interface MLConfig {
  minConfidence: number;
  maxInferenceTime: number;
  modelUpdateFrequency: number;
  activeLearningThreshold: number;
  ensembleSize: number;
}

export interface FeatureConfig {
  enableStructural: boolean;
  enableSemantic: boolean;
  enableStatistical: boolean;
  enableVisual: boolean;
  enableContextual: boolean;
  embeddingDimension: number;
}

export interface PerformanceConfig {
  maxMemoryMB: number;
  maxCacheSize: number;
  cacheTTL: number;
  parallelProcessing: boolean;
  batchSize: number;
}

// ============================================================================
// Event Types
// ============================================================================

export interface PatternEvent {
  type: EventType;
  pattern?: Pattern;
  data: unknown;
  timestamp: Date;
}

export type EventType = 
  | 'pattern:learned'
  | 'pattern:evolved'
  | 'pattern:matched'
  | 'pattern:failed'
  | 'model:updated'
  | 'cache:hit'
  | 'cache:miss';

// ============================================================================
// Database Schema Types
// ============================================================================

export interface PatternRecord {
  id: string;
  pattern: Pattern;
  features: PatternFeatures;
  performance: PatternPerformance;
  created_at: Date;
  updated_at: Date;
}

export interface PatternPerformance {
  totalUses: number;
  successCount: number;
  failureCount: number;
  averageConfidence: number;
  averageExtractionTime: number;
  lastSuccess?: Date;
  lastFailure?: Date;
}

export interface ModelRecord {
  id: string;
  model: MLModel;
  training_data: string; // Reference to training data
  performance: ModelPerformance;
  created_at: Date;
  updated_at: Date;
}

export interface ModelPerformance {
  predictions: number;
  correctPredictions: number;
  averageConfidence: number;
  averageInferenceTime: number;
}

// ============================================================================
// Additional Type Exports (for compatibility)
// ============================================================================

export type PatternPrediction = RecognitionResponse;

export interface PatternVariation {
  id: string;
  patternId: string;
  selector: string;
  confidence: number;
  usageCount: number;
}

export interface PatternSignature {
  hash: string;
  features: PatternFeatures;
  created: Date;
}

export type PatternCategory = PatternType;

// ============================================================================
// API Types
// ============================================================================

export interface RecognitionRequest {
  html: string;
  url?: string;
  targetType?: PatternType;
  options?: RecognitionOptions;
}

export interface RecognitionOptions {
  useCache?: boolean;
  learnFromResult?: boolean;
  confidenceThreshold?: number;
  maxResults?: number;
  timeout?: number;
}

export interface RecognitionResponse {
  success: boolean;
  matches: PatternMatch[];
  confidence: number;
  extractedData: unknown;
  performanceMetrics: {
    totalTime: number;
    featureExtractionTime: number;
    inferenceTime: number;
    cacheHit: boolean;
  };
}

// ============================================================================
// Monitoring Types
// ============================================================================

export interface SystemMetrics {
  patterns: {
    total: number;
    active: number;
    learned: number;
    evolved: number;
  };
  models: {
    total: number;
    accuracy: number;
    lastUpdated: Date;
  };
  performance: {
    averageInferenceTime: number;
    cacheHitRate: number;
    memoryUsage: number;
  };
  learning: {
    totalExamples: number;
    accuracy: number;
    lastLearned: Date;
  };
}