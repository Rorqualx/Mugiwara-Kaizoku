/**
 * Batch Processor for URL Discovery
 *
 * Processes titles in configurable batches with progress tracking
 * and crash recovery support.
 *
 * @module url-discovery/batch-processor
 */

import { logger } from '../../src/utils/logger';

import type {
  CsvRow,
  DiscoveryResult,
  DiscoveryOptions,
  DiscoveryStats,
} from './csv/types';
import {
  createEmptyDiscoveryStats,
  hasValidValue,
  DOES_NOT_EXIST,
} from './csv/types';
import { discoverWikipedia } from './discover-wikipedia';
import { discoverFandom } from './discover-fandom';
import { discoverComicVine } from './discover-comicvine';

/**
 * Delay execution for a specified time.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log a discovery result.
 */
function logResult(result: DiscoveryResult, verbose: boolean): void {
  const wiki = result.wikipedia.url ? '✓' : result.wikipedia.error ? '✗' : '-';
  const fandom = result.fandom.url ? '✓' : result.fandom.error ? '✗' : '-';
  const cv = result.comicvine.id ? '✓' : result.comicvine.error ? '✗' : '-';

  logger.info(`[W:${wiki} F:${fandom} CV:${cv}] ${result.title}`, { durationMs: result.timing.total });

  if (verbose) {
    if (result.wikipedia.url) logger.debug('Wikipedia URL found', { url: result.wikipedia.url });
    if (result.fandom.url) logger.debug('Fandom URL found', { url: result.fandom.url });
    if (result.comicvine.id) logger.debug('ComicVine ID found', { id: result.comicvine.id });
  }
}

/**
 * Check if a row needs discovery for any source.
 */
function needsDiscovery(row: CsvRow, options: DiscoveryOptions): boolean {
  if (!options.onlyEmpty) {
    return true;
  }

  for (const source of options.sources) {
    if (source === 'wikipedia' && !hasValidValue(row.WikipediaURL)) return true;
    if (source === 'fandom' && !hasValidValue(row.FandomURL)) return true;
    if (source === 'comicvine' && !hasValidValue(row.ComicVineID)) return true;
  }

  return false;
}

/**
 * Run Wikipedia discovery and update result.
 */
async function runWikipediaDiscovery(title: string, result: DiscoveryResult): Promise<void> {
  const wikiResult = await discoverWikipedia(title);
  result.wikipedia = { url: wikiResult.url, error: wikiResult.error };
  result.timing.wikipedia = wikiResult.timing;
}

/**
 * Run Fandom discovery and update result.
 */
async function runFandomDiscovery(
  title: string,
  result: DiscoveryResult,
  domainLookup?: Map<string, string>
): Promise<void> {
  const fandomResult = await discoverFandom(title, domainLookup);
  result.fandom = {
    url: fandomResult.url,
    domain: fandomResult.domain ?? undefined,
    error: fandomResult.error,
  };
  result.timing.fandom = fandomResult.timing;
}

/**
 * Run ComicVine discovery and update result.
 */
async function runComicVineDiscovery(title: string, result: DiscoveryResult): Promise<void> {
  const cvResult = await discoverComicVine(title);
  result.comicvine = {
    id: cvResult.id,
    url: cvResult.url ?? undefined,
    error: cvResult.error,
  };
  result.timing.comicvine = cvResult.timing;
}

/**
 * Discover URLs for a single title.
 */
async function discoverUrlsForTitle(
  row: CsvRow,
  options: DiscoveryOptions,
  domainLookup?: Map<string, string>
): Promise<DiscoveryResult> {
  const start = Date.now();

  const result: DiscoveryResult = {
    title: row.Title,
    anilistId: row.AniListID,
    wikipedia: { url: null },
    fandom: { url: null },
    comicvine: { id: null },
    timing: { wikipedia: 0, fandom: 0, comicvine: 0, total: 0 },
  };

  const promises: Promise<void>[] = [];

  if (options.sources.includes('wikipedia') && !hasValidValue(row.WikipediaURL)) {
    promises.push(runWikipediaDiscovery(row.Title, result));
  }

  if (options.sources.includes('fandom') && !hasValidValue(row.FandomURL)) {
    promises.push(runFandomDiscovery(row.Title, result, domainLookup));
  }

  if (options.sources.includes('comicvine') && !hasValidValue(row.ComicVineID)) {
    promises.push(runComicVineDiscovery(row.Title, result));
  }

  await Promise.all(promises);

  result.timing.total = Date.now() - start;
  return result;
}

/**
 * Update a CSV row with discovery results.
 */
function updateRowWithResults(row: CsvRow, result: DiscoveryResult): CsvRow {
  const updated = { ...row };

  if (result.wikipedia.url) {
    updated.WikipediaURL = result.wikipedia.url;
  } else if (result.wikipedia.error === undefined && result.timing.wikipedia > 0) {
    updated.WikipediaURL = DOES_NOT_EXIST;
  }

  if (result.fandom.url) {
    updated.FandomURL = result.fandom.url;
  } else if (result.fandom.error === undefined && result.timing.fandom > 0) {
    updated.FandomURL = DOES_NOT_EXIST;
  }

  if (result.comicvine.id) {
    updated.ComicVineID = result.comicvine.id;
  } else if (result.comicvine.error === undefined && result.timing.comicvine > 0) {
    updated.ComicVineID = DOES_NOT_EXIST;
  }

  return updated;
}

/**
 * Update stats with a discovery result.
 */
function updateStats(stats: DiscoveryStats, result: DiscoveryResult): void {
  if (result.timing.wikipedia > 0) {
    stats.wikipedia.totalSearches++;
    if (result.wikipedia.url) {
      stats.wikipedia.found++;
    } else if (result.wikipedia.error) {
      stats.wikipedia.errors++;
      stats.errors.push({ title: result.title, source: 'wikipedia', error: result.wikipedia.error });
    } else {
      stats.wikipedia.notFound++;
    }
  }

  if (result.timing.fandom > 0) {
    stats.fandom.totalSearches++;
    if (result.fandom.url) {
      stats.fandom.found++;
    } else if (result.fandom.error) {
      stats.fandom.errors++;
      stats.errors.push({ title: result.title, source: 'fandom', error: result.fandom.error });
    } else {
      stats.fandom.notFound++;
    }
  }

  if (result.timing.comicvine > 0) {
    stats.comicvine.totalSearches++;
    if (result.comicvine.id) {
      stats.comicvine.found++;
    } else if (result.comicvine.error) {
      stats.comicvine.errors++;
      stats.errors.push({ title: result.title, source: 'comicvine', error: result.comicvine.error });
    } else {
      stats.comicvine.notFound++;
    }
  }
}

/**
 * Calculate average times for stats.
 */
function calculateAverageTimes(stats: DiscoveryStats, results: DiscoveryResult[]): void {
  const wikiTimes = results.filter(r => r.timing.wikipedia > 0).map(r => r.timing.wikipedia);
  const fandomTimes = results.filter(r => r.timing.fandom > 0).map(r => r.timing.fandom);
  const cvTimes = results.filter(r => r.timing.comicvine > 0).map(r => r.timing.comicvine);

  if (wikiTimes.length > 0) {
    stats.wikipedia.avgTimeMs = Math.round(wikiTimes.reduce((a, b) => a + b, 0) / wikiTimes.length);
  }
  if (fandomTimes.length > 0) {
    stats.fandom.avgTimeMs = Math.round(fandomTimes.reduce((a, b) => a + b, 0) / fandomTimes.length);
  }
  if (cvTimes.length > 0) {
    stats.comicvine.avgTimeMs = Math.round(cvTimes.reduce((a, b) => a + b, 0) / cvTimes.length);
  }
}

/**
 * Process a single batch of rows.
 */
async function processBatch(
  batch: CsvRow[],
  options: DiscoveryOptions,
  domainLookup: Map<string, string>,
  stats: DiscoveryStats
): Promise<{ updatedRows: CsvRow[]; results: DiscoveryResult[] }> {
  const results: DiscoveryResult[] = [];
  const updatedRows: CsvRow[] = [];

  for (const row of batch) {
    if (!needsDiscovery(row, options)) {
      updatedRows.push(row);
      stats.skipped++;
      continue;
    }

    const result = await discoverUrlsForTitle(row, options, domainLookup);
    results.push(result);

    const updatedRow = updateRowWithResults(row, result);
    updatedRows.push(updatedRow);

    updateStats(stats, result);
    stats.processed++;

    logResult(result, options.verbose);
  }

  return { updatedRows, results };
}

/**
 * Process all rows in batches.
 *
 * @param rows - All CSV rows to process
 * @param options - Discovery options
 * @param domainLookup - Pre-built Fandom domain lookup
 * @param onBatchComplete - Callback after each batch (for progress saving)
 * @returns Updated rows and discovery stats
 */
export async function processInBatches(
  rows: CsvRow[],
  options: DiscoveryOptions,
  domainLookup: Map<string, string>,
  onBatchComplete?: (updatedRows: CsvRow[], processedCount: number) => void
): Promise<{ updatedRows: CsvRow[]; stats: DiscoveryStats }> {
  const stats = createEmptyDiscoveryStats();
  stats.totalRows = rows.length;

  const allUpdatedRows: CsvRow[] = [];
  const allResults: DiscoveryResult[] = [];

  const startRow = options.startRow ?? 0;
  const endRow = options.endRow ?? rows.length;
  const rowsToProcess = rows.slice(startRow, endRow);

  allUpdatedRows.push(...rows.slice(0, startRow));

  const totalBatches = Math.ceil(rowsToProcess.length / options.batchSize);

  for (let i = 0; i < rowsToProcess.length; i += options.batchSize) {
    const batchNum = Math.floor(i / options.batchSize) + 1;
    const batch = rowsToProcess.slice(i, i + options.batchSize);

    logger.info(`Processing batch ${batchNum}/${totalBatches}`, { batchSize: batch.length });

    const { updatedRows, results } = await processBatch(batch, options, domainLookup, stats);
    allUpdatedRows.push(...updatedRows);
    allResults.push(...results);

    if (onBatchComplete) {
      onBatchComplete([...allUpdatedRows, ...rows.slice(startRow + i + options.batchSize)], allUpdatedRows.length);
    }

    if (i + options.batchSize < rowsToProcess.length) {
      await delay(1000);
    }
  }

  allUpdatedRows.push(...rows.slice(endRow));

  calculateAverageTimes(stats, allResults);

  return { updatedRows: allUpdatedRows, stats };
}
