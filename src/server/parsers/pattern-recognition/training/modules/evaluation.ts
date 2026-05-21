/**
 * Model Evaluation Module
 *
 * Handles evaluation metrics calculation including confusion matrices
 * and model performance assessment.
 *
 * Extracted from: ModelTrainer.ts (lines 476-542)
 */

import fs from 'fs/promises';
import path from 'path';

import * as tf from '@tensorflow/tfjs-node';

import type { MLPipeline } from '@/server/parsers/pattern-recognition/core/MLPipeline';
import type { LearningExample } from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/server/utils/logger';

import { DataPreparation } from './data-preparation';



/**
 * Evaluation results for a specific model
 */
interface ModelEvaluationResults {
  testLoss: number;
  testAccuracy: number;
  testSize: number;
}

/**
 * Model evaluation utilities
 */
export class ModelEvaluator {
  private mlPipeline: MLPipeline;
  private modelsDir: string;
  private dataPrep: DataPreparation;

  constructor(mlPipeline: MLPipeline, modelsDir: string) {
    this.mlPipeline = mlPipeline;
    this.modelsDir = modelsDir;
    this.dataPrep = new DataPreparation();
  }

  /**
   * Calculate confusion matrix with type-safe tensor conversions
   *
   * Converts predictions and labels to a confusion matrix showing
   * the relationship between predicted and actual classes.
   *
   * FIXES:
   * - Line 484: Safe tensor array conversion with type guards
   * - Line 484: Proper array initialization using Array.from
   * - Lines 489: Replace undefined/null checks with typeof
   * - Lines 489: Add bounds checking before array access
   *
   * @param predictions - Predicted class indices
   * @param labels - Actual class indices
   * @param numClasses - Number of classes (default: 10)
   * @returns Confusion matrix as 2D array
   */
  public async calculateConfusionMatrix(
    predictions: tf.Tensor,
    labels: tf.Tensor,
    numClasses: number = 10
  ): Promise<number[][]> {
    // SAFE tensor conversion with type guards
    const predArrayRaw = await predictions.array();
    const labelArrayRaw = await labels.array();

    // Validate that array conversion succeeded
    if (!Array.isArray(predArrayRaw) || !Array.isArray(labelArrayRaw)) {
      throw new Error('Invalid tensor array conversion: result is not an array');
    }

    // Cast to number arrays after validation
    const predArray = predArrayRaw as number[];
    const labelArray = labelArrayRaw as number[];

    // Validate array lengths match
    if (predArray.length !== labelArray.length) {
      throw new Error(
        `Prediction and label arrays have different lengths: ${predArray.length} vs ${labelArray.length}`
      );
    }

    // SAFE array initialization using Array.from (no fill(null))
    const matrix: number[][] = Array.from({ length: numClasses }, () =>
      Array.from({ length: numClasses }, () => 0)
    );

    // Populate confusion matrix with type-safe access
    for (let i = 0; i < predArray.length; i++) {
      const labelIdx = labelArray[i];
      const predIdx = predArray[i];

      // Type guard: ensure indices are numbers (not undefined/null check)
      if (typeof labelIdx !== 'number' || typeof predIdx !== 'number') {
        logger.warn(`Skipping invalid index at position ${i}: label=${labelIdx}, pred=${predIdx}`);
        continue;
      }

      // Bounds checking before array access
      if (labelIdx < 0 || labelIdx >= numClasses || predIdx < 0 || predIdx >= numClasses) {
        logger.warn(
          `Skipping out-of-bounds index at position ${i}: label=${labelIdx}, pred=${predIdx}, numClasses=${numClasses}`
        );
        continue;
      }

      // Safe array access after validation
      const row = matrix[labelIdx];
      if (row) {
        const currentValue = row[predIdx];
        if (typeof currentValue === 'number') {
          row[predIdx] = currentValue + 1;
        }
      }
    }

    return matrix;
  }

  /**
   * Evaluate models on test set
   *
   * Runs model evaluation on test examples and logs performance metrics.
   * Saves evaluation results to disk.
   *
   * FIXES:
   * - Lines 524: Replace undefined/null checks with typeof checks
   *
   * @param testExamples - Array of test examples
   * @returns Promise that resolves when evaluation is complete
   */
  public async evaluateModels(testExamples: LearningExample[]): Promise<void> {
    logger.info('Evaluating models on test set...');

    const { features, labels } = this.dataPrep.prepareClassifierData(testExamples);
    const testX = tf.tensor2d(features);
    const testY = tf.oneHot(labels, 10);

    try {
      // Evaluate classifier
      const classifier = (this.mlPipeline as unknown as Record<string, unknown>)['classifier'];
      if (!classifier) {
        logger.warn('Classifier not available for evaluation');
        return;
      }

      // Type assertion for evaluate method (returns array of scalars)
      const result = (classifier as unknown as { evaluate: (x: tf.Tensor, y: tf.Tensor) => tf.Scalar[] }).evaluate(
        testX,
        testY
      );

      const lossScalar = result[0];
      const accuracyScalar = result[1];

      if (!lossScalar || !accuracyScalar) {
        throw new Error('Evaluation results are missing');
      }

      const loss = await lossScalar.data();
      const accuracy = await accuracyScalar.data();
      const lossValue = (loss as Float32Array)[0] ?? 0;
      const accValue = (accuracy as Float32Array)[0] ?? 0;

      // Type guard for number (not undefined/null check)
      if (typeof lossValue !== 'number' || typeof accValue !== 'number') {
        throw new Error('Evaluation values are not valid numbers');
      }

      logger.info(`Classifier - Test Loss: ${lossValue.toFixed(4)}, Test Accuracy: ${accValue.toFixed(4)}`);

      // Save evaluation results
      await this.saveEvaluation('classifier', {
        testLoss: lossValue,
        testAccuracy: accValue,
        testSize: testExamples.length
      });

      // Cleanup tensors
      result.forEach(t => t.dispose());
    } finally {
      // Always cleanup input tensors
      testX.dispose();
      testY.dispose();
    }
  }

  /**
   * Save evaluation results to disk
   *
   * Persists model evaluation metrics to JSON file.
   *
   * @param modelName - Name of the model
   * @param results - Evaluation results to save
   * @returns Promise that resolves when file is written
   */
  private async saveEvaluation(modelName: string, results: ModelEvaluationResults): Promise<void> {
    const evaluationPath = path.join(this.modelsDir, 'evaluation', `${modelName}_evaluation.json`);

    const data = {
      ...results,
      evaluatedAt: new Date().toISOString()
    };

    await fs.writeFile(evaluationPath, JSON.stringify(data, null, 2));
    logger.info(`Evaluation results saved to ${evaluationPath}`);
  }
}
