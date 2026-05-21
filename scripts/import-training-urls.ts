/**
 * Import discovered URLs from training CSV into AnnotatedPage table
 *
 * Usage: bun run scripts/import-training-urls.ts
 *        bun run scripts/import-training-urls.ts --dry-run
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { PrismaClient } from '@prisma/client';

const CSV_PATH = path.join(process.cwd(), 'ml-training-pages.csv');
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient();

interface DiscoveredUrl {
  type: string;
  url: string;
  categoryName?: string;
}

interface TrainingEntry {
  title: string;
  fandomDiscoveredUrls: DiscoveredUrl[];
  wikipediaDiscoveredUrls: DiscoveredUrl[];
  comicVineDiscoveredUrls: DiscoveredUrl[];
}

interface PageToImport {
  url: string;
  mangaTitle: string;
  sourceType: 'FANDOM' | 'WIKIPEDIA' | 'COMICVINE';
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      if (inQuotes && line[j + 1] === '"') {
        current += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
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

function parseCategoryUrl(rest: string): DiscoveredUrl | null {
  const colonIndex = rest.indexOf(':http');
  if (colonIndex > 0) {
    return {
      type: 'CATEGORY',
      categoryName: rest.substring(0, colonIndex),
      url: rest.substring(colonIndex + 1),
    };
  }
  return null;
}

function parseTypedUrl(trimmed: string): DiscoveredUrl | null {
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) return null;

  const type = trimmed.substring(0, colonIndex);
  const url = trimmed.substring(colonIndex + 1);
  if (!url.startsWith('http')) return null;

  return { type, url };
}

function parseDiscoveredUrls(urlsString: string): DiscoveredUrl[] {
  if (!urlsString || urlsString.trim() === '') {
    return [];
  }

  const urls: DiscoveredUrl[] = [];
  const parts = urlsString.split('|');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('CATEGORY:')) {
      const rest = trimmed.substring('CATEGORY:'.length);
      const parsed = parseCategoryUrl(rest);
      if (parsed) {
        urls.push(parsed);
        continue;
      }
    }

    const parsed = parseTypedUrl(trimmed);
    if (parsed) {
      urls.push(parsed);
    }
  }

  return urls;
}

function loadTrainingData(): TrainingEntry[] {
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n');

  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return [];
  }
  const headers = parseCSVLine(headerLine);

  const columnIndex: Record<string, number> = {};
  headers.forEach((header, idx) => {
    columnIndex[header.trim()] = idx;
  });

  const entries: TrainingEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const getColumn = (name: string): string => {
      const idx = columnIndex[name];
      return idx !== undefined ? (values[idx] ?? '') : '';
    };

    entries.push({
      title: getColumn('Title'),
      fandomDiscoveredUrls: parseDiscoveredUrls(getColumn('FandomDiscoveredURLs')),
      wikipediaDiscoveredUrls: parseDiscoveredUrls(getColumn('WikipediaDiscoveredURLs')),
      comicVineDiscoveredUrls: parseDiscoveredUrls(getColumn('ComicVineDiscoveredURLs')),
    });
  }

  return entries;
}

function collectPagesToImport(entries: TrainingEntry[]): PageToImport[] {
  const pages: PageToImport[] = [];

  for (const entry of entries) {
    for (const discovered of entry.fandomDiscoveredUrls) {
      pages.push({ url: discovered.url, mangaTitle: entry.title, sourceType: 'FANDOM' });
    }
    for (const discovered of entry.wikipediaDiscoveredUrls) {
      pages.push({ url: discovered.url, mangaTitle: entry.title, sourceType: 'WIKIPEDIA' });
    }
    for (const discovered of entry.comicVineDiscoveredUrls) {
      pages.push({ url: discovered.url, mangaTitle: entry.title, sourceType: 'COMICVINE' });
    }
  }

  return pages;
}

async function getExistingUrls(): Promise<Set<string>> {
  const existing = await prisma.annotatedPage.findMany({ select: { url: true } });
  return new Set(existing.map((p) => p.url));
}

async function importPage(page: PageToImport): Promise<boolean> {
  try {
    await prisma.annotatedPage.create({
      data: {
        url: page.url,
        mangaTitle: page.mangaTitle,
        sourceType: page.sourceType,
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
      process.stderr.write(`  Error: ${msg}\n`);
    }
    return false;
  }
}

async function main(): Promise<void> {
  process.stdout.write('Discovered URLs Importer\n');
  process.stdout.write(`CSV: ${CSV_PATH}\n`);
  process.stdout.write(`Dry run: ${DRY_RUN}\n\n`);

  const entries = loadTrainingData();
  process.stdout.write(`CSV entries: ${entries.length}\n`);

  const allPages = collectPagesToImport(entries);
  const bySource = {
    FANDOM: allPages.filter((p) => p.sourceType === 'FANDOM').length,
    WIKIPEDIA: allPages.filter((p) => p.sourceType === 'WIKIPEDIA').length,
    COMICVINE: allPages.filter((p) => p.sourceType === 'COMICVINE').length,
  };
  process.stdout.write(`Discovered URLs by source:\n`);
  process.stdout.write(`  FANDOM: ${bySource.FANDOM}\n`);
  process.stdout.write(`  WIKIPEDIA: ${bySource.WIKIPEDIA}\n`);
  process.stdout.write(`  COMICVINE: ${bySource.COMICVINE}\n`);
  process.stdout.write(`  Total: ${allPages.length}\n\n`);

  const existingUrls = await getExistingUrls();
  process.stdout.write(`Already in DB: ${existingUrls.size}\n`);

  const newPages = allPages.filter((p) => !existingUrls.has(p.url));
  process.stdout.write(`New to import: ${newPages.length}\n\n`);

  if (DRY_RUN) {
    process.stdout.write('Sample pages to import:\n');
    for (const page of newPages.slice(0, 20)) {
      process.stdout.write(`  [${page.sourceType}] ${page.mangaTitle}: ${page.url}\n`);
    }
    process.stdout.write(`\nDry run complete. Would import ${newPages.length} pages.\n`);
    await prisma.$disconnect();
    return;
  }

  let imported = 0;
  let errors = 0;
  const batchSize = 100;

  for (let i = 0; i < newPages.length; i += batchSize) {
    const batch = newPages.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(importPage));
    imported += results.filter(Boolean).length;
    errors += results.filter((r) => !r).length;

    const pct = (((i + batch.length) / newPages.length) * 100).toFixed(1);
    process.stdout.write(`[${pct}%] Imported ${imported}, Errors ${errors}\r`);
  }

  process.stdout.write(`\n\nImported: ${imported}, Errors: ${errors}\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  process.stderr.write(`${e}\n`);
  process.exit(1);
});
