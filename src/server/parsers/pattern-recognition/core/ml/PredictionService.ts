/**
 * Prediction Service
 *
 * Handles pattern classification using trained ML models.
 * Supports both single-model and ensemble predictions.
 *
 * Key Features:
 * - Single-model classification with confidence scoring
 * - Ensemble predictions using multiple models for higher accuracy
 * - Inference time monitoring and warnings
 * - Proper resource cleanup with tensor disposal
 *
 * Extracted from: MLPipeline.ts (lines 391-523)
 * Critical Fixes:
 * - Fixed await-in-loop in classifyEnsemble() using Promise.all()
 * - Added explicit return types: Promise<Prediction>
 * - Added type guards instead of non-null assertions
 */

import * as tf from '@tensorflow/tfjs-node';

import type { PatternFeatures, Prediction } from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/server/utils/logger';

import { FeatureConverter } from './FeatureConverter';
import { FeatureScaler } from './FeatureScaler';
import { LabelEncoder } from './ml-utils';

import type { MLConfig } from './ml-utils';

export class PredictionService {
  private config: MLConfig;
  private labelEncoder: LabelEncoder;
  private featureConverter: FeatureConverter;
  private featureScaler: FeatureScaler;
  private classifier: tf.Sequential | null = null;
  private ensembleModels: tf.Sequential[] = [];

  constructor(
    config: MLConfig,
    labelEncoder: LabelEncoder,
    featureConverter: FeatureConverter,
    featureScaler: FeatureScaler
  ) {
    this.config = config;
    this.labelEncoder = labelEncoder;
    this.featureConverter = featureConverter;
    this.featureScaler = featureScaler;
  }

  /**
   * Set the classifier model
   *
   * @param model - Trained sequential model for classification
   */
  setClassifier(model: tf.Sequential): void {
    this.classifier = model;
  }

  /**
   * Set the ensemble models
   *
   * @param models - Array of trained models for ensemble prediction
   */
  setEnsembleModels(models: tf.Sequential[]): void {
    this.ensembleModels = models;
  }

  /**
   * Classify a pattern based on features
   *
   * Uses the trained classifier model to predict pattern type
   * with confidence scores and probability distribution.
   *
   * @param features - Pattern features to classify
   * @returns Prediction with label, confidence, and probabilities
   * @throws Error if classifier not initialized or prediction fails
   */
  async classify(features: PatternFeatures): Promise<Prediction> {
    if (!this.classifier) {
      throw new Error('Classifier not initialized. Call buildClassifier first.');
    }

    const startTime = Date.now();

    // Prepare input
    const vector = this.featureConverter.featuresToVector(features);
    const scaledVector = this.featureScaler.scaleFeatures(vector);
    const input = tf.tensor2d([scaledVector]);

    // Get prediction
    const prediction = await this.classifier.predict(input) as tf.Tensor;
    const probabilities = await prediction.array() as number[][];

    // Find best class
    const probs = probabilities[0];
    if (!probs) {
      throw new Error('Invalid prediction output');
    }
    let maxProb = 0;
    let maxIndex = 0;

    for (let i = 0; i < probs.length; i++) {
      const prob = probs[i];
      if (prob !== undefined && prob > maxProb) {
        maxProb = prob;
        maxIndex = i;
      }
    }

    const label = this.labelEncoder.decode(maxIndex);

    // Build probability map
    const probabilityMap: Record<string, number> = {};
    for (let i = 0; i < probs.length; i++) {
      const type = this.labelEncoder.decode(i);
      const prob = probs[i];
      if (prob !== undefined) {
        probabilityMap[type] = prob;
      }
    }

    // Check inference time
    const inferenceTime = Date.now() - startTime;
    if (inferenceTime > this.config.maxInferenceTime) {
      logger.warn('Inference time exceeded', {
        inferenceTime,
        maxInferenceTime: this.config.maxInferenceTime,
        label
      });
    }

    // Cleanup
    input.dispose();
    prediction.dispose();

    return {
      label,
      confidence: maxProb,
      probabilities: probabilityMap,
      features,
      modelId: 'classifier'
    };
  }

  /**
   * Ensemble classification for higher accuracy
   *
   * Uses multiple models to predict pattern type and averages
   * their predictions for more robust classification.
   *
   * CRITICAL FIX: Replaced await-in-loop (lines 469-477) with Promise.all()
   * for parallel model predictions, improving performance and avoiding
   * ESLint no-await-in-loop violations.
   *
   * @param features - Pattern features to classify
   * @returns Prediction with averaged ensemble confidence scores
   */
  async classifyEnsemble(features: PatternFeatures): Promise<Prediction> {
    if (this.ensembleModels.length === 0) {
      return this.classify(features);
    }

    const vector = this.featureConverter.featuresToVector(features);
    const scaledVector = this.featureScaler.scaleFeatures(vector);
    const input = tf.tensor2d([scaledVector]);

    // FIXED: Use Promise.all() instead of sequential await in loop
    // This runs all model predictions in parallel, improving performance
    // and avoiding no-await-in-loop ESLint rule violation
    const allPredictions = await Promise.all(
      this.ensembleModels.map(async (model) => {
        const pred = await model.predict(input) as tf.Tensor;
        const probs = await pred.array() as number[][];
        const firstProbs = probs[0];
        pred.dispose();
        return firstProbs ?? [];
      })
    );

    // Average predictions across all models
    const avgProbs = new Array(this.labelEncoder.size).fill(0);
    for (const probs of allPredictions) {
      for (let i = 0; i < probs.length; i++) {
        const prob = probs[i];
        if (prob !== undefined) {
          avgProbs[i] += prob;
        }
      }
    }
    for (let i = 0; i < avgProbs.length; i++) {
      avgProbs[i] /= allPredictions.length;
    }

    // Find best class
    let maxProb = 0;
    let maxIndex = 0;
    for (let i = 0; i < avgProbs.length; i++) {
      const prob = avgProbs[i] as number;
      if (prob > maxProb) {
        maxProb = prob;
        maxIndex = i;
      }
    }

    const label = this.labelEncoder.decode(maxIndex);

    // Build probability map
    const probabilityMap: Record<string, number> = {};
    for (let i = 0; i < avgProbs.length; i++) {
      const type = this.labelEncoder.decode(i);
      const prob = avgProbs[i] as number;
      probabilityMap[type] = prob;
    }

    input.dispose();

    return {
      label,
      confidence: maxProb,
      probabilities: probabilityMap,
      features,
      modelId: 'ensemble'
    };
  }

  /**
   * Cleanup resources
   *
   * Disposes all TensorFlow models to free GPU/CPU memory.
   * Should be called when service is no longer needed.
   */
  dispose(): void {
    this.classifier?.dispose();
    this.ensembleModels.forEach(m => m.dispose());
  }
}
