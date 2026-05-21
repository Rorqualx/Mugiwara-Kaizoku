/**
 * Turbo ComicVine English Matcher
 *
 * Maximum speed optimizations:
 * 1. Skip if already have English publisher match
 * 2. Skip if no English title and primary has CJK
 * 3. 8s delay with aggressive backoff
 * 4. Re-use existing progress from fast-matcher
 *
 * COMICVINE_API_KEY=key bun run scripts/comicvine-english-matcher/turbo-matcher.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { AniListMedia, ComicVineMatch, CSVRow } from './types';

// ============================================================================
// Config
// ============================================================================

const CSV_PATH = path.join(process.cwd(), 'ml-training-pages.csv');
const OUTPUT_PATH = path.join(process.cwd(), 'ml-training-pages-english.csv');
const PROGRESS_PATH = path.join(process.cwd(), 'scripts', 'comicvine-english-matcher', 'turbo-progress.json');
const ANILIST_CACHE_PATH = path.join(process.cwd(), 'scripts', 'comicvine-english-matcher', 'anilist-cache.json');

// Import previous progress if available
const FAST_PROGRESS_PATH = path.join(process.cwd(), 'scripts', 'comicvine-english-matcher', 'fast-progress.json');

const COMICVINE_API = 'https://comicvine.gamespot.com/api';
const ANILIST_API = 'https://graphql.anilist.co';
const MIN_SIMILARITY = 0.4;

// Aggressive timing
const COMICVINE_BASE_DELAY = 8000; // 8s base
const ANILIST_DELAY = 700;
const SAVE_INTERVAL = 20;

function getApiKey(): string {
  const k = process.env.COMICVINE_API_KEY;
  if (!k) { process.stderr.write('Set COMICVINE_API_KEY\n'); process.exit(1); }
  return k;
}
const API_KEY: string = getApiKey();

// ============================================================================
// Utils
// ============================================================================

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
const print = (m: string): void => { process.stdout.write(m + '\n'); };

function normalize(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function similarity(t1: string, t2: string): number {
  const n1 = normalize(t1), n2 = normalize(t2);
  if (n1 === n2) return 1;
  const w1 = new Set(n1.split(' ').filter(w => w.length > 1));
  const w2 = new Set(n2.split(' ').filter(w => w.length > 1));
  if (!w1.size || !w2.size) return 0;
  const inter = [...w1].filter(x => w2.has(x)).length;
  return inter / new Set([...w1, ...w2]).size;
}

function hasCJK(s: string): boolean {
  return /[\u3000-\u9faf\uac00-\ud7af]/.test(s);
}

const NON_ENG_PUBS = ['shueisha','kodansha','shogakukan','kadokawa','square enix','ki-oon','kana','glénat','delcourt','pika','panini','planet manga','norma editorial','planeta','ivrea','carlsen','egmont','ascii media','hakusensha','houbunsha'];
const ENG_PUBS = ['viz','kodansha usa','kodansha comics','seven seas','yen press','dark horse','tokyopop','vertical','j-novel club','one peace books','ghost ship','denpa','drawn & quarterly','fanfare','conundrum','caliber','magnetic press','retrofit'];

function isNonEng(title: string, pub?: string): boolean {
  if (hasCJK(title)) return true;
  return NON_ENG_PUBS.some(p => (pub ?? '').toLowerCase().includes(p));
}

function isEngPub(pub?: string): boolean {
  return pub ? ENG_PUBS.some(p => pub.toLowerCase().includes(p)) : false;
}

// ============================================================================
// CSV
// ============================================================================

function parseCSV(c: string): CSVRow[] {
  const lines = c.split('\n'), rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]?.trim(); if (!l) continue;
    const v: string[] = []; let cur = '', inQ = false;
    for (let j = 0; j < l.length; j++) {
      const ch = l[j];
      if (ch === '"') { if (inQ && l[j+1] === '"') { cur += '"'; j++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ) { v.push(cur); cur = ''; }
      else cur += ch;
    }
    v.push(cur);
    if (v.length >= 5) rows.push({ Title: v[0]??'', AniListID: v[1]??'', WikipediaURL: v[2]??'', FandomURL: v[3]??'', ComicVineID: v[4]??'', FandomDiscoveredURLs: v[5]??'', WikipediaDiscoveredURLs: v[6]??'', ComicVineDiscoveredURLs: v[7]??'' });
  }
  return rows;
}

function esc(v: string): string { return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v; }
function writeCSV(rows: CSVRow[], p: string): void {
  const h = 'Title,AniListID,WikipediaURL,FandomURL,ComicVineID,FandomDiscoveredURLs,WikipediaDiscoveredURLs,ComicVineDiscoveredURLs';
  fs.writeFileSync(p, [h, ...rows.map(r => [r.Title,r.AniListID,r.WikipediaURL,r.FandomURL,r.ComicVineID,r.FandomDiscoveredURLs,r.WikipediaDiscoveredURLs,r.ComicVineDiscoveredURLs].map(esc).join(','))].join('\n'));
}

// ============================================================================
// AniList
// ============================================================================

const ALQ = `query ($id: Int) { Media(id: $id, type: MANGA) { id title { english romaji native } synonyms } }`;

async function fetchAL(id: number): Promise<AniListMedia | null> {
  for (let a = 0; a < 3; a++) {
    try {
      const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
      const r = await fetch(ANILIST_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: ALQ, variables: { id } }), signal: c.signal });
      clearTimeout(t);
      if (r.status === 429) { print('  AL rate limited, waiting...'); await sleep(30000); continue; }
      if (!r.ok) return null;
      const j = await r.json() as { data?: { Media?: AniListMedia } };
      return j.data?.Media ?? null;
    } catch { if (a === 2) return null; await sleep(1000); }
  }
  return null;
}

// ============================================================================
// ComicVine
// ============================================================================

let cvDelay = COMICVINE_BASE_DELAY;

async function searchCV(q: string): Promise<ComicVineMatch | null> {
  try {
    const url = new URL(`${COMICVINE_API}/search/`);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('format', 'json');
    url.searchParams.set('query', q);
    url.searchParams.set('resources', 'volume');
    url.searchParams.set('limit', '10');
    url.searchParams.set('field_list', 'id,name,publisher,site_detail_url');

    const r = await fetch(url.toString(), { headers: { 'User-Agent': 'Kaizoku/1.0', Accept: 'application/json' } });

    if (r.status === 429) {
      cvDelay = Math.min(cvDelay * 2, 60000);
      print(`  CV rate limit! Delay -> ${cvDelay/1000}s`);
      await sleep(cvDelay);
      return searchCV(q);
    }

    cvDelay = Math.max(COMICVINE_BASE_DELAY, cvDelay - 500);
    if (!r.ok) return null;

    const d = await r.json() as { status_code: number; results?: Array<{ id: number; name: string; publisher?: { name?: string }; site_detail_url?: string }> };
    if (d.status_code === 107) { cvDelay = Math.min(cvDelay * 2, 60000); await sleep(cvDelay); return searchCV(q); }
    if (!d.results?.length) return null;

    let best: ComicVineMatch | null = null, bestS = 0;
    for (const x of d.results) {
      const pub = x.publisher?.name;
      let sim = similarity(q, x.name), score = sim;
      if (isNonEng(x.name, pub)) score *= 0.7;
      if (isEngPub(pub)) score *= 1.2;
      if (score > bestS && sim >= MIN_SIMILARITY) {
        bestS = score;
        best = { id: x.id, name: x.name, publisher: pub ?? null, url: x.site_detail_url ?? null, similarity: sim, isEnglish: !isNonEng(x.name, pub) };
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
  print('TURBO ComicVine English Matcher');
  print('================================');

  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  print(`Total rows: ${rows.length}`);

  // Load progress (merge from fast-matcher if available)
  let prog: Progress = { lastIndex: -1, results: {} };
  try { if (fs.existsSync(PROGRESS_PATH)) prog = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8')); } catch {}
  try {
    if (fs.existsSync(FAST_PROGRESS_PATH)) {
      const fast = JSON.parse(fs.readFileSync(FAST_PROGRESS_PATH, 'utf-8')) as Progress;
      prog.results = { ...fast.results, ...prog.results };
      print(`Imported ${Object.keys(fast.results).length} results from fast-matcher`);
    }
  } catch {}

  let aniCache: Record<string, AniListMedia | null> = {};
  try { if (fs.existsSync(ANILIST_CACHE_PATH)) aniCache = JSON.parse(fs.readFileSync(ANILIST_CACHE_PATH, 'utf-8')); } catch {}

  // Count how many we can skip
  let needsProcessing = 0, alreadyEng = 0, noEngTitle = 0;
  for (const row of rows) {
    if (!row.AniListID || row.AniListID === 'DOES_NOT_EXIST') continue;
    if (prog.results[row.Title] !== undefined) {
      const cached = prog.results[row.Title];
      if (cached?.isEnglish) { alreadyEng++; continue; }
    }
    needsProcessing++;
  }

  print(`Already English: ${alreadyEng}, Need processing: ${needsProcessing}`);
  print(`Estimated: ~${((needsProcessing * 9) / 60).toFixed(0)} minutes\n`);

  let updated = 0, skipped = 0, notFound = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; if (!row) continue;
    const pct = (((i + 1) / rows.length) * 100).toFixed(1);
    const short = row.Title.length > 30 ? row.Title.slice(0, 30) + '...' : row.Title;

    // Skip no AniList
    if (!row.AniListID || row.AniListID === 'DOES_NOT_EXIST') { skipped++; continue; }

    // Check cache - already have English match?
    const cached = prog.results[row.Title];
    if (cached !== undefined) {
      if (cached?.isEnglish) {
        row.ComicVineID = String(cached.id);
        row.ComicVineDiscoveredURLs = cached.url ?? '';
        updated++;
        continue;
      }
      // Have non-English or null - still try again
    }

    // Fetch AniList
    let ani = aniCache[row.AniListID];
    if (!ani) {
      ani = await fetchAL(parseInt(row.AniListID, 10));
      aniCache[row.AniListID] = ani;
      await sleep(ANILIST_DELAY);
    }

    if (!ani) { skipped++; continue; }

    // Skip optimization: no English title AND primary has CJK = unlikely to have English pub
    if (!ani.title.english && hasCJK(row.Title)) {
      print(`[${pct}%] ${i+1}: "${short}" - Skip (no EN title, has CJK)`);
      noEngTitle++;
      skipped++;
      continue;
    }

    const q = ani.title.english ?? ani.title.romaji ?? row.Title;
    print(`[${pct}%] ${i+1}: "${short}" -> "${q}"`);

    const match = await searchCV(q);
    await sleep(cvDelay);
    prog.results[row.Title] = match;

    if (match) {
      print(`  MATCH: ${match.name} [${match.publisher ?? '-'}] ${match.isEnglish ? '(EN)' : '(non-EN)'}`);
      row.ComicVineID = String(match.id);
      row.ComicVineDiscoveredURLs = match.url ?? `https://comicvine.gamespot.com/volume/4050-${match.id}/`;
      updated++;
    } else {
      notFound++;
    }

    if ((i + 1) % SAVE_INTERVAL === 0) {
      prog.lastIndex = i;
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(prog));
      fs.writeFileSync(ANILIST_CACHE_PATH, JSON.stringify(aniCache));
      writeCSV(rows, OUTPUT_PATH);
      print(`  [Saved]`);
    }
  }

  prog.lastIndex = rows.length - 1;
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(prog));
  fs.writeFileSync(ANILIST_CACHE_PATH, JSON.stringify(aniCache));
  writeCSV(rows, OUTPUT_PATH);

  print('\n================================');
  print(`Done! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
  print(`Skipped due to no English title: ${noEngTitle}`);
  print(`Output: ${OUTPUT_PATH}`);
}

main().catch(e => { process.stderr.write(`${e}\n`); process.exit(1); });
