/**
 * ComicVine ID Discovery using Enhanced Provider Matcher
 *
 * This script leverages the existing ProviderMatcher infrastructure to discover
 * correct ComicVine volume IDs for the test corpus. It uses:
 * - Title variants (subtitles, special characters, publisher patterns)
 * - Alternative titles (English, Romaji, Native)
 * - Levenshtein distance similarity scoring
 * - Publisher-aware matching (filters by expected publisher)
 *
 * Metrics tracked:
 * - Discovery success rate (% of titles with matches)
 * - Average confidence score
 * - Publisher match accuracy
 * - Failed titles (needs manual review)
 */

// Set to a small number for testing, then increase to process full corpus
// Set to 0 to process all 537 titles (takes ~30-40 minutes due to rate limiting)
const SAMPLE_SIZE = 20;

import { comicvineService } from '@/server/services/comicvine/service';
import { EnhancedProviderMatcher } from './enhanced-provider-matcher';
import { logger } from '@/utils/logger';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';
import { COMICVINE_TEST_CORPUS } from './test-comicvine-corpus';

interface DiscoveryResult {
  title: string;
  anilistSearch: string;
  expectedPublisher?: string;
  expectedLanguage?: string;
  currentComicvineId?: string;

  // Discovery results
  discoveredId?: string;
  discoveredTitle?: string;
  discoveredPublisher?: string;
  confidence?: number;
  success: boolean;
  reason?: string;

  // Publisher match info
  publisherMatch?: boolean;
}

interface DiscoveryMetrics {
  total: number;
  successful: number;
  failed: number;
  successRate: number;

  // Confidence metrics
  avgConfidence: number;
  highConfidence: number; // >= 0.8
  mediumConfidence: number; // 0.5 - 0.8
  lowConfidence: number; // < 0.5

  // Publisher metrics
  publisherMatches: number;
  publisherMismatch: number;
  publisherUnknown: number;

  // Failed titles
  failedTitles: string[];

  // ID changes
  idsChanged: number;
  idsUnchanged: number;
}

/**
 * Publisher name normalization for matching
 * Handles different publisher name formats across providers
 */
function normalizePublisher(publisher: string): string {
  return publisher
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^the\s+/i, '')
    .replace(/\s+(comics|publishing|manga|media)$/i, '');
}

/**
 * Check if two publisher names match
 */
function publishersMatch(pub1: string | undefined, pub2: string | undefined): boolean {
  if (!pub1 || !pub2) return false;
  return normalizePublisher(pub1) === normalizePublisher(pub2);
}

/**
 * Discover ComicVine ID for a single manga
 */
async function discoverId(
  manga: typeof COMICVINE_TEST_CORPUS[0],
  matcher: EnhancedProviderMatcher
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    title: manga.title,
    anilistSearch: manga.anilistSearch,
    expectedPublisher: manga.expectedPublisher,
    expectedLanguage: manga.expectedLanguage,
    currentComicvineId: manga.comicvineUrl?.match(/4050-(\d+)/)?.[1],
    success: false,
  };

  try {
    logger.info(`\nSearching for: ${manga.anilistSearch}`);

    // Skip if marked for skipping
    if (manga.skipComicVine) {
      result.reason = 'Skipped (skipComicVine=true)';
      return result;
    }

    // Use EnhancedProviderMatcher to find match with confidence score
    const matchResult = await matcher.findMatchWithScore(manga.anilistSearch, 'comicvine');

    if (!matchResult.id) {
      result.reason = matchResult.title
        ? `No match found above threshold (best: "${matchResult.title}" score: ${matchResult.score.toFixed(2)})`
        : 'No match found below threshold';
      return result;
    }

    // Fetch volume details to get publisher info
    const volumeInfo = await comicvineService.getCompleteVolumeInfo(matchResult.id);

    result.discoveredId = matchResult.id;
    result.discoveredTitle = volumeInfo.name || 'Unknown';
    result.discoveredPublisher = typeof volumeInfo.publisher === 'string'
      ? volumeInfo.publisher
      : volumeInfo.publisher?.name || 'Unknown';

    // Check publisher match
    result.publisherMatch = manga.expectedPublisher
      ? publishersMatch(result.discoveredPublisher, manga.expectedPublisher)
      : undefined;

    // Use actual confidence score from matcher
    result.confidence = matchResult.score;
    result.success = true;

    logger.info(`  ✓ Found: ${result.discoveredTitle}`);
    logger.info(`    ID: ${comicvineId}`);
    logger.info(`    Publisher: ${result.discoveredPublisher}`);
    if (result.publisherMatch !== undefined) {
      logger.info(`    Publisher Match: ${result.publisherMatch ? '✓' : '✗'}`);
    }

    // Rate limiting - ComicVine free tier is 200 requests/hour
    await new Promise(resolve => setTimeout(resolve, 3000));

  } catch (error) {
    result.reason = error instanceof Error ? error.message : String(error);
    logger.error(`  ✗ Error: ${result.reason}`);
  }

  return result;
}

/**
 * Process all manga in corpus
 */
async function discoverAllIds(): Promise<DiscoveryResult[]> {
  logger.info('=== ComicVine ID Discovery using EnhancedProviderMatcher ===');

  // Initialize the provider registry
  searchProviderRegistry.initialize();

  const corpusToProcess = SAMPLE_SIZE > 0
    ? COMICVINE_TEST_CORPUS.slice(0, SAMPLE_SIZE)
    : COMICVINE_TEST_CORPUS;
  logger.info(`Processing ${corpusToProcess.length} manga titles (SAMPLE_SIZE=${SAMPLE_SIZE})\n`);

  // Initialize ComicVine service
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    throw new Error('Failed to initialize ComicVine service');
  }

  // Create enhanced provider matcher with lenient threshold
  const matcher = new EnhancedProviderMatcher({ minScore: 0.3 });

  const results: DiscoveryResult[] = [];

  for (const manga of corpusToProcess) {
    const result = await discoverId(manga, matcher);
    results.push(result);
  }

  return results;
}

/**
 * Calculate metrics from discovery results
 */
function calculateMetrics(results: DiscoveryResult[]): DiscoveryMetrics {
  const successful = results.filter(r => r.success);

  const publisherMatches = successful.filter(r => r.publisherMatch === true).length;
  const publisherMismatches = successful.filter(r => r.publisherMatch === false).length;
  const publisherUnknown = successful.filter(r => r.publisherMatch === undefined).length;

  const idsChanged = successful.filter(r =>
    r.currentComicvineId && r.discoveredId !== r.currentComicvineId
  ).length;
  const idsUnchanged = successful.filter(r =>
    r.currentComicvineId && r.discoveredId === r.currentComicvineId
  ).length;

  const confidences = successful
    .map(r => r.confidence ?? 0)
    .filter(c => c > 0);

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;

  return {
    total: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    successRate: (successful.length / results.length) * 100,

    avgConfidence,
    highConfidence: confidences.filter(c => c >= 0.8).length,
    mediumConfidence: confidences.filter(c => c >= 0.5 && c < 0.8).length,
    lowConfidence: confidences.filter(c => c < 0.5).length,

    publisherMatches,
    publisherMismatch: publisherMismatches,
    publisherUnknown,

    failedTitles: results
      .filter(r => !r.success)
      .map(r => `${r.anilistSearch}: ${r.reason}`),

    idsChanged,
    idsUnchanged,
  };
}

/**
 * Print discovery results summary
 */
function printSummary(metrics: DiscoveryMetrics): void {
  logger.info('\n=== Discovery Summary ===');
  logger.info(`Total processed: ${metrics.total}`);
  logger.info(`Successful: ${metrics.successful} (${metrics.successRate.toFixed(1)}%)`);
  logger.info(`Failed: ${metrics.failed}`);

  logger.info('\n=== Confidence Distribution ===');
  logger.info(`High (≥0.8): ${metrics.highConfidence}`);
  logger.info(`Medium (0.5-0.8): ${metrics.mediumConfidence}`);
  logger.info(`Low (<0.5): ${metrics.lowConfidence}`);
  logger.info(`Average: ${metrics.avgConfidence.toFixed(2)}`);

  logger.info('\n=== Publisher Match Accuracy ===');
  logger.info(`Matched: ${metrics.publisherMatches}`);
  logger.info(`Mismatched: ${metrics.publisherMismatch}`);
  logger.info(`Unknown: ${metrics.publisherUnknown}`);

  logger.info('\n=== ID Changes ===');
  logger.info(`Changed: ${metrics.idsChanged}`);
  logger.info(`Unchanged: ${metrics.idsUnchanged}`);

  if (metrics.failedTitles.length > 0) {
    logger.info('\n=== Failed Titles ===');
    for (const title of metrics.failedTitles) {
      logger.info(`  - ${title}`);
    }
  }
}

/**
 * Generate TypeScript code to update corpus file
 */
function generateCorpusUpdate(results: DiscoveryResult[]): string {
  const updates: string[] = [];

  for (const result of results) {
    if (result.success && result.discoveredId) {
      const url = `https://comicvine.gamespot.com/${result.discoveredTitle.toLowerCase().replace(/\s+/g, '-')}/4050-${result.discoveredId}/`;

      updates.push(`  {
    title: '${result.title.replace(/'/g, "\\'")}',
    anilistSearch: '${result.anilistSearch.replace(/'/g, "\\'")}',
    expectedLanguage: '${result.expectedLanguage || 'en'}',
    expectedPublisher: '${result.expectedPublisher || 'Unknown'}',
    comicvineUrl: '${url}',
    ${result.overrideChapters ? `overrideChapters: ${result.overrideChapters},` : ''}
  },`);
    }
  }

  return `// Updated corpus entries with discovered ComicVine IDs
// Total: ${updates.length} entries

export const UPDATED_CORPUS = [
${updates.join('\n')}
];
`;
}

/**
 * Main function
 */
async function main() {
  try {
    const results = await discoverAllIds();
    const metrics = calculateMetrics(results);

    printSummary(metrics);

    // Save detailed results
    const resultsPath = 'docs/research/comicvine-accuracy/DISCOVERY_RESULTS.json';
    await Bun.write(
      resultsPath,
      JSON.stringify({ results, metrics }, null, 2)
    );
    logger.info(`\nDetailed results saved to: ${resultsPath}`);

    // Generate corpus update code
    const updateCode = generateCorpusUpdate(results);
    const updatePath = 'docs/research/comicvine-accuracy/CORPUS_UPDATE.ts';
    await Bun.write(updatePath, updateCode);
    logger.info(`Corpus update code saved to: ${updatePath}`);

  } catch (error) {
    logger.error('Discovery failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main()
    .catch(logger.error)
    .finally(() => process.exit(0));
}
