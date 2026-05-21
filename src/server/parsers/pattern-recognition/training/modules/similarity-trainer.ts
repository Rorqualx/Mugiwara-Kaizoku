/**
 * Similarity Model Trainer
 *
 * Handles training of similarity model for pattern matching.
 * Generates feature pairs and trains a similarity-based neural network.
 *
 * Extracted from: ModelTrainer.ts (lines 246-281)
 */

import type { MLPipeline } from '@/server/parsers/pattern-recognition/core/MLPipeline';
import type { LearningExample } from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/server/utils/logger';

import { DataPreparation } from './data-preparation';

import type { TrainingConfig, TrainingResult } from './types';


/**
 * Trainer for similarity models used in pattern recognition
 */
export class SimilarityTrainer {
  private mlPipeline: MLPipeline;
  private dataPrep: DataPreparation;
  private config: TrainingConfig;

  /**
   * Initialize similarity trainer
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
   * Train similarity model on provided examples
   *
   * Generates similarity pairs from training examples (positive pairs with same label,
   * negative pairs with different labels) and trains the similarity model to learn
   * pattern similarity relationships.
   *
   * @param trainExamples - Examples for training
   * @param valExamples - Examples for validation
   * @returns Training result with metrics
   */
  public async train(
    trainExamples: LearningExample[],
    valExamples: LearningExample[]
  ): Promise<TrainingResult> {
    logger.info('Training similarity model...');
    const startTime = Date.now();

    // Generate pairs using DataPreparation
    const trainPairs = this.dataPrep.generateSimilarityPairs(trainExamples);
    const _valPairs = this.dataPrep.generateSimilarityPairs(valExamples);

    logger.info(`Generated ${trainPairs.length} training pairs`);

    // Train model
    const history = await this.mlPipeline.trainSimilarityModel(
      trainPairs,
      this.config.epochs,
      this.config.batchSize
    );

    // Extract metrics from training history
    const finalHistory = history.history;
    const lossArray = finalHistory['loss'];
    if (!lossArray || lossArray.length === 0) {
      throw new Error('No loss history available');
    }

    const lastEpoch = lossArray.length - 1;
    const lossValue = lossArray[lastEpoch];
    const accValue = finalHistory['acc']?.[lastEpoch];
    const valAccValue = finalHistory['val_acc']?.[lastEpoch];
    const valLossValue = finalHistory['val_loss']?.[lastEpoch];

    const trainingResult: TrainingResult = {
      modelId: 'similarity',
      accuracy: Number(accValue ?? 0),
      loss: Number(lossValue ?? 0),
      validationAccuracy: Number(valAccValue ?? 0),
      validationLoss: Number(valLossValue ?? 0),
      confusionMatrix: [],
      trainingTime: Date.now() - startTime,
      hyperparameters: this.config
    };

    logger.info(
      `Similarity model training complete - Loss: ${trainingResult.loss.toFixed(4)}, ` +
      `Accuracy: ${trainingResult.accuracy.toFixed(4)}, ` +
      `Time: ${trainingResult.trainingTime}ms`
    );

    return trainingResult;
  }
}
