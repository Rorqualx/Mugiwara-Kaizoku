#!/usr/bin/env bun
/**
 * Fix ComicVine IDs in the output CSV
 *
 * Merges ComicVineID values from input CSV into output CSV
 * and generates ComicVineDiscoveredURLs from those IDs.
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

function generateComicVineUrl(comicVineId: string): string {
  if (!comicVineId || comicVineId === 'DOES_NOT_EXIST') {
    return '';
  }
  const cleanId = comicVineId.replace('4050-', '');
  return `https://comicvine.gamespot.com/volume/4050-${cleanId}/`;
}

async function main(): Promise<void> {
  const inputPath = path.resolve(process.cwd(), 'ml-training-titles.csv');
  const outputPath = path.resolve(process.cwd(), 'ml-training-pages.csv');
  const fixedOutputPath = path.resolve(process.cwd(), 'ml-training-pages-fixed.csv');

  logger.info('Reading input CSV (original)', { path: inputPath });
  const inputRows = readCsv(inputPath);
  logger.info('Loaded input rows', { count: inputRows.length });

  logger.info('Reading output CSV (to fix)', { path: outputPath });
  const outputRows = readCsv(outputPath);
  logger.info('Loaded output rows', { count: outputRows.length });

  // Build lookup from input: AniListID -> ComicVineID
  const comicVineIdLookup = new Map<string, string>();
  for (const row of inputRows) {
    if (row.ComicVineID && row.ComicVineID !== 'DOES_NOT_EXIST') {
      comicVineIdLookup.set(row.AniListID, row.ComicVineID);
    }
  }
  logger.info('Found ComicVine IDs in input', { count: comicVineIdLookup.size });

  // Fix output rows
  let fixed = 0;
  for (const row of outputRows) {
    const comicVineId = comicVineIdLookup.get(row.AniListID);
    if (comicVineId) {
      row.ComicVineID = comicVineId;
      row.ComicVineDiscoveredURLs = generateComicVineUrl(comicVineId);
      fixed++;
    }
  }

  logger.info('Fixed rows with ComicVine IDs', { count: fixed });

  // Write fixed output
  logger.info('Writing fixed output', { path: fixedOutputPath });
  writeCsv(fixedOutputPath, outputRows);

  // Stats
  const withComicVine = outputRows.filter(r => r.ComicVineID && r.ComicVineID !== 'DOES_NOT_EXIST').length;
  const withFandom = outputRows.filter(r => r.FandomDiscoveredURLs).length;
  const withWikipedia = outputRows.filter(r => r.WikipediaDiscoveredURLs).length;
  const withComicVineDiscovered = outputRows.filter(r => r.ComicVineDiscoveredURLs).length;

  logger.info('Summary', {
    totalRows: outputRows.length,
    comicVineIdPopulated: withComicVine,
    comicVineDiscoveredUrlsPopulated: withComicVineDiscovered,
    fandomDiscoveredUrlsPopulated: withFandom,
    wikipediaDiscoveredUrlsPopulated: withWikipedia,
    fixedOutputPath,
  });
}

main().catch(error => {
  logger.error('Fatal error', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
