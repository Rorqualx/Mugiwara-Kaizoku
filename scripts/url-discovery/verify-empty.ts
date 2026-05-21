#!/usr/bin/env bun
/**
 * Verify Empty Cells Script
 *
 * Processes empty Fandom and ComicVine cells in small batches,
 * marking them as DOES_NOT_EXIST if not found.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { logger } from '../../src/utils/logger';
import { FandomProvider } from '../../src/server/services/search/providers/FandomProvider';

interface CsvRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
}

interface Progress {
  lastRow: number;
  fandomFound: number;
  fandomNotFound: number;
}

interface VerifyStats {
  fandomFound: number;
  fandomNotFound: number;
  processed: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

async function verifyFandom(title: string, provider: FandomProvider): Promise<string | null> {
  try {
    const results = await withTimeout(provider.search(title, { limit: 1 }), 5000, []);
    if (results.length > 0 && results[0].url) {
      return results[0].url;
    }
    return null;
  } catch {
    return null;
  }
}

function loadProgress(progressPath: string): number {
  if (fs.existsSync(progressPath)) {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8')) as Progress;
    return progress.lastRow ?? 0;
  }
  return 0;
}

function saveProgress(
  progressPath: string,
  outputPath: string,
  rows: CsvRow[],
  rowIndex: number,
  stats: VerifyStats
): void {
  fs.writeFileSync(progressPath, JSON.stringify({
    lastRow: rowIndex + 1,
    fandomFound: stats.fandomFound,
    fandomNotFound: stats.fandomNotFound
  }));
  const csvContent = stringify(rows, { header: true });
  fs.writeFileSync(outputPath + '.progress', csvContent);
  logger.info('Progress saved', { row: rowIndex + 1, ...stats });
}

async function processRows(
  rows: CsvRow[],
  startRow: number,
  provider: FandomProvider,
  progressPath: string,
  outputPath: string
): Promise<VerifyStats> {
  const stats: VerifyStats = { fandomFound: 0, fandomNotFound: 0, processed: 0 };

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];

    if (row.FandomURL === '') {
      const url = await verifyFandom(row.Title, provider);
      if (url) {
        row.FandomURL = url;
        stats.fandomFound++;
        logger.info(`[FOUND] Fandom: ${row.Title} -> ${url}`);
      } else {
        row.FandomURL = 'DOES_NOT_EXIST';
        stats.fandomNotFound++;
        logger.info(`[DNE] Fandom: ${row.Title}`);
      }
      stats.processed++;

      if (stats.processed % 10 === 0) {
        saveProgress(progressPath, outputPath, rows, i, stats);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return stats;
}

async function main(): Promise<void> {
  const inputPath = path.resolve(process.cwd(), 'ml-training-titles-enriched.csv');
  const outputPath = path.resolve(process.cwd(), 'ml-training-titles-final.csv');
  const progressPath = path.resolve(process.cwd(), 'verify-progress.json');

  const content = fs.readFileSync(inputPath, 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as CsvRow[];
  logger.info('Loaded rows', { count: rows.length });

  const startRow = loadProgress(progressPath);
  if (startRow > 0) logger.info('Resuming from row', { startRow });

  const fandomProvider = new FandomProvider();
  const stats = await processRows(rows, startRow, fandomProvider, progressPath, outputPath);

  fs.writeFileSync(outputPath, stringify(rows, { header: true }));
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
  if (fs.existsSync(outputPath + '.progress')) fs.unlinkSync(outputPath + '.progress');

  logger.info('Verification complete', { totalRows: rows.length, ...stats });
}

main().catch(console.error);
