/**
 * A/B Testing Framework - Experiment Manager
 *
 * Manages experiment lifecycle and state transitions.
 *
 * This module provides pure functions for experiment management,
 * avoiding parameter mutation and following immutable update patterns.
 */

import { logger } from '@/utils/logger';

import type { ExperimentResults, VariantResults } from './types';

/**
 * Check if experiment should end based on sample size and duration
 *
 * @param experiment - The experiment to check
 * @returns True if experiment should end, false otherwise
 */
export function shouldEndExperiment(experiment: ExperimentResults): boolean {
  // Check minimum sample size
  const minSamples = Math.min(
    experiment.variantA.samples,
    experiment.variantB.samples
  );
  if (minSamples < experiment.config.minSampleSize) {
    return false;
  }

  // Check duration if specified
  if (experiment.config.duration) {
    const elapsedHours = (Date.now() - experiment.startTime.getTime()) / (1000 * 60 * 60);
    if (elapsedHours < experiment.config.duration) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate statistical significance using Chi-square test
 *
 * @param variantA - Rule-based variant results
 * @param variantB - ML-based variant results
 * @returns P-value and winner determination
 */
export function calculateStatisticalSignificance(
  variantA: VariantResults,
  variantB: VariantResults
): { pValue: number; winner: 'A' | 'B' | 'tie' } {
  // Simplified Chi-square test for success rates
  const successA = Math.round(variantA.successRate * variantA.samples);
  const failureA = variantA.samples - successA;
  const successB = Math.round(variantB.successRate * variantB.samples);
  const failureB = variantB.samples - successB;

  const total = variantA.samples + variantB.samples;
  const totalSuccess = successA + successB;
  const totalFailure = failureA + failureB;

  // Expected values
  const expectedSuccessA = (variantA.samples * totalSuccess) / total;
  const expectedFailureA = (variantA.samples * totalFailure) / total;
  const expectedSuccessB = (variantB.samples * totalSuccess) / total;
  const expectedFailureB = (variantB.samples * totalFailure) / total;

  // Chi-square statistic
  const chiSquare =
    Math.pow(successA - expectedSuccessA, 2) / expectedSuccessA +
    Math.pow(failureA - expectedFailureA, 2) / expectedFailureA +
    Math.pow(successB - expectedSuccessB, 2) / expectedSuccessB +
    Math.pow(failureB - expectedFailureB, 2) / expectedFailureB;

  // Simplified p-value calculation (would use proper distribution in production)
  const pValue = Math.exp(-chiSquare / 2);

  // Determine winner
  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (pValue < 0.05) { // Significant difference
    if (variantA.successRate > variantB.successRate) {
      winner = 'A';
    } else if (variantB.successRate > variantA.successRate) {
      winner = 'B';
    }
  }

  return { pValue, winner };
}

/**
 * Generate recommendations based on experiment results
 *
 * @param experiment - The experiment to analyze
 * @returns Array of recommendation strings
 */
export function generateRecommendations(experiment: ExperimentResults): string[] {
  const recommendations: string[] = [];

  // Compare success rates
  if (experiment.variantB.successRate > experiment.variantA.successRate * 1.1) {
    recommendations.push('ML variant shows significant improvement in success rate. Consider increasing traffic allocation.');
  } else if (experiment.variantA.successRate > experiment.variantB.successRate * 1.1) {
    recommendations.push('Rule-based parser outperforms ML variant. Review ML training data and patterns.');
  }

  // Compare execution times
  if (experiment.variantB.averageExecutionTime > experiment.variantA.averageExecutionTime * 2) {
    recommendations.push('ML variant is significantly slower. Consider optimization or caching strategies.');
  } else if (experiment.variantB.averageExecutionTime < experiment.variantA.averageExecutionTime * 0.5) {
    recommendations.push('ML variant shows excellent performance improvement.');
  }

  // Check error rates
  if (experiment.variantB.errors > experiment.variantA.errors * 2) {
    recommendations.push('ML variant has higher error rate. Investigate failure cases and improve error handling.');
  }

  // Check confidence levels
  if (experiment.variantB.averageConfidence < 0.7) {
    recommendations.push('ML variant has low confidence. Consider additional training or pattern refinement.');
  }

  // Overall recommendation
  if (experiment.winner === 'B') {
    recommendations.push('ML variant is the clear winner. Recommend full rollout with continued monitoring.');
  } else if (experiment.winner === 'A') {
    recommendations.push('Rule-based parser performs better. Continue ML improvements before retry.');
  } else {
    recommendations.push('No significant difference detected. Continue testing with larger sample size.');
  }

  return recommendations;
}

/**
 * Finalize experiment with results (IMMUTABLE)
 *
 * This function returns a NEW experiment object with updated fields,
 * avoiding mutation of the input parameter.
 *
 * FIX: Replaced parameter reassignment with immutable update pattern
 *
 * @param experiment - The experiment to finalize
 * @returns New experiment object with final results
 */
export function finalizeExperiment(
  experiment: ExperimentResults
): ExperimentResults {
  // Calculate statistical significance
  const { pValue, winner } = calculateStatisticalSignificance(
    experiment.variantA,
    experiment.variantB
  );

  // Generate recommendations with preliminary results
  const recommendations = generateRecommendations({
    ...experiment,
    statisticalSignificance: pValue,
    winner
  });

  // Return NEW object instead of mutating parameter
  return {
    ...experiment,
    endTime: new Date(),
    statisticalSignificance: pValue,
    winner,
    recommendations
  };
}

/**
 * Log experiment completion
 *
 * @param experiment - The completed experiment
 */
export function logExperimentCompletion(experiment: ExperimentResults): void {
  logger.info(`Experiment ${experiment.config.name} completed. Winner: ${experiment.winner ?? 'none'}`);
}
