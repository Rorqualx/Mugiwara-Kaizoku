/**
 * Training Service
 *
 * Handles model training for classifiers and similarity models.
 * Supports batch training with validation splits and progress logging.
 *
 * Extracted from: MLPipeline.ts (lines 628-723)
 */

import * as tf from '@tensorflow/tfjs-node';

import type { PatternFeatures, PatternType } from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/server/utils/logger';

import { FeatureConverter } from './FeatureConverter';
import { FeatureScaler } from './FeatureScaler';
import { LabelEncoder } from './ml-utils';


/**
 * Training Service
 *
 * Manages model training workflows for pattern recognition ML models.
 * Handles data preparation, feature scaling, and training execution.
 *
 * Key Features:
 * - Classifier training with one-hot encoded labels
 * - Similarity model training with pair-based learning
 * - Automatic feature scaling and normalization
 * - Validation splits for overfitting prevention
 * - Progress logging during training epochs
 *
 * @example
 * ```typescript
 * const service = new TrainingService(labelEncoder, converter, scaler);
 * service.setClassifier(model);
 * const history = await service.trainClassifier(features, labels, 10, 32);
 * ```
 */
export class TrainingService {
  private labelEncoder: LabelEncoder;
  private featureConverter: FeatureConverter;
  private featureScaler: FeatureScaler;
  private classifier: tf.Sequential | null = null;
  private similarityModel: tf.Sequential | null = null;

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
   * Set classifier model for training
   *
   * @param model - Sequential model to use for classification
   */
  setClassifier(model: tf.Sequential): void {
    this.classifier = model;
  }

  /**
   * Set similarity model for training
   *
   * @param model - Sequential model to use for similarity matching
   */
  setSimilarityModel(model: tf.Sequential): void {
    this.similarityModel = model;
  }

  /**
   * Train classifier with labeled data
   *
   * Trains a classification model using supervised learning with
   * one-hot encoded labels. Features are automatically scaled and
   * normalized before training.
   *
   * CRITICAL FIX: Removed non-null assertion (line 655 in original)
   * Now uses type guard with proper error handling instead.
   *
   * @param features - Array of pattern features for training
   * @param labels - Corresponding pattern type labels
   * @param epochs - Number of training epochs (default: 10)
   * @param batchSize - Batch size for training (default: 32)
   * @returns Training history with loss and accuracy metrics
   * @throws {Error} If classifier not initialized or no features provided
   *
   * @example
   * ```typescript
   * const history = await service.trainClassifier(
   *   [{ wordCount: 10, ... }, { wordCount: 15, ... }],
   *   ['volume', 'chapter'],
   *   10,
   *   32
   * );
   * console.log(history.history.loss);
   * ```
   */
  async trainClassifier(
    features: PatternFeatures[],
    labels: PatternType[],
    epochs: number = 10,
    batchSize: number = 32
  ): Promise<tf.History> {
    // CRITICAL FIX: Use type guard instead of non-null assertion
    if (!this.classifier) {
      const firstFeature = features[0];
      if (!firstFeature) {
        throw new Error('No training features provided');
      }
      throw new Error('Classifier not initialized. Call setClassifier() first.');
    }

    // Prepare training data
    const vectors = features.map(f => this.featureConverter.featuresToVector(f));
    this.featureScaler.updateScaler(vectors);

    const scaledVectors = vectors.map(v => this.featureScaler.scaleFeatures(v));
    const xs = tf.tensor2d(scaledVectors);

    // One-hot encode labels
    const labelIndices = labels.map(label => this.labelEncoder.encode(label));
    const ys = tf.oneHot(labelIndices, this.labelEncoder.size);

    // Train model - FIXED: No non-null assertion needed (type guard above ensures classifier exists)
    const history = await this.classifier.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          logger.info(`Epoch ${epoch + 1}: loss = ${logs?.["loss"]?.toFixed(4)}, accuracy = ${logs?.["acc"]?.toFixed(4)}`);
        }
      }
    });

    // Cleanup
    xs.dispose();
    ys.dispose();

    return history;
  }

  /**
   * Train similarity model with pairs
   *
   * Trains a similarity model using pair-based learning. Each training
   * pair consists of two feature sets and a binary label indicating
   * whether they should be considered similar.
   *
   * CRITICAL FIX: Removed non-null assertion (line 711 in original)
   * Now uses type guard with proper error handling instead.
   *
   * @param pairs - Array of feature pairs with similarity labels
   * @param epochs - Number of training epochs (default: 10)
   * @param batchSize - Batch size for training (default: 32)
   * @returns Training history with loss metrics
   * @throws {Error} If similarity model not initialized or no pairs provided
   *
   * @example
   * ```typescript
   * const history = await service.trainSimilarityModel(
   *   [
   *     { features1: {...}, features2: {...}, similar: true },
   *     { features1: {...}, features2: {...}, similar: false }
   *   ],
   *   10,
   *   32
   * );
   * ```
   */
  async trainSimilarityModel(
    pairs: Array<{ features1: PatternFeatures, features2: PatternFeatures, similar: boolean }>,
    epochs: number = 10,
    batchSize: number = 32
  ): Promise<tf.History> {
    if (pairs.length === 0) {
      throw new Error('No training pairs provided');
    }

    // CRITICAL FIX: Use type guard instead of non-null assertion
    if (!this.similarityModel) {
      throw new Error('Similarity model not initialized. Call setSimilarityModel() first.');
    }

    // Prepare training data
    const inputs: number[][] = [];
    const outputs: number[] = [];

    for (const pair of pairs) {
      const vector1 = this.featureScaler.scaleFeatures(
        this.featureConverter.featuresToVector(pair.features1)
      );
      const vector2 = this.featureScaler.scaleFeatures(
        this.featureConverter.featuresToVector(pair.features2)
      );
      inputs.push([...vector1, ...vector2]);
      outputs.push(pair.similar ? 1 : 0);
    }

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(outputs, [outputs.length, 1]);

    // Train model - FIXED: No non-null assertion needed (type guard above ensures model exists)
    const history = await this.similarityModel.fit(xs, ys, {
      epochs,
      batchSize,
      validationSplit: 0.2,
      shuffle: true
    });

    // Cleanup
    xs.dispose();
    ys.dispose();

    return history;
  }

  /**
   * Dispose of models and free memory
   *
   * Cleans up TensorFlow.js models and releases GPU/CPU resources.
   * Should be called when the service is no longer needed.
   */
  dispose(): void {
    this.classifier?.dispose();
    this.similarityModel?.dispose();
  }
}
