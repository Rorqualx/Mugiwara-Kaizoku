/**
 * Training Orchestrator
 *
 * Manages model retraining decisions, execution, and similarity model training
 * for the Active Learning System.
 *
 * Extracted from: ActiveLearningSystem.ts (lines 260-510)
 */

import * as tf from '@tensorflow/tfjs-node';

import type {
  LearningExample,
  PatternFeatures,
  PatternType,
  LearningMetrics
} from '@/server/parsers/pattern-recognition/types';
import { logger } from '@/utils/logger';

import type { MLPipeline } from '../MLPipeline';

/**
 * Options for shouldRetrain function
 */
export interface ShouldRetrainOptions {
  isTraining: boolean;
  examplesSinceRetrain: number;
  retrainThreshold: number;
  metrics: LearningMetrics;
  learningExamplesCount: number;
  uncertainExamplesCount: number;
}

/**
 * Check if retraining is needed
 *
 * Evaluates multiple criteria:
 * - Already training (prevent concurrent retraining)
 * - Enough new examples accumulated
 * - Accuracy drop requiring intervention
 * - Too many uncertain examples pending
 */
export function shouldRetrain(options: ShouldRetrainOptions): boolean {
  const {
    isTraining,
    examplesSinceRetrain,
    retrainThreshold,
    metrics,
    learningExamplesCount,
    uncertainExamplesCount
  } = options;
  // Don't retrain if already training
  if (isTraining) {
    return false;
  }

  // Retrain if enough new examples
  if (examplesSinceRetrain >= retrainThreshold) {
    return true;
  }

  // Retrain if accuracy dropped significantly
  if (metrics.accuracy < 0.7 && learningExamplesCount > 50) {
    return true;
  }

  // Retrain if many uncertain examples
  if (uncertainExamplesCount > retrainThreshold * 0.5) {
    return true;
  }

  return false;
}

/**
 * Retrain models with accumulated examples
 *
 * Trains both classifier and similarity models using prepared training data.
 * Returns training history for learning curve updates.
 */
export async function retrain(
  mlPipeline: MLPipeline,
  trainingExamples: LearningExample[],
  batchSize: number
): Promise<tf.History> {
  logger.info('Starting model retraining...');

  // Extract features and labels
  const features = trainingExamples.map(e => e.features);
  const labels = trainingExamples.map(e => e.label as PatternType);

  // Train classifier
  const result = await mlPipeline.trainClassifier(
    features,
    labels,
    10, // epochs
    batchSize
  );

  logger.info('Model retraining completed');

  return result;
}

/**
 * Helper function to create negative pairs between two label groups
 * Reduces nesting depth in trainSimilarityModel
 */
function createNegativePairs(
  byLabel: Map<string, LearningExample[]>,
  label1: string,
  label2: string,
  pairs: Array<{
    features1: PatternFeatures;
    features2: PatternFeatures;
    similar: boolean;
  }>
): void {
  const examples1 = byLabel.get(label1);
  const examples2 = byLabel.get(label2);

  if (examples1 === undefined || examples2 === undefined) {
    return;
  }

  for (let k = 0; k < Math.min(5, examples1.length, examples2.length); k++) {
    const example1 = examples1[k];
    const example2 = examples2[k];
    if (example1 !== undefined && example2 !== undefined) {
      pairs.push({
        features1: example1.features,
        features2: example2.features,
        similar: false
      });
    }
  }
}

/**
 * Train similarity model from examples
 *
 * Creates positive pairs (same label) and negative pairs (different labels)
 * for training the similarity model.
 *
 * FIXED: All no-non-null-assertion violations (lines 230, 420, 461)
 */
export async function trainSimilarityModel(
  mlPipeline: MLPipeline,
  learningExamples: LearningExample[],
  batchSize: number
): Promise<void> {
  const pairs: Array<{
    features1: PatternFeatures;
    features2: PatternFeatures;
    similar: boolean;
  }> = [];

  // Create positive pairs (same label)
  const byLabel = new Map<string, LearningExample[]>();
  for (const example of learningExamples) {
    const labelExamples = byLabel.get(example.label);
    if (labelExamples === undefined) {
      byLabel.set(example.label, [example]);
    } else {
      labelExamples.push(example);
    }
  }

  // Generate positive pairs from same-label examples
  const labelGroups = Array.from(byLabel.values());
  for (const labelExamples of labelGroups) {
    for (let i = 0; i < Math.min(10, labelExamples.length - 1); i++) {
      for (let j = i + 1; j < Math.min(i + 5, labelExamples.length); j++) {
        const example1 = labelExamples[i];
        const example2 = labelExamples[j];
        if (example1 !== undefined && example2 !== undefined) {
          pairs.push({
            features1: example1.features,
            features2: example2.features,
            similar: true
          });
        }
      }
    }
  }

  // Create negative pairs (different labels)
  const labels = Array.from(byLabel.keys());
  for (let i = 0; i < labels.length - 1; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const label1 = labels[i];
      const label2 = labels[j];
      if (label1 !== undefined && label2 !== undefined) {
        createNegativePairs(byLabel, label1, label2, pairs);
      }
    }
  }

  if (pairs.length >= batchSize) {
    await mlPipeline.trainSimilarityModel(pairs, 5, batchSize);
  }
}
