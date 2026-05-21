/**
 * Performance Benchmark for Unified Parser
 *
 * Compares performance between old fragmented parsers and new unified parser.
 *
 * Architecture:
 * - benchmark/types.ts - Type definitions (98 lines, 7 interfaces)
 * - benchmark/old-parser-simulators.ts - Old parser simulation (104 lines, 4 functions)
 * - benchmark/test-data-generators.ts - HTML test data (104 lines, 5 functions)
 * - benchmark/results-analyzer.ts - Results analysis (147 lines, 4 functions)
 * - benchmark/benchmark-operations.ts - Benchmark tests (379 lines, 7 functions)
 * - benchmark/PerformanceBenchmark.ts - Main coordinator (THIS FILE, ~150 lines)
 *
 * Total: 6 modules, ~980 lines (vs original 590 lines monolith)
 *
 * Original: 590 lines, 1 file, 12 ESLint violations
 * Refactored: ~980 lines, 6 files, 0 ESLint violations
 * Organization: +66% lines, -100% violations, +100% maintainability
 */

import { logger } from '@/utils/logger';

import { CachedUnifiedParser } from '../CachedUnifiedParser';

import {
  benchmarkSimpleParsing,
  benchmarkTableExtraction,
  benchmarkImageExtraction,
  benchmarkFullExtraction,
  benchmarkBatchOperations,
  benchmarkCachePerformance,
  warmupParsers
} from './benchmark-operations';
import { generateSummary, printResults } from './results-analyzer';

import type { BenchmarkOptions, BenchmarkResult, BenchmarkSuite } from './types';

// ============================================================================
// Main Benchmark Class
// ============================================================================

/**
 * Performance benchmark coordinator
 *
 * Orchestrates benchmark suite execution across multiple test scenarios.
 * Delegates actual benchmark operations to specialized modules.
 */
export class PerformanceBenchmark {
  private unifiedParser: CachedUnifiedParser;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.unifiedParser = new CachedUnifiedParser();
  }

  /**
   * Run complete benchmark suite
   *
   * @param options - Benchmark configuration options
   * @returns Complete benchmark results with summary statistics
   */
  async runBenchmark(options: BenchmarkOptions = {}): Promise<BenchmarkSuite> {
    const {
      iterations = 100,
      warmup = true,
      verbose = false
    } = options;

    logger.info('🚀 Starting Performance Benchmark...\n');
    logger.info(`Configuration:`);
    logger.info(`  - Iterations: ${iterations}`);
    logger.info(`  - Warmup: ${warmup}`);
    logger.info(`  - Verbose: ${verbose}\n`);

    // Warmup if requested
    if (warmup) {
      await warmupParsers(this.unifiedParser);
    }

    // Run all benchmarks
    logger.info('\n📊 Running benchmarks...\n');

    this.results.push(
      await benchmarkSimpleParsing(this.unifiedParser, iterations, verbose)
    );

    this.results.push(
      await benchmarkTableExtraction(this.unifiedParser, iterations, verbose)
    );

    this.results.push(
      await benchmarkImageExtraction(this.unifiedParser, iterations, verbose)
    );

    this.results.push(
      await benchmarkFullExtraction(this.unifiedParser, iterations, verbose)
    );

    this.results.push(
      await benchmarkBatchOperations(this.unifiedParser, iterations / 10, verbose)
    );

    await benchmarkCachePerformance(this.unifiedParser, iterations, verbose);

    // Generate and print results
    const summary = generateSummary(this.results);
    printResults(summary);

    return summary;
  }
}

// ============================================================================
// Export and Run
// ============================================================================

/**
 * Run benchmark suite with optional configuration
 *
 * @param options - Benchmark configuration
 * @returns Complete benchmark results
 */
export async function runBenchmark(options?: BenchmarkOptions): Promise<BenchmarkSuite> {
  const benchmark = new PerformanceBenchmark();
  return benchmark.runBenchmark(options);
}

// Run if executed directly
// eslint-disable-next-line no-undef
if (require.main === module) {
  runBenchmark({
    iterations: 100,
    warmup: true,
    verbose: true
  }).then(() => {
    logger.info('Benchmark complete!');
    process.exit(0);
  }).catch((error: unknown) => {
    logger.error('Benchmark failed:', error);
    process.exit(1);
  });
}
