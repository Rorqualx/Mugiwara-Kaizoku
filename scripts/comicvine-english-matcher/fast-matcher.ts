/**
 * Fast ComicVine English Matcher
 *
 * Optimized version that:
 * 1. Pre-fetches all AniList data in parallel batches
 * 2. Uses single variant search (English title only)
 * 3. More aggressive ComicVine rate limiting (10s with backoff)
 *
 * Usage:
 *   COMICVINE_API_KEY=key bun run scripts/comicvine-english-matcher/fast-matcher.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { AniListMedia, ComicVineMatch, CSVRow } from './types';

// ============================================================================
// Configuration
// ============================================================================

const CSV_PATH = path.join(process.cwd(), 'ml-training-pages.csv');
const OUTPUT_PATH = path.join(process.cwd(), 'ml-training-pages-english.csv');
const PROGRESS_PATH = path.join(process.cwd(), 'scripts', 'comicvine-english-matcher', 'fast-progress.json');
const ANILIST_CACHE_PATH = path.join(process.cwd(), 'scripts', 'comicvine-english-matcher', 'anilist-cache.json');

const COMICVINE_API = 'https://comicvine.gamespot.com/api';
const ANILIST_API = 'https://graphql.anilist.co';
const MIN_SIMILARITY = 0.4;

// Timing - single-pass approach (no pre-fetching)
const COMICVINE_BASE_DELAY = 10000; // 10s base delay
const ANILIST_DELAY = 800; // 0.8s per request (~75/min)
const SAVE_INTERVAL = 25;

function getApiKey(): string {
  const key = process.env.COMICVINE_API_KEY;
  if (!key) {
    process.stderr.write('ERROR: Set COMICVINE_API_KEY environment variable\n');
    process.exit(1);
  }
  return key;
}
const COMICVINE_API_KEY: string = getApiKey();

// ============================================================================
// Utilities
// ============================================================================

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const println = (msg: string): void => {
  process.stdout.write(msg + '\n');
};

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function calculateSimilarity(t1: string, t2: string): number {
  const n1 = normalizeTitle(t1), n2 = normalizeTitle(t2);
  if (n1 === n2) return 1.0;
  const w1 = new Set(n1.split(' ').filter(w => w.length > 1));
  const w2 = new Set(n2.split(' ').filter(w => w.length > 1));
  if (!w1.size || !w2.size) return 0;
  const inter = [...w1].filter(x => w2.has(x)).length;
  return inter / new Set([...w1, ...w2]).size;
}

function isNonEnglish(title: string, pub?: string): boolean {
  if (/[\u3000-\u9faf\uac00-\ud7af]/.test(title)) return true;
  const nonEngPubs = ['shueisha','kodansha','shogakukan','kadokawa','square enix','ki-oon','kana','glénat','delcourt','pika','panini','planet manga','norma editorial','planeta','ivrea','carlsen','egmont'];
  return nonEngPubs.some(p => (pub ?? '').toLowerCase().includes(p));
}

function isEnglishPub(pub?: string): boolean {
  if (!pub) return false;
  const engPubs = ['viz','kodansha usa','kodansha comics','seven seas','yen press','dark horse','tokyopop','vertical','j-novel club','one peace books','ghost ship','denpa'];
  return engPubs.some(p => pub.toLowerCase().includes(p));
}

// ============================================================================
// CSV Parsing
// ============================================================================

function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n');
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') { if (inQ && line[j+1] === '"') { cur += '"'; j++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { vals.push(cur); cur = ''; }
      else cur += c;
    }
    vals.push(cur);
    if (vals.length >= 5) {
      rows.push({
        Title: vals[0] ?? '', AniListID: vals[1] ?? '', WikipediaURL: vals[2] ?? '',
        FandomURL: vals[3] ?? '', ComicVineID: vals[4] ?? '', FandomDiscoveredURLs: vals[5] ?? '',
        WikipediaDiscoveredURLs: vals[6] ?? '', ComicVineDiscoveredURLs: vals[7] ?? '',
      });
    }
  }
  return rows;
}

function escapeCSV(v: string): string {
  return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
}

function writeCSV(rows: CSVRow[], outPath: string): void {
  const hdr = 'Title,AniListID,WikipediaURL,FandomURL,ComicVineID,FandomDiscoveredURLs,WikipediaDiscoveredURLs,ComicVineDiscoveredURLs';
  const lines = [hdr, ...rows.map(r => [r.Title,r.AniListID,r.WikipediaURL,r.FandomURL,r.ComicVineID,r.FandomDiscoveredURLs,r.WikipediaDiscoveredURLs,r.ComicVineDiscoveredURLs].map(escapeCSV).join(','))];
  fs.writeFileSync(outPath, lines.join('\n'));
}

// ============================================================================
// AniList Batch Fetching
// ============================================================================

const ANILIST_QUERY = `query ($id: Int) { Media(id: $id, type: MANGA) { id title { english romaji native } synonyms } }`;

async function fetchAniList(id: number, retries = 3): Promise<AniListMedia | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(ANILIST_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: ANILIST_QUERY, variables: { id } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 429) {
        println(`  AniList rate limited, waiting 30s...`);
        await sleep(30000);
        continue;
      }
      if (!res.ok) return null;
      const json = await res.json() as { data?: { Media?: AniListMedia } };
      return json.data?.Media ?? null;
    } catch (e) {
      if (attempt === retries - 1) return null;
      await sleep(1000);
    }
  }
  return null;
}

// Removed pre-fetch - using single-pass approach instead

// ============================================================================
// ComicVine Search (Single Variant, Aggressive)
// ============================================================================

let cvDelay = COMICVINE_BASE_DELAY;

async function searchComicVine(query: string): Promise<ComicVineMatch | null> {
  try {
    const url = new URL(`${COMICVINE_API}/search/`);
    url.searchParams.set('api_key', COMICVINE_API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('query', query);
    url.searchParams.set('resources', 'volume');
    url.searchParams.set('limit', '10');
    url.searchParams.set('field_list', 'id,name,publisher,site_detail_url');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0', Accept: 'application/json' },
    });

    if (res.status === 429 || res.status === 107) {
      cvDelay = Math.min(cvDelay * 2, 60000); // Exponential backoff, max 60s
      println(`  Rate limited! Increasing delay to ${cvDelay/1000}s, waiting...`);
      await sleep(cvDelay);
      return searchComicVine(query);
    }

    // Success - gradually reduce delay back to base
    cvDelay = Math.max(COMICVINE_BASE_DELAY, cvDelay - 1000);

    if (!res.ok) return null;
    const data = await res.json() as { status_code: number; results?: Array<{ id: number; name: string; publisher?: { name?: string }; site_detail_url?: string }> };

    if (data.status_code === 107) {
      cvDelay = Math.min(cvDelay * 2, 60000);
      await sleep(cvDelay);
      return searchComicVine(query);
    }

    if (!data.results?.length) return null;

    // Score results with English preference
    let best: ComicVineMatch | null = null;
    let bestScore = 0;

    for (const r of data.results) {
      const pub = r.publisher?.name;
      let sim = calculateSimilarity(query, r.name);
      let score = sim;

      if (isNonEnglish(r.name, pub)) score *= 0.7;
      if (isEnglishPub(pub)) score *= 1.2;

      if (score > bestScore && sim >= MIN_SIMILARITY) {
        bestScore = score;
        best = { id: r.id, name: r.name, publisher: pub ?? null, url: r.site_detail_url ?? null, similarity: sim, isEnglish: !isNonEnglish(r.name, pub) };
      }
    }

    return best;
  } catch { return null; }
}

// ============================================================================
// Main
// ============================================================================

interface Progress { lastIndex: number; results: Record<string, ComicVineMatch | null> }

async function main(): Promise<void> {
  println('Fast ComicVine English Matcher (Single-Pass)');
  println('=============================================');

  // Load CSV
  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  println(`Total rows: ${rows.length}`);

  // Load progress
  let progress: Progress = { lastIndex: -1, results: {} };
  try { if (fs.existsSync(PROGRESS_PATH)) progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8')); } catch {}

  // Load AniList cache (still useful for repeated runs)
  let aniCache: Record<string, AniListMedia | null> = {};
  try { if (fs.existsSync(ANILIST_CACHE_PATH)) aniCache = JSON.parse(fs.readFileSync(ANILIST_CACHE_PATH, 'utf-8')); } catch {}

  const startIdx = progress.lastIndex + 1;
  const remaining = rows.length - startIdx;
  // ~11s per row (0.8s AniList + 10s ComicVine)
  println(`Starting from index ${startIdx}, ~${((remaining * 11) / 60).toFixed(0)} minutes remaining\n`);

  let updated = 0, skipped = 0, notFound = 0;

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const pct = (((i + 1) / rows.length) * 100).toFixed(1);
    const short = row.Title.length > 35 ? row.Title.slice(0, 35) + '...' : row.Title;

    // Skip if no AniList
    if (!row.AniListID || row.AniListID === 'DOES_NOT_EXIST') {
      skipped++;
      continue;
    }

    // Use cached ComicVine result if available
    if (progress.results[row.Title] !== undefined) {
      const cached = progress.results[row.Title];
      if (cached) {
        row.ComicVineID = String(cached.id);
        row.ComicVineDiscoveredURLs = cached.url ?? '';
        updated++;
      }
      continue;
    }

    // Fetch AniList (use cache if available)
    let ani = aniCache[row.AniListID];
    if (!ani) {
      ani = await fetchAniList(parseInt(row.AniListID, 10));
      aniCache[row.AniListID] = ani;
      await sleep(ANILIST_DELAY);
    }

    if (!ani) {
      println(`[${pct}%] ${i+1}/${rows.length}: "${short}" - No AniList data`);
      skipped++;
      continue;
    }

    // Single search query: prefer English title
    const searchQuery = ani.title.english ?? ani.title.romaji ?? row.Title;
    println(`[${pct}%] ${i+1}/${rows.length}: "${short}" -> "${searchQuery}"`);

    const match = await searchComicVine(searchQuery);
    await sleep(cvDelay);

    progress.results[row.Title] = match;

    if (match) {
      println(`  MATCH: ${match.name} [${match.publisher ?? '-'}] (${match.isEnglish ? 'EN' : 'non-EN'})`);
      row.ComicVineID = String(match.id);
      row.ComicVineDiscoveredURLs = match.url ?? `https://comicvine.gamespot.com/volume/4050-${match.id}/`;
      updated++;
    } else {
      notFound++;
    }

    // Save progress & AniList cache periodically
    if ((i + 1) % SAVE_INTERVAL === 0) {
      progress.lastIndex = i;
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
      fs.writeFileSync(ANILIST_CACHE_PATH, JSON.stringify(aniCache));
      writeCSV(rows, OUTPUT_PATH);
      println(`  [Saved at ${i + 1}]`);
    }
  }

  // Final save
  progress.lastIndex = rows.length - 1;
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
  writeCSV(rows, OUTPUT_PATH);

  println('\n==============================');
  println(`Complete! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
  println(`Output: ${OUTPUT_PATH}`);
}

main().catch(e => { process.stderr.write(`Error: ${e}\n`); process.exit(1); });
