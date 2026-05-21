/**
 * CSV Reader for URL Discovery Tool
 *
 * Parses the authoritative CSV file containing manga titles and their URLs.
 * Handles quoted fields, escaped characters, and various CSV edge cases.
 *
 * @module url-discovery/csv/reader
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { CsvRow } from './types';

/**
 * Handle a character inside a quoted field.
 * Returns the updated current field and whether to skip the next character.
 */
function handleQuotedChar(
  line: string,
  i: number,
  current: string
): { current: string; skipNext: boolean; endQuote: boolean } {
  const char = line[i];

  if (char === '"') {
    // Check for escaped quote (double quote)
    if (i + 1 < line.length && line[i + 1] === '"') {
      return { current: current + '"', skipNext: true, endQuote: false };
    }
    // End of quoted field
    return { current, skipNext: false, endQuote: true };
  }

  return { current: current + char, skipNext: false, endQuote: false };
}

/**
 * Handle a character outside a quoted field.
 * Returns the updated state.
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
 * Handles RFC 4180 CSV format with quoted fields containing commas.
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

  // Push last field
  fields.push(current.trim());

  return fields;
}

/**
 * Parse a single data row into a CsvRow object.
 */
function parseDataRow(line: string, headers: string[]): CsvRow | null {
  if (!line || line.trim() === '') {
    return null;
  }

  const fields = parseCsvLine(line);

  // Pad with empty strings if row has fewer fields
  while (fields.length < headers.length) {
    fields.push('');
  }

  const row: Record<string, string> = {};
  for (let j = 0; j < headers.length; j++) {
    const header = headers[j];
    if (header) {
      row[header] = fields[j] ?? '';
    }
  }

  return row as unknown as CsvRow;
}

/**
 * Read and parse a CSV file.
 *
 * @param filePath - Path to the CSV file
 * @returns Array of CsvRow objects
 */
export function readCsv(filePath: string): CsvRow[] {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`CSV file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error('CSV file has no header');
  }
  const headers = parseCsvLine(headerLine);

  // Validate expected columns
  const expectedColumns = ['Title', 'AniListID', 'WikipediaURL', 'FandomURL', 'ComicVineID'];
  const missingColumns = expectedColumns.filter(col => !headers.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`CSV missing required columns: ${missingColumns.join(', ')}`);
  }

  // Parse data rows
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseDataRow(lines[i] ?? '', headers);
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Get the total number of rows in a CSV file without loading all data.
 *
 * @param filePath - Path to the CSV file
 * @returns Number of data rows (excluding header)
 */
export function getCsvRowCount(filePath: string): number {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`CSV file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');

  // Subtract 1 for header
  return Math.max(0, lines.length - 1);
}

/**
 * Read a subset of rows from a CSV file.
 *
 * @param filePath - Path to the CSV file
 * @param startRow - Starting row index (0-indexed)
 * @param endRow - Ending row index (exclusive)
 * @returns Array of CsvRow objects
 */
export function readCsvRange(filePath: string, startRow: number, endRow: number): CsvRow[] {
  const allRows = readCsv(filePath);
  return allRows.slice(startRow, endRow);
}

/**
 * Extract Fandom domain from a URL.
 */
function extractFandomDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Normalize a title for lookup.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Build a Fandom domain lookup table from existing CSV data.
 * Maps normalized title -> Fandom domain for faster lookups.
 *
 * @param rows - CSV rows to process
 * @returns Map of normalized title to Fandom domain
 */
export function buildFandomDomainLookup(rows: CsvRow[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const row of rows) {
    if (!row.FandomURL || row.FandomURL === 'DOES_NOT_EXIST' || row.FandomURL === '') {
      continue;
    }

    const domain = extractFandomDomain(row.FandomURL);
    if (domain) {
      const normalized = normalizeTitle(row.Title);
      lookup.set(normalized, domain);
    }
  }

  return lookup;
}
