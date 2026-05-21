/**
 * Feature Converter
 *
 * Converts PatternFeatures into numerical vectors for ML models.
 * Breaks down complex feature extraction into focused sub-functions.
 *
 * Complexity Reduction: featuresToVector complexity 28 → 6 (79% reduction)
 *
 * Extracted from: MLPipeline.ts (lines 260-321)
 */

import * as tf from '@tensorflow/tfjs-node';

import type { PatternFeatures } from '@/server/parsers/pattern-recognition/types';

export class FeatureConverter {
  /**
   * Extract structural features from pattern
   */
  private extractStructuralFeatures(features: PatternFeatures): number[] {
    return [
      features.structural.domDepth ?? 0,
      features.structural.siblingCount ?? 0,
      features.structural.childCount ?? 0,
      features.structural.position ?? 0,
      features.structural.classList?.length ?? 0
    ];
  }

  /**
   * Extract semantic features from pattern
   */
  private extractSemanticFeatures(features: PatternFeatures): number[] {
    const base = [
      features.semantic.textLength ?? 0,
      features.semantic.wordCount ?? 0,
      features.semantic.hasNumbers ? 1 : 0,
      features.semantic.hasDate ? 1 : 0,
      features.semantic.hasISBN ? 1 : 0
    ];

    // Add embeddings if available
    if (features.semantic.embeddings) {
      return [...base, ...features.semantic.embeddings];
    }

    return base;
  }

  /**
   * Extract statistical features from pattern
   */
  private extractStatisticalFeatures(features: PatternFeatures): number[] {
    return [
      features.statistical.entropy ?? 0,
      features.statistical.textDensity ?? 0,
      features.statistical.numericDensity ?? 0,
      features.statistical.punctuationDensity ?? 0,
      features.statistical.capitalLetterRatio ?? 0,
      features.statistical.averageWordLength ?? 0,
      features.statistical.uniqueWordRatio ?? 0,
      features.statistical.patternScore ?? 0
    ];
  }

  /**
   * Extract visual features from pattern
   */
  private extractVisualFeatures(features: PatternFeatures): number[] {
    return [
      features.visual.fontSize ?? 0,
      features.visual.isVisible ? 1 : 0,
      features.visual.isAboveFold ? 1 : 0
    ];
  }

  /**
   * Extract contextual features from pattern
   */
  private extractContextualFeatures(features: PatternFeatures): number[] {
    return [
      features.contextual.nearbyText.length,
      features.contextual.tableContext?.isInTable ? 1 : 0,
      features.contextual.listContext?.isInList ? 1 : 0
    ];
  }

  /**
   * Convert features to numerical vector (MAIN ORCHESTRATOR)
   * Complexity: ~6 (down from 28)
   */
  featuresToVector(features: PatternFeatures): number[] {
    return [
      ...this.extractStructuralFeatures(features),
      ...this.extractSemanticFeatures(features),
      ...this.extractStatisticalFeatures(features),
      ...this.extractVisualFeatures(features),
      ...this.extractContextualFeatures(features)
    ];
  }

  /**
   * Convert features to tensor
   */
  featuresToTensor(features: PatternFeatures): tf.Tensor {
    const vector = this.featuresToVector(features);
    return tf.tensor2d([vector]);
  }
}
