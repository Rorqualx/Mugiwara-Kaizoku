#!/usr/bin/env bun
/**
 * Re-discover Fandom URLs for titles missing Fandom coverage.
 *
 * Queries AnnotatedPage for titles without any FANDOM source pages,
 * then uses discoverFandom() to find series-specific wikis and inserts results.
 *
 * Usage:
 *   bun run scripts/url-discovery/rediscover-fandom-urls.ts --dry-run
 *   bun run scripts/url-discovery/rediscover-fandom-urls.ts
 *
 * @module url-discovery/rediscover-fandom-urls
 */

import { PrismaClient } from '@prisma/client';

import {
  discoverAllChapterVolumeUrls,
  extractDomainFromUrl,
  probeUrl,
} from '../../src/server/services/fandom/adaptive/url-discoverer';
import { logger } from '../../src/utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 300;
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

interface DiscoveryResult {
  title: string;
  domain: string | null;
  listPages: string[];
  chapterPages: string[];
  volumePages: string[];
  error?: string;
}

interface ProgressState {
  discovered: number;
  totalPages: number;
  failed: number;
  startTime: number;
}

// ============================================================================
// Domain Generation
// ============================================================================

function titleToSubdomain(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateFandomDomains(title: string): string[] {
  const domains: string[] = [];
  const fullSubdomain = titleToSubdomain(title);

  if (fullSubdomain) {
    domains.push(`${fullSubdomain}.fandom.com`);
  }

  const cleaned = title.replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanedSub = titleToSubdomain(cleaned);
  if (cleanedSub && cleanedSub !== fullSubdomain) {
    domains.push(`${cleanedSub}.fandom.com`);
  }

  const words = title.split(/\s+/);
  if (words.length > 2) {
    const twoWords = titleToSubdomain(words.slice(0, 2).join(' '));
    if (twoWords && !domains.includes(`${twoWords}.fandom.com`)) {
      domains.push(`${twoWords}.fandom.com`);
    }
  }

  return domains;
}

// ============================================================================
// Sample Page Discovery
// ============================================================================

const CHAPTER_PATTERNS = ['/wiki/Chapter_{N}', '/wiki/Chapter%20{N}', '/wiki/Ch._{N}'];
const VOLUME_PATTERNS = ['/wiki/Volume_{N}', '/wiki/Volume%20{N}', '/wiki/Vol._{N}'];

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
// Discovery Pipeline
// ============================================================================

function isValidDomain(domain: string | null): boolean {
  if (!domain) return false;
  if (MULTI_SERIES_WIKIS.has(domain)) return false;
  return domain.endsWith('.fandom.com') || domain.endsWith('.wikia.com');
}

async function checkDomainExists(domain: string): Promise<boolean> {
  try {
    const result = await probeUrl(`https://${domain}/wiki/Main_Page`, { probeTimeoutMs: 3000 });
    return result.exists;
  } catch {
    return false;
  }
}

async function discoverFromDomain(domain: string): Promise<Omit<DiscoveryResult, 'title'> | null> {
  // Quick check: does the wiki even exist?
  const exists = await checkDomainExists(domain);
  if (!exists) return null;

  try {
    const listResult = await discoverAllChapterVolumeUrls(domain, {}, MAX_LIST_PAGES);
    const listPages = listResult.candidates.map((c) => c.url);
    const chapterPages = await discoverSamplePages(domain, CHAPTER_PATTERNS);
    const volumePages = await discoverSamplePages(domain, VOLUME_PATTERNS);

    const total = listPages.length + chapterPages.length + volumePages.length;
    if (total > 0) {
      return { domain, listPages, chapterPages, volumePages };
    }
  } catch {
    // Domain probe failed
  }
  return null;
}

async function discoverViaDomainProbing(title: string): Promise<Omit<DiscoveryResult, 'title'> | null> {
  const domains = generateFandomDomains(title);
  for (const domain of domains) {
    const result = await discoverFromDomain(domain);
    if (result) return result;
  }
  return null;
}

async function discoverForTitle(title: string): Promise<DiscoveryResult> {
  const empty: DiscoveryResult = {
    title,
    domain: null,
    listPages: [],
    chapterPages: [],
    volumePages: [],
  };

  // Domain probing only — FandomProvider.search() is too slow for bulk discovery
  const probeResult = await discoverViaDomainProbing(title);
  if (probeResult) return { title, ...probeResult };

  return empty;
}

// ============================================================================
// Database Operations
// ============================================================================

const prisma = new PrismaClient();

async function getTitlesMissingFandom(): Promise<string[]> {
  const result = await prisma.$queryRaw<Array<{ mangaTitle: string }>>`
    SELECT DISTINCT "mangaTitle"
    FROM "AnnotatedPage" a
    WHERE NOT EXISTS (
      SELECT 1 FROM "AnnotatedPage" b
      WHERE b."mangaTitle" = a."mangaTitle"
      AND b."sourceType" = 'FANDOM'
    )
    ORDER BY "mangaTitle"
  `;
  return result.map((r) => r.mangaTitle);
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
      logger.error('Insert error', { url, mangaTitle, error: msg });
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
// Progress Reporting
// ============================================================================

function logProgress(index: number, total: number, state: ProgressState): void {
  if ((index + 1) % PROGRESS_INTERVAL !== 0) return;

  const elapsed = (Date.now() - state.startTime) / 1000;
  const rate = (index + 1) / elapsed;
  const remaining = (total - index - 1) / rate;
  process.stdout.write(
    `[${index + 1}/${total}] Discovered: ${state.discovered}, Pages: ${state.totalPages}, ` +
    `Failed: ${state.failed}, Rate: ${rate.toFixed(1)}/s, ETA: ${Math.ceil(remaining / 60)}m\n`
  );
}

function logDryRunSample(result: DiscoveryResult, allUrls: string[], count: number): void {
  if (count <= 10) {
    process.stdout.write(
      `  [FOUND] ${result.title} → ${result.domain} (${allUrls.length} pages)\n`
    );
  }
}

function logSummary(total: number, state: ProgressState): void {
  const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
  process.stdout.write(`\n${'='.repeat(60)}\n`);
  process.stdout.write(`Complete in ${elapsed}s\n`);
  process.stdout.write(`Titles discovered: ${state.discovered}/${total}\n`);
  process.stdout.write(`Pages ${DRY_RUN ? 'would be ' : ''}inserted: ${state.totalPages}\n`);
  process.stdout.write(`Titles not found: ${state.failed}\n`);
}

// ============================================================================
// Processing
// ============================================================================

function collectUrls(result: DiscoveryResult): string[] {
  return [...result.listPages, ...result.chapterPages, ...result.volumePages];
}

async function processTitle(title: string, state: ProgressState): Promise<void> {
  const result = await discoverForTitle(title);
  const allUrls = collectUrls(result);

  if (allUrls.length === 0) {
    state.failed++;
    return;
  }

  state.discovered++;

  if (DRY_RUN) {
    state.totalPages += allUrls.length;
    logDryRunSample(result, allUrls, state.discovered);
  } else {
    state.totalPages += await insertDiscoveredPages(title, allUrls);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  process.stdout.write('Fandom URL Re-Discovery Script\n');
  process.stdout.write(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n\n`);

  const titles = await getTitlesMissingFandom();
  process.stdout.write(`Titles missing Fandom coverage: ${titles.length}\n\n`);

  const state: ProgressState = { discovered: 0, totalPages: 0, failed: 0, startTime: Date.now() };

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i];
    if (!title) continue;

    try {
      await processTitle(title, state);
    } catch (error) {
      state.failed++;
      logger.error('Discovery failed', {
        title,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logProgress(i, titles.length, state);
    await sleep(DELAY_MS);
  }

  logSummary(titles.length, state);
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error('Script failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
