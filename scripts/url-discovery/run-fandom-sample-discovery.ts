#!/usr/bin/env bun
/**
 * Fandom Sample Page Discovery Script
 *
 * Discovers individual chapter/volume sample pages from Fandom wikis.
 * For each Fandom URL, probes for pages like Chapter_1, Volume_1, etc.
 *
 * The discovered URLs are actual content pages that can be used for ML training,
 * not just the list/category pages.
 *
 * Usage: bun run scripts/url-discovery/run-fandom-sample-discovery.ts
 *
 * @module url-discovery/run-fandom-sample-discovery
 */

import * as fs from 'node:fs';

import { extractDomainFromUrl, probeUrl } from '../../src/server/services/fandom/adaptive/url-discoverer';
import { logger } from '../../src/utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = './ml-training-pages.csv';
const OUTPUT_PATH = './ml-training-pages-with-fandom-samples.csv';
const CHECKPOINT_PATH = './ml-training-pages-fandom-samples-checkpoint.json';
const DELAY_MS = 300; // Shorter delay for Fandom (more lenient rate limiting)
const PROGRESS_INTERVAL = 50;
const SAVE_INTERVAL = 100; // Save progress every N records
const SAMPLE_COUNT = 5; // Probe pages 1-5

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
  WikipediaDiscoveredURLs?: string;
  ComicVineDiscoveredURLs?: string;
  [key: string]: string | undefined;
}

interface DiscoveryResult {
  chapterPages: string[];
  volumePages: string[];
}

interface Checkpoint {
  lastProcessedIndex: number;
  processedCount: number;
  discoveredCount: number;
  lastSaveTime: string;
  totalRecords: number;
}

// ============================================================================
// CSV Parsing Utilities (same as ComicVine script)
// ============================================================================

/**
 * Handle a character inside a quoted field.
 */
function handleQuotedChar(
  line: string,
  i: number,
  current: string
): { current: string; skipNext: boolean; endQuote: boolean } {
  const char = line[i];

  if (char === '"') {
    if (i + 1 < line.length && line[i + 1] === '"') {
      return { current: current + '"', skipNext: true, endQuote: false };
    }
    return { current, skipNext: false, endQuote: true };
  }

  return { current: current + char, skipNext: false, endQuote: false };
}

/**
 * Handle a character outside a quoted field.
 */
function handleUnquotedChar(
  char: string,
  current: string,
  fields: string[]
): { current: string; startQuote: boolean; fieldEnd: boolean } {
  if (char === '"') {
    return { current, startQuote: true, fieldEnd: false };
  }
  if (char === ',') {
    fields.push(current.trim());
    return { current: '', startQuote: false, fieldEnd: true };
  }
  return { current: current + char, startQuote: false, fieldEnd: false };
}

/**
 * Parse a CSV line handling quoted fields and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (!char) {
      i++;
      continue;
    }

    if (inQuotes) {
      const result = handleQuotedChar(line, i, current);
      current = result.current;
      if (result.endQuote) {
        inQuotes = false;
      }
      i += result.skipNext ? 2 : 1;
    } else {
      const result = handleUnquotedChar(char, current, fields);
      current = result.current;
      if (result.startQuote) {
        inQuotes = true;
      }
      i++;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV content into array of records.
 */
function parseCsv(content: string): { headers: string[]; records: CsvRecord[] } {
  const lines = content.split('\n').filter(line => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error('CSV file has no header');
  }
  const headers = parseCsvLine(headerLine);

  const records: CsvRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;

    const fields = parseCsvLine(line);
    const record: CsvRecord = {
      Title: '',
      AniListID: '',
      WikipediaURL: '',
      FandomURL: '',
      ComicVineID: '',
    };

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        record[header] = fields[j] ?? '';
      }
    }

    records.push(record);
  }

  return { headers, records };
}

/**
 * Escape a field for CSV output.
 */
function escapeCsvField(field: string | undefined): string {
  if (field === null || field === undefined) {
    return '';
  }

  const value = String(field);

  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Write records to CSV format.
 */
function writeCsv(headers: string[], records: CsvRecord[]): string {
  const lines: string[] = [headers.map(escapeCsvField).join(',')];

  for (const record of records) {
    const fields = headers.map(h => escapeCsvField(record[h]));
    lines.push(fields.join(','));
  }

  return lines.join('\n') + '\n';
}

// ============================================================================
// Checkpoint Management
// ============================================================================

/**
 * Save checkpoint to allow resuming after interruption.
 */
function saveCheckpoint(
  checkpoint: Checkpoint,
  headers: string[],
  records: CsvRecord[]
): void {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2), 'utf-8');

  const output = writeCsv(headers, records);
  fs.writeFileSync(OUTPUT_PATH, output);

  logger.info('Checkpoint saved', {
    lastProcessedIndex: checkpoint.lastProcessedIndex,
    processedCount: checkpoint.processedCount,
    discoveredCount: checkpoint.discoveredCount,
  });
}

/**
 * Load checkpoint if it exists.
 */
function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    return null;
  }

  try {
    const content = fs.readFileSync(CHECKPOINT_PATH, 'utf-8');
    const checkpoint = JSON.parse(content) as Checkpoint;
    logger.info('Checkpoint loaded', {
      lastProcessedIndex: checkpoint.lastProcessedIndex,
      processedCount: checkpoint.processedCount,
      discoveredCount: checkpoint.discoveredCount,
      savedAt: checkpoint.lastSaveTime,
    });
    return checkpoint;
  } catch {
    logger.warn('Failed to load checkpoint, starting fresh');
    return null;
  }
}

/**
 * Delete checkpoint file after successful completion.
 */
function deleteCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    fs.unlinkSync(CHECKPOINT_PATH);
    logger.info('Checkpoint deleted');
  }
}

// ============================================================================
// Sample Page Discovery
// ============================================================================

const CHAPTER_PATTERNS = [
  '/wiki/Chapter_{N}',
  '/wiki/Chapter%20{N}',
  '/wiki/Episode_{N}',
  '/wiki/Ch._{N}',
  '/wiki/Chapter_0{N}', // Zero-padded
  '/wiki/Chapter_00{N}', // Double zero-padded
];

const VOLUME_PATTERNS = [
  '/wiki/Volume_{N}',
  '/wiki/Volume%20{N}',
  '/wiki/Vol._{N}',
  '/wiki/Tankōbon_{N}',
  '/wiki/Tankobon_{N}',
  '/wiki/Volume_0{N}', // Zero-padded
  '/wiki/Volume_00{N}', // Double zero-padded
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
    // Handle zero-padding patterns
    let numStr = String(pageNumber);
    if (pattern.includes('00{N}')) {
      numStr = String(pageNumber).padStart(3, '0');
    } else if (pattern.includes('0{N}')) {
      numStr = String(pageNumber).padStart(2, '0');
    }

    const url = `${baseUrl}${pattern.replace('{N}', numStr).replace('0{N}', numStr).replace('00{N}', numStr)}`;
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
// Fandom URL Validation
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

// ============================================================================
// Discovery Logic
// ============================================================================

/**
 * Discover sample chapter/volume URLs for a Fandom wiki domain.
 */
async function discoverFandomSamples(fandomUrl: string): Promise<DiscoveryResult> {
  const emptyResult: DiscoveryResult = { chapterPages: [], volumePages: [] };

  if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') {
    return emptyResult;
  }

  const domain = extractDomainFromUrl(fandomUrl);
  if (!isValidFandomDomain(domain)) {
    return emptyResult;
  }

  // Discover sample chapter and volume pages
  const chapterPages = await discoverSamplePages(domain, CHAPTER_PATTERNS);
  const volumePages = await discoverSamplePages(domain, VOLUME_PATTERNS);

  return { chapterPages, volumePages };
}

/**
 * Parse existing FandomDiscoveredURLs to extract by type.
 */
function parseExistingDiscoveredUrls(urls: string | undefined): {
  listUrls: string[];
  chapterUrls: string[];
  volumeUrls: string[];
  categoryUrls: string[];
  otherUrls: string[];
} {
  const result = {
    listUrls: [] as string[],
    chapterUrls: [] as string[],
    volumeUrls: [] as string[],
    categoryUrls: [] as string[],
    otherUrls: [] as string[],
  };

  if (!urls || urls.trim() === '') {
    return result;
  }

  const parts = urls.split('|');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('LIST:')) {
      result.listUrls.push(trimmed);
    } else if (trimmed.startsWith('CHAPTER:')) {
      result.chapterUrls.push(trimmed);
    } else if (trimmed.startsWith('VOLUME:')) {
      result.volumeUrls.push(trimmed);
    } else if (trimmed.startsWith('CATEGORY:')) {
      result.categoryUrls.push(trimmed);
    } else if (trimmed) {
      result.otherUrls.push(trimmed);
    }
  }

  return result;
}

/**
 * Check if a record already has sample chapter/volume pages.
 */
function hasExistingSamples(record: CsvRecord): boolean {
  const existing = parseExistingDiscoveredUrls(record.FandomDiscoveredURLs);
  // Consider having samples if we have at least 2 chapter or 2 volume entries
  return existing.chapterUrls.length >= 2 || existing.volumeUrls.length >= 2;
}

/**
 * Merge new discovered samples with existing URLs.
 */
function mergeDiscoveredUrls(
  existing: string | undefined,
  newSamples: DiscoveryResult
): string {
  const parsed = parseExistingDiscoveredUrls(existing);

  // Add new chapter samples (avoid duplicates)
  const existingChapterSet = new Set(parsed.chapterUrls.map(u => u.replace('CHAPTER:', '')));
  for (const url of newSamples.chapterPages) {
    if (!existingChapterSet.has(url)) {
      parsed.chapterUrls.push(`CHAPTER:${url}`);
    }
  }

  // Add new volume samples (avoid duplicates)
  const existingVolumeSet = new Set(parsed.volumeUrls.map(u => u.replace('VOLUME:', '')));
  for (const url of newSamples.volumePages) {
    if (!existingVolumeSet.has(url)) {
      parsed.volumeUrls.push(`VOLUME:${url}`);
    }
  }

  // Reconstruct the URL string in order: LIST, CATEGORY, CHAPTER, VOLUME, OTHER
  const allUrls = [
    ...parsed.listUrls,
    ...parsed.categoryUrls,
    ...parsed.chapterUrls,
    ...parsed.volumeUrls,
    ...parsed.otherUrls,
  ];

  return allUrls.join('|');
}

// ============================================================================
// CSV Processing
// ============================================================================

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logProgress(processed: number, total: number, discovered: number, startTime: number): void {
  if (processed % PROGRESS_INTERVAL !== 0 && processed !== total) return;

  const elapsed = (Date.now() - startTime) / 1000;
  const rate = processed / elapsed;
  const remaining = (total - processed) / rate;
  logger.info('Discovery progress', {
    processed,
    total,
    discovered,
    rate: rate.toFixed(2),
    etaMinutes: Math.ceil(remaining / 60),
  });
}

interface ProcessingState {
  processed: number;
  discovered: number;
  skipped: number;
  sinceLastSave: number;
}

/**
 * Handle checkpoint saving if needed.
 */
function maybeSaveCheckpoint(
  state: ProcessingState,
  index: number,
  headers: string[],
  records: CsvRecord[]
): void {
  if (state.sinceLastSave < SAVE_INTERVAL) return;

  saveCheckpoint(
    {
      lastProcessedIndex: index + 1,
      processedCount: state.processed,
      discoveredCount: state.discovered,
      lastSaveTime: new Date().toISOString(),
      totalRecords: records.length,
    },
    headers,
    records
  );
  state.sinceLastSave = 0;
}

/**
 * Process a single record and update its FandomDiscoveredURLs.
 */
async function processRecord(record: CsvRecord): Promise<boolean> {
  const fandomUrl = record.FandomURL?.trim();

  if (!isValidUrl(fandomUrl)) {
    return false;
  }

  const samples = await discoverFandomSamples(fandomUrl ?? '');
  const totalFound = samples.chapterPages.length + samples.volumePages.length;

  if (totalFound > 0) {
    record.FandomDiscoveredURLs = mergeDiscoveredUrls(record.FandomDiscoveredURLs, samples);
    logger.debug('Discovered sample URLs', {
      title: record.Title,
      chapters: samples.chapterPages.length,
      volumes: samples.volumePages.length,
    });
    return true;
  }

  return false;
}

/**
 * Process and update state for a single record.
 */
async function processAndUpdateState(
  record: CsvRecord,
  state: ProcessingState
): Promise<void> {
  const found = await processRecord(record);
  if (found) state.discovered++;
  state.processed++;
  state.sinceLastSave++;
}

async function processRecords(
  records: CsvRecord[],
  headers: string[],
  startIndex: number,
  initialProcessed: number,
  initialDiscovered: number
): Promise<{ processed: number; discovered: number; skipped: number }> {
  const state: ProcessingState = {
    processed: initialProcessed,
    discovered: initialDiscovered,
    skipped: 0,
    sinceLastSave: 0,
  };
  const startTime = Date.now();
  const totalValid = records.filter(r => isValidUrl(r.FandomURL)).length;

  for (let i = startIndex; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;

    record.FandomDiscoveredURLs ??= '';

    if (!isValidUrl(record.FandomURL)) continue;
    if (hasExistingSamples(record)) {
      state.skipped++;
      continue;
    }

    try {
      await processAndUpdateState(record, state);
      logProgress(state.processed, totalValid - state.skipped, state.discovered, startTime);
      maybeSaveCheckpoint(state, i, headers, records);
      await sleep(DELAY_MS);
    } catch (error) {
      logger.error('Error processing record', {
        title: record.Title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed: state.processed, discovered: state.discovered, skipped: state.skipped };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  logger.info('Fandom Sample Page Discovery Script starting', { csvPath: CSV_PATH });

  if (!fs.existsSync(CSV_PATH)) {
    logger.error('CSV file not found', { path: CSV_PATH });
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const { headers, records } = parseCsv(csvContent);
  logger.info('CSV loaded', { totalRecords: records.length });

  // Check for existing checkpoint
  const checkpoint = loadCheckpoint();
  const startIndex = checkpoint?.lastProcessedIndex ?? 0;
  const initialProcessed = checkpoint?.processedCount ?? 0;
  const initialDiscovered = checkpoint?.discoveredCount ?? 0;

  if (checkpoint) {
    logger.info('Resuming from checkpoint', { startIndex, initialProcessed, initialDiscovered });
  }

  const withFandom = records.filter(r => isValidUrl(r.FandomURL));
  logger.info('Records with valid Fandom URLs', { count: withFandom.length });

  const needingSamples = withFandom.filter(r => !hasExistingSamples(r));
  logger.info('Records needing sample discovery', { count: needingSamples.length });

  const { processed, discovered, skipped } = await processRecords(
    records,
    headers,
    startIndex,
    initialProcessed,
    initialDiscovered
  );
  logger.info('Discovery complete', { processed, discovered, skipped });

  const output = writeCsv(headers, records);
  fs.writeFileSync(OUTPUT_PATH, output);
  logger.info('Output written', { path: OUTPUT_PATH });

  // Clean up checkpoint on success
  deleteCheckpoint();
}

main().catch(err => {
  logger.error('Script failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
