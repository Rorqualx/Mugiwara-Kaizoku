/**
 * Data Preparation Module
 *
 * Utilities for preparing training data, converting features to vectors,
 * and generating training pairs for ML models.
 *
 * Extracted from: ModelTrainer.ts (lines 338-471)
 */

import type {
  LearningExample,
  PatternType,
  PatternFeatures,
  StructuralFeatures,
  SemanticFeatures,
  StatisticalFeatures
} from '@/server/parsers/pattern-recognition/types';

/**
 * Prepared data for classifier training
 */
interface PreparedClassifierData {
  features: number[][];
  labels: number[];
}

/**
 * Training pair for similarity learning
 */
interface SimilarityPair {
  features1: PatternFeatures;
  features2: PatternFeatures;
  similar: boolean;
}

/**
 * Data preparation utilities for model training
 */
export class DataPreparation {
  /**
   * Prepare classifier training data
   *
   * Converts learning examples to feature vectors and numeric labels.
   * Creates a label mapping from pattern types to numeric indices.
   *
   * @param examples - Array of learning examples with features and labels
   * @returns Object containing feature vectors and corresponding numeric labels
   */
  public prepareClassifierData(examples: LearningExample[]): PreparedClassifierData {
    const features: number[][] = [];
    const labels: number[] = [];

    const labelMap = new Map<string, number>();
    const patternTypes: PatternType[] = [
      'volume', 'chapter', 'title', 'author', 'coverImage',
      'description', 'metadata', 'table', 'gallery', 'infobox'
    ];

    patternTypes.forEach((type, index) => {
      labelMap.set(type, index);
    });

    for (const example of examples) {
      features.push(this.featuresToVector(example.features));
      labels.push(labelMap.get(example.label) ?? 0);
    }

    return { features, labels };
  }

  /**
   * Convert pattern features to vector
   *
   * Transforms multi-dimensional pattern features into a fixed-size numeric vector.
   * Uses helper methods to extract structural, semantic, and statistical features.
   * Pads or truncates the result to a fixed size of 50 elements.
   *
   * @param features - Pattern features to convert
   * @returns Fixed-size numeric vector (length 50)
   */
  public featuresToVector(features: PatternFeatures): number[] {
    const vector: number[] = [
      ...this.extractStructuralFeatures(features.structural),
      ...this.extractSemanticFeatures(features.semantic),
      ...this.extractStatisticalFeatures(features.statistical)
    ];

    // Pad to fixed size
    while (vector.length < 50) {
      vector.push(0);
    }

    return vector.slice(0, 50);
  }

  /**
   * Extract structural features from pattern
   *
   * Converts structural features (DOM hierarchy, position, classes) to numeric vector.
   *
   * @param structural - Structural features to extract
   * @returns Numeric vector with 5 structural feature values
   */
  private extractStructuralFeatures(structural: StructuralFeatures): number[] {
    return [
      structural.domDepth ?? 0,
      structural.siblingCount ?? 0,
      structural.childCount ?? 0,
      structural.position ?? 0,
      structural.classList?.length ?? 0
    ];
  }

  /**
   * Extract semantic features from pattern
   *
   * Converts semantic features (text properties, content indicators) to numeric vector.
   *
   * @param semantic - Semantic features to extract
   * @returns Numeric vector with 5 semantic feature values
   */
  private extractSemanticFeatures(semantic: SemanticFeatures): number[] {
    return [
      semantic.textLength ?? 0,
      semantic.wordCount ?? 0,
      semantic.hasNumbers ? 1 : 0,
      semantic.hasDate ? 1 : 0,
      semantic.hasISBN ? 1 : 0
    ];
  }

  /**
   * Extract statistical features from pattern
   *
   * Converts statistical features (entropy, density, ratios) to numeric vector.
   *
   * @param statistical - Statistical features to extract
   * @returns Numeric vector with 8 statistical feature values
   */
  private extractStatisticalFeatures(statistical: StatisticalFeatures): number[] {
    return [
      statistical.entropy ?? 0,
      statistical.textDensity ?? 0,
      statistical.numericDensity ?? 0,
      statistical.punctuationDensity ?? 0,
      statistical.capitalLetterRatio ?? 0,
      statistical.averageWordLength ?? 0,
      statistical.uniqueWordRatio ?? 0,
      statistical.patternScore ?? 0
    ];
  }

  /**
   * Generate similarity training pairs
   *
   * Creates positive pairs (same label) and negative pairs (different labels)
   * for training similarity-based models. Limits the number of pairs to prevent
   * combinatorial explosion.
   *
   * @param examples - Array of learning examples
   * @returns Array of feature pairs with similarity labels
   */
  public generateSimilarityPairs(examples: LearningExample[]): SimilarityPair[] {
    const pairs: SimilarityPair[] = [];

    // Group by label
    const byLabel = new Map<string, LearningExample[]>();
    for (const example of examples) {
      if (!byLabel.has(example.label)) {
        byLabel.set(example.label, []);
      }
      const labelExamples = byLabel.get(example.label);
      if (labelExamples) {
        labelExamples.push(example);
      }
    }

    // Generate positive pairs (same label)
    for (const labelExamples of byLabel.values()) {
      for (let i = 0; i < Math.min(10, labelExamples.length - 1); i++) {
        for (let j = i + 1; j < Math.min(i + 3, labelExamples.length); j++) {
          const ex1 = labelExamples[i];
          const ex2 = labelExamples[j];
          if (!ex1 || !ex2) continue;
          pairs.push({
            features1: ex1.features,
            features2: ex2.features,
            similar: true
          });
        }
      }
    }

    // Generate negative pairs (different labels)
    const labels = Array.from(byLabel.keys());
    for (let i = 0; i < labels.length - 1; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const label1 = labels[i];
        const label2 = labels[j];
        if (!label1 || !label2) continue;
        const examples1 = byLabel.get(label1);
        const examples2 = byLabel.get(label2);
        if (!examples1 || !examples2) continue;

        for (let k = 0; k < Math.min(3, examples1.length, examples2.length); k++) {
          const ex1 = examples1[k];
          const ex2 = examples2[k];
          if (!ex1 || !ex2) continue;
          pairs.push({
            features1: ex1.features,
            features2: ex2.features,
            similar: false
          });
        }
      }
    }

    return pairs;
  }
}
