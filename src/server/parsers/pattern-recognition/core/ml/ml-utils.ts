/**
 * ML Pipeline Utilities
 *
 * Shared utilities, types, and configuration for the ML pipeline.
 * Provides label encoding/decoding and feature scaling infrastructure.
 *
 * Extracted from: MLPipeline.ts (lines 24-63)
 */

import type { PatternType } from '@/server/parsers/pattern-recognition/types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * ML Configuration
 *
 * Configuration options for ML pipeline behavior including
 * inference limits, model updates, and ensemble settings.
 */
export interface MLConfig {
  /** Minimum confidence threshold for accepting predictions */
  minConfidence: number;
  /** Maximum inference time in milliseconds */
  maxInferenceTime: number;
  /** Number of predictions before triggering model update */
  modelUpdateFrequency: number;
  /** Confidence threshold for active learning (requesting labels) */
  activeLearningThreshold: number;
  /** Number of models in ensemble */
  ensembleSize: number;
}

/**
 * Feature Scaler
 *
 * Stores mean and standard deviation for feature normalization.
 * Used to standardize input features before model inference.
 */
export interface FeatureScaler {
  /** Mean value for each feature dimension */
  mean: number[];
  /** Standard deviation for each feature dimension */
  std: number[];
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default ML Configuration
 *
 * Production-ready defaults for ML pipeline.
 * - 70% minimum confidence for accepting predictions
 * - 50ms max inference time for real-time performance
 * - Model updates every 100 predictions
 * - Active learning for 50-70% confidence range
 * - 3-model ensemble for robust predictions
 */
export const DEFAULT_ML_CONFIG: MLConfig = {
  minConfidence: 0.7,
  maxInferenceTime: 50,
  modelUpdateFrequency: 100,
  activeLearningThreshold: 0.5,
  ensembleSize: 3
};

// ============================================================================
// Label Encoding
// ============================================================================

/**
 * Label Encoder
 *
 * Bidirectional encoder/decoder for pattern types.
 * Maps string labels to integer indices for neural network output layers.
 *
 * @example
 * ```typescript
 * const encoder = new LabelEncoder();
 * const index = encoder.encode('volume');  // 0
 * const label = encoder.decode(0);         // 'volume'
 * console.log(encoder.size);               // 10
 * ```
 */
export class LabelEncoder {
  private encoder: Map<string, number> = new Map();
  private decoder: Map<number, string> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize label encoding mappings
   *
   * Creates bidirectional mappings for all pattern types.
   * Order matches neural network output layer structure.
   */
  private initialize(): void {
    const types: PatternType[] = [
      'volume', 'chapter', 'title', 'author', 'coverImage',
      'description', 'metadata', 'table', 'gallery', 'infobox'
    ];

    types.forEach((type, index) => {
      this.encoder.set(type, index);
      this.decoder.set(index, type);
    });
  }

  /**
   * Encode pattern type to integer index
   *
   * @param type - Pattern type to encode
   * @returns Integer index (0-9) or 0 if type unknown
   */
  encode(type: PatternType): number {
    return this.encoder.get(type) ?? 0;
  }

  /**
   * Decode integer index to pattern type
   *
   * @param index - Integer index to decode
   * @returns Pattern type or 'metadata' if index unknown
   */
  decode(index: number): PatternType {
    const decoded = this.decoder.get(index);
    return (decoded as PatternType | undefined) ?? 'metadata';
  }

  /**
   * Get total number of labels
   *
   * @returns Number of distinct pattern types (10)
   */
  get size(): number {
    return this.encoder.size;
  }
}
