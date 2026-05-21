/**
 * Import all source URLs from CSV into AnnotatedPage table
 * Groups by manga title: Fandom, Wikipedia, AniList, ComicVine
 *
 * Usage: bun run scripts/import-all-sources.ts
 *        bun run scripts/import-all-sources.ts --dry-run
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { PrismaClient } from '@prisma/client';

const CSV_PATH = path.join(process.cwd(), 'ml-training-pages.csv');
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient();

interface CSVRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
}

interface PageToImport {
  url: string;
  mangaTitle: string;
  sourceType: 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE';
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

function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n');
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length >= 5) {
      rows.push({
        Title: values[0] ?? '',
        AniListID: values[1] ?? '',
        WikipediaURL: values[2] ?? '',
        FandomURL: values[3] ?? '',
        ComicVineID: values[4] ?? '',
      });
    }
  }
  return rows;
}

function isValidUrl(url: string): boolean {
  return Boolean(url) && url !== 'DOES_NOT_EXIST' && url.startsWith('http');
}

function isValidId(id: string): boolean {
  return Boolean(id) && id !== 'DOES_NOT_EXIST' && /^\d+$/.test(id);
}

function collectPagesToImport(rows: CSVRow[]): PageToImport[] {
  const pages: PageToImport[] = [];

  for (const row of rows) {
    if (isValidUrl(row.FandomURL)) {
      pages.push({ url: row.FandomURL, mangaTitle: row.Title, sourceType: 'FANDOM' });
    }
    if (isValidUrl(row.WikipediaURL)) {
      pages.push({ url: row.WikipediaURL, mangaTitle: row.Title, sourceType: 'WIKIPEDIA' });
    }
    if (isValidId(row.AniListID)) {
      pages.push({
        url: `https://anilist.co/manga/${row.AniListID}`,
        mangaTitle: row.Title,
        sourceType: 'ANILIST',
      });
    }
    if (isValidId(row.ComicVineID)) {
      pages.push({
        url: `https://comicvine.gamespot.com/volume/4050-${row.ComicVineID}/`,
        mangaTitle: row.Title,
        sourceType: 'COMICVINE',
      });
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
  process.stdout.write('Multi-Source URL Importer\n');
  process.stdout.write(`Dry run: ${DRY_RUN}\n\n`);

  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  process.stdout.write(`CSV rows (manga titles): ${rows.length}\n`);

  const allPages = collectPagesToImport(rows);
  const bySource = {
    FANDOM: allPages.filter((p) => p.sourceType === 'FANDOM').length,
    WIKIPEDIA: allPages.filter((p) => p.sourceType === 'WIKIPEDIA').length,
    ANILIST: allPages.filter((p) => p.sourceType === 'ANILIST').length,
    COMICVINE: allPages.filter((p) => p.sourceType === 'COMICVINE').length,
  };
  process.stdout.write(`Pages by source:\n`);
  process.stdout.write(`  FANDOM: ${bySource.FANDOM}\n`);
  process.stdout.write(`  WIKIPEDIA: ${bySource.WIKIPEDIA}\n`);
  process.stdout.write(`  ANILIST: ${bySource.ANILIST}\n`);
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
