/**
 * Feature Engineering Types Module
 *
 * Shared type definitions, interfaces, and configuration for the
 * feature engineering system. All feature extraction modules depend
 * on this foundation module.
 *
 * Extracted from: FeatureEngineering.ts (lines 1-39)
 */

import type { AnyNode } from 'domhandler';

// ============================================================================
// Re-exported Types from Pattern Recognition System
// ============================================================================

export type {
  PatternFeatures,
  StructuralFeatures,
  SemanticFeatures,
  StatisticalFeatures,
  VisualFeatures,
  ContextualFeatures,
  FeatureConfig as BaseFeatureConfig
} from '@/server/parsers/pattern-recognition/types';

// ============================================================================
// DOM Element Types
// ============================================================================

/** DOM element type alias for cheerio nodes */
export type Element = AnyNode;

/** Cheerio API type for DOM manipulation */
export type { CheerioAPI } from 'cheerio';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Feature extraction configuration
 *
 * Controls which feature types are extracted and their parameters.
 * All feature types are enabled by default for comprehensive analysis.
 */
export interface FeatureConfig {
  /** Enable structural feature extraction (DOM structure, tags, attributes) */
  enableStructural: boolean;

  /** Enable semantic feature extraction (text content, entities, meaning) */
  enableSemantic: boolean;

  /** Enable statistical feature extraction (densities, ratios, entropy) */
  enableStatistical: boolean;

  /** Enable visual feature extraction (fonts, colors, layout) */
  enableVisual: boolean;

  /** Enable contextual feature extraction (nearby elements, sections, tables) */
  enableContextual: boolean;

  /** Dimension for text embeddings (default: 128) */
  embeddingDimension: number;
}

/**
 * Default feature extraction configuration
 *
 * Enables all feature types with standard embedding dimensions.
 * Used when no custom configuration is provided.
 */
export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  enableStructural: true,
  enableSemantic: true,
  enableStatistical: true,
  enableVisual: true,
  enableContextual: true,
  embeddingDimension: 128
};
