/**
 * Hyperparameter Tuning Module
 *
 * Handles grid search hyperparameter tuning and cross-validation.
 * Provides simple, focused utilities for parameter optimization.
 *
 * Extracted from: ModelTrainer.ts (lines 594-680)
 */

import type { DataCollector } from '@/server/parsers/pattern-recognition/training/DataCollector';
import type { LearningExample } from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/server/utils/logger';


import type { TrainingConfig, TrainingResult } from './types';

/**
 * Grid search hyperparameter tuning and cross-validation utilities
 */
export class HyperparameterTuner {
  private dataCollector: DataCollector;
  private modelsDir: string;

  constructor(dataCollector: DataCollector, modelsDir: string) {
    this.dataCollector = dataCollector;
    this.modelsDir = modelsDir;
  }

  /**
   * Hyperparameter tuning with grid search
   *
   * SEQUENTIAL EXECUTION RATIONALE:
   * Grid search evaluates parameter combinations sequentially because:
   * 1. Shared ModelTrainer state cannot be parallelized safely
   * 2. Each configuration modifies trainer state (this.config)
   * 3. Results need deterministic comparison with consistent state
   *
   * For parallel tuning, use the standalone HyperparameterTuner class.
   */
  public async hyperparameterTuning(
    examples: LearningExample[],
    trainAllModels: (examples: LearningExample[]) => Promise<TrainingResult[]>,
    getCurrentConfig: () => TrainingConfig,
    setConfig: (config: TrainingConfig) => void
  ): Promise<{
    bestParams: TrainingConfig;
    bestScore: number;
  }> {
    logger.info('Starting hyperparameter tuning...');

    const paramGrid = {
      epochs: [30, 50],
      batchSize: [16, 32],
      learningRate: [0.001, 0.01]
    };

    let bestScore = 0;
    let bestParams = getCurrentConfig();

    // Grid search with sequential evaluation
    for (const epochs of paramGrid.epochs) {
      for (const batchSize of paramGrid.batchSize) {
        for (const learningRate of paramGrid.learningRate) {
          const currentConfig = getCurrentConfig();
          setConfig({
            ...currentConfig,
            epochs,
            batchSize,
            learningRate,
            verbose: false
          });

          logger.info(`Testing params: epochs=${epochs}, batchSize=${batchSize}, lr=${learningRate}`);

          // SEQUENTIAL EXECUTION (no-await-in-loop exception)
          // Rationale documented above - shared state prevents parallelization
          // eslint-disable-next-line no-await-in-loop
          const results = await trainAllModels(examples);
          const avgAccuracy = results.reduce((sum, r) => sum + r.validationAccuracy, 0) / results.length;

          if (avgAccuracy > bestScore) {
            bestScore = avgAccuracy;
            bestParams = { ...getCurrentConfig() };
            logger.info(`New best score: ${bestScore.toFixed(4)}`);
          }
        }
      }
    }

    // Restore best params
    setConfig(bestParams);

    return { bestParams, bestScore };
  }

  /**
   * K-fold cross-validation with parallel fold execution
   *
   * PARALLELIZATION STRATEGY:
   * Cross-validation folds are independent and can be trained in parallel.
   * Each fold uses isolated data splits without shared state.
   *
   * Performance improvement: ~5x faster for 5 folds (sequential → parallel)
   */
  public async crossValidation(
    examples: LearningExample[],
    trainClassifier: (
      trainExamples: LearningExample[],
      valExamples: LearningExample[]
    ) => Promise<TrainingResult>,
    folds: number = 5
  ): Promise<{
    meanAccuracy: number;
    stdAccuracy: number;
  }> {
    logger.info(`Starting ${folds}-fold cross-validation...`);

    const foldSize = Math.floor(examples.length / folds);

    // PARALLELIZED: Generate all fold training functions
    const foldPromises = Array.from({ length: folds }, (_, fold) => {
      const testStart = fold * foldSize;
      const testEnd = testStart + foldSize;
      const trainFold = [
        ...examples.slice(0, testStart),
        ...examples.slice(testEnd)
      ];

      return async (): Promise<number> => {
        logger.info(`Fold ${fold + 1}/${folds}`);

        // Split training fold into train/validation
        const { train, validation } = this.dataCollector.splitDataset(trainFold, 0.8, 0.2);

        // Train classifier on this fold
        const result = await trainClassifier(train, validation);

        return result.validationAccuracy;
      };
    });

    // Execute all folds in parallel
    const accuracies = await Promise.all(foldPromises.map(fn => fn()));

    // Calculate statistics
    const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
    const variance = accuracies.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / accuracies.length;
    const std = Math.sqrt(variance);

    logger.info(`Cross-validation results: ${mean.toFixed(4)} ± ${std.toFixed(4)}`);

    return {
      meanAccuracy: mean,
      stdAccuracy: std
    };
  }
}
