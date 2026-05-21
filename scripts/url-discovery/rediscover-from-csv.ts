#!/usr/bin/env bun
/**
 * Re-discover Fandom URLs using known domains from the training CSV.
 *
 * Uses FandomURL column from ml-training-pages-full.csv to discover
 * series-specific wiki pages for titles missing Fandom coverage.
 *
 * Usage:
 *   bun run scripts/url-discovery/rediscover-from-csv.ts --dry-run
 *   bun run scripts/url-discovery/rediscover-from-csv.ts
 *
 * @module url-discovery/rediscover-from-csv
 */

import * as fs from 'node:fs';

import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';

import {
  discoverAllChapterVolumeUrls,
  extractDomainFromUrl,
  probeUrl,
} from '../../src/server/services/fandom/adaptive/url-discoverer';

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = './ml-training-pages-full.csv';
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 200;
const PROGRESS_INTERVAL = 25;
const SAMPLE_COUNT = 5;
const MAX_LIST_PAGES = 8;

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
  FandomURL: string;
  FandomDiscoveredURLs?: string;
}

interface ProgressState {
  discovered: number;
  totalPages: number;
  failed: number;
  skipped: number;
  startTime: number;
}

// ============================================================================
// Sample Page Discovery
// ============================================================================

const CHAPTER_PATTERNS = ['/wiki/Chapter_{N}', '/wiki/Chapter%20{N}'];
const VOLUME_PATTERNS = ['/wiki/Volume_{N}', '/wiki/Volume%20{N}'];

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
    if (url) foundUrls.push(url);
  }

  return foundUrls;
}

// ============================================================================
// Discovery
// ============================================================================

function isValidDomain(domain: string | null): boolean {
  if (!domain) return false;
  if (MULTI_SERIES_WIKIS.has(domain)) return false;
  return domain.endsWith('.fandom.com') || domain.endsWith('.wikia.com');
}

async function discoverFromDomain(domain: string): Promise<string[]> {
  const allUrls: string[] = [];

  try {
    const listResult = await discoverAllChapterVolumeUrls(domain, {}, MAX_LIST_PAGES);
    allUrls.push(...listResult.candidates.map((c) => c.url));
  } catch {
    // List discovery failed
  }

  try {
    const chapters = await discoverSamplePages(domain, CHAPTER_PATTERNS);
    allUrls.push(...chapters);
  } catch {
    // Chapter discovery failed
  }

  try {
    const volumes = await discoverSamplePages(domain, VOLUME_PATTERNS);
    allUrls.push(...volumes);
  } catch {
    // Volume discovery failed
  }

  return allUrls;
}

// ============================================================================
// Database
// ============================================================================

const prisma = new PrismaClient();

async function getTitlesMissingFandom(): Promise<Set<string>> {
  const result = await prisma.$queryRaw<Array<{ mangaTitle: string }>>`
    SELECT DISTINCT "mangaTitle"
    FROM "AnnotatedPage" a
    WHERE NOT EXISTS (
      SELECT 1 FROM "AnnotatedPage" b
      WHERE b."mangaTitle" = a."mangaTitle"
      AND b."sourceType" = 'FANDOM'
    )
  `;
  return new Set(result.map((r) => r.mangaTitle));
}

async function insertPage(url: string, mangaTitle: string): Promise<boolean> {
  try {
    await prisma.annotatedPage.create({
      data: {
        url,
        mangaTitle,
        sourceType: 'FANDOM',
        status: 'BOOTSTRAP',
        htmlSnapshot: '',
        tokens: [],
        labels: [],
      },
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('Unique constraint')) {
      process.stderr.write(`Insert error: ${msg}\n`);
    }
    return false;
  }
}

async function insertDiscoveredPages(title: string, urls: string[]): Promise<number> {
  let inserted = 0;
  for (const url of urls) {
    const ok = await insertPage(url, title);
    if (ok) inserted++;
  }
  return inserted;
}

// ============================================================================
// CSV Loading
// ============================================================================

function loadCsvFandomDomains(): Map<string, string> {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRecord[];

  const domainMap = new Map<string, string>();
  for (const record of records) {
    const fandomUrl = record.FandomURL?.trim();
    if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') continue;

    const domain = extractDomainFromUrl(fandomUrl);
    if (isValidDomain(domain)) {
      domainMap.set(record.Title, domain);
    }
  }

  return domainMap;
}

// ============================================================================
// Progress
// ============================================================================

function logProgress(index: number, total: number, state: ProgressState): void {
  if ((index + 1) % PROGRESS_INTERVAL !== 0) return;

  const elapsed = (Date.now() - state.startTime) / 1000;
  const rate = (index + 1) / elapsed;
  const remaining = (total - index - 1) / rate;
  process.stdout.write(
    `[${index + 1}/${total}] Found: ${state.discovered}, Pages: ${state.totalPages}, ` +
    `Failed: ${state.failed}, Skipped: ${state.skipped}, ` +
    `Rate: ${rate.toFixed(1)}/s, ETA: ${Math.ceil(remaining / 60)}m\n`
  );
}

function logSummary(total: number, state: ProgressState): void {
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
  process.stdout.write(`\n${'='.repeat(60)}\n`);
  process.stdout.write(`Complete in ${elapsed}s\n`);
  process.stdout.write(`Titles with known domains: ${total}\n`);
  process.stdout.write(`Titles discovered: ${state.discovered}\n`);
  process.stdout.write(`Pages ${DRY_RUN ? 'would be ' : ''}inserted: ${state.totalPages}\n`);
  process.stdout.write(`Failed: ${state.failed}\n`);
  process.stdout.write(`Skipped (already has fandom): ${state.skipped}\n`);
}

// ============================================================================
// Processing
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processTitle(
  title: string,
  domain: string,
  state: ProgressState
): Promise<void> {
  const urls = await discoverFromDomain(domain);

  if (urls.length === 0) {
    state.failed++;
    return;
  }

  state.discovered++;

  if (DRY_RUN) {
    state.totalPages += urls.length;
    if (state.discovered <= 20) {
      process.stdout.write(`  [FOUND] ${title} → ${domain} (${urls.length} pages)\n`);
    }
  } else {
    state.totalPages += await insertDiscoveredPages(title, urls);
  }
}

async function main(): Promise<void> {
  process.stdout.write('Fandom Re-Discovery from CSV\n');
  process.stdout.write(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);
  process.stdout.write(`CSV: ${CSV_PATH}\n\n`);

  const domainMap = loadCsvFandomDomains();
  process.stdout.write(`Titles with FandomURL in CSV: ${domainMap.size}\n`);

  const missingTitles = await getTitlesMissingFandom();
  process.stdout.write(`Titles missing Fandom coverage: ${missingTitles.size}\n`);

  // Filter to only titles that need discovery AND have a known domain
  const toProcess: Array<[string, string]> = [];
  for (const [title, domain] of domainMap) {
    if (missingTitles.has(title)) {
      toProcess.push([title, domain]);
    }
  }
  process.stdout.write(`Titles to process: ${toProcess.length}\n\n`);

  const state: ProgressState = {
    discovered: 0,
    totalPages: 0,
    failed: 0,
    skipped: 0,
    startTime: Date.now(),
  };

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    if (!entry) continue;
    const [title, domain] = entry;

    try {
      await processTitle(title, domain, state);
    } catch (error) {
      state.failed++;
      process.stderr.write(
        `Error: ${title}: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }

    logProgress(i, toProcess.length, state);
    await sleep(DELAY_MS);
  }

  logSummary(toProcess.length, state);
  await prisma.$disconnect();
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
