/**
 * Benchmark Operations
 *
 * Individual benchmark test implementations for parser performance comparison.
 * Each benchmark measures old vs unified parser performance with statistical analysis.
 *
 * Note: Sequential await operations in timing loops are intentional and required
 * for accurate performance measurements. ESLint warnings are suppressed with justification.
 *
 * Extracted from: PerformanceBenchmark.ts (lines 109-282, 301-311)
 *
 * @module server/parsers/benchmark/benchmark-operations
 */


import { performance } from 'perf_hooks';

import { logger } from '@/utils/logger';

import {
  simulateOldParser,
  simulateOldTableParser,
  simulateOldImageParser,
  simulateOldFullParser
} from './old-parser-simulators';
import { recordResult } from './results-analyzer';
import {
  generateSimpleHTML,
  generateTableHTML,
  generateImageHTML,
  generateFullHTML
} from './test-data-generators';

import type { BenchmarkResult } from './types';
import type { CachedUnifiedParser } from '../CachedUnifiedParser';


/**
 * Benchmark simple HTML parsing performance
 *
 * Compares old parser vs unified parser for basic HTML parsing operations.
 * Uses sequential execution to ensure accurate timing measurements.
 *
 * @param unifiedParser - The unified parser instance to benchmark
 * @param iterations - Number of iterations to run for statistical accuracy
 * @param verbose - Whether to log detailed progress information
 * @returns Benchmark result with timing and memory statistics
 */
export async function benchmarkSimpleParsing(
  unifiedParser: CachedUnifiedParser,
  iterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  const testHtml = generateSimpleHTML();
  logger.info('1️⃣ Simple HTML Parsing...');

  // Old parser timing (MUST be sequential for accurate measurements)
  const oldTimes: number[] = [];
  const oldMemStart = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await simulateOldParser(testHtml);
    const end = performance.now();
    oldTimes.push(end - start);
  }

  const oldMemEnd = process.memoryUsage().heapUsed;

  // Unified parser timing (MUST be sequential for accurate measurements)
  const unifiedTimes: number[] = [];
  const unifiedMemStart = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await unifiedParser.parseHTML(testHtml);
    const end = performance.now();
    unifiedTimes.push(end - start);
  }

  const unifiedMemEnd = process.memoryUsage().heapUsed;

  const result = recordResult(
    'Simple HTML Parsing',
    oldTimes,
    unifiedTimes,
    oldMemEnd - oldMemStart,
    unifiedMemEnd - unifiedMemStart
  );

  if (verbose) {
    logger.info(`  ✅ Completed ${iterations} iterations`);
    logger.info(`  📈 Improvement: ${result.improvement.percentage.toFixed(1)}%\n`);
  }

  return result;
}

/**
 * Benchmark table extraction performance
 *
 * Compares old table parser vs unified parser for table extraction.
 * Tests with large tables (100 rows) to measure complex DOM traversal.
 *
 * @param unifiedParser - The unified parser instance to benchmark
 * @param iterations - Number of iterations to run for statistical accuracy
 * @param verbose - Whether to log detailed progress information
 * @returns Benchmark result with timing statistics
 */
export async function benchmarkTableExtraction(
  unifiedParser: CachedUnifiedParser,
  iterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  const testHtml = generateTableHTML();
  logger.info('2️⃣ Table Extraction...');

  const oldTimes: number[] = [];
  const unifiedTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Old parser timing
    const oldStart = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await simulateOldTableParser(testHtml);
    oldTimes.push(performance.now() - oldStart);

    // Unified parser timing
    const unifiedStart = performance.now();
    const _result = unifiedParser.parseHTML(testHtml, {
      extractTables: true,
      extractImages: false,
      extractMetadata: false
    });
    unifiedTimes.push(performance.now() - unifiedStart);
  }

  const result = recordResult('Table Extraction', oldTimes, unifiedTimes, 0, 0);

  if (verbose) {
    logger.info(`  ✅ Completed ${iterations} iterations`);
    logger.info(`  📈 Improvement: ${result.improvement.percentage.toFixed(1)}%\n`);
  }

  return result;
}

/**
 * Benchmark image extraction performance
 *
 * Compares old image parser vs unified parser for image extraction.
 * Tests with 50 images including src and data-src attributes.
 *
 * @param unifiedParser - The unified parser instance to benchmark
 * @param iterations - Number of iterations to run for statistical accuracy
 * @param verbose - Whether to log detailed progress information
 * @returns Benchmark result with timing statistics
 */
export async function benchmarkImageExtraction(
  unifiedParser: CachedUnifiedParser,
  iterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  const testHtml = generateImageHTML();
  logger.info('3️⃣ Image Extraction...');

  const oldTimes: number[] = [];
  const unifiedTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Old parser timing
    const oldStart = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await simulateOldImageParser(testHtml);
    oldTimes.push(performance.now() - oldStart);

    // Unified parser timing
    const unifiedStart = performance.now();
    const _result = unifiedParser.parseHTML(testHtml, {
      extractTables: false,
      extractImages: true,
      extractMetadata: false
    });
    unifiedTimes.push(performance.now() - unifiedStart);
  }

  const result = recordResult('Image Extraction', oldTimes, unifiedTimes, 0, 0);

  if (verbose) {
    logger.info(`  ✅ Completed ${iterations} iterations`);
    logger.info(`  📈 Improvement: ${result.improvement.percentage.toFixed(1)}%\n`);
  }

  return result;
}

/**
 * Benchmark full metadata extraction performance
 *
 * Compares old full parser vs unified parser for complete metadata extraction.
 * Tests comprehensive parsing including infoboxes, tables, and images.
 *
 * @param unifiedParser - The unified parser instance to benchmark
 * @param iterations - Number of iterations to run for statistical accuracy
 * @param verbose - Whether to log detailed progress information
 * @returns Benchmark result with timing and memory statistics
 */
export async function benchmarkFullExtraction(
  unifiedParser: CachedUnifiedParser,
  iterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  const testHtml = generateFullHTML();
  logger.info('4️⃣ Full Metadata Extraction...');

  const oldTimes: number[] = [];
  const unifiedTimes: number[] = [];

  // Old parser timing with memory tracking
  const oldMemStart = process.memoryUsage().heapUsed;
  for (let i = 0; i < iterations; i++) {
    const oldStart = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await simulateOldFullParser(testHtml);
    oldTimes.push(performance.now() - oldStart);
  }
  const oldMemEnd = process.memoryUsage().heapUsed;

  // Unified parser timing with memory tracking
  const unifiedMemStart = process.memoryUsage().heapUsed;
  for (let i = 0; i < iterations; i++) {
    const unifiedStart = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await unifiedParser.parseUnified(testHtml);
    unifiedTimes.push(performance.now() - unifiedStart);
  }
  const unifiedMemEnd = process.memoryUsage().heapUsed;

  const result = recordResult(
    'Full Metadata Extraction',
    oldTimes,
    unifiedTimes,
    oldMemEnd - oldMemStart,
    unifiedMemEnd - unifiedMemStart
  );

  if (verbose) {
    logger.info(`  ✅ Completed ${iterations} iterations`);
    logger.info(`  📈 Improvement: ${result.improvement.percentage.toFixed(1)}%\n`);
  }

  return result;
}

/**
 * Benchmark batch operations performance
 *
 * Compares old sequential processing vs unified batch processing.
 * Tests with 10 items to measure parallelization benefits.
 *
 * @param unifiedParser - The unified parser instance to benchmark
 * @param iterations - Number of iterations to run for statistical accuracy
 * @param verbose - Whether to log detailed progress information
 * @returns Benchmark result with timing statistics
 */
export async function benchmarkBatchOperations(
  unifiedParser: CachedUnifiedParser,
  iterations: number,
  verbose: boolean
): Promise<BenchmarkResult> {
  logger.info('5️⃣ Batch Operations...');

  const batchSize = 10;
  const testUrls = Array.from({ length: batchSize }, (_, i) =>
    `https://example.fandom.com/wiki/Page_${i}`
  );

  const oldTimes: number[] = [];
  const unifiedTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // Old parser - sequential processing (MUST be sequential for timing)
    const oldStart = performance.now();
    for (const _url of testUrls) {
      // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements of old sequential approach
      await simulateOldParser(generateSimpleHTML());
    }
    oldTimes.push(performance.now() - oldStart);

    // Unified parser - batch processing
    const unifiedStart = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate timing measurements
    await unifiedParser.parseBatch(
      testUrls.map(_url => ({ input: generateSimpleHTML(), options: {} }))
    );
    unifiedTimes.push(performance.now() - unifiedStart);
  }

  const result = recordResult('Batch Operations (10 items)', oldTimes, unifiedTimes, 0, 0);

  if (verbose) {
    logger.info(`  ✅ Completed ${iterations} iterations`);
    logger.info(`  📈 Improvement: ${result.improvement.percentage.toFixed(1)}%\n`);
  }

  return result;
}

/**
 * Benchmark cache performance
 *
 * Measures cache hit vs cache miss performance for the unified parser.
 * Tests cache speedup factor with repeated parsing operations.
 *
 * @param unifiedParser - The unified parser instance to benchmark
 * @param iterations - Number of iterations to run for cache hit timing
 * @param _verbose - Whether to log detailed progress information (unused, kept for consistency)
 * @returns Promise that resolves when benchmark is complete
 */
export async function benchmarkCachePerformance(
  unifiedParser: CachedUnifiedParser,
  iterations: number,
  _verbose: boolean
): Promise<void> {
  logger.info('6️⃣ Cache Performance...');

  const testHtml = generateFullHTML();
  const _cacheKey = 'benchmark-test';

  // First parse (cache miss)
  const missStart = performance.now();
  await unifiedParser.parseUnified(testHtml, {
    useCache: true,
    forceRefresh: true
  });
  const missTime = performance.now() - missStart;

  // Subsequent parses (cache hits) - MUST be sequential for timing
  const hitTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required for accurate cache timing measurements
    await unifiedParser.parseUnified(testHtml, { useCache: true });
    hitTimes.push(performance.now() - start);
  }

  const avgHitTime = hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length;
  const cacheSpeedup = missTime / avgHitTime;

  logger.info(`  ⚡ Cache speedup: ${cacheSpeedup.toFixed(1)}x`);
  logger.info(`  📊 Miss time: ${missTime.toFixed(2)}ms`);
  logger.info(`  📊 Avg hit time: ${avgHitTime.toFixed(2)}ms\n`);
}

/**
 * Warmup parsers before benchmarking
 *
 * Runs warmup iterations to ensure JIT compilation and stabilization.
 * Uses parallel execution since warmup timing doesn't matter.
 *
 * @param unifiedParser - The unified parser instance to warm up
 * @returns Promise that resolves when warmup is complete
 */
export async function warmupParsers(unifiedParser: CachedUnifiedParser): Promise<void> {
  const warmupHtml = generateSimpleHTML();

  logger.info('⏳ Warming up parsers...');

  // Warmup old parser - CAN be parallelized (timing doesn't matter)
  const oldWarmupPromises = Array.from({ length: 10 }, () =>
    simulateOldParser(warmupHtml)
  );
  await Promise.all(oldWarmupPromises);

  // Warmup unified parser - CAN be parallelized (timing doesn't matter)
  const unifiedWarmupPromises = Array.from({ length: 10 }, () =>
    unifiedParser.parseHTML(warmupHtml)
  );
  await Promise.all(unifiedWarmupPromises);
}
