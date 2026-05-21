/**
 * Metrics Calculator
 *
 * Calculates confusion matrix, accuracy, precision, recall, and F1 score
 * for the Active Learning System.
 *
 * Extracted from: ActiveLearningSystem.ts (lines 512-588)
 */

import type {
  LearningMetrics,
  PatternType,
  Prediction,
  LearningExample,
} from '@/server/parsers/pattern-recognition/types';

/**
 * Update learning metrics with a new prediction
 *
 * @param metrics - Current metrics state
 * @param example - Learning example with actual label
 * @param prediction - Predicted label
 * @returns Updated metrics with new prediction incorporated
 */
export function updateMetrics(
  metrics: LearningMetrics,
  example: LearningExample,
  prediction: Prediction
): LearningMetrics {
  // Create a deep copy of confusion matrix for immutability
  const confusionMatrix = metrics.confusionMatrix.map(row => [...row]);

  const actualIndex = getLabelIndex(example.label);
  const predictedIndex = getLabelIndex(prediction.label);

  // Initialize row if needed, then update
  const existingRow = confusionMatrix[actualIndex];
  if (existingRow) {
    existingRow[predictedIndex] = (existingRow[predictedIndex] ?? 0) + 1;
  } else {
    const newRow: number[] = [];
    newRow[predictedIndex] = 1;
    confusionMatrix[actualIndex] = newRow;
  }

  // Calculate and return updated metrics
  return calculateMetricsFromConfusionMatrix({
    ...metrics,
    confusionMatrix,
  });
}

/**
 * Get label index for confusion matrix
 *
 * Maps pattern types to matrix indices.
 *
 * @param label - Pattern type label
 * @returns Index in confusion matrix (0-9), or -1 if not found
 */
export function getLabelIndex(label: string): number {
  const types: PatternType[] = [
    'volume',
    'chapter',
    'title',
    'author',
    'coverImage',
    'description',
    'metadata',
    'table',
    'gallery',
    'infobox',
  ];
  return types.indexOf(label as PatternType);
}

/**
 * Calculate metrics from confusion matrix
 *
 * Computes accuracy, precision, recall, and F1 score from the
 * current confusion matrix state.
 *
 * @param metrics - Metrics with confusion matrix to analyze
 * @returns Updated metrics with calculated values
 */
export function calculateMetricsFromConfusionMatrix(
  metrics: LearningMetrics
): LearningMetrics {
  const matrix = metrics.confusionMatrix;

  // Early return if matrix is empty
  if (matrix.length === 0) {
    return metrics;
  }

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let total = 0;

  // Process confusion matrix
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (row !== undefined) {
      for (let j = 0; j < row.length; j++) {
        const count = row[j] ?? 0;
        total += count;

        if (i === j) {
          truePositives += count;
        } else {
          falsePositives += count;
          falseNegatives += count;
        }
      }
    }
  }

  // Calculate metrics with safe division
  const accuracy = total > 0 ? truePositives / total : 0;
  const precision =
    truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;
  const recall =
    truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;
  const f1Score =
    precision + recall > 0
      ? (2 * (precision * recall)) / (precision + recall)
      : 0;

  // Return new metrics object with updated values
  return {
    ...metrics,
    accuracy,
    precision,
    recall,
    f1Score,
  };
}

/**
 * Get a copy of current learning metrics
 *
 * @param metrics - Current metrics state
 * @returns Shallow copy of metrics
 */
export function getMetrics(metrics: LearningMetrics): LearningMetrics {
  return { ...metrics };
}
