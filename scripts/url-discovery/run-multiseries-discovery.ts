#!/usr/bin/env bun
/**
 * Multi-Series Wiki Discovery Script
 *
 * Discovers chapter/volume pages for manga on multi-series wikis
 * (webtoon.fandom.com, manga.fandom.com, etc.) by probing URLs
 * relative to each manga's specific page.
 *
 * Usage: bun run scripts/url-discovery/run-multiseries-discovery.ts
 *        bun run scripts/url-discovery/run-multiseries-discovery.ts --dry-run
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const CSV_PATH = path.join(process.cwd(), 'ml-training-pages.csv');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 200;
const SAVE_INTERVAL = 50;

const MULTI_SERIES_WIKIS = new Set([
  'webtoon.fandom.com',
  'manga.fandom.com',
  'yaoi.fandom.com',
  'animanga.fandom.com',
  'kodansha-comics.fandom.com',
  'shonen-jump.fandom.com',
  'manga-encyclopedie.fandom.com',
]);

// Patterns relative to manga page name
const RELATIVE_PATTERNS = [
  '/Chapters',
  '/Volumes',
  '/Chapters_and_Volumes',
  '/Episode_List',
  '/Chapter_List',
  '/Volume_List',
  '/List_of_Chapters',
  '/List_of_Volumes',
  '/Media',
];

// Category patterns
const CATEGORY_PATTERNS = [
  'Category:{name}_Chapters',
  'Category:{name}_Volumes',
  'Category:{name}',
];

// Chapter/Volume sample patterns
const CHAPTER_PATTERNS = [
  '{name}/Chapter_1',
  '{name}/Chapter_2',
  '{name}/Ch._1',
  '{name}/Episode_1',
];

const VOLUME_PATTERNS = [
  '{name}/Volume_1',
  '{name}/Volume_2',
  '{name}/Vol._1',
];

interface CSVRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs: string;
  WikipediaDiscoveredURLs: string;
  ComicVineDiscoveredURLs: string;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      if (inQuotes && line[j + 1] === '"') { current += '"'; j++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n');
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const v = parseCSVLine(line);
    rows.push({
      Title: v[0] ?? '',
      AniListID: v[1] ?? '',
      WikipediaURL: v[2] ?? '',
      FandomURL: v[3] ?? '',
      ComicVineID: v[4] ?? '',
      FandomDiscoveredURLs: v[5] ?? '',
      WikipediaDiscoveredURLs: v[6] ?? '',
      ComicVineDiscoveredURLs: v[7] ?? '',
    });
  }
  return rows;
}

function escapeCSV(v: string): string {
  if (!v) return '';
  return v.includes(',') || v.includes('"') || v.includes('\n')
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}

function writeCSV(rows: CSVRow[]): void {
  const header = 'Title,AniListID,WikipediaURL,FandomURL,ComicVineID,FandomDiscoveredURLs,WikipediaDiscoveredURLs,ComicVineDiscoveredURLs';
  const lines = rows.map(r => [
    r.Title, r.AniListID, r.WikipediaURL, r.FandomURL, r.ComicVineID,
    r.FandomDiscoveredURLs, r.WikipediaDiscoveredURLs, r.ComicVineDiscoveredURLs
  ].map(escapeCSV).join(','));
  fs.writeFileSync(CSV_PATH, [header, ...lines].join('\n'));
}

function extractMangaPageInfo(url: string): { domain: string; pageName: string; baseUrl: string } | null {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    if (!MULTI_SERIES_WIKIS.has(domain)) return null;

    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)/);
    if (!pathMatch?.[1]) return null;

    const pageName = decodeURIComponent(pathMatch[1]);
    return { domain, pageName, baseUrl: `https://${domain}/wiki/` };
  } catch {
    return null;
  }
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MuggiwaraBot/1.0)' },
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function discoverForManga(info: { domain: string; pageName: string; baseUrl: string }): Promise<string[]> {
  const found: string[] = [];
  const encodedName = encodeURIComponent(info.pageName).replace(/%20/g, '_');

  // Try relative patterns (e.g., /wiki/MangaName/Chapters)
  for (const pattern of RELATIVE_PATTERNS) {
    const url = `${info.baseUrl}${encodedName}${pattern}`;
    if (await probeUrl(url)) {
      found.push(`LIST:${url}`);
    }
    await sleep(DELAY_MS);
  }

  // Try category patterns
  for (const pattern of CATEGORY_PATTERNS) {
    const categoryName = pattern.replace('{name}', encodedName);
    const url = `${info.baseUrl}${categoryName}`;
    if (await probeUrl(url)) {
      found.push(`CATEGORY:${url}`);
    }
    await sleep(DELAY_MS);
  }

  // Try sample chapter pages
  for (const pattern of CHAPTER_PATTERNS) {
    const pagePath = pattern.replace('{name}', encodedName);
    const url = `${info.baseUrl}${pagePath}`;
    if (await probeUrl(url)) {
      found.push(`CHAPTER:${url}`);
      break; // Only need one sample
    }
    await sleep(DELAY_MS);
  }

  // Try sample volume pages
  for (const pattern of VOLUME_PATTERNS) {
    const pagePath = pattern.replace('{name}', encodedName);
    const url = `${info.baseUrl}${pagePath}`;
    if (await probeUrl(url)) {
      found.push(`VOLUME:${url}`);
      break; // Only need one sample
    }
    await sleep(DELAY_MS);
  }

  return found;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main(): Promise<void> {
  process.stdout.write('Multi-Series Wiki Discovery\n');
  process.stdout.write(`Dry run: ${DRY_RUN}\n\n`);

  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  process.stdout.write(`Total rows: ${rows.length}\n`);

  // Find rows that need discovery
  const toProcess = rows.filter(row => {
    if (!row.FandomURL || row.FandomURL === 'DOES_NOT_EXIST') return false;
    if (row.FandomDiscoveredURLs) return false; // Already has discovered URLs
    const info = extractMangaPageInfo(row.FandomURL);
    return info !== null;
  });

  process.stdout.write(`Multi-series wiki titles to process: ${toProcess.length}\n\n`);

  if (DRY_RUN) {
    process.stdout.write('Sample titles:\n');
    for (const row of toProcess.slice(0, 10)) {
      const info = extractMangaPageInfo(row.FandomURL);
      process.stdout.write(`  ${row.Title} -> ${info?.pageName}\n`);
    }
    return;
  }

  let processed = 0;
  let discovered = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const info = extractMangaPageInfo(row.FandomURL);
    if (!info) continue;
    if (row.FandomDiscoveredURLs) continue; // Skip if already has data

    const urls = await discoverForManga(info);
    processed++;

    if (urls.length > 0) {
      row.FandomDiscoveredURLs = urls.join('|');
      discovered++;
      process.stdout.write(`[${processed}] ${row.Title}: ${urls.length} URLs found\n`);
    }

    // Progress update
    if (processed % 20 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = (toProcess.length - processed) / rate;
      process.stdout.write(`  Progress: ${processed}/${toProcess.length}, Rate: ${rate.toFixed(1)}/s, ETA: ${Math.ceil(remaining / 60)}min\n`);
    }

    // Save periodically
    if (processed % SAVE_INTERVAL === 0) {
      writeCSV(rows);
      process.stdout.write(`  [Saved]\n`);
    }
  }

  // Final save
  writeCSV(rows);
  process.stdout.write(`\nComplete! Processed: ${processed}, Discovered: ${discovered}\n`);
}

main().catch(e => {
  process.stderr.write(`Error: ${e}\n`);
  process.exit(1);
});
