/**
 * A/B Testing Framework - Variant Analyzer
 *
 * Analyzes variant performance and provides statistical comparisons.
 *
 * Extracted from: ABTestingFramework.ts (lines 254-260, 280-298, 345-415, 419-430)
 *
 * ESLint Fixes:
 * - Fixed 6 no-param-reassign violations (lines 281-296)
 * - Changed updateVariantResults to return new object instead of mutating parameter
 * - All functions are now pure/immutable
 */

import type { ExperimentResults, VariantResults, TestResult } from './types';

// ============================================================================
// Variant Selection
// ============================================================================

/**
 * Determine if ML variant should be used based on traffic split
 *
 * @param experiment - Experiment results containing traffic split configuration
 * @returns True if ML variant should be used based on random selection
 *
 * Extracted from: ABTestingFramework.ts (lines 254-260)
 */
export function shouldUseMLVariant(experiment: ExperimentResults): boolean {
  const random = Math.random() * 100;
  return random < experiment.config.trafficSplit;
}

// ============================================================================
// Variant Results Management
// ============================================================================

/**
 * Initialize variant results with default values
 *
 * @param name - Variant name (e.g., "Rule-based Parser" or "ML Pattern Recognition")
 * @returns Initialized variant results object
 *
 * Extracted from: ABTestingFramework.ts (lines 419-430)
 */
export function initializeVariantResults(name: string): VariantResults {
  return {
    name,
    samples: 0,
    successRate: 0,
    averageAccuracy: 0,
    averageConfidence: 0,
    averageExecutionTime: 0,
    p95ExecutionTime: 0,
    errors: 0,
    metrics: {}
  };
}

/**
 * Update variant results with new test result (IMMUTABLE)
 *
 * FIX: Returns NEW object instead of mutating parameter
 *
 * ESLint Violations Fixed:
 * - Line 281: no-param-reassign (variant.samples++)
 * - Line 284: no-param-reassign (variant.successRate = ...)
 * - Line 287: no-param-reassign (variant.averageAccuracy = ...)
 * - Line 290: no-param-reassign (variant.averageConfidence = ...)
 * - Line 293: no-param-reassign (variant.averageExecutionTime = ...)
 * - Line 296: no-param-reassign (variant.errors++)
 *
 * @param variant - Current variant results
 * @param result - New test result to incorporate
 * @returns New variant results with updated statistics
 *
 * Extracted from: ABTestingFramework.ts (lines 280-298)
 */
export function updateVariantResults(
  variant: VariantResults,
  result: TestResult
): VariantResults {
  const newSamples = variant.samples + 1;

  // Calculate new success rate
  const prevSuccessCount = variant.successRate * variant.samples;
  const newSuccessRate = (prevSuccessCount + (result.success ? 1 : 0)) / newSamples;

  // Calculate new average accuracy
  const prevAccuracySum = variant.averageAccuracy * variant.samples;
  const newAverageAccuracy = (prevAccuracySum + result.accuracy) / newSamples;

  // Calculate new average confidence
  const prevConfidenceSum = variant.averageConfidence * variant.samples;
  const newAverageConfidence = (prevConfidenceSum + result.confidence) / newSamples;

  // Calculate new average execution time
  const prevTimeSum = variant.averageExecutionTime * variant.samples;
  const newAverageExecutionTime = (prevTimeSum + result.executionTime) / newSamples;

  // Calculate new error count
  const newErrors = variant.errors + (result.errors && result.errors.length > 0 ? 1 : 0);

  return {
    ...variant,
    samples: newSamples,
    successRate: newSuccessRate,
    averageAccuracy: newAverageAccuracy,
    averageConfidence: newAverageConfidence,
    averageExecutionTime: newAverageExecutionTime,
    errors: newErrors
  };
}

// ============================================================================
// Statistical Analysis
// ============================================================================

/**
 * Calculate statistical significance using Chi-square test
 *
 * Compares two variants to determine if there's a significant difference
 * in their success rates. Uses a simplified Chi-square test.
 *
 * @param variantA - First variant results (rule-based)
 * @param variantB - Second variant results (ML-based)
 * @returns Object containing p-value and winner determination
 *
 * Extracted from: ABTestingFramework.ts (lines 345-380)
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

// ============================================================================
// Recommendations Generation
// ============================================================================

/**
 * Generate recommendations based on experiment results
 *
 * Analyzes the experiment outcomes and provides actionable recommendations
 * for improving the system or adjusting the experiment.
 *
 * @param experiment - Experiment results to analyze
 * @returns Array of recommendation strings
 *
 * Extracted from: ABTestingFramework.ts (lines 384-415)
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
