/**
 * Anomaly Detection Trainer
 *
 * Handles training of autoencoder for anomaly detection.
 * Trains on normal examples only to learn the distribution of correct patterns,
 * then uses reconstruction error for anomaly detection.
 *
 * Extracted from: ModelTrainer.ts (lines 286-333)
 */

import * as tf from '@tensorflow/tfjs-node';

import type { MLPipeline } from '@/server/parsers/pattern-recognition/core/MLPipeline';
import type { LearningExample } from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/server/utils/logger';

import { DataPreparation } from './data-preparation';

import type { TrainingConfig, TrainingResult } from './types';


/**
 * Trainer for anomaly detection models
 */
export class AnomalyTrainer {
  private mlPipeline: MLPipeline;
  private dataPrep: DataPreparation;
  private config: TrainingConfig;

  /**
   * Initialize anomaly trainer
   *
   * @param mlPipeline - ML pipeline instance for model operations
   * @param dataPrep - Data preparation utilities
   * @param config - Training configuration
   */
  constructor(
    mlPipeline: MLPipeline,
    dataPrep: DataPreparation,
    config: TrainingConfig
  ) {
    this.mlPipeline = mlPipeline;
    this.dataPrep = dataPrep;
    this.config = config;
  }

  /**
   * Train anomaly detector on provided examples
   *
   * Trains an autoencoder on normal (correct) examples to learn the manifold
   * of correct pattern features. The autoencoder reconstructs the input, and
   * high reconstruction error indicates anomalies (incorrect patterns).
   *
   * @param trainExamples - Examples for training (both correct and incorrect used to filter correct ones)
   * @param _valExamples - Examples for validation (unused for autoencoder)
   * @returns Training result with metrics
   */
  public async train(
    trainExamples: LearningExample[],
    _valExamples: LearningExample[]
  ): Promise<TrainingResult> {
    logger.info('Training anomaly detector...');
    const startTime = Date.now();

    // Use only normal examples (correct patterns)
    const normalExamples = trainExamples.filter(example => example.correct);
    const features = normalExamples.map(example =>
      this.dataPrep.featuresToVector(example.features)
    );

    logger.info(`Using ${normalExamples.length} normal examples for anomaly detector training`);

    // Validate features
    const firstFeature = features[0];
    if (!firstFeature) {
      throw new Error('No features available for anomaly detection');
    }

    const inputDim = firstFeature.length;
    logger.info(`Building autoencoder with input dimension: ${inputDim}`);

    // Build autoencoder model - buildAnomalyDetector returns the model
    // CRITICAL FIX: Use return value instead of accessing private property with non-null assertion
    const anomalyDetector = await this.mlPipeline.buildAnomalyDetector(inputDim);

    // Train autoencoder (input = output for reconstruction)
    const trainX = tf.tensor2d(features);

    logger.info(
      `Training autoencoder with ${features.length} samples, ` +
      `${this.config.epochs} epochs, batch size ${this.config.batchSize}`
    );

    const history = await anomalyDetector.fit(trainX, trainX, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: this.config.validationSplit,
      verbose: this.config.verbose ? 1 : 0
    });

    // Cleanup training tensor
    trainX.dispose();

    // Extract metrics from training history
    const finalHistory = history.history;
    const lossArray = finalHistory['loss'];

    if (!lossArray || lossArray.length === 0) {
      throw new Error('No loss history available from autoencoder training');
    }

    const lastEpoch = lossArray.length - 1;
    const lossValue = lossArray[lastEpoch];
    const valLossValue = finalHistory['val_loss']?.[lastEpoch];

    const trainingResult: TrainingResult = {
      modelId: 'anomaly',
      accuracy: 0, // Not applicable for autoencoder
      loss: Number(lossValue ?? 0),
      validationAccuracy: 0,
      validationLoss: Number(valLossValue ?? 0),
      confusionMatrix: [],
      trainingTime: Date.now() - startTime,
      hyperparameters: this.config
    };

    logger.info(
      `Anomaly detector training complete - Loss: ${trainingResult.loss.toFixed(4)}, ` +
      `Validation Loss: ${trainingResult.validationLoss.toFixed(4)}, ` +
      `Time: ${trainingResult.trainingTime}ms`
    );

    return trainingResult;
  }
}
