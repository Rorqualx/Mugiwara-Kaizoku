#!/usr/bin/env bun
/**
 * Verify Empty ComicVine Cells Script
 *
 * Processes empty ComicVine cells, marking them as DOES_NOT_EXIST if not found.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { logger } from '../../src/utils/logger';
import { ComicVineProvider } from '../../src/server/services/search/providers/ComicVineProvider';

interface CsvRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
}

interface Progress {
  lastRow: number;
  found: number;
  notFound: number;
}

interface VerifyStats {
  found: number;
  notFound: number;
  processed: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
}

async function verifyComicVine(title: string, provider: ComicVineProvider): Promise<string | null> {
  try {
    const results = await withTimeout(provider.search(title, { limit: 3 }), 8000, []);
    if (results.length > 0 && results[0].externalId) {
      return results[0].externalId;
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
    found: stats.found,
    notFound: stats.notFound
  }));
  const csvContent = stringify(rows, { header: true });
  fs.writeFileSync(outputPath + '.progress', csvContent);
  logger.info('Progress', { row: rowIndex + 1, ...stats });
}

async function processRows(
  rows: CsvRow[],
  startRow: number,
  provider: ComicVineProvider,
  progressPath: string,
  outputPath: string
): Promise<VerifyStats> {
  const stats: VerifyStats = { found: 0, notFound: 0, processed: 0 };

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];

    if (row.ComicVineID === '') {
      const cvId = await verifyComicVine(row.Title, provider);
      if (cvId) {
        row.ComicVineID = cvId;
        stats.found++;
        logger.info(`[FOUND] CV: ${row.Title} -> ${cvId}`);
      } else {
        row.ComicVineID = 'DOES_NOT_EXIST';
        stats.notFound++;
        logger.info(`[DNE] CV: ${row.Title}`);
      }
      stats.processed++;

      if (stats.processed % 10 === 0) {
        saveProgress(progressPath, outputPath, rows, i, stats);
      }
      // ComicVine rate limit: 1 request per second
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return stats;
}

async function main(): Promise<void> {
  const inputPath = path.resolve(process.cwd(), 'ml-training-titles-final.csv');
  const outputPath = path.resolve(process.cwd(), 'ml-training-titles-complete.csv');
  const progressPath = path.resolve(process.cwd(), 'verify-cv-progress.json');

  const content = fs.readFileSync(inputPath, 'utf-8');
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as CsvRow[];
  logger.info('Loaded rows', { count: rows.length });

  const startRow = loadProgress(progressPath);
  if (startRow > 0) logger.info('Resuming from row', { startRow });

  const provider = new ComicVineProvider();
  const stats = await processRows(rows, startRow, provider, progressPath, outputPath);

  fs.writeFileSync(outputPath, stringify(rows, { header: true }));
  if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
  if (fs.existsSync(outputPath + '.progress')) fs.unlinkSync(outputPath + '.progress');

  logger.info('ComicVine verification complete', { totalRows: rows.length, ...stats });
}

main().catch(console.error);
