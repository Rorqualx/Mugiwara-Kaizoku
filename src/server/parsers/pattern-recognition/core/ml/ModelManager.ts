/**
 * Model Manager
 *
 * Handles model persistence (save/load) and evaluation.
 * Manages model caching for performance optimization.
 *
 * Extracted from: MLPipeline.ts (lines 728-781)
 */

import * as tf from '@tensorflow/tfjs-node';


import type { PatternFeatures, PatternType } from '@/server/parsers/pattern-recognition/types';

import { FeatureConverter } from './FeatureConverter';
import { FeatureScaler } from './FeatureScaler';
import { LabelEncoder } from './ml-utils';


/**
 * Model Manager
 *
 * Manages model persistence, caching, and evaluation metrics.
 * Coordinates with feature conversion and scaling services.
 */
export class ModelManager {
  private labelEncoder: LabelEncoder;
  private featureConverter: FeatureConverter;
  private featureScaler: FeatureScaler;
  private modelCache: Map<string, tf.Sequential> = new Map();

  /**
   * Initialize model manager with dependencies
   */
  constructor(
    labelEncoder: LabelEncoder,
    featureConverter: FeatureConverter,
    featureScaler: FeatureScaler
  ) {
    this.labelEncoder = labelEncoder;
    this.featureConverter = featureConverter;
    this.featureScaler = featureScaler;
  }

  /**
   * Save model to disk
   *
   * Persists TensorFlow Sequential model to the file system.
   * Automatically prefixes path with file:// protocol.
   *
   * @param model - TensorFlow Sequential model to save
   * @param path - File system path (directory will be created if needed)
   * @throws Error if save operation fails
   *
   * @example
   * ```typescript
   * await modelManager.saveModel(model, '/path/to/model');
   * // Creates /path/to/model/model.json and weights
   * ```
   */
  async saveModel(model: tf.Sequential, path: string): Promise<void> {
    await model.save(`file://${path}`);
  }

  /**
   * Load model from disk
   *
   * Retrieves TensorFlow Sequential model from file system.
   * Caches loaded models for subsequent access.
   *
   * @param path - File system path to model directory
   * @returns Loaded TensorFlow Sequential model
   * @throws Error if model.json not found or load fails
   *
   * @example
   * ```typescript
   * const model = await modelManager.loadModel('/path/to/model');
   * // Automatically cached for future use
   * ```
   */
  async loadModel(path: string): Promise<tf.Sequential> {
    const model = await tf.loadLayersModel(`file://${path}/model.json`) as tf.Sequential;
    this.modelCache.set(path, model);
    return model;
  }

  /**
   * Get model performance metrics
   *
   * Evaluates model on test set and returns loss and accuracy metrics.
   * Properly manages tensor lifecycle to prevent memory leaks.
   *
   * @param model - Model to evaluate
   * @param features - Test feature set
   * @param labels - True labels for test set
   * @returns Object with loss and accuracy metrics (0-1 range)
   *
   * @example
   * ```typescript
   * const metrics = await modelManager.evaluateModel(model, testFeatures, testLabels);
   * console.log(`Accuracy: ${metrics.accuracy.toFixed(3)}`);
   * ```
   */
  async evaluateModel(
    model: tf.Sequential,
    features: PatternFeatures[],
    labels: PatternType[]
  ): Promise<{ accuracy: number; loss: number }> {
    // Convert features to vectors and apply scaling
    const vectors = features.map(f => this.featureScaler.scaleFeatures(
      this.featureConverter.featuresToVector(f)
    ));
    const xs = tf.tensor2d(vectors);

    // Encode labels and create one-hot encoding
    const labelIndices = labels.map(label => this.labelEncoder.encode(label));
    const ys = tf.oneHot(labelIndices, this.labelEncoder.size);

    // Evaluate model and get predictions
    const result = model.evaluate(xs, ys) as tf.Scalar[];

    // Type guard: check that result contains at least 2 scalars (loss and accuracy)
    const lossScalar = result[0];
    const accuracyScalar = result[1];

    // Handle missing evaluation results
    if (!lossScalar || !accuracyScalar) {
      xs.dispose();
      ys.dispose();
      for (const t of result) {
        t.dispose();
      }
      return { loss: 0, accuracy: 0 };
    }

    // Extract numeric values from scalar tensors
    const lossData = await lossScalar.data();
    const accuracyData = await accuracyScalar.data();

    // Cleanup tensor memory
    xs.dispose();
    ys.dispose();
    result.forEach(t => t.dispose());

    // Extract first element from data arrays with fallback to 0
    const lossValue = lossData[0] ?? 0;
    const accuracyValue = accuracyData[0] ?? 0;

    return {
      loss: lossValue,
      accuracy: accuracyValue
    };
  }

  /**
   * Clear model cache
   *
   * Releases memory used by cached models.
   * Disposes all TensorFlow tensors associated with cached models.
   */
  clearCache(): void {
    this.modelCache.forEach(m => m.dispose());
    this.modelCache.clear();
  }

  /**
   * Cleanup resources
   *
   * Performs cleanup operations including cache clearing.
   * Should be called when ModelManager is no longer needed.
   */
  dispose(): void {
    this.clearCache();
  }
}
