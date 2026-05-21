#!/usr/bin/env bun
/**
 * Page Discovery Tool
 *
 * Takes existing URLs from CSV and discovers the best chapter/volume pages
 * using the app's URL discovery functions.
 *
 * For each source:
 * - Fandom: Extracts domain, runs discoverAllChapterVolumeUrls() to find chapter/volume pages
 * - Wikipedia: Runs discoverWikipediaUrls() to find list pages and main articles
 * - ComicVine: Runs scrapeSeriesVolumeUrls() to find volume pages
 *
 * Usage:
 *   bun run scripts/url-discovery/discover-pages.ts [options]
 *
 * Options:
 *   --input <path>      Input CSV file (default: ml-training-titles.csv)
 *   --output <path>     Output CSV file (default: ml-training-pages.csv)
 *   --batch-size <n>    Rows per batch (default: 5)
 *   --sources <list>    Comma-separated: wikipedia,fandom,comicvine (default: all)
 *   --start-row <n>     Resume from specific row
 *   --end-row <n>       Stop at specific row
 *   --dry-run           Don't write output, just log results
 *
 * @module url-discovery/discover-pages
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { discoverAllChapterVolumeUrls, extractDomainFromUrl } from '../../src/server/services/fandom/adaptive/url-discoverer';
import { discoverWikipediaUrls } from '../../src/server/services/wikipedia/adaptive/url-discoverer';
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
  // New columns for discovered pages
  FandomDiscoveredURLs?: string;
  WikipediaDiscoveredURLs?: string;
  ComicVineDiscoveredURLs?: string;
}

interface DiscoveryOptions {
  inputCsv: string;
  outputCsv: string;
  batchSize: number;
  sources: Array<'wikipedia' | 'fandom' | 'comicvine'>;
  startRow?: number;
  endRow?: number;
  dryRun: boolean;
}

interface DiscoveryStats {
  totalRows: number;
  processed: number;
  skipped: number;
  fandom: { found: number; notFound: number; errors: number };
  wikipedia: { found: number; notFound: number; errors: number };
  comicvine: { found: number; notFound: number; errors: number };
  durationMs: number;
}

// ============================================================================
// CSV Parsing (RFC 4180 compliant)
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
    } else {
      if (char === '"') {
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
  }
  fields.push(current);
  return fields;
}

function readCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Normalize line endings (handle Windows \r\n and Mac \r)
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n').filter(line => line.trim());

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row as unknown as CsvRow);
  }

  return rows;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function writeCsv(filePath: string, rows: CsvRow[]): void {
  if (rows.length === 0) return;

  const headers = [
    'Title',
    'AniListID',
    'WikipediaURL',
    'FandomURL',
    'ComicVineID',
    'FandomDiscoveredURLs',
    'WikipediaDiscoveredURLs',
    'ComicVineDiscoveredURLs',
  ];

  const lines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(h => escapeCsvField(row[h as keyof CsvRow] ?? ''));
    lines.push(values.join(','));
  }

  fs.writeFileSync(filePath, lines.join('\n'));
}

// ============================================================================
// Page Type Classification
// ============================================================================

/**
 * Fandom page types for categorizing discovered URLs.
 * Ordered by richness of data (most detailed first).
 */
const FANDOM_PAGE_TYPES = {
  VOLUMES_RICH: 'VOLUMES_RICH',       // /Chapters_and_Volumes/Volumes (detailed volume data)
  CHAPTERS_RICH: 'CHAPTERS_RICH',     // /Chapters_and_Volumes/Chapters (detailed chapter data)
  CHAPTERS_VOLUMES: 'CHAPTERS_VOLUMES', // /Chapters_and_Volumes, /Volumes_and_Chapters (combined)
  LIST_PAGE: 'LIST_PAGE',             // /List_of_Chapters, /List_of_Volumes
  MANGA_PAGE: 'MANGA_PAGE',           // /(Manga), /Manga
  VOLUMES: 'VOLUMES',                 // /Category:Volumes, /Volume_N, /Volumes
  CHAPTERS: 'CHAPTERS',               // /Category:Chapters, /Chapter_N, /Chapters
  ARCS: 'ARCS',                       // /Story_Arcs, /Arcs
  OTHER: 'OTHER',                     // Anything else
} as const;

type FandomPageType = typeof FANDOM_PAGE_TYPES[keyof typeof FANDOM_PAGE_TYPES];

/**
 * Classify a Fandom URL by its page type based on URL patterns.
 */
function classifyFandomPageType(url: string): FandomPageType {
  const path = new URL(url).pathname.toLowerCase();

  // Most specific patterns first (subpages)
  if (path.includes('/chapters_and_volumes/volumes') || path.includes('/volumes_%26_chapters/volumes')) {
    return FANDOM_PAGE_TYPES.VOLUMES_RICH;
  }
  if (path.includes('/chapters_and_volumes/chapters') || path.includes('/volumes_%26_chapters/chapters')) {
    return FANDOM_PAGE_TYPES.CHAPTERS_RICH;
  }

  // Combined chapter/volume pages
  if (path.includes('/chapters_and_volumes') || path.includes('/volumes_and_chapters') ||
      path.includes('/volumes_%26_chapters') || path.includes('/list_of_chapters_and_volumes') ||
      path.includes('/list_of_volumes_and_chapters')) {
    return FANDOM_PAGE_TYPES.CHAPTERS_VOLUMES;
  }

  // List pages
  if (path.includes('/list_of_chapters') || path.includes('/list_of_volumes') ||
      path.includes('/chapter_list') || path.includes('/volume_list')) {
    return FANDOM_PAGE_TYPES.LIST_PAGE;
  }

  // Manga-specific pages
  if (path.includes('_(manga)') || path.match(/\/wiki\/manga$/i) || path.includes('/manga_guide')) {
    return FANDOM_PAGE_TYPES.MANGA_PAGE;
  }

  // Arcs pages
  if (path.includes('/story_arcs') || path.includes('/arcs')) {
    return FANDOM_PAGE_TYPES.ARCS;
  }

  // Volume pages (category or individual)
  if (path.includes('/category:volume') || path.match(/\/volume_\d+/) ||
      path.includes('/volumes') || path.includes('/tankōbon') || path.includes('/tankobon')) {
    return FANDOM_PAGE_TYPES.VOLUMES;
  }

  // Chapter pages (category or individual)
  if (path.includes('/category:chapter') || path.match(/\/chapter_\d+/) ||
      path.includes('/chapters') || path.includes('/episodes') || path.includes('/episode_list')) {
    return FANDOM_PAGE_TYPES.CHAPTERS;
  }

  return FANDOM_PAGE_TYPES.OTHER;
}

/**
 * Format discovered URL with page type prefix.
 */
function formatDiscoveredUrl(url: string): string {
  const pageType = classifyFandomPageType(url);
  return `${pageType}:${url}`;
}

// ============================================================================
// Discovery Functions
// ============================================================================

// Multi-series wikis where domain-based discovery returns wrong results.
const MULTI_SERIES_WIKIS = [
  'webtoon.fandom.com',
  'manga.fandom.com',
  'yaoi.fandom.com',
  'animanga.fandom.com',
  'kodansha-comics.fandom.com',
  'shonen-jump.fandom.com',
  'manga-encyclopedie.fandom.com',
];

async function discoverFandomPages(fandomUrl: string): Promise<string[]> {
  if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') {
    return [];
  }

  try {
    const domain = extractDomainFromUrl(fandomUrl);
    if (!domain || (!domain.endsWith('.fandom.com') && !domain.endsWith('.wikia.com'))) {
      return [];
    }

    // Skip multi-series wikis - domain-based discovery doesn't work for them
    if (MULTI_SERIES_WIKIS.includes(domain)) {
      logger.debug('Skipping multi-series wiki', { domain, url: fandomUrl });
      return [];
    }

    const result = await discoverAllChapterVolumeUrls(domain, {}, 10);
    // Extract URLs from candidates array and deduplicate
    const seenUrls = new Set<string>();
    const uniqueUrls: string[] = [];
    for (const c of result.candidates) {
      const normalizedUrl = c.url.toLowerCase().replace(/\/$/, '');
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        uniqueUrls.push(c.url);
      }
    }

    // Filter out results from multi-series wikis (handles redirects)
    const filteredUrls = uniqueUrls.filter(url => {
      const urlDomain = extractDomainFromUrl(url);
      if (urlDomain && MULTI_SERIES_WIKIS.includes(urlDomain)) {
        logger.debug('Filtering redirected multi-series wiki URL', { url, originalDomain: domain });
        return false;
      }
      return true;
    });

    // Format URLs with page type prefix
    return filteredUrls.map(formatDiscoveredUrl);
  } catch (error) {
    logger.error('Fandom discovery error', {
      url: fandomUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function discoverWikipediaPages(wikipediaUrl: string): Promise<string[]> {
  if (!wikipediaUrl || wikipediaUrl === 'DOES_NOT_EXIST') {
    return [];
  }

  try {
    const result = await discoverWikipediaUrls(wikipediaUrl, { preferListPage: true });
    const urls: string[] = [];

    if (result.listPageUrl) urls.push(result.listPageUrl);
    if (result.mainArticleUrl && result.mainArticleUrl !== result.listPageUrl) {
      urls.push(result.mainArticleUrl);
    }

    return urls;
  } catch (error) {
    logger.error('Wikipedia discovery error', {
      url: wikipediaUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

async function discoverComicVinePages(comicVineId: string): Promise<string[]> {
  if (!comicVineId || comicVineId === 'DOES_NOT_EXIST') {
    return [];
  }

  try {
    // Build volume page URL from ID
    // ComicVine IDs are like "4050-12345" where 4050 indicates a volume
    // Note: Full scraping is heavy, so just return the volume page URL
    const cleanId = comicVineId.replace('4050-', '');
    const volumePageUrl = `https://comicvine.gamespot.com/volume/4050-${cleanId}/`;

    return [volumePageUrl];
  } catch (error) {
    logger.error('ComicVine discovery error', {
      id: comicVineId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

async function processRow(
  row: CsvRow,
  sources: Array<'wikipedia' | 'fandom' | 'comicvine'>,
  stats: DiscoveryStats
): Promise<CsvRow> {
  const updatedRow = { ...row };

  // Fandom discovery
  if (sources.includes('fandom') && row.FandomURL && row.FandomURL !== 'DOES_NOT_EXIST') {
    const fandomPages = await discoverFandomPages(row.FandomURL);
    if (fandomPages.length > 0) {
      updatedRow.FandomDiscoveredURLs = fandomPages.join('|');
      stats.fandom.found++;
    } else {
      stats.fandom.notFound++;
    }
  }

  // Wikipedia discovery
  if (sources.includes('wikipedia') && row.WikipediaURL && row.WikipediaURL !== 'DOES_NOT_EXIST') {
    const wikiPages = await discoverWikipediaPages(row.WikipediaURL);
    if (wikiPages.length > 0) {
      updatedRow.WikipediaDiscoveredURLs = wikiPages.join('|');
      stats.wikipedia.found++;
    } else {
      stats.wikipedia.notFound++;
    }
  }

  // ComicVine discovery
  if (sources.includes('comicvine') && row.ComicVineID && row.ComicVineID !== 'DOES_NOT_EXIST') {
    const cvPages = await discoverComicVinePages(row.ComicVineID);
    if (cvPages.length > 0) {
      updatedRow.ComicVineDiscoveredURLs = cvPages.join('|');
      stats.comicvine.found++;
    } else {
      stats.comicvine.notFound++;
    }
  }

  return updatedRow;
}

async function processBatch(
  rows: CsvRow[],
  options: DiscoveryOptions,
  stats: DiscoveryStats
): Promise<CsvRow[]> {
  const results: CsvRow[] = [];

  for (const row of rows) {
    const result = await processRow(row, options.sources, stats);
    results.push(result);
    stats.processed++;

    // Log progress
    const fandomStatus = result.FandomDiscoveredURLs ? 'Y' : '-';
    const wikiStatus = result.WikipediaDiscoveredURLs ? 'Y' : '-';
    const cvStatus = result.ComicVineDiscoveredURLs ? 'Y' : '-';
    logger.info(`[F:${fandomStatus} W:${wikiStatus} CV:${cvStatus}] ${row.Title}`);
  }

  return results;
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): DiscoveryOptions {
  const args = process.argv.slice(2);
  const options: DiscoveryOptions = {
    inputCsv: 'ml-training-titles.csv',
    outputCsv: 'ml-training-pages.csv',
    batchSize: 5,
    sources: ['wikipedia', 'fandom', 'comicvine'],
    dryRun: false,
  };

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
      case '--start-row':
        if (nextArg) options.startRow = parseInt(nextArg, 10);
        i++;
        break;
      case '--end-row':
        if (nextArg) options.endRow = parseInt(nextArg, 10);
        i++;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  const helpText = `
Page Discovery Tool

Discovers chapter/volume pages from existing wiki URLs.

Usage:
  bun run scripts/url-discovery/discover-pages.ts [options]

Options:
  --input <path>      Input CSV file (default: ml-training-titles.csv)
  --output <path>     Output CSV file (default: ml-training-pages.csv)
  --batch-size <n>    Rows per batch (default: 5)
  --sources <list>    Comma-separated: wikipedia,fandom,comicvine (default: all)
  --start-row <n>     Resume from specific row
  --end-row <n>       Stop at specific row
  --dry-run           Don't write output, just log results
  --help              Show this help message

Examples:
  # Discover pages for all rows
  bun run scripts/url-discovery/discover-pages.ts

  # Fandom only, first 10 rows
  bun run scripts/url-discovery/discover-pages.ts --sources fandom --end-row 10

  # Dry run
  bun run scripts/url-discovery/discover-pages.ts --dry-run --end-row 5
`;
  process.stdout.write(helpText);
}

function printStats(stats: DiscoveryStats): void {
  const summary = `
================================================================================
                         PAGE DISCOVERY COMPLETE
================================================================================

Total Rows:     ${stats.totalRows}
Processed:      ${stats.processed}
Skipped:        ${stats.skipped}

Fandom:
  Found:        ${stats.fandom.found}
  Not Found:    ${stats.fandom.notFound}
  Errors:       ${stats.fandom.errors}

Wikipedia:
  Found:        ${stats.wikipedia.found}
  Not Found:    ${stats.wikipedia.notFound}
  Errors:       ${stats.wikipedia.errors}

ComicVine:
  Found:        ${stats.comicvine.found}
  Not Found:    ${stats.comicvine.notFound}
  Errors:       ${stats.comicvine.errors}

Duration: ${Math.round(stats.durationMs / 1000)}s
================================================================================
`;
  process.stdout.write(summary);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();
  const startTime = Date.now();

  logger.info('Starting Page Discovery', {
    input: options.inputCsv,
    output: options.outputCsv,
    sources: options.sources,
    dryRun: options.dryRun,
  });

  // Resolve paths
  const inputPath = path.isAbsolute(options.inputCsv)
    ? options.inputCsv
    : path.resolve(process.cwd(), options.inputCsv);

  const outputPath = path.isAbsolute(options.outputCsv)
    ? options.outputCsv
    : path.resolve(process.cwd(), options.outputCsv);

  // Read CSV
  logger.info('Reading input CSV', { path: inputPath });
  let rows = readCsv(inputPath);
  logger.info('Loaded rows', { count: rows.length });

  // Apply row filters
  if (options.startRow !== undefined) {
    rows = rows.slice(options.startRow);
  }
  if (options.endRow !== undefined) {
    rows = rows.slice(0, options.endRow - (options.startRow ?? 0));
  }

  const stats: DiscoveryStats = {
    totalRows: rows.length,
    processed: 0,
    skipped: 0,
    fandom: { found: 0, notFound: 0, errors: 0 },
    wikipedia: { found: 0, notFound: 0, errors: 0 },
    comicvine: { found: 0, notFound: 0, errors: 0 },
    durationMs: 0,
  };

  // Progress file paths
  const progressCsvPath = outputPath.replace('.csv', '.progress.csv');
  const progressJsonPath = outputPath.replace('.csv', '.progress.json');

  // Process in batches
  const allResults: CsvRow[] = [];
  for (let i = 0; i < rows.length; i += options.batchSize) {
    const batch = rows.slice(i, i + options.batchSize);
    const batchNum = Math.floor(i / options.batchSize) + 1;
    const totalBatches = Math.ceil(rows.length / options.batchSize);

    logger.info(`Processing batch ${batchNum}/${totalBatches}`, { batchSize: batch.length });

    const results = await processBatch(batch, options, stats);
    allResults.push(...results);

    // Save progress after each batch (if not dry run)
    if (!options.dryRun) {
      writeCsv(progressCsvPath, allResults);
      fs.writeFileSync(progressJsonPath, JSON.stringify({
        lastProcessedRow: (options.startRow ?? 0) + i + batch.length,
        lastSaveTime: new Date().toISOString(),
        totalRows: rows.length,
      }, null, 2));
      logger.info(`Progress saved: ${allResults.length} rows`);
    }

    // Rate limiting between batches
    if (i + options.batchSize < rows.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  stats.durationMs = Date.now() - startTime;

  // Write final output and cleanup progress files
  if (!options.dryRun) {
    logger.info('Writing output CSV', { path: outputPath });
    writeCsv(outputPath, allResults);

    // Cleanup progress files
    try {
      if (fs.existsSync(progressCsvPath)) fs.unlinkSync(progressCsvPath);
      if (fs.existsSync(progressJsonPath)) fs.unlinkSync(progressJsonPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  printStats(stats);
  logger.info('Page discovery complete');
}

main().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
