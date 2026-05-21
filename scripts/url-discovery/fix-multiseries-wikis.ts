#!/usr/bin/env bun
/**
 * Fix Multi-Series Wiki Entries
 *
 * Clears bogus FandomDiscoveredURLs for multi-series wikis where the
 * domain-based discovery returned wrong results.
 *
 * Multi-series wikis: webtoon.fandom.com, manga.fandom.com
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { logger } from '../../src/utils/logger';

interface CsvRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs?: string;
  WikipediaDiscoveredURLs?: string;
  ComicVineDiscoveredURLs?: string;
}

// Multi-series wikis where domain-based discovery doesn't work
const MULTI_SERIES_WIKIS = [
  'webtoon.fandom.com',
  'manga.fandom.com',
];

function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

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

function isMultiSeriesWiki(fandomUrl: string): boolean {
  if (!fandomUrl || fandomUrl === 'DOES_NOT_EXIST') {
    return false;
  }
  const domain = extractDomainFromUrl(fandomUrl);
  return domain !== null && MULTI_SERIES_WIKIS.includes(domain);
}

async function main(): Promise<void> {
  const csvPath = path.resolve(process.cwd(), 'ml-training-pages.csv');

  logger.info('Reading CSV', { path: csvPath });
  const rows = readCsv(csvPath);
  logger.info('Loaded rows', { count: rows.length });

  // Clear bogus FandomDiscoveredURLs for multi-series wikis
  let cleared = 0;
  let multiSeriesCount = 0;

  for (const row of rows) {
    if (isMultiSeriesWiki(row.FandomURL)) {
      multiSeriesCount++;
      if (row.FandomDiscoveredURLs) {
        row.FandomDiscoveredURLs = '';
        cleared++;
      }
    }
  }

  logger.info('Cleared bogus URLs', { cleared, multiSeriesEntries: multiSeriesCount });

  // Write fixed output
  logger.info('Writing fixed CSV', { path: csvPath });
  writeCsv(csvPath, rows);

  // Stats
  const withFandom = rows.filter(r => r.FandomDiscoveredURLs).length;
  const withWikipedia = rows.filter(r => r.WikipediaDiscoveredURLs).length;
  const withComicVine = rows.filter(r => r.ComicVineDiscoveredURLs).length;

  logger.info('Final stats', {
    totalRows: rows.length,
    fandomDiscoveredUrls: withFandom,
    wikipediaDiscoveredUrls: withWikipedia,
    comicVineDiscoveredUrls: withComicVine,
    multiSeriesEntriesCleared: cleared,
  });
}

main().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
