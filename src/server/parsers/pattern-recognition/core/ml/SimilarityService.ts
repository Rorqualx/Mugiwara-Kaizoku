/**
 * Similarity Service
 *
 * Calculates pattern similarity using ML models or feature engineering.
 * Supports batch similarity searches with threshold filtering.
 *
 * Extracted from: MLPipeline.ts (lines 528-582)
 * Fixed: Replaced await-in-loop with Promise.all() for parallel calculations
 */

import * as tf from '@tensorflow/tfjs-node';

import type { PatternFeatures, Pattern, PatternMatch } from '@/server/parsers/pattern-recognition/types';

import { FeatureEngineering } from '../FeatureEngineering';

import { FeatureConverter } from './FeatureConverter';
import { FeatureScaler } from './FeatureScaler';

export class SimilarityService {
  private featureConverter: FeatureConverter;
  private featureScaler: FeatureScaler;
  private featureEngineering: FeatureEngineering;
  private similarityModel: tf.Sequential | null = null;

  constructor(
    featureConverter: FeatureConverter,
    featureScaler: FeatureScaler,
    featureEngineering: FeatureEngineering
  ) {
    this.featureConverter = featureConverter;
    this.featureScaler = featureScaler;
    this.featureEngineering = featureEngineering;
  }

  setSimilarityModel(model: tf.Sequential): void {
    this.similarityModel = model;
  }

  /**
   * Calculate similarity between two feature sets
   */
  async calculateSimilarity(
    features1: PatternFeatures,
    features2: PatternFeatures
  ): Promise<number> {
    if (!this.similarityModel) {
      // Fallback to feature engineering similarity
      return this.featureEngineering.calculateSimilarity(features1, features2);
    }

    // Prepare input
    const vector1 = this.scaleFeatures(this.featuresToVector(features1));
    const vector2 = this.scaleFeatures(this.featuresToVector(features2));
    const combined = [...vector1, ...vector2];
    const input = tf.tensor2d([combined]);

    // Get similarity score
    const prediction = (await this.similarityModel.predict(input)) as tf.Tensor;
    const score = (await prediction.array()) as number[][];

    // Cleanup
    input.dispose();
    prediction.dispose();

    const firstRow = score[0];
    if (!firstRow) return 0;
    const scoreValue = firstRow[0];
    return scoreValue ?? 0;
  }

  /**
   * Find similar patterns
   * FIX: Uses Promise.all() instead of sequential await in loop for parallel calculations
   */
  async findSimilarPatterns(
    features: PatternFeatures,
    patterns: Pattern[],
    threshold: number = 0.7
  ): Promise<PatternMatch[]> {
    // Calculate all similarities in parallel
    const similarities = await Promise.all(
      patterns.map(async (pattern) => ({
        pattern,
        similarity: await this.calculateSimilarity(features, pattern.features)
      }))
    );

    // Filter by threshold and build matches
    const matches: PatternMatch[] = similarities
      .filter(({ similarity }) => similarity >= threshold)
      .map(({ pattern, similarity }) => ({
        pattern,
        element: null,
        features,
        confidence: similarity,
        extractedData: {}
      }));

    // Sort by confidence (descending)
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
  }

  /**
   * Convert feature object to vector (helper method)
   */
  private featuresToVector(features: PatternFeatures): number[] {
    return this.featureConverter.featuresToVector(features);
  }

  /**
   * Scale feature vector (helper method)
   */
  private scaleFeatures(vector: number[]): number[] {
    return this.featureScaler.scaleFeatures(vector);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.similarityModel?.dispose();
  }
}
