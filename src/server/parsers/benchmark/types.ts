/**
 * Performance Benchmark Type Definitions
 *
 * Type definitions for benchmark results, configuration, and statistics.
 * Extracted from: PerformanceBenchmark.ts (lines 14-50)
 *
 * @module server/parsers/benchmark/types
 */

/**
 * Options for configuring benchmark execution
 */
export interface BenchmarkOptions {
  /** Number of iterations to run for each test (default: 100) */
  iterations?: number;
  /** Whether to run warmup iterations before benchmarking (default: true) */
  warmup?: boolean;
  /** Enable verbose logging during benchmark execution (default: false) */
  verbose?: boolean;
}

/**
 * Statistics for parser performance
 */
export interface ParserStats {
  /** Average execution time in milliseconds */
  avgTime: number;
  /** Minimum execution time in milliseconds */
  minTime: number;
  /** Maximum execution time in milliseconds */
  maxTime: number;
  /** Total execution time across all iterations in milliseconds */
  totalTime: number;
  /** Number of iterations executed */
  iterations: number;
}

/**
 * Performance improvement metrics
 */
export interface ImprovementMetrics {
  /** Percentage improvement (e.g., 45.2 for 45.2% improvement) */
  percentage: number;
  /** Improvement factor (e.g., 2.0 for 2x faster) */
  factor: number;
}

/**
 * Memory usage statistics in bytes
 */
export interface MemoryStats {
  /** Memory used by old parser implementation */
  old: number;
  /** Memory used by unified parser implementation */
  unified: number;
  /** Memory saved by using unified parser (old - unified) */
  saved: number;
}

/**
 * Result from a single benchmark test
 */
export interface BenchmarkResult {
  /** Name of the benchmark test */
  name: string;
  /** Performance statistics for the old parser implementation */
  oldParser: ParserStats;
  /** Performance statistics for the unified parser implementation */
  unifiedParser: ParserStats;
  /** Improvement metrics comparing old vs unified parser */
  improvement: ImprovementMetrics;
  /** Memory usage comparison between implementations */
  memoryUsage: MemoryStats;
}

/**
 * Summary statistics across all benchmarks
 */
export interface BenchmarkSummary {
  /** Total number of tests executed */
  totalTests: number;
  /** Average percentage improvement across all tests */
  avgImprovement: number;
  /** Total memory saved across all tests in bytes */
  totalMemorySaved: number;
  /** Total time saved across all tests in milliseconds */
  totalTimeSaved: number;
}

/**
 * Complete benchmark suite results
 */
export interface BenchmarkSuite {
  /** Individual test results */
  results: BenchmarkResult[];
  /** Aggregated summary statistics */
  summary: BenchmarkSummary;
}
