#!/usr/bin/env bun
/**
 * Parallel Fandom URL Discovery Script
 *
 * Discovers chapter/volume pages from Fandom wikis with parallelism.
 * - Processes multiple domains concurrently (different wikis)
 * - Rate limits per domain to avoid 429s
 * - Saves progress periodically
 *
 * Usage: bun run scripts/url-discovery/run-fandom-discovery-parallel.ts
 *
 * @module url-discovery/run-fandom-discovery-parallel
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
const PROGRESS_PATH = './ml-training-titles-fandom-progress.json';

// Parallelism settings
const MAX_CONCURRENT_DOMAINS = 8;
const DELAY_BETWEEN_REQUESTS_MS = 100;

const PROGRESS_SAVE_INTERVAL = 100;
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

interface ProgressState {
  processed: Set<string>;
  results: Map<string, string>;
}

interface ProcessingContext {
  state: ProgressState;
  processedCount: number;
  discoveredCount: number;
  totalToProcess: number;
  startTime: number;
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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  return foundUrls;
}

// ============================================================================
// Domain Validation & Discovery
// ============================================================================

function isValidFandomDomain(domain: string | null): boolean {
  if (!domain) return false;
  if (MULTI_SERIES_WIKIS.has(domain)) return false;
  return domain.endsWith('.fandom.com') || domain.endsWith('.wikia.com');
}

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed !== '' && trimmed !== 'DOES_NOT_EXIST';
}

async function discoverFandomUrls(fandomUrl: string): Promise<DiscoveryResult> {
  const emptyResult: DiscoveryResult = { listPages: [], chapterPages: [], volumePages: [] };

  if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') {
    return emptyResult;
  }

  const domain = extractDomainFromUrl(fandomUrl);
  if (!isValidFandomDomain(domain)) {
    return emptyResult;
  }

  const listResult = await discoverAllChapterVolumeUrls(domain, {}, 8);
  const listPages = listResult.candidates.map(c => c.url);
  const chapterPages = await discoverSamplePages(domain, CHAPTER_PATTERNS);
  const volumePages = await discoverSamplePages(domain, VOLUME_PATTERNS);

  return { listPages, chapterPages, volumePages };
}

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
// Progress Management
// ============================================================================

function loadProgress(): ProgressState {
  const state: ProgressState = {
    processed: new Set(),
    results: new Map(),
  };

  if (!fs.existsSync(PROGRESS_PATH)) {
    return state;
  }

  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8')) as {
      processed: string[];
      results: Array<[string, string]>;
    };
    state.processed = new Set(data.processed);
    state.results = new Map(data.results);
    logger.info('Loaded progress from previous run', {
      processed: state.processed.size,
      results: state.results.size,
    });
  } catch {
    logger.warn('Could not load progress file, starting fresh');
  }

  return state;
}

function saveProgress(state: ProgressState): void {
  const data = {
    processed: Array.from(state.processed),
    results: Array.from(state.results.entries()),
  };
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(data));
}

// ============================================================================
// Semaphore for Concurrency Control
// ============================================================================

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>(resolve => this.waiting.push(resolve));
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

// ============================================================================
// Record Processing
// ============================================================================

async function processRecord(record: CsvRecord): Promise<{ title: string; result: string } | null> {
  const fandomUrl = record.FandomURL?.trim();

  if (!isValidUrl(fandomUrl)) {
    return null;
  }

  try {
    const result = await discoverFandomUrls(fandomUrl);
    const totalFound = result.listPages.length + result.chapterPages.length + result.volumePages.length;

    if (totalFound > 0) {
      return { title: record.Title, result: formatDiscoveryResult(result) };
    }
  } catch (error) {
    logger.warn('Discovery failed for record', {
      title: record.Title,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

function logProgress(ctx: ProcessingContext): void {
  if (ctx.processedCount % 10 !== 0) return;

  const elapsed = (Date.now() - ctx.startTime) / 1000;
  const rate = ctx.processedCount / elapsed;
  const remaining = (ctx.totalToProcess - ctx.processedCount) / rate;

  logger.info('Progress', {
    processed: ctx.processedCount,
    total: ctx.totalToProcess,
    discovered: ctx.discoveredCount,
    ratePerSec: rate.toFixed(2),
    etaMinutes: Math.ceil(remaining / 60),
  });
}

async function processSingleRecord(
  record: CsvRecord,
  ctx: ProcessingContext,
  semaphore: Semaphore
): Promise<void> {
  await semaphore.acquire();
  const key = `${record.Title}|${record.FandomURL}`;

  try {
    const result = await processRecord(record);
    ctx.processedCount++;

    if (result) {
      ctx.discoveredCount++;
      ctx.state.results.set(key, result.result);
      logger.debug('Discovered URLs', { title: result.title, urlCount: result.result.split('|').length });
    }

    ctx.state.processed.add(key);
    logProgress(ctx);

    if (ctx.processedCount % PROGRESS_SAVE_INTERVAL === 0) {
      saveProgress(ctx.state);
    }
  } finally {
    semaphore.release();
  }
}

async function processRecordsParallel(
  records: CsvRecord[],
  state: ProgressState
): Promise<{ processed: number; discovered: number }> {
  const semaphore = new Semaphore(MAX_CONCURRENT_DOMAINS);

  const toProcess = records.filter(r => {
    const key = `${r.Title}|${r.FandomURL}`;
    return isValidUrl(r.FandomURL) && !state.processed.has(key);
  });

  logger.info('Starting parallel processing', {
    total: toProcess.length,
    alreadyProcessed: state.processed.size,
    concurrency: MAX_CONCURRENT_DOMAINS,
  });

  const ctx: ProcessingContext = {
    state,
    processedCount: 0,
    discoveredCount: 0,
    totalToProcess: toProcess.length,
    startTime: Date.now(),
  };

  const batchSize = 50;
  for (let i = 0; i < toProcess.length; i += batchSize) {
    const batch = toProcess.slice(i, i + batchSize);
    const promises = batch.map(record => processSingleRecord(record, ctx, semaphore));
    await Promise.all(promises);
  }

  saveProgress(state);
  return { processed: ctx.processedCount, discovered: ctx.discoveredCount };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  logger.info('Parallel Fandom URL Discovery Script starting', {
    csvPath: CSV_PATH,
    maxConcurrency: MAX_CONCURRENT_DOMAINS,
  });

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRecord[];
  logger.info('CSV loaded', { totalRecords: records.length });

  const withFandom = records.filter(r => isValidUrl(r.FandomURL));
  logger.info('Records with valid Fandom URLs', { count: withFandom.length });

  const state = loadProgress();
  const { processed, discovered } = await processRecordsParallel(records, state);
  logger.info('Discovery complete', { processed, discovered, totalResults: state.results.size });

  // Apply results to records
  for (const record of records) {
    record.FandomDiscoveredURLs ??= '';
    const key = `${record.Title}|${record.FandomURL}`;
    const result = state.results.get(key);
    if (result) {
      record.FandomDiscoveredURLs = result;
    }
  }

  const columns = ['Title', 'AniListID', 'WikipediaURL', 'FandomURL', 'ComicVineID', 'FandomDiscoveredURLs'];
  const output = stringify(records, { header: true, columns });
  fs.writeFileSync(OUTPUT_PATH, output);
  logger.info('Output written', { path: OUTPUT_PATH });

  if (fs.existsSync(PROGRESS_PATH)) {
    fs.unlinkSync(PROGRESS_PATH);
    logger.info('Progress file cleaned up');
  }
}

main().catch(err => {
  logger.error('Script failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
