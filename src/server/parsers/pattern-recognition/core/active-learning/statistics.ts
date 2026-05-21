/**
 * Statistics and Data Management
 *
 * Provides statistics reporting, data export/import, and data clearing
 * for the Active Learning System.
 *
 * Extracted from: ActiveLearningSystem.ts (lines 589-665)
 */

import type { LearningExample, LearningMetrics } from '@/server/parsers/pattern-recognition/types';

/**
 * Learning system statistics
 */
export interface LearningStatistics {
  totalExamples: number;
  uncertainExamples: number;
  correctPredictions: number;
  incorrectPredictions: number;
  feedbackReceived: number;
  examplesSinceRetrain: number;
  isTraining: boolean;
}

/**
 * Data export container
 */
export interface ExportedLearningData {
  examples: LearningExample[];
  metrics: LearningMetrics;
  statistics: LearningStatistics;
}

/**
 * Data import container
 */
export interface ImportedLearningData {
  examples: LearningExample[];
  metrics?: LearningMetrics;
}

/**
 * Get learning statistics
 */
export function getStatistics(
  learningExamples: LearningExample[],
  uncertainExamples: LearningExample[],
  examplesSinceRetrain: number,
  isTraining: boolean
): LearningStatistics {
  const correct = learningExamples.filter(e => e.correct).length;
  const incorrect = learningExamples.filter(e => !e.correct).length;
  const withFeedback = learningExamples.filter(e => e.feedback).length;

  return {
    totalExamples: learningExamples.length,
    uncertainExamples: uncertainExamples.length,
    correctPredictions: correct,
    incorrectPredictions: incorrect,
    feedbackReceived: withFeedback,
    examplesSinceRetrain,
    isTraining
  };
}

/**
 * Export learning data for analysis
 */
export function exportLearningData(
  learningExamples: LearningExample[],
  metrics: LearningMetrics,
  statistics: LearningStatistics
): ExportedLearningData {
  return {
    examples: [...learningExamples],
    metrics: { ...metrics },
    statistics
  };
}

/**
 * Create initial metrics structure
 */
export function createInitialMetrics(): LearningMetrics {
  return {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    confusionMatrix: [],
    learningCurve: []
  };
}

/**
 * Clear all learning data structures
 */
export function clearLearningData(): {
  learningExamples: LearningExample[];
  uncertainExamples: LearningExample[];
  feedbackQueue: never[];
  examplesSinceRetrain: number;
  metrics: LearningMetrics;
} {
  return {
    learningExamples: [],
    uncertainExamples: [],
    feedbackQueue: [],
    examplesSinceRetrain: 0,
    metrics: createInitialMetrics()
  };
}
