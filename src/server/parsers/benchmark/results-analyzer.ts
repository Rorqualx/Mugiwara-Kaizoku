/**
 * Results Analyzer
 *
 * Analyzes and reports benchmark results with statistical calculations
 * and formatted output.
 *
 * Extracted from: PerformanceBenchmark.ts (lines 458-563)
 */

import { logger } from '@/utils/logger';

import type { BenchmarkResult, BenchmarkSuite } from './types';


/**
 * Calculate improvement percentage between old and unified parsers
 *
 * @param oldTimes - Array of old parser timing measurements
 * @param unifiedTimes - Array of unified parser timing measurements
 * @returns Improvement percentage (positive = better performance)
 */
export function calculateImprovement(oldTimes: number[], unifiedTimes: number[]): number {
  const oldAvg = oldTimes.reduce((a, b) => a + b, 0) / oldTimes.length;
  const unifiedAvg = unifiedTimes.reduce((a, b) => a + b, 0) / unifiedTimes.length;
  return ((oldAvg - unifiedAvg) / oldAvg) * 100;
}

/**
 * Record benchmark result from timing measurements
 *
 * @param name - Name of the benchmark test
 * @param oldTimes - Array of old parser timings
 * @param unifiedTimes - Array of unified parser timings
 * @param oldMemory - Memory used by old parser (bytes)
 * @param unifiedMemory - Memory used by unified parser (bytes)
 * @returns Complete benchmark result with statistics
 */
export function recordResult(
  name: string,
  oldTimes: number[],
  unifiedTimes: number[],
  oldMemory: number,
  unifiedMemory: number
): BenchmarkResult {
  const result: BenchmarkResult = {
    name,
    oldParser: {
      avgTime: oldTimes.reduce((a, b) => a + b, 0) / oldTimes.length,
      minTime: Math.min(...oldTimes),
      maxTime: Math.max(...oldTimes),
      totalTime: oldTimes.reduce((a, b) => a + b, 0),
      iterations: oldTimes.length
    },
    unifiedParser: {
      avgTime: unifiedTimes.reduce((a, b) => a + b, 0) / unifiedTimes.length,
      minTime: Math.min(...unifiedTimes),
      maxTime: Math.max(...unifiedTimes),
      totalTime: unifiedTimes.reduce((a, b) => a + b, 0),
      iterations: unifiedTimes.length
    },
    improvement: {
      percentage: 0,
      factor: 0
    },
    memoryUsage: {
      old: oldMemory,
      unified: unifiedMemory,
      saved: oldMemory - unifiedMemory
    }
  };

  // Calculate improvement
  result.improvement.percentage = calculateImprovement(oldTimes, unifiedTimes);
  result.improvement.factor = result.oldParser.avgTime / result.unifiedParser.avgTime;

  return result;
}

/**
 * Generate summary statistics from all benchmark results
 *
 * @param results - Array of all benchmark results
 * @returns Complete benchmark suite with summary statistics
 */
export function generateSummary(results: BenchmarkResult[]): BenchmarkSuite {
  const totalTests = results.length;
  const avgImprovement = results.reduce((sum, r) => sum + r.improvement.percentage, 0) / totalTests;
  const totalMemorySaved = results.reduce((sum, r) => sum + r.memoryUsage.saved, 0);
  const totalTimeSaved = results.reduce((sum, r) =>
    sum + (r.oldParser.totalTime - r.unifiedParser.totalTime), 0);

  return {
    results,
    summary: {
      totalTests,
      avgImprovement,
      totalMemorySaved,
      totalTimeSaved
    }
  };
}

/**
 * Print formatted benchmark results to console
 *
 * @param suite - Complete benchmark suite with results and summary
 */
export function printResults(suite: BenchmarkSuite): void {
  logger.info('\n' + '='.repeat(80));
  logger.info('📊 BENCHMARK RESULTS');
  logger.info('='.repeat(80));

  // Individual test results
  logger.info('\n📈 Performance Comparison:\n');
  logger.info('Test Name                    | Old Parser | Unified Parser | Improvement | Factor');
  logger.info('-'.repeat(80));

  for (const result of suite.results) {
    logger.info(
      `${result["name"].padEnd(28)} | ` +
      `${result.oldParser.avgTime.toFixed(2)}ms`.padEnd(10) + ' | ' +
      `${result.unifiedParser.avgTime.toFixed(2)}ms`.padEnd(14) + ' | ' +
      `${result.improvement.percentage.toFixed(1)}%`.padEnd(11) + ' | ' +
      `${result.improvement.factor.toFixed(1)}x`
    );
  }

  // Summary
  logger.info('\n' + '='.repeat(80));
  logger.info('📊 SUMMARY');
  logger.info('='.repeat(80));
  logger.info(`\n✅ Total Tests: ${suite.summary.totalTests}`);
  logger.info(`📈 Average Improvement: ${suite.summary.avgImprovement.toFixed(1)}%`);
  logger.info(`⏱️ Total Time Saved: ${suite.summary.totalTimeSaved.toFixed(2)}ms`);
  logger.info(`💾 Memory Saved: ${(suite.summary.totalMemorySaved / 1024 / 1024).toFixed(2)}MB`);

  // Verdict
  logger.info('\n' + '='.repeat(80));
  if (suite.summary.avgImprovement > 50) {
    logger.info('🎉 EXCELLENT: Unified parser shows significant performance improvements!');
  } else if (suite.summary.avgImprovement > 20) {
    logger.info('✅ GOOD: Unified parser provides meaningful performance gains.');
  } else if (suite.summary.avgImprovement > 0) {
    logger.info('👍 POSITIVE: Unified parser performs better than old implementation.');
  } else {
    logger.info('⚠️ REVIEW: Performance gains are minimal, but consider other benefits.');
  }
  logger.info('='.repeat(80) + '\n');
}
