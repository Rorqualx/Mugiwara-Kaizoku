/**
 * Prowlarr Search Quality Testing Script
 *
 * This script tests different Prowlarr search strategies to identify
 * the optimal approach for finding high-quality manga downloads.
 *
 * Usage:
 *   pnpm tsx scripts/test-prowlarr-search.ts
 */

import { ProwlarrMangaSearch } from '../src/server/services/prowlarr/mangaSearch';
import { logger } from '../src/utils/logger';
import { isSuccess, isError } from '../src/utils/async-result';

// Test manga titles (mix of popular and niche titles)
const TEST_QUERIES = [
  'Fire Force',           // Example from commit history
  'One Piece',            // Long-running popular series
  'Chainsaw Man',         // Recent popular series
  'Vinland Saga',         // Critically acclaimed
  'Spy x Family'          // Recent mainstream hit
];

interface SearchMetrics {
  testName: string;
  query: string;
  resultCount: number;
  uniqueGuids: number;
  torrentCount: number;
  usenetCount: number;
  avgSeeders: number;
  avgSize: number;
  topRelevanceScore: number;
  avgRelevanceScore: number;
  completePackCount: number;
  categoryBreakdown: Record<number, number>;
  executionTimeMs: number;
}

interface TestScenario {
  name: string;
  description: string;
  options: {
    categories?: number[];
    limit?: number;
    maxage?: number;
    minsize?: number;
    maxsize?: number;
  };
}

// Define test scenarios
const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Baseline (Current Implementation)',
    description: 'Category 7000 (Books), 100 limit, 365 days, 10MB min',
    options: {
      categories: [7000],
      limit: 100,
      maxage: 365,
      minsize: 10485760  // 10MB
    }
  },
  {
    name: 'Specific Category (Comics/Manga)',
    description: 'Category 7030 (Comics) for manga-specific results',
    options: {
      categories: [7030],
      limit: 100,
      maxage: 365,
      minsize: 10485760
    }
  },
  {
    name: 'Multiple Categories',
    description: 'Categories 7030 (Comics) + 7020 (eBooks)',
    options: {
      categories: [7030, 7020],
      limit: 100,
      maxage: 365,
      minsize: 10485760
    }
  },
  {
    name: 'No Age Filter',
    description: 'Remove age filter for classic manga',
    options: {
      categories: [7000],
      limit: 100,
      // No maxage - get all results regardless of publish date
      minsize: 10485760
    }
  },
  {
    name: 'High Quality Filter',
    description: 'Larger minimum size for higher quality',
    options: {
      categories: [7000],
      limit: 100,
      maxage: 365,
      minsize: 52428800  // 50MB minimum
    }
  },
  {
    name: 'Extended Results',
    description: 'Increase result limit to 200',
    options: {
      categories: [7000],
      limit: 200,
      maxage: 365,
      minsize: 10485760
    }
  },
  {
    name: 'Recent Releases Only',
    description: 'Only results from last 180 days',
    options: {
      categories: [7000],
      limit: 100,
      maxage: 180,
      minsize: 10485760
    }
  }
];

/**
 * Calculate metrics from search results
 */
function calculateMetrics(
  testName: string,
  query: string,
  results: any[],
  executionTimeMs: number
): SearchMetrics {
  const uniqueGuids = new Set(results.map(r => r.guid)).size;

  const torrents = results.filter(r => r.protocol?.toLowerCase() === 'torrent');
  const usenet = results.filter(r => r.protocol?.toLowerCase() === 'usenet' || r.protocol?.toLowerCase() === 'nzb');

  const avgSeeders = torrents.length > 0
    ? torrents.reduce((sum, r) => sum + (r.seeders || 0), 0) / torrents.length
    : 0;

  const avgSize = results.length > 0
    ? results.reduce((sum, r) => sum + (r.size || 0), 0) / results.length
    : 0;

  const relevanceScores = results
    .map(r => r.relevanceScore || 0)
    .filter(score => score > 0);

  const topRelevanceScore = relevanceScores.length > 0
    ? Math.max(...relevanceScores)
    : 0;

  const avgRelevanceScore = relevanceScores.length > 0
    ? relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length
    : 0;

  const completePackCount = results.filter(r =>
    /complete|full|all|collection/i.test(r.title || '')
  ).length;

  // Category breakdown
  const categoryBreakdown: Record<number, number> = {};
  results.forEach(r => {
    if (r.categories && Array.isArray(r.categories)) {
      r.categories.forEach((cat: number) => {
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });
    }
  });

  return {
    testName,
    query,
    resultCount: results.length,
    uniqueGuids,
    torrentCount: torrents.length,
    usenetCount: usenet.length,
    avgSeeders: Math.round(avgSeeders * 10) / 10,
    avgSize: Math.round(avgSize),
    topRelevanceScore: Math.round(topRelevanceScore),
    avgRelevanceScore: Math.round(avgRelevanceScore * 10) / 10,
    completePackCount,
    categoryBreakdown,
    executionTimeMs
  };
}

/**
 * Run a single test scenario for a query
 */
async function runTest(
  query: string,
  scenario: TestScenario
): Promise<SearchMetrics | null> {
  const startTime = Date.now();

  logger.info(`\n${'='.repeat(80)}`);
  logger.info(`Running: ${scenario.name}`);
  logger.info(`Query: "${query}"`);
  logger.info(`Options:`, scenario.options);
  logger.info('='.repeat(80));

  try {
    const prowlarrSearch = new ProwlarrMangaSearch();
    const results = await prowlarrSearch.searchManga(query, scenario.options);

    const executionTimeMs = Date.now() - startTime;

    if (isError(results)) {
      logger.error(`Test failed: ${results.error.message}`);
      return null;
    }

    if (isSuccess(results)) {
      const metrics = calculateMetrics(
        scenario.name,
        query,
        results.data,
        executionTimeMs
      );

      // Log summary
      logger.info(`\nResults Summary:`);
      logger.info(`  Total Results: ${metrics.resultCount} (${metrics.uniqueGuids} unique)`);
      logger.info(`  Protocol Distribution: ${metrics.torrentCount} torrents, ${metrics.usenetCount} usenet`);
      logger.info(`  Avg Seeders: ${metrics.avgSeeders}`);
      logger.info(`  Avg Size: ${(metrics.avgSize / (1024 * 1024)).toFixed(1)} MB`);
      logger.info(`  Relevance: Top=${metrics.topRelevanceScore}, Avg=${metrics.avgRelevanceScore}`);
      logger.info(`  Complete Packs: ${metrics.completePackCount}`);
      logger.info(`  Execution Time: ${metrics.executionTimeMs}ms`);
      logger.info(`  Categories:`, Object.entries(metrics.categoryBreakdown)
        .map(([cat, count]) => `${cat}=${count}`)
        .join(', '));

      // Show top 5 results
      logger.info(`\nTop 5 Results:`);
      results.data.slice(0, 5).forEach((result, i) => {
        logger.info(`  ${i + 1}. [${result.protocol?.toUpperCase()}] ${result.title}`);
        logger.info(`     Indexer: ${result.indexerName}, Size: ${(result.size / (1024 * 1024)).toFixed(1)}MB, ` +
          `Seeders: ${result.seeders || 'N/A'}, Relevance: ${result.relevanceScore || 0}`);
      });

      return metrics;
    }

    return null;
  } catch (error) {
    logger.error(`Test execution error:`, error);
    return null;
  }
}

/**
 * Generate comparison matrix from all test results
 */
function generateComparisonMatrix(allMetrics: SearchMetrics[]): void {
  logger.info(`\n${'='.repeat(120)}`);
  logger.info('COMPARISON MATRIX');
  logger.info('='.repeat(120));

  // Group by query
  const byQuery = allMetrics.reduce((acc, metric) => {
    if (!acc[metric.query]) {
      acc[metric.query] = [];
    }
    acc[metric.query].push(metric);
    return acc;
  }, {} as Record<string, SearchMetrics[]>);

  // For each query, compare scenarios
  Object.entries(byQuery).forEach(([query, metrics]) => {
    logger.info(`\n## Query: "${query}"\n`);

    // Table header
    const header = `| ${'Test Scenario'.padEnd(30)} | ${'Results'.padStart(7)} | ${'Unique'.padStart(6)} | ${'Torrents'.padStart(8)} | ${'Usenet'.padStart(6)} | ${'Avg Seeders'.padStart(11)} | ${'Complete'.padStart(8)} | ${'Top Score'.padStart(9)} | ${'Time (ms)'.padStart(9)} |`;
    const separator = `|${'-'.repeat(32)}|${'-'.repeat(9)}|${'-'.repeat(8)}|${'-'.repeat(10)}|${'-'.repeat(8)}|${'-'.repeat(13)}|${'-'.repeat(10)}|${'-'.repeat(11)}|${'-'.repeat(11)}|`;

    logger.info(header);
    logger.info(separator);

    // Table rows
    metrics.forEach(m => {
      const row = `| ${m.testName.padEnd(30)} | ${String(m.resultCount).padStart(7)} | ${String(m.uniqueGuids).padStart(6)} | ${String(m.torrentCount).padStart(8)} | ${String(m.usenetCount).padStart(6)} | ${String(m.avgSeeders).padStart(11)} | ${String(m.completePackCount).padStart(8)} | ${String(m.topRelevanceScore).padStart(9)} | ${String(m.executionTimeMs).padStart(9)} |`;
      logger.info(row);
    });

    // Find best scenario for each metric
    const bestResults = metrics.reduce((best, current) =>
      current.resultCount > best.resultCount ? current : best
    );
    const bestRelevance = metrics.reduce((best, current) =>
      current.topRelevanceScore > best.topRelevanceScore ? current : best
    );
    const bestComplete = metrics.reduce((best, current) =>
      current.completePackCount > best.completePackCount ? current : best
    );

    logger.info(`\n### Best Scenarios for "${query}":`);
    logger.info(`  - Most Results: ${bestResults.testName} (${bestResults.resultCount} results)`);
    logger.info(`  - Best Relevance: ${bestRelevance.testName} (score: ${bestRelevance.topRelevanceScore})`);
    logger.info(`  - Most Complete Packs: ${bestComplete.testName} (${bestComplete.completePackCount} packs)`);
  });

  // Overall recommendations
  logger.info(`\n${'='.repeat(120)}`);
  logger.info('OVERALL RECOMMENDATIONS');
  logger.info('='.repeat(120));

  // Calculate averages across all queries for each scenario
  const scenarioAverages = TEST_SCENARIOS.map(scenario => {
    const scenarioMetrics = allMetrics.filter(m => m.testName === scenario.name);
    const avgResults = scenarioMetrics.reduce((sum, m) => sum + m.resultCount, 0) / scenarioMetrics.length;
    const avgRelevance = scenarioMetrics.reduce((sum, m) => sum + m.topRelevanceScore, 0) / scenarioMetrics.length;
    const avgComplete = scenarioMetrics.reduce((sum, m) => sum + m.completePackCount, 0) / scenarioMetrics.length;
    const avgSeeders = scenarioMetrics.reduce((sum, m) => sum + m.avgSeeders, 0) / scenarioMetrics.length;

    return {
      name: scenario.name,
      avgResults: Math.round(avgResults * 10) / 10,
      avgRelevance: Math.round(avgRelevance * 10) / 10,
      avgComplete: Math.round(avgComplete * 10) / 10,
      avgSeeders: Math.round(avgSeeders * 10) / 10
    };
  });

  logger.info(`\n### Average Performance Across All Test Queries:\n`);
  scenarioAverages.forEach(avg => {
    logger.info(`**${avg.name}**:`);
    logger.info(`  - Avg Results: ${avg.avgResults}`);
    logger.info(`  - Avg Top Relevance: ${avg.avgRelevance}`);
    logger.info(`  - Avg Complete Packs: ${avg.avgComplete}`);
    logger.info(`  - Avg Seeders: ${avg.avgSeeders}`);
    logger.info('');
  });

  // Determine best overall scenario
  const bestOverall = scenarioAverages.reduce((best, current) => {
    // Score = weighted combination of metrics
    const currentScore = (current.avgResults * 0.3) + (current.avgRelevance * 0.4) + (current.avgComplete * 0.2) + (current.avgSeeders * 0.1);
    const bestScore = (best.avgResults * 0.3) + (best.avgRelevance * 0.4) + (best.avgComplete * 0.2) + (best.avgSeeders * 0.1);
    return currentScore > bestScore ? current : best;
  });

  logger.info(`### 🏆 Recommended Configuration: **${bestOverall.name}**`);
  logger.info(`This scenario provides the best balance of result quantity, relevance, and quality.`);
}

/**
 * Main test runner
 */
async function main() {
  logger.info('='.repeat(120));
  logger.info('PROWLARR SEARCH QUALITY TEST SUITE');
  logger.info('='.repeat(120));
  logger.info(`Testing ${TEST_SCENARIOS.length} scenarios across ${TEST_QUERIES.length} queries (${TEST_SCENARIOS.length * TEST_QUERIES.length} total tests)`);
  logger.info('='.repeat(120));

  const allMetrics: SearchMetrics[] = [];

  // Run all tests
  for (const query of TEST_QUERIES) {
    for (const scenario of TEST_SCENARIOS) {
      const metrics = await runTest(query, scenario);
      if (metrics) {
        allMetrics.push(metrics);
      }

      // Small delay to avoid overwhelming Prowlarr
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Generate comparison matrix
  if (allMetrics.length > 0) {
    generateComparisonMatrix(allMetrics);

    // Export results to JSON for further analysis
    const fs = await import('fs');
    const outputPath = './prowlarr-search-test-results.json';
    fs.writeFileSync(outputPath, JSON.stringify({
      testDate: new Date().toISOString(),
      totalTests: allMetrics.length,
      scenarios: TEST_SCENARIOS,
      queries: TEST_QUERIES,
      results: allMetrics
    }, null, 2));

    logger.info(`\n✅ Test results saved to: ${outputPath}`);
  } else {
    logger.error('No test results collected. Check Prowlarr configuration and connectivity.');
  }
}

// Run the tests
main().catch(error => {
  logger.error('Test suite failed:', error);
  process.exit(1);
});
