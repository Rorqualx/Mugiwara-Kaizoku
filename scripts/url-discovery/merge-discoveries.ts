#!/usr/bin/env bun
/**
 * Merge Wikipedia and Fandom discovery results into final CSV.
 *
 * Usage: bun run scripts/url-discovery/merge-discoveries.ts
 *
 * @module url-discovery/merge-discoveries
 */

import * as fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

import { logger } from '../../src/utils/logger';

const WIKIPEDIA_CSV = './ml-training-titles-with-wikipedia-discovery.csv';
const FANDOM_CSV = './ml-training-titles-with-fandom-discovery.csv';
const OUTPUT_CSV = './ml-training-titles-final.csv';

interface WikipediaRecord {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  WikipediaDiscoveredURLs: string;
}

interface FandomRecord {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs: string;
}

interface MergedRecord {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  WikipediaDiscoveredURLs: string;
  FandomDiscoveredURLs: string;
}

function loadCsv<T>(path: string, label: string): T[] {
  logger.info(`Loading ${label} CSV`, { path });
  const content = fs.readFileSync(path, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[];
  logger.info(`Loaded ${label} records`, { count: records.length });
  return records;
}

function buildFandomLookup(records: FandomRecord[]): Map<string, FandomRecord> {
  const lookup = new Map<string, FandomRecord>();
  for (const record of records) {
    const key = `${record.Title}|${record.AniListID}`;
    lookup.set(key, record);
  }
  return lookup;
}

function mergeRecords(
  wikiRecords: WikipediaRecord[],
  fandomLookup: Map<string, FandomRecord>
): { merged: MergedRecord[]; wikiCount: number; fandomCount: number } {
  const merged: MergedRecord[] = [];
  let wikiCount = 0;
  let fandomCount = 0;

  for (const wiki of wikiRecords) {
    const key = `${wiki.Title}|${wiki.AniListID}`;
    const fandom = fandomLookup.get(key);

    const record: MergedRecord = {
      Title: wiki.Title,
      AniListID: wiki.AniListID,
      WikipediaURL: wiki.WikipediaURL,
      FandomURL: wiki.FandomURL,
      ComicVineID: wiki.ComicVineID,
      WikipediaDiscoveredURLs: wiki.WikipediaDiscoveredURLs ?? '',
      FandomDiscoveredURLs: fandom?.FandomDiscoveredURLs ?? '',
    };

    if (record.WikipediaDiscoveredURLs) wikiCount++;
    if (record.FandomDiscoveredURLs) fandomCount++;

    merged.push(record);
  }

  return { merged, wikiCount, fandomCount };
}

function writeMergedCsv(records: MergedRecord[]): void {
  const columns = [
    'Title',
    'AniListID',
    'WikipediaURL',
    'FandomURL',
    'ComicVineID',
    'WikipediaDiscoveredURLs',
    'FandomDiscoveredURLs',
  ];
  const output = stringify(records, { header: true, columns });
  fs.writeFileSync(OUTPUT_CSV, output);
}

function main(): void {
  const wikiRecords = loadCsv<WikipediaRecord>(WIKIPEDIA_CSV, 'Wikipedia');
  const fandomRecords = loadCsv<FandomRecord>(FANDOM_CSV, 'Fandom');

  const fandomLookup = buildFandomLookup(fandomRecords);
  const { merged, wikiCount, fandomCount } = mergeRecords(wikiRecords, fandomLookup);

  writeMergedCsv(merged);

  logger.info('Merge complete', {
    totalRecords: merged.length,
    withWikipediaDiscoveries: wikiCount,
    withFandomDiscoveries: fandomCount,
    output: OUTPUT_CSV,
  });
}

main();
