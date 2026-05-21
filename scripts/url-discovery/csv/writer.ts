/**
 * CSV Writer for URL Discovery Tool
 *
 * Writes enriched CSV data with backup functionality and progress saving.
 *
 * @module url-discovery/csv/writer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { CsvRow, DiscoveryStats } from './types';

/**
 * Escape a field for CSV output.
 * Quotes fields containing commas, quotes, or newlines.
 */
function escapeCsvField(field: string): string {
  if (field === null || field === undefined) {
    return '';
  }

  const value = String(field);

  // Check if quoting is needed
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Escape double quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Convert a CsvRow to a CSV line string.
 */
function rowToCsvLine(row: CsvRow): string {
  const fields = [
    escapeCsvField(row.Title),
    escapeCsvField(row.AniListID),
    escapeCsvField(row.WikipediaURL),
    escapeCsvField(row.FandomURL),
    escapeCsvField(row.ComicVineID),
  ];
  return fields.join(',');
}

/**
 * Create a backup of a file before modifying it.
 *
 * @param filePath - Path to the file to backup
 * @returns Path to the backup file
 */
export function createBackup(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Cannot backup non-existent file: ${absolutePath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.dirname(absolutePath);
  const ext = path.extname(absolutePath);
  const base = path.basename(absolutePath, ext);
  const backupPath = path.join(dir, `${base}.backup-${timestamp}${ext}`);

  fs.copyFileSync(absolutePath, backupPath);

  return backupPath;
}

/**
 * Write CSV rows to a file.
 *
 * @param filePath - Path to the output file
 * @param rows - Array of CsvRow objects
 */
export function writeCsv(filePath: string, rows: CsvRow[]): void {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  // Ensure directory exists
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Build CSV content
  const header = 'Title,AniListID,WikipediaURL,FandomURL,ComicVineID';
  const lines = [header, ...rows.map(rowToCsvLine)];
  const content = lines.join('\n') + '\n';

  fs.writeFileSync(absolutePath, content, 'utf-8');
}

/**
 * Save progress to a temporary file for crash recovery.
 *
 * @param rows - All rows (including processed ones)
 * @param outputPath - Path to the output file
 * @param processedCount - Number of rows processed so far
 */
export function saveProgress(rows: CsvRow[], outputPath: string, processedCount: number): void {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
  const progressPath = absolutePath.replace(/\.csv$/, '.progress.csv');

  writeCsv(progressPath, rows);

  // Also save a progress metadata file
  const metaPath = absolutePath.replace(/\.csv$/, '.progress.json');
  const meta = {
    lastProcessedRow: processedCount,
    lastSaveTime: new Date().toISOString(),
    totalRows: rows.length,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * Load progress from a previous run if it exists.
 *
 * @param outputPath - Path to the output file
 * @returns Progress info or null if no progress file exists
 */
export function loadProgress(outputPath: string): {
  rows: CsvRow[];
  lastProcessedRow: number;
} | null {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
  const progressPath = absolutePath.replace(/\.csv$/, '.progress.csv');
  const metaPath = absolutePath.replace(/\.csv$/, '.progress.json');

  if (!fs.existsSync(progressPath) || !fs.existsSync(metaPath)) {
    return null;
  }

  try {
    // Import reader dynamically to avoid circular dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readCsv } = require('./reader');
    const rows = readCsv(progressPath);
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    return {
      rows,
      lastProcessedRow: meta.lastProcessedRow,
    };
  } catch {
    return null;
  }
}

/**
 * Clean up progress files after successful completion.
 *
 * @param outputPath - Path to the output file
 */
export function cleanupProgress(outputPath: string): void {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
  const progressPath = absolutePath.replace(/\.csv$/, '.progress.csv');
  const metaPath = absolutePath.replace(/\.csv$/, '.progress.json');

  if (fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
  }
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
  }
}

/**
 * Write discovery stats to a JSON file.
 *
 * @param stats - Discovery statistics
 * @param outputPath - Path to the output CSV (stats file will be named similarly)
 */
export function writeStats(stats: DiscoveryStats, outputPath: string): void {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
  const statsPath = absolutePath.replace(/\.csv$/, '.stats.json');

  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
}
