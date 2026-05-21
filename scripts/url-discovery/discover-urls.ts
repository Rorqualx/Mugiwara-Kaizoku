#!/usr/bin/env bun
/**
 * CSV URL Discovery Tool
 *
 * Uses project components to discover URLs for manga titles in the authoritative CSV.
 * Validates that ComicVine, Wikipedia, and Fandom providers work correctly.
 *
 * Usage:
 *   bun run scripts/url-discovery/discover-urls.ts [options]
 *
 * Options:
 *   --input <path>      Input CSV file (default: ml-training-titles.csv)
 *   --output <path>     Output CSV file (default: ml-training-titles-enriched.csv)
 *   --batch-size <n>    Titles per batch (default: 5)
 *   --sources <list>    Comma-separated sources: wikipedia,fandom,comicvine
 *   --only-empty        Only process rows with empty values
 *   --dry-run           Don't write output, just log results
 *   --start-row <n>     Resume from specific row (0-indexed)
 *   --end-row <n>       Stop at specific row (0-indexed)
 *   --verbose           Output detailed logs
 *
 * @module url-discovery/discover-urls
 */

import * as path from 'node:path';

import { logger } from '../../src/utils/logger';

import { readCsv, buildFandomDomainLookup } from './csv/reader';
import { writeCsv, createBackup, saveProgress, cleanupProgress, writeStats } from './csv/writer';
import type { DiscoveryOptions, DiscoveryStats } from './csv/types';
import { DEFAULT_DISCOVERY_OPTIONS } from './csv/types';
import { processInBatches } from './batch-processor';

/**
 * Parse command line arguments.
 */
function parseArgs(): DiscoveryOptions {
  const args = process.argv.slice(2);
  const options = { ...DEFAULT_DISCOVERY_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--input':
        if (nextArg) options.inputCsv = nextArg;
        i++;
        break;
      case '--output':
        if (nextArg) options.outputCsv = nextArg;
        i++;
        break;
      case '--batch-size':
        if (nextArg) options.batchSize = parseInt(nextArg, 10);
        i++;
        break;
      case '--sources':
        if (nextArg) {
          options.sources = nextArg.split(',').filter(
            (s): s is 'wikipedia' | 'fandom' | 'comicvine' =>
              ['wikipedia', 'fandom', 'comicvine'].includes(s)
          );
        }
        i++;
        break;
      case '--only-empty':
        options.onlyEmpty = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--start-row':
        if (nextArg) options.startRow = parseInt(nextArg, 10);
        i++;
        break;
      case '--end-row':
        if (nextArg) options.endRow = parseInt(nextArg, 10);
        i++;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message.
 */
function printHelp(): void {
  const helpText = `
CSV URL Discovery Tool

Discovers Wikipedia, Fandom, and ComicVine URLs for manga titles.

Usage:
  bun run scripts/url-discovery/discover-urls.ts [options]

Options:
  --input <path>      Input CSV file (default: ml-training-titles.csv)
  --output <path>     Output CSV file (default: ml-training-titles-enriched.csv)
  --batch-size <n>    Titles per batch (default: 5)
  --sources <list>    Comma-separated: wikipedia,fandom,comicvine (default: all)
  --only-empty        Only process rows with empty values
  --dry-run           Don't write output, just log results
  --start-row <n>     Resume from specific row (0-indexed)
  --end-row <n>       Stop at specific row (0-indexed)
  --verbose           Output detailed logs
  --help              Show this help message

Examples:
  # Full discovery
  bun run scripts/url-discovery/discover-urls.ts

  # Only process empty values, Wikipedia only
  bun run scripts/url-discovery/discover-urls.ts --only-empty --sources wikipedia

  # Dry run first 10 rows
  bun run scripts/url-discovery/discover-urls.ts --dry-run --end-row 10

  # Resume from row 500
  bun run scripts/url-discovery/discover-urls.ts --start-row 500
`;
  // Using process.stdout.write for CLI help output
  process.stdout.write(helpText);
}

/**
 * Print summary statistics.
 */
function printStats(stats: DiscoveryStats): void {
  const summary = `
================================================================================
                           DISCOVERY COMPLETE
================================================================================

Total Rows:     ${stats.totalRows}
Processed:      ${stats.processed}
Skipped:        ${stats.skipped}

Wikipedia:
  Found:        ${stats.wikipedia.found}
  Not Found:    ${stats.wikipedia.notFound}
  Errors:       ${stats.wikipedia.errors}
  Avg Time:     ${stats.wikipedia.avgTimeMs}ms

Fandom:
  Found:        ${stats.fandom.found}
  Not Found:    ${stats.fandom.notFound}
  Errors:       ${stats.fandom.errors}
  Avg Time:     ${stats.fandom.avgTimeMs}ms

ComicVine:
  Found:        ${stats.comicvine.found}
  Not Found:    ${stats.comicvine.notFound}
  Errors:       ${stats.comicvine.errors}
  Avg Time:     ${stats.comicvine.avgTimeMs}ms

Total Duration: ${Math.round(stats.durationMs / 1000)}s
================================================================================
`;
  process.stdout.write(summary);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const options = parseArgs();

  logger.info('Starting URL Discovery', {
    input: options.inputCsv,
    output: options.outputCsv,
    batchSize: options.batchSize,
    sources: options.sources,
    onlyEmpty: options.onlyEmpty,
    dryRun: options.dryRun,
  });

  // Resolve paths
  const inputPath = path.isAbsolute(options.inputCsv)
    ? options.inputCsv
    : path.resolve(process.cwd(), options.inputCsv);

  const outputPath = path.isAbsolute(options.outputCsv)
    ? options.outputCsv
    : path.resolve(process.cwd(), options.outputCsv);

  // Read input CSV
  logger.info('Reading input CSV', { path: inputPath });
  const rows = readCsv(inputPath);
  logger.info('Loaded rows', { count: rows.length });

  // Build Fandom domain lookup from existing data
  logger.info('Building Fandom domain lookup from existing data');
  const domainLookup = buildFandomDomainLookup(rows);
  logger.info('Domain lookup built', { entries: domainLookup.size });

  // Create backup if not dry run
  if (!options.dryRun) {
    try {
      const backupPath = createBackup(inputPath);
      logger.info('Backup created', { path: backupPath });
    } catch {
      logger.warn('Could not create backup (file may not exist yet)');
    }
  }

  const startTime = Date.now();

  // Process in batches
  const { updatedRows, stats } = await processInBatches(
    rows,
    options,
    domainLookup,
    options.dryRun ? undefined : (currentRows, count) => saveProgress(currentRows, outputPath, count)
  );

  stats.durationMs = Date.now() - startTime;

  // Write output if not dry run
  if (!options.dryRun) {
    logger.info('Writing output CSV', { path: outputPath });
    writeCsv(outputPath, updatedRows);

    // Write stats
    writeStats(stats, outputPath);
    logger.info('Stats written', { path: outputPath.replace('.csv', '.stats.json') });

    // Cleanup progress files
    cleanupProgress(outputPath);
  }

  // Print summary
  printStats(stats);

  // Log any errors
  if (stats.errors.length > 0) {
    logger.warn('Errors encountered', { count: stats.errors.length });
    for (const error of stats.errors.slice(0, 10)) {
      logger.debug('Error detail', { title: error.title, source: error.source, error: error.error });
    }
    if (stats.errors.length > 10) {
      logger.debug('Additional errors', { count: stats.errors.length - 10 });
    }
  }

  logger.info('Discovery complete');
}

// Run main
main().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
