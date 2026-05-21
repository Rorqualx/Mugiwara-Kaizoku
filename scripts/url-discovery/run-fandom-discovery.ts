#!/usr/bin/env bun
/**
 * Enhanced Fandom URL Discovery Script
 *
 * Discovers chapter/volume pages from Fandom wikis including:
 * - Main list pages (Chapters_and_Volumes, etc.)
 * - Sample chapter pages (Chapter_1 through Chapter_5)
 * - Sample volume pages (Volume_1 through Volume_5)
 *
 * Usage: bun run scripts/url-discovery/run-fandom-discovery.ts
 *
 * @module url-discovery/run-fandom-discovery
 */

import * as fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

import {
  discoverAllChapterVolumeUrls,
  extractDomainFromUrl,
  probeUrl,
} from '../../src/server/services/fandom/adaptive/url-discoverer';
import { logger } from '../../src/utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = './ml-training-titles.csv';
const OUTPUT_PATH = './ml-training-titles-with-fandom-discovery.csv';
const DELAY_MS = 300;
const PROGRESS_INTERVAL = 50;
const SAMPLE_COUNT = 5;

// Multi-series wikis where domain-based discovery doesn't work
const MULTI_SERIES_WIKIS = new Set([
  'webtoon.fandom.com',
  'manga.fandom.com',
  'yaoi.fandom.com',
  'animanga.fandom.com',
  'kodansha-comics.fandom.com',
  'shonen-jump.fandom.com',
  'manga-encyclopedie.fandom.com',
]);

// ============================================================================
// Types
// ============================================================================

interface CsvRecord {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs?: string;
}

interface DiscoveryResult {
  listPages: string[];
  chapterPages: string[];
  volumePages: string[];
}

// ============================================================================
// Sample Page Discovery
// ============================================================================

const CHAPTER_PATTERNS = [
  '/wiki/Chapter_{N}',
  '/wiki/Chapter%20{N}',
  '/wiki/Episode_{N}',
  '/wiki/Ch._{N}',
];

const VOLUME_PATTERNS = [
  '/wiki/Volume_{N}',
  '/wiki/Volume%20{N}',
  '/wiki/Vol._{N}',
  '/wiki/Tankōbon_{N}',
  '/wiki/Tankobon_{N}',
];

/**
 * Probe a single numbered page across multiple patterns.
 */
async function probeNumberedPage(
  baseUrl: string,
  patterns: string[],
  pageNumber: number
): Promise<string | null> {
  for (const pattern of patterns) {
    const url = `${baseUrl}${pattern.replace('{N}', String(pageNumber))}`;
    const result = await probeUrl(url, { probeTimeoutMs: 3000 });
    if (result.exists) {
      return result.redirectedTo ?? url;
    }
  }
  return null;
}

/**
 * Probe for sample pages (1 through N) using given patterns.
 */
async function discoverSamplePages(
  domain: string,
  patterns: string[],
  count: number = SAMPLE_COUNT
): Promise<string[]> {
  const baseUrl = `https://${domain}`;
  const foundUrls: string[] = [];

  for (let n = 1; n <= count; n++) {
    const url = await probeNumberedPage(baseUrl, patterns, n);
    if (url) {
      foundUrls.push(url);
    }
  }

  return foundUrls;
}

// ============================================================================
// Main Discovery Function
// ============================================================================

function isValidFandomDomain(domain: string | null): boolean {
  if (!domain) return false;
  if (MULTI_SERIES_WIKIS.has(domain)) return false;
  return domain.endsWith('.fandom.com') || domain.endsWith('.wikia.com');
}

/**
 * Discover all relevant Fandom URLs for a wiki domain.
 */
async function discoverFandomUrls(fandomUrl: string): Promise<DiscoveryResult> {
  const emptyResult: DiscoveryResult = { listPages: [], chapterPages: [], volumePages: [] };

  if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') {
    return emptyResult;
  }

  const domain = extractDomainFromUrl(fandomUrl);
  if (!isValidFandomDomain(domain)) {
    return emptyResult;
  }

  // Discover main list pages
  const listResult = await discoverAllChapterVolumeUrls(domain, {}, 8);
  const listPages = listResult.candidates.map(c => c.url);

  // Discover sample chapter and volume pages
  const chapterPages = await discoverSamplePages(domain, CHAPTER_PATTERNS);
  const volumePages = await discoverSamplePages(domain, VOLUME_PATTERNS);

  return { listPages, chapterPages, volumePages };
}

/**
 * Format discovery result as pipe-separated URL string with type prefixes.
 */
function formatDiscoveryResult(result: DiscoveryResult): string {
  const urls: string[] = [];

  for (const url of result.listPages) {
    urls.push(`LIST:${url}`);
  }
  for (const url of result.chapterPages) {
    urls.push(`CHAPTER:${url}`);
  }
  for (const url of result.volumePages) {
    urls.push(`VOLUME:${url}`);
  }

  return urls.join('|');
}

// ============================================================================
// CSV Processing
// ============================================================================

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed !== '' && trimmed !== 'DOES_NOT_EXIST';
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logProgress(processed: number, total: number, discovered: number, startTime: number): void {
  if (processed % PROGRESS_INTERVAL !== 0) return;

  const elapsed = (Date.now() - startTime) / 1000;
  const rate = processed / elapsed;
  const remaining = (total - processed) / rate;
  logger.info('Discovery progress', {
    processed,
    total,
    discovered,
    rate: rate.toFixed(1),
    etaMinutes: Math.ceil(remaining / 60),
  });
}

/**
 * Process a single record and update its FandomDiscoveredURLs.
 */
async function processRecord(record: CsvRecord): Promise<boolean> {
  const fandomUrl = record.FandomURL?.trim();

  if (!isValidUrl(fandomUrl)) {
    return false;
  }

  const result = await discoverFandomUrls(fandomUrl);
  const totalFound = result.listPages.length + result.chapterPages.length + result.volumePages.length;

  if (totalFound > 0) {
    record.FandomDiscoveredURLs = formatDiscoveryResult(result);
    logger.debug('Discovered URLs', {
      title: record.Title,
      lists: result.listPages.length,
      chapters: result.chapterPages.length,
      volumes: result.volumePages.length,
    });
    return true;
  }

  return false;
}

async function processRecords(
  records: CsvRecord[],
  totalWithFandom: number
): Promise<{ processed: number; discovered: number }> {
  let processed = 0;
  let discovered = 0;
  const startTime = Date.now();

  for (const record of records) {
    if (record.FandomDiscoveredURLs === undefined) {
      record.FandomDiscoveredURLs = '';
    }

    if (!isValidUrl(record.FandomURL)) {
      continue;
    }

    try {
      const found = await processRecord(record);
      if (found) discovered++;
      processed++;
      logProgress(processed, totalWithFandom, discovered, startTime);
      await sleep(DELAY_MS);
    } catch (error) {
      logger.error('Error processing record', {
        title: record.Title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, discovered };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  logger.info('Fandom URL Discovery Script starting', { csvPath: CSV_PATH });

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRecord[];
  logger.info('CSV loaded', { totalRecords: records.length });

  const withFandom = records.filter(r => isValidUrl(r.FandomURL));
  logger.info('Records with valid Fandom URLs', { count: withFandom.length });

  const { processed, discovered } = await processRecords(records, withFandom.length);
  logger.info('Discovery complete', { processed, discovered });

  const columns = ['Title', 'AniListID', 'WikipediaURL', 'FandomURL', 'ComicVineID', 'FandomDiscoveredURLs'];
  const output = stringify(records, { header: true, columns });
  fs.writeFileSync(OUTPUT_PATH, output);
  logger.info('Output written', { path: OUTPUT_PATH });
}

main().catch(err => {
  logger.error('Script failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
