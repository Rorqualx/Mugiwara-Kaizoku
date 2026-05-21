/**
 * Type definitions for the Dynamic Confidence System
 *
 * Provides types for multi-factor confidence calculation that
 * replaces hardcoded provider confidence values.
 *
 * @module lib/confidence/types
 */

// ============================================================================
// Quality Signal Types
// ============================================================================

/**
 * Individual quality signals used in confidence calculation
 * Each signal is scored 0-100
 */
export interface QualitySignals {
  /** Is the field present and filled? */
  fieldCompleteness: number;
  /** Description length, structure, validation */
  contentQuality: number;
  /** Provider's known reliability (from FIELD_QUALITY_MATRIX) */
  providerBase: number;
  /** Does value match other providers? */
  dataConsistency: number;
  /** Arrays with objects vs flat strings */
  richDataScore: number;
}

/**
 * Context needed for confidence calculation
 */
export interface FieldConfidenceContext {
  /** Field name being evaluated */
  field: string;
  /** Current field value */
  value: unknown;
  /** Provider source of the value */
  provider: string;
  /** Optional data from all providers for cross-validation */
  allProviderData?: Record<string, Record<string, unknown>>;
}

/**
 * Result of dynamic confidence calculation
 */
export interface DynamicConfidenceResult {
  /** Final confidence score (0-100) */
  confidence: number;
  /** Breakdown of individual quality signals */
  signals: QualitySignals;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Weights for each quality signal in the final calculation
 */
export interface ConfidenceWeights {
  fieldCompleteness: number;
  contentQuality: number;
  providerBase: number;
  dataConsistency: number;
  richDataScore: number;
}

/**
 * Configuration for the confidence service
 */
export interface ConfidenceServiceConfig {
  /** Time-to-live for cached results in milliseconds */
  cacheTTL: number;
  /** Maximum number of cached entries */
  maxCacheSize: number;
  /** Weights for each quality signal */
  weights: ConfidenceWeights;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default weights as specified in the plan
 * Formula: 0.25 * fieldCompleteness + 0.25 * contentQuality + 0.20 * providerBase +
 *          0.15 * dataConsistency + 0.15 * richDataScore
 */
export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  fieldCompleteness: 0.25,
  contentQuality: 0.25,
  providerBase: 0.20,
  dataConsistency: 0.15,
  richDataScore: 0.15,
};

/**
 * Default service configuration
 */
export const DEFAULT_SERVICE_CONFIG: ConfidenceServiceConfig = {
  cacheTTL: 5000, // 5 seconds
  maxCacheSize: 1000,
  weights: DEFAULT_CONFIDENCE_WEIGHTS,
};

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cached entry with timestamp for TTL management
 */
export interface CachedConfidenceEntry {
  result: DynamicConfidenceResult;
  timestamp: number;
}

/**
 * Provider quality baseline from FIELD_QUALITY_MATRIX
 */
export interface ProviderQualityBaseline {
  quality: number;
  confidence: number;
}
