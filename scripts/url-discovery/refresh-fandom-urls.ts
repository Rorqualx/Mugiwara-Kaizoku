#!/usr/bin/env bun
/**
 * Refresh Fandom URLs Tool
 *
 * Re-searches titles that have multi-series wiki URLs to find their correct
 * dedicated wiki URLs using FandomProvider.search().
 *
 * Phase 4 of URL Discovery Plan: Fix Fandom Discovery Pipeline
 *
 * Usage:
 *   bun run scripts/url-discovery/refresh-fandom-urls.ts [options]
 *
 * @module url-discovery/refresh-fandom-urls
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { FandomProvider } from '../../src/server/services/search/providers/FandomProvider';
import { logger } from '../../src/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface CsvRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs?: string;
  WikipediaDiscoveredURLs?: string;
  ComicVineDiscoveredURLs?: string;
}

interface RefreshOptions {
  inputCsv: string;
  outputCsv: string;
  batchSize: number;
  startRow?: number;
  endRow?: number;
  dryRun: boolean;
  includeEmpty: boolean;
}

interface RefreshStats {
  totalRows: number;
  processed: number;
  skipped: number;
  multiSeriesFound: number;
  emptyFound: number;
  updated: number;
  notFound: number;
  errors: number;
  durationMs: number;
}

// ============================================================================
// Multi-Series Wiki Detection
// ============================================================================

const MULTI_SERIES_WIKIS = [
  'webtoon.fandom.com',
  'manga.fandom.com',
  'yaoi.fandom.com',
  'animanga.fandom.com',
  'kodansha-comics.fandom.com',
  'shonen-jump.fandom.com',
  'manga-encyclopedie.fandom.com',
  'shojo.fandom.com',
  'shoujo.fandom.com',
  'seinen.fandom.com',
  'josei.fandom.com',
  'manhua.fandom.com',
  'manhwa.fandom.com',
  'light-novel.fandom.com',
  'visual-novel.fandom.com',
];

function extractDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isMultiSeriesWiki(fandomUrl: string): boolean {
  if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') return false;
  const domain = extractDomainFromUrl(fandomUrl);
  return domain !== null && MULTI_SERIES_WIKIS.includes(domain);
}

function needsRefresh(row: CsvRow, includeEmpty: boolean): boolean {
  if (isMultiSeriesWiki(row.FandomURL)) return true;
  if (includeEmpty && (!row.FandomURL || row.FandomURL.trim() === '')) return true;
  return false;
}

// ============================================================================
// CSV Utilities
// ============================================================================

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else if (char === '"') {
        inQuotes = false;
        i++;
      } else {
        current += char;
        i++;
      }
    } else if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      fields.push(current);
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  fields.push(current);
  return fields;
}

function readCsv(filePath: string): { headers: string[]; rows: CsvRow[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ''; });
    return row as unknown as CsvRow;
  });

  return { headers, rows };
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function writeCsv(filePath: string, headers: string[], rows: CsvRow[]): void {
  if (rows.length === 0) return;
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map(h => escapeCsvField(row[h as keyof CsvRow] ?? ''));
    lines.push(values.join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'));
}

function createBackup(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  const backupPath = `${base}.backup-${timestamp}${ext}`;
  fs.copyFileSync(filePath, backupPath);
  logger.info('Backup created', { path: backupPath });
  return backupPath;
}

// ============================================================================
// Fandom Search
// ============================================================================

async function searchFandomForTitle(
  provider: FandomProvider,
  title: string
): Promise<{ url: string | null; domain: string | null; error?: string }> {
  try {
    const results = await provider.search(title, { limit: 1, skipFallback: true });

    if (results.length > 0 && results[0]?.url) {
      const url = results[0].url;
      const domain = extractDomainFromUrl(url);
      if (domain && MULTI_SERIES_WIKIS.includes(domain)) {
        logger.debug('Search returned multi-series wiki, skipping', { title, url });
        return { url: null, domain: null };
      }
      return { url, domain };
    }
    return { url: null, domain: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Fandom search error', { title, error: errorMessage });
    return { url: null, domain: null, error: errorMessage };
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processRow(
  provider: FandomProvider,
  row: CsvRow,
  stats: RefreshStats
): Promise<CsvRow> {
  const result = await searchFandomForTitle(provider, row.Title);

  if (result.error) {
    stats.errors++;
    return row;
  }

  if (result.url) {
    stats.updated++;
    return { ...row, FandomURL: result.url, FandomDiscoveredURLs: '' };
  }

  stats.notFound++;
  return row;
}

async function processBatch(
  provider: FandomProvider,
  rows: CsvRow[],
  stats: RefreshStats
): Promise<CsvRow[]> {
  const results: CsvRow[] = [];

  for (const row of rows) {
    const result = await processRow(provider, row, stats);
    results.push(result);
    stats.processed++;

    const originalDomain = extractDomainFromUrl(row.FandomURL) ?? 'empty';
    const newDomain = extractDomainFromUrl(result.FandomURL) ?? 'empty';
    const changed = row.FandomURL !== result.FandomURL;
    const status = changed ? 'UPDATED' : 'SKIPPED';

    logger.info(`[${status}] ${row.Title.substring(0, 50)} | ${originalDomain} → ${newDomain}`);
  }

  return results;
}

// ============================================================================
// CLI & Stats
// ============================================================================

function parseArgs(): RefreshOptions {
  const args = process.argv.slice(2);
  const options: RefreshOptions = {
    inputCsv: 'ml-training-titles.csv',
    outputCsv: 'ml-training-titles-refreshed.csv',
    batchSize: 5,
    dryRun: false,
    includeEmpty: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--input' && nextArg) { options.inputCsv = nextArg; i++; }
    else if (arg === '--output' && nextArg) { options.outputCsv = nextArg; i++; }
    else if (arg === '--batch-size' && nextArg) { options.batchSize = parseInt(nextArg, 10); i++; }
    else if (arg === '--start-row' && nextArg) { options.startRow = parseInt(nextArg, 10); i++; }
    else if (arg === '--end-row' && nextArg) { options.endRow = parseInt(nextArg, 10); i++; }
    else if (arg === '--dry-run') { options.dryRun = true; }
    else if (arg === '--include-empty') { options.includeEmpty = true; }
    else if (arg === '--help') { printHelp(); process.exit(0); }
  }

  return options;
}

function printHelp(): void {
  process.stdout.write(`
Refresh Fandom URLs Tool

Re-searches titles with multi-series wiki URLs to find dedicated wikis.

Usage:
  bun run scripts/url-discovery/refresh-fandom-urls.ts [options]

Options:
  --input <path>      Input CSV file (default: ml-training-titles.csv)
  --output <path>     Output CSV file (default: ml-training-titles-refreshed.csv)
  --batch-size <n>    Rows per batch (default: 5)
  --start-row <n>     Resume from specific row
  --end-row <n>       Stop at specific row
  --dry-run           Don't write output, just log results
  --include-empty     Also search rows with empty FandomURL
  --help              Show this help message
`);
}

function printStats(stats: RefreshStats): void {
  process.stdout.write(`
================================================================================
                         FANDOM URL REFRESH COMPLETE
================================================================================
Total Rows:           ${stats.totalRows}
Processed:            ${stats.processed}
Skipped:              ${stats.skipped}
Multi-Series Found:   ${stats.multiSeriesFound}
Empty URLs Found:     ${stats.emptyFound}
Updated:              ${stats.updated}
Not Found:            ${stats.notFound}
Errors:               ${stats.errors}
Duration: ${Math.round(stats.durationMs / 1000)}s
================================================================================
`);
}

// ============================================================================
// Initialization & Categorization
// ============================================================================

function categorizeRows(
  allRows: CsvRow[],
  includeEmpty: boolean,
  stats: RefreshStats
): Array<{ index: number; row: CsvRow }> {
  const rowsToRefresh: Array<{ index: number; row: CsvRow }> = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row) continue;

    if (isMultiSeriesWiki(row.FandomURL)) stats.multiSeriesFound++;
    if (!row.FandomURL || row.FandomURL.trim() === '') stats.emptyFound++;

    if (needsRefresh(row, includeEmpty)) {
      rowsToRefresh.push({ index: i, row });
    } else {
      stats.skipped++;
    }
  }

  return rowsToRefresh;
}

function applyRowFilters(
  rows: Array<{ index: number; row: CsvRow }>,
  options: RefreshOptions
): Array<{ index: number; row: CsvRow }> {
  let filtered = rows;
  if (options.startRow !== undefined) {
    filtered = filtered.filter((_, i) => i >= (options.startRow ?? 0));
  }
  if (options.endRow !== undefined) {
    filtered = filtered.slice(0, options.endRow - (options.startRow ?? 0));
  }
  return filtered;
}

function saveProgress(
  outputPath: string,
  headers: string[],
  resultRows: CsvRow[],
  batchEnd: number,
  totalToProcess: number,
  stats: RefreshStats
): void {
  const progressCsvPath = outputPath.replace('.csv', '.progress.csv');
  const progressJsonPath = outputPath.replace('.csv', '.progress.json');

  writeCsv(progressCsvPath, headers, resultRows);
  fs.writeFileSync(progressJsonPath, JSON.stringify({
    lastProcessedRow: batchEnd,
    lastSaveTime: new Date().toISOString(),
    totalToProcess,
    stats,
  }, null, 2));
  logger.info(`Progress saved: ${stats.processed} rows processed`);
}

function cleanupProgressFiles(outputPath: string): void {
  const progressCsvPath = outputPath.replace('.csv', '.progress.csv');
  const progressJsonPath = outputPath.replace('.csv', '.progress.json');
  try {
    if (fs.existsSync(progressCsvPath)) fs.unlinkSync(progressCsvPath);
    if (fs.existsSync(progressJsonPath)) fs.unlinkSync(progressJsonPath);
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();
  const startTime = Date.now();

  logger.info('Starting Fandom URL Refresh', { ...options });

  const inputPath = path.isAbsolute(options.inputCsv)
    ? options.inputCsv
    : path.resolve(process.cwd(), options.inputCsv);
  const outputPath = path.isAbsolute(options.outputCsv)
    ? options.outputCsv
    : path.resolve(process.cwd(), options.outputCsv);

  logger.info('Reading input CSV', { path: inputPath });
  const { headers, rows: allRows } = readCsv(inputPath);
  logger.info('Loaded rows', { count: allRows.length });

  if (!options.dryRun) createBackup(inputPath);

  const stats: RefreshStats = {
    totalRows: allRows.length, processed: 0, skipped: 0,
    multiSeriesFound: 0, emptyFound: 0, updated: 0, notFound: 0, errors: 0, durationMs: 0,
  };

  const rowsToRefresh = categorizeRows(allRows, options.includeEmpty, stats);
  const filteredRows = applyRowFilters(rowsToRefresh, options);
  const resultRows: CsvRow[] = [...allRows];

  logger.info('Processing rows', { toRefresh: filteredRows.length });

  const provider = new FandomProvider();

  for (let i = 0; i < filteredRows.length; i += options.batchSize) {
    const batch = filteredRows.slice(i, i + options.batchSize);
    const batchNum = Math.floor(i / options.batchSize) + 1;
    const totalBatches = Math.ceil(filteredRows.length / options.batchSize);

    logger.info(`Processing batch ${batchNum}/${totalBatches}`);

    const results = await processBatch(provider, batch.map(b => b.row), stats);

    batch.forEach((item, j) => {
      const result = results[j];
      if (item && result) resultRows[item.index] = result;
    });

    if (!options.dryRun) {
      saveProgress(outputPath, headers, resultRows, i + batch.length, filteredRows.length, stats);
    }

    if (i + options.batchSize < filteredRows.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  stats.durationMs = Date.now() - startTime;

  if (!options.dryRun) {
    writeCsv(outputPath, headers, resultRows);
    fs.writeFileSync(outputPath.replace('.csv', '.stats.json'), JSON.stringify(stats, null, 2));
    cleanupProgressFiles(outputPath);
  }

  printStats(stats);
  provider.destroy();
}

main().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
