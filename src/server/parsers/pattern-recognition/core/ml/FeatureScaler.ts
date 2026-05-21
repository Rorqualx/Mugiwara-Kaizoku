/**
 * Feature Scaler
 *
 * Standardizes feature vectors using z-score normalization.
 * Maintains running statistics for online learning.
 *
 * Extracted from: MLPipeline.ts (lines 326-386)
 */

import type { FeatureScaler as FeatureScalerData } from './ml-utils';

export class FeatureScaler {
  private scaler: FeatureScalerData | null = null;

  /**
   * Scale features using z-score standardization
   *
   * Applies z-score normalization: (value - mean) / std
   * On first call, initializes scaler with the provided vector.
   *
   * @param vector - Raw feature vector to scale
   * @returns Standardized feature vector
   */
  scaleFeatures(vector: number[]): number[] {
    if (!this.scaler) {
      // Initialize scaler with first sample
      this.scaler = {
        mean: vector.slice(),
        std: vector.map(() => 1)
      };
      return vector;
    }

    // Apply standardization (z-score)
    return vector.map((val, i) => {
      // Use optional chaining to safely access scaler properties
      const mean = this.scaler?.mean[i];
      const std = this.scaler?.std[i];

      if (mean === undefined || std === undefined) return 0;
      return std > 0 ? (val - mean) / std : 0;
    });
  }

  /**
   * Update feature scaler with batch of training data
   *
   * Calculates mean and standard deviation for each feature dimension
   * using the provided batch of vectors. Supports online learning scenarios.
   *
   * @param vectors - Array of feature vectors to compute statistics from
   */
  updateScaler(vectors: number[][]): void {
    if (vectors.length === 0) return;

    const firstVector = vectors[0];
    if (!firstVector) return;

    const dim = firstVector.length;
    const mean = new Array(dim).fill(0);
    const std = new Array(dim).fill(0);

    // Calculate mean
    for (const vector of vectors) {
      for (let i = 0; i < dim; i++) {
        const val = vector[i];
        if (val !== undefined) {
          mean[i] += val;
        }
      }
    }
    for (let i = 0; i < dim; i++) {
      mean[i] /= vectors.length;
    }

    // Calculate standard deviation
    for (const vector of vectors) {
      for (let i = 0; i < dim; i++) {
        const val = vector[i];
        if (val !== undefined) {
          const diff = val - mean[i];
          std[i] += diff * diff;
        }
      }
    }
    for (let i = 0; i < dim; i++) {
      std[i] = Math.sqrt(std[i] / vectors.length);
    }

    this.scaler = { mean: mean as number[], std: std as number[] };
  }
}
