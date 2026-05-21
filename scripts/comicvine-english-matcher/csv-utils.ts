/**
 * CSV parsing and writing utilities
 */

import * as fs from 'node:fs';

import type { ComicVineMatch, CSVRow, Progress } from './types';
import { println } from './utils';

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string): CSVRow[] {
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
        FandomDiscoveredURLs: values[5] ?? '',
        WikipediaDiscoveredURLs: values[6] ?? '',
        ComicVineDiscoveredURLs: values[7] ?? '',
      });
    }
  }

  return rows;
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

/**
 * Escape a CSV field value
 */
export function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Write rows to CSV file
 */
export function writeCSV(rows: CSVRow[], outputPath: string): void {
  const header =
    'Title,AniListID,WikipediaURL,FandomURL,ComicVineID,FandomDiscoveredURLs,WikipediaDiscoveredURLs,ComicVineDiscoveredURLs';

  const lines = [header];

  for (const row of rows) {
    const line = [
      escapeCSVField(row.Title),
      escapeCSVField(row.AniListID),
      escapeCSVField(row.WikipediaURL),
      escapeCSVField(row.FandomURL),
      escapeCSVField(row.ComicVineID),
      escapeCSVField(row.FandomDiscoveredURLs),
      escapeCSVField(row.WikipediaDiscoveredURLs),
      escapeCSVField(row.ComicVineDiscoveredURLs),
    ].join(',');
    lines.push(line);
  }

  fs.writeFileSync(outputPath, lines.join('\n'));
}

/**
 * Load progress from file
 */
export function loadProgress(progressPath: string): Progress {
  try {
    if (fs.existsSync(progressPath)) {
      const data = fs.readFileSync(progressPath, 'utf-8');
      return JSON.parse(data) as Progress;
    }
  } catch {
    println('No valid progress file found, starting fresh');
  }
  return { lastIndex: -1, results: {} };
}

/**
 * Save progress to file
 */
export function saveProgress(
  progressPath: string,
  lastIndex: number,
  results: Record<string, ComicVineMatch | null>
): void {
  fs.writeFileSync(progressPath, JSON.stringify({ lastIndex, results }, null, 2));
}
