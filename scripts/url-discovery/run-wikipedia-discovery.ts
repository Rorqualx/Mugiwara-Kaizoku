/**
 * Wikipedia URL Discovery Script
 *
 * Reads ml-training-titles.csv, runs Wikipedia URL discovery on each entry,
 * and writes discovered volume/chapter URLs to the WikipediaDiscoveredURLs column.
 *
 * Usage: bun run scripts/url-discovery/run-wikipedia-discovery.ts
 */

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import { discoverWikipediaUrls } from '../../src/server/services/wikipedia/adaptive/url-discoverer';
import { logger } from '../../src/utils/logger';

const CSV_PATH = './Naya title training data/ml-training-pages-full.csv';
const OUTPUT_PATH = './ml-training-pages-full-updated.csv';
const DELAY_MS = 500;
const PROGRESS_INTERVAL = 50;

interface CsvRecord {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs?: string;
  WikipediaDiscoveredURLs?: string;
  ComicVineDiscoveredURLs?: string;
}

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed !== '' && trimmed !== 'DOES_NOT_EXIST';
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processRecords(
  records: CsvRecord[],
  withWikipedia: CsvRecord[]
): Promise<{ processed: number; discovered: number }> {
  let processed = 0;
  let discovered = 0;
  const startTime = Date.now();

  for (const record of records) {
    const wikiUrl = record.WikipediaURL?.trim();

    if (record.WikipediaDiscoveredURLs === undefined) {
      record.WikipediaDiscoveredURLs = '';
    }

    if (!isValidUrl(wikiUrl)) {
      continue;
    }

    try {
      const result = await discoverWikipediaUrls(wikiUrl, { preferListPage: true, timeoutMs: 15000 });
      const discoveredUrls = collectDiscoveredUrls(result, wikiUrl);

      if (discoveredUrls.length > 0) {
        record.WikipediaDiscoveredURLs = discoveredUrls.join('|');
        discovered++;
      }

      processed++;
      logProgress(processed, withWikipedia.length, discovered, startTime);
      await sleep(DELAY_MS);
    } catch (error) {
      logger.error('Error processing record', {
        title: record.Title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, discovered };
}

function collectDiscoveredUrls(
  result: { listPageUrl: string | null; mainArticleUrl: string | null },
  originalUrl: string
): string[] {
  const urls: string[] = [];

  if (result.listPageUrl && result.listPageUrl !== originalUrl) {
    urls.push(result.listPageUrl);
  }

  if (
    result.mainArticleUrl &&
    result.mainArticleUrl !== originalUrl &&
    result.mainArticleUrl !== result.listPageUrl
  ) {
    urls.push(result.mainArticleUrl);
  }

  return urls;
}

function logProgress(processed: number, total: number, discovered: number, startTime: number): void {
  if (processed % PROGRESS_INTERVAL !== 0) return;

  const elapsed = (Date.now() - startTime) / 1000;
  const rate = processed / elapsed;
  const remaining = (total - processed) / rate;
  logger.info('Discovery progress', { processed, total, discovered, rate: rate.toFixed(1), etaMinutes: Math.ceil(remaining / 60) });
}

async function main(): Promise<void> {
  logger.info('Wikipedia URL Discovery Script starting', { csvPath: CSV_PATH });

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true, relax_column_count: true }) as CsvRecord[];
  logger.info('CSV loaded', { totalRecords: records.length });

  const withWikipedia = records.filter(r => isValidUrl(r.WikipediaURL));
  logger.info('Records with valid Wikipedia URLs', { count: withWikipedia.length });

  const { processed, discovered } = await processRecords(records, withWikipedia);
  logger.info('Discovery complete', { processed, discovered });

  const columns = ['Title', 'AniListID', 'WikipediaURL', 'FandomURL', 'ComicVineID', 'FandomDiscoveredURLs', 'WikipediaDiscoveredURLs', 'ComicVineDiscoveredURLs'];
  const output = stringify(records, { header: true, columns });
  fs.writeFileSync(OUTPUT_PATH, output);
  logger.info('Output written', { path: OUTPUT_PATH });
}

main().catch(err => {
  logger.error('Script failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
