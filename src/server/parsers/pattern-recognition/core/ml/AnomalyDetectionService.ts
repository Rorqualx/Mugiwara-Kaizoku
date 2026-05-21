/**
 * Anomaly Detection Service
 *
 * Detects anomalies in patterns using autoencoder reconstruction error.
 * Higher scores indicate more anomalous patterns.
 *
 * Extracted from: MLPipeline.ts (lines 587-623)
 */

import * as tf from '@tensorflow/tfjs-node';

import type { PatternFeatures } from '@/server/parsers/pattern-recognition/types';

import { FeatureConverter } from './FeatureConverter';
import { FeatureScaler } from './FeatureScaler';

export class AnomalyDetectionService {
  private featureConverter: FeatureConverter;
  private featureScaler: FeatureScaler;
  private anomalyDetector: tf.Sequential | null = null;

  constructor(
    featureConverter: FeatureConverter,
    featureScaler: FeatureScaler
  ) {
    this.featureConverter = featureConverter;
    this.featureScaler = featureScaler;
  }

  /**
   * Set the anomaly detector model
   */
  setAnomalyDetector(model: tf.Sequential): void {
    this.anomalyDetector = model;
  }

  /**
   * Detect anomalies in patterns
   *
   * Uses reconstruction error from autoencoder to detect anomalies.
   * Higher error indicates more anomalous patterns.
   *
   * @param features - Pattern features to analyze
   * @returns Anomaly score (0 = normal, 1 = anomaly)
   */
  async detectAnomaly(features: PatternFeatures): Promise<number> {
    if (!this.anomalyDetector) {
      return 0; // No anomaly detection available
    }

    const vector = this.scaleFeatures(this.featuresToVector(features));
    const input = tf.tensor2d([vector]);

    // Get reconstruction
    const reconstruction = (await this.anomalyDetector.predict(input)) as tf.Tensor;
    const reconstructed = (await reconstruction.array()) as number[][];

    // Calculate reconstruction error
    let error = 0;
    const firstReconstructed = reconstructed[0];
    if (!firstReconstructed) {
      input.dispose();
      reconstruction.dispose();
      return 0;
    }

    for (let i = 0; i < vector.length; i++) {
      const vecVal = vector[i];
      const recVal = firstReconstructed[i];
      if (vecVal !== undefined && recVal !== undefined) {
        const diff = vecVal - recVal;
        error += diff * diff;
      }
    }
    error = Math.sqrt(error / vector.length);

    // Cleanup
    input.dispose();
    reconstruction.dispose();

    // Convert to anomaly score (0 = normal, 1 = anomaly)
    return Math.min(error / 10, 1);
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
    this.anomalyDetector?.dispose();
  }
}
