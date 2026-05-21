/**
 * Feature Engineering System
 *
 * Main orchestrator for extracting and engineering features from HTML elements.
 * Delegates to specialized modules for different feature types.
 *
 * Architecture:
 * - feature-engineering/types.ts - Shared types and configuration (81 lines)
 * - feature-engineering/dom-helpers.ts - DOM traversal utilities (139 lines, 4 functions)
 * - feature-engineering/text-helpers.ts - Text analysis (150 lines, 5 functions)
 * - feature-engineering/calculation-helpers.ts - Statistical calculations (185 lines, 8 functions)
 * - feature-engineering/similarity-helpers.ts - Similarity metrics (331 lines, 7 functions)
 * - feature-engineering/structural-features.ts - Structural extraction (70 lines, 1 function)
 * - feature-engineering/semantic-features.ts - Semantic extraction (136 lines, 4 functions)
 * - feature-engineering/statistical-features.ts - Statistical extraction (67 lines, 1 function)
 * - feature-engineering/visual-features.ts - Visual extraction (152 lines, 8 functions)
 * - feature-engineering/contextual-features.ts - Contextual extraction (196 lines, 5 functions)
 *
 * Total: 10 modules, ~1,587 lines (down from 641 monolithic lines)
 *
 * Refactored: 2025-11-21
 * Original: FeatureEngineering.ts.backup
 */

import { extractContextualFeatures } from './feature-engineering/contextual-features';
import { extractSemanticFeatures, hasDate } from './feature-engineering/semantic-features';
import { calculateSimilarity } from './feature-engineering/similarity-helpers';
import { extractStatisticalFeatures } from './feature-engineering/statistical-features';
import { extractStructuralFeatures } from './feature-engineering/structural-features';
import { DEFAULT_FEATURE_CONFIG } from './feature-engineering/types';
import { extractVisualFeatures } from './feature-engineering/visual-features';

import type {
  FeatureConfig,
  PatternFeatures,
  StructuralFeatures,
  SemanticFeatures,
  StatisticalFeatures,
  VisualFeatures,
  ContextualFeatures
} from './feature-engineering/types';
import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';



type Element = AnyNode;

/**
 * Feature Engineering System
 *
 * Extracts comprehensive features from HTML elements for pattern recognition.
 * Combines structural, semantic, statistical, visual, and contextual features.
 *
 * @example
 * ```typescript
 * const featureEng = new FeatureEngineering({
 *   enableStructural: true,
 *   enableSemantic: true,
 *   embeddingDimension: 128
 * });
 *
 * const features = featureEng.extractFeatures(element, $);
 * const similarity = featureEng.calculateSimilarity(features1, features2);
 * ```
 */
export class FeatureEngineering {
  private config: FeatureConfig;
  private embeddings: Map<string, number[]> = new Map();

  constructor(config: Partial<FeatureConfig> = {}) {
    this.config = {
      ...DEFAULT_FEATURE_CONFIG,
      ...config
    };
  }

  /**
   * Extract all enabled features from an element
   *
   * Delegates to specialized extractors based on configuration:
   * - Structural: DOM structure, paths, selectors
   * - Semantic: Content type, entities, embeddings
   * - Statistical: Text metrics, entropy, density
   * - Visual: Layout, styling, visibility
   * - Contextual: Parent/sibling relationships, position
   *
   * @param element - The HTML element to analyze
   * @param $ - Cheerio instance for DOM traversal
   * @returns Comprehensive feature vector
   */
  extractFeatures(element: Element, $: CheerioAPI): PatternFeatures {
    const features: PatternFeatures = {
      structural: this.config.enableStructural
        ? extractStructuralFeatures(element, $)
        : {} as StructuralFeatures,

      semantic: this.config.enableSemantic
        ? extractSemanticFeatures(
            element,
            $,
            this.config.embeddingDimension,
            this.embeddings
          )
        : {} as SemanticFeatures,

      statistical: this.config.enableStatistical
        ? extractStatisticalFeatures(element, $, hasDate)
        : {} as StatisticalFeatures,

      visual: this.config.enableVisual
        ? extractVisualFeatures(element, $)
        : {} as VisualFeatures,

      contextual: this.config.enableContextual
        ? extractContextualFeatures(element, $)
        : {} as ContextualFeatures
    };

    return features;
  }

  /**
   * Calculate similarity between two feature vectors
   *
   * Uses weighted cosine similarity across all feature dimensions.
   * Weights are configured via FeatureConfig.
   *
   * @param features1 - First feature vector
   * @param features2 - Second feature vector
   * @returns Similarity score (0-1, where 1 is identical)
   */
  calculateSimilarity(features1: PatternFeatures, features2: PatternFeatures): number {
    return calculateSimilarity(features1, features2, this.config);
  }
}
