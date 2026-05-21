#!/usr/bin/env bun
/**
 * ComicVine Issue URL Discovery Script
 *
 * Discovers individual volume/issue URLs from ComicVine series pages.
 * For each series URL (4050-XXXXX), fetches the actual volume issue URLs (4000-XXXXX).
 *
 * The discovered URLs are the actual volume pages that contain chapter metadata,
 * not just the series overview page.
 *
 * Usage: bun run scripts/url-discovery/run-comicvine-discovery.ts
 *
 * @module url-discovery/run-comicvine-discovery
 */

import * as fs from 'node:fs';

import { ComicVineService } from '../../src/server/services/comicvine/service';
import type { ComicVineIssue } from '../../src/server/services/comicvine/comicvine/types';
import { logger } from '../../src/utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = './ml-training-pages.csv';
const OUTPUT_PATH = './ml-training-pages-with-comicvine-discovery.csv';
const CHECKPOINT_PATH = './ml-training-pages-comicvine-checkpoint.json';
const DELAY_MS = 1000; // Longer delay for ComicVine rate limiting
const PROGRESS_INTERVAL = 10;
const SAVE_INTERVAL = 50; // Save progress every N records
const MAX_ISSUES_TO_FETCH = 5; // Only fetch first N issues as samples

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

interface IssueInfo {
  issueNumber: number;
  url: string;
}

interface Checkpoint {
  lastProcessedIndex: number;
  processedCount: number;
  discoveredCount: number;
  lastSaveTime: string;
  totalRecords: number;
}

// ============================================================================
// CSV Parsing Utilities
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
  // Save checkpoint metadata
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2), 'utf-8');

  // Save current progress to output file
  if (!headers.includes('ComicVineDiscoveredURLs')) {
    headers.push('ComicVineDiscoveredURLs');
  }
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
// Issue Data Extraction
// ============================================================================

/**
 * Extract issue info from a single issue data object.
 */
function extractIssueInfo(issue: ComicVineIssue): IssueInfo | null {
  if (!issue.site_detail_url) {
    return null;
  }

  const issueNumber = issue.issue_number ? parseInt(issue.issue_number, 10) : 0;
  return {
    issueNumber: isNaN(issueNumber) ? 0 : issueNumber,
    url: issue.site_detail_url,
  };
}

/**
 * Transform array of issue data into sorted IssueInfo array.
 */
function transformIssuesToInfos(issues: ComicVineIssue[]): IssueInfo[] {
  const issueInfos: IssueInfo[] = [];

  for (const issue of issues) {
    const info = extractIssueInfo(issue);
    if (info) {
      issueInfos.push(info);
    }
  }

  issueInfos.sort((a, b) => a.issueNumber - b.issueNumber);
  return issueInfos.slice(0, MAX_ISSUES_TO_FETCH);
}

// ============================================================================
// ComicVine Issue Discovery
// ============================================================================

/**
 * Parse and validate a ComicVine ID string.
 */
function parseComicVineId(comicvineId: string): number | null {
  const cleanId = comicvineId.replace(/^4050-/, '');
  const volumeId = parseInt(cleanId, 10);
  return isNaN(volumeId) ? null : volumeId;
}

/**
 * Discover issue URLs for a ComicVine volume using the API.
 */
async function discoverIssueUrls(
  service: ComicVineService,
  comicvineId: string
): Promise<IssueInfo[]> {
  const volumeId = parseComicVineId(comicvineId);

  if (volumeId === null) {
    logger.warn('Invalid ComicVine ID', { comicvineId });
    return [];
  }

  try {
    const issues = await service.getVolumeIssues(volumeId, 0, MAX_ISSUES_TO_FETCH);

    if (!issues || issues.length === 0) {
      logger.debug('No issues found for volume', { volumeId });
      return [];
    }

    return transformIssuesToInfos(issues);
  } catch (error) {
    logger.error('Error discovering issues', {
      comicvineId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Format discovered issue URLs as pipe-separated string with type prefixes.
 */
function formatDiscoveredUrls(issues: IssueInfo[]): string {
  if (issues.length === 0) {
    return '';
  }

  return issues.map(issue => `VOLUME:${issue.url}`).join('|');
}

// ============================================================================
// CSV Processing
// ============================================================================

function isValidComicVineId(id: string | undefined): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  if (trimmed === '' || trimmed === 'DOES_NOT_EXIST') return false;
  return /^(?:4050-)?\d+$/.test(trimmed);
}

function hasExistingDiscoveredUrls(record: CsvRecord): boolean {
  const urls = record.ComicVineDiscoveredURLs?.trim();
  return urls !== undefined && urls !== '' && urls.includes('/4000-');
}

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

/**
 * Process a single record and update its ComicVineDiscoveredURLs.
 */
async function processRecord(
  service: ComicVineService,
  record: CsvRecord
): Promise<boolean> {
  const comicvineId = record.ComicVineID?.trim();

  if (!isValidComicVineId(comicvineId)) {
    return false;
  }

  if (hasExistingDiscoveredUrls(record)) {
    logger.debug('Skipping - already has discovered URLs', { title: record.Title });
    return false;
  }

  const issues = await discoverIssueUrls(service, comicvineId ?? '');

  if (issues.length > 0) {
    record.ComicVineDiscoveredURLs = formatDiscoveredUrls(issues);
    logger.debug('Discovered issue URLs', {
      title: record.Title,
      comicvineId,
      issueCount: issues.length,
      sampleUrl: issues[0]?.url,
    });
    return true;
  }

  return false;
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
 * Process a single record and update state.
 */
async function processAndUpdateState(
  service: ComicVineService,
  record: CsvRecord,
  state: ProcessingState
): Promise<void> {
  const found = await processRecord(service, record);
  if (found) state.discovered++;
  state.processed++;
  state.sinceLastSave++;
}

async function processRecords(
  service: ComicVineService,
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
  const totalValid = records.filter(r => isValidComicVineId(r.ComicVineID)).length;

  for (let i = startIndex; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;

    record.ComicVineDiscoveredURLs ??= '';

    if (!isValidComicVineId(record.ComicVineID)) continue;
    if (hasExistingDiscoveredUrls(record)) {
      state.skipped++;
      continue;
    }

    try {
      await processAndUpdateState(service, record, state);
      logProgress(state.processed, totalValid - state.skipped, state.discovered, startTime);
      maybeSaveCheckpoint(state, i, headers, records);
      // eslint-disable-next-line no-await-in-loop -- Sequential for rate limiting
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
  logger.info('ComicVine Issue URL Discovery Script starting', { csvPath: CSV_PATH });

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

  const withComicVine = records.filter(r => isValidComicVineId(r.ComicVineID));
  logger.info('Records with valid ComicVine IDs', { count: withComicVine.length });

  // Initialize the service
  const service = new ComicVineService();
  const initialized = await service.initialize();
  if (!initialized) {
    logger.error('Failed to initialize ComicVine service');
    process.exit(1);
  }

  const { processed, discovered, skipped } = await processRecords(
    service,
    records,
    headers,
    startIndex,
    initialProcessed,
    initialDiscovered
  );
  logger.info('Discovery complete', { processed, discovered, skipped });

  // Ensure ComicVineDiscoveredURLs column is in headers
  if (!headers.includes('ComicVineDiscoveredURLs')) {
    headers.push('ComicVineDiscoveredURLs');
  }

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
