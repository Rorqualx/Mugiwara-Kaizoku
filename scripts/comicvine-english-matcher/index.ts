/**
 * ComicVine English Matcher Script
 *
 * Re-matches manga titles in ml-training-pages.csv to ComicVine,
 * prioritizing English publications using language filter scoring.
 *
 * Prerequisites:
 *   - ComicVine API key (free at https://comicvine.gamespot.com/api/)
 *
 * Usage:
 *   COMICVINE_API_KEY=your-key bun run scripts/comicvine-english-matcher/index.ts
 *   COMICVINE_API_KEY=your-key bun run scripts/comicvine-english-matcher/index.ts --dry-run
 *   COMICVINE_API_KEY=your-key bun run scripts/comicvine-english-matcher/index.ts --start-from=100
 *
 * Rate limits:
 *   - AniList: ~85 requests/min
 *   - ComicVine: 200 requests/hour (18s delay between requests)
 *   - Estimated total time: ~20 hours for full CSV
 *
 * Progress is saved every 10 rows, so the script can be safely interrupted and resumed.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { fetchAniListTitles } from './anilist-client';
import { searchComicVineWithEnglishPreference } from './comicvine-client';
import { loadProgress, parseCSV, saveProgress, writeCSV } from './csv-utils';
import type { ComicVineMatch, CSVRow } from './types';
import { println, sleep } from './utils';

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = path.join(process.cwd(), 'ml-training-pages.csv');
const OUTPUT_CSV_PATH = path.join(process.cwd(), 'ml-training-pages-english.csv');
const PROGRESS_PATH = path.join(process.cwd(), 'scripts', 'comicvine-english-matcher', 'progress.json');

const ANILIST_DELAY_MS = 700;
const COMICVINE_DELAY_MS = 18000;
const SAVE_INTERVAL = 10;

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const START_FROM_ARG = args.find((a) => a.startsWith('--start-from='));
const CLI_START_FROM = START_FROM_ARG ? parseInt(START_FROM_ARG.split('=')[1] ?? '0', 10) : null;

// ============================================================================
// Main Processing
// ============================================================================

async function processRow(
  row: CSVRow,
  results: Record<string, ComicVineMatch | null>
): Promise<ComicVineMatch | null> {
  // Check cache first
  if (results[row.Title] !== undefined) {
    println('  Using cached result');
    return results[row.Title];
  }

  // Validate AniList ID
  if (!row.AniListID || row.AniListID === 'DOES_NOT_EXIST') {
    println('  Skipping: No AniList ID');
    return null;
  }

  const anilistId = parseInt(row.AniListID, 10);
  if (isNaN(anilistId)) {
    println('  Skipping: Invalid AniList ID');
    return null;
  }

  // Fetch AniList titles
  println(`  Fetching AniList titles for ID ${anilistId}...`);
  const anilistData = await fetchAniListTitles(anilistId);
  await sleep(ANILIST_DELAY_MS);

  if (!anilistData) {
    println('  Could not fetch AniList data');
    results[row.Title] = null;
    return null;
  }

  const enTitle = anilistData.title.english ?? 'N/A';
  const romajiTitle = anilistData.title.romaji ?? 'N/A';
  println(`  AniList: en="${enTitle}" | romaji="${romajiTitle}"`);

  // Search ComicVine with English preference
  println('  Searching ComicVine with English preference...');
  const match = await searchComicVineWithEnglishPreference(
    row.Title,
    {
      english: anilistData.title.english,
      romaji: anilistData.title.romaji,
      synonyms: anilistData.synonyms,
    },
    COMICVINE_DELAY_MS
  );

  await sleep(COMICVINE_DELAY_MS);

  results[row.Title] = match;
  return match;
}

function updateRow(row: CSVRow, match: ComicVineMatch, dryRun: boolean): void {
  const existingId = row.ComicVineID;
  const newId = String(match.id);

  if (existingId !== newId && existingId !== 'DOES_NOT_EXIST' && existingId !== '') {
    println(`  UPDATE: ${existingId} -> ${newId}`);
  }

  if (!dryRun) {
    row.ComicVineID = newId;
    row.ComicVineDiscoveredURLs =
      match.url ?? `https://comicvine.gamespot.com/volume/4050-${match.id}/`;
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  println('ComicVine English Matcher');
  println('=========================');
  println(`Input CSV: ${CSV_PATH}`);
  println(`Output CSV: ${OUTPUT_CSV_PATH}`);
  println(`Dry run: ${DRY_RUN}`);
  println('');

  // Read CSV
  const content = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(content);
  println(`Total rows: ${rows.length}`);

  // Load progress
  const { lastIndex: progressLastIndex, results } = loadProgress(PROGRESS_PATH);
  const startIndex = CLI_START_FROM ?? progressLastIndex + 1;
  println(`Starting from index: ${startIndex}`);
  println(`Previously processed: ${Object.keys(results).length}`);

  // Estimate time
  const remaining = rows.length - startIndex;
  const estimatedMinutes = (remaining * (ANILIST_DELAY_MS + COMICVINE_DELAY_MS)) / 1000 / 60;
  println(`Estimated time: ${estimatedMinutes.toFixed(1)} minutes`);
  println('');

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const progress = (((i + 1) / rows.length) * 100).toFixed(1);
    const shortTitle = row.Title.length > 40 ? row.Title.substring(0, 40) + '...' : row.Title;

    println(`\n[${progress}%] ${i + 1}/${rows.length}: "${shortTitle}"`);

    const match = await processRow(row, results);

    if (match) {
      const pubInfo = match.publisher ?? 'no publisher';
      const simInfo = match.similarity.toFixed(2);
      println(`  MATCH: ${match.name} [${pubInfo}] (ID: ${match.id}, sim: ${simInfo})`);
      updateRow(row, match, DRY_RUN);
      updatedCount++;
    } else if (!row.AniListID || row.AniListID === 'DOES_NOT_EXIST') {
      skippedCount++;
    } else {
      println('  No English match found');
      if (!DRY_RUN && row.ComicVineID !== 'DOES_NOT_EXIST') {
        println(`  Keeping existing ID: ${row.ComicVineID}`);
      }
      notFoundCount++;
    }

    // Save progress periodically
    if ((i + 1) % SAVE_INTERVAL === 0) {
      saveProgress(PROGRESS_PATH, i, results);
      if (!DRY_RUN) {
        writeCSV(rows, OUTPUT_CSV_PATH);
      }
      println(`  [Progress saved at ${i + 1}]`);
    }
  }

  // Final save
  saveProgress(PROGRESS_PATH, rows.length - 1, results);
  if (!DRY_RUN) {
    writeCSV(rows, OUTPUT_CSV_PATH);
  }

  println('\n=========================');
  println('Complete!');
  println(`Updated: ${updatedCount}`);
  println(`Skipped: ${skippedCount}`);
  println(`Not found: ${notFoundCount}`);
  println(`Output: ${OUTPUT_CSV_PATH}`);
  println(`Progress file: ${PROGRESS_PATH}`);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
