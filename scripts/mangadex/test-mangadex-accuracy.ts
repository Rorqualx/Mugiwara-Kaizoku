/**
 * MangaDex Accuracy Test Runner
 *
 * Measures how well the production MangaDex discovery + metadata pipeline
 * performs against AniList ground truth. No scraping, no FlareSolverr — pure API.
 *
 * Per-title flow:
 *   1. AniList ground truth (chapters, volumes, status)
 *   2. MangaDex discovery (search + pickBestMatch by dice coefficient)
 *   3. Cross-reference (MangaDex links.al == AniList ID)
 *   4. Metadata comparison (chapters, volumes, status)
 *   5. Aggregate fetch (volume→chapter structure)
 *
 * Usage:
 *   bun scripts/mangadex/test-mangadex-accuracy.ts --title "Naruto" --iteration 1
 *   bun scripts/mangadex/test-mangadex-accuracy.ts --fast-sample --iteration 1
 *   bun scripts/mangadex/test-mangadex-accuracy.ts --fast-sample --write-ids --iteration 1
 *
 * @module scripts/mangadex/test-mangadex-accuracy
 */

import * as fs from 'fs';
import * as path from 'path';

import type { MangaDexManga } from '@/server/services/mangadex/types';

import { generateReport, saveResults } from './report-generator';
import { MANGADEX_TEST_CORPUS, type MangaDexTestManga } from './test-mangadex-corpus';
import { fetchMALData } from './mal-client';

import type { AniListResult, MALResult, MangaDexResult, MangaTestResult, DiscoveryDiagnostics, CandidateSummary, AggregateMetrics, GroundTruthSource } from './report-generator';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

// ============================================================================
// CLI
// ============================================================================

interface CliOptions {
  singleTitle: string | null;
  fromIndex: number;
  toIndex: number | null;
  iteration?: number;
  fastSample: boolean;
  limit: number | null;
  writeIds: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const o: CliOptions = { singleTitle: null, fromIndex: 0, toIndex: null, fastSample: false, limit: null, writeIds: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--title' && args[i + 1]) { o.singleTitle = args[i + 1] ?? null; i++; }
    else if (a === '--from' && args[i + 1]) { o.fromIndex = parseInt(args[i + 1] ?? '0', 10); i++; }
    else if (a === '--to' && args[i + 1]) { o.toIndex = parseInt(args[i + 1] ?? '0', 10); i++; }
    else if (a === '--iteration' && args[i + 1]) { o.iteration = parseInt(args[i + 1] ?? '0', 10); i++; }
    else if (a === '--fast-sample') o.fastSample = true;
    else if (a === '--limit' && args[i + 1]) { o.limit = parseInt(args[i + 1] ?? '0', 10); i++; }
    else if (a === '--write-ids') o.writeIds = true;
  }
  return o;
}

// ============================================================================
// Helpers
// ============================================================================

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/research/mangadex-accuracy');
const ITERATIONS_DIR = path.resolve(OUTPUT_DIR, 'iterations');

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function ensureDir(d: string): void { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

/** Bigram dice coefficient (0..1) */
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const biA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) biA.add(a.slice(i, i + 2));
  let inter = 0;
  for (let i = 0; i < b.length - 1; i++) { if (biA.has(b.slice(i, i + 2))) inter++; }
  return (2 * inter) / (biA.size + (b.length - 1));
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

const EDITION_QUALIFIERS = [/\b(color|colou?r|full color|digital)\b/i, /\b(omnibus|deluxe|box set)\b/i];
/** Subtitle/spinoff qualifiers — reject candidate if it has these but query doesn't */
const SPINOFF_QUALIFIERS = [
  /\b(colored?|full color|official colou?red)\b/i,
  /\bpart\s+\d/i,
  /\b(shin|gaiden|side story|prologue|sequel)\b/i,
  /\b4-?koma\b/i, /\bantho(logy)?\b/i, /\b\w+-bu!?\b/i,
];
function hasEditionMismatch(query: string, candidate: string): boolean {
  // Original: query has qualifier but candidate doesn't
  if (EDITION_QUALIFIERS.some((p) => p.test(query) && !p.test(candidate))) return true;
  // Bidirectional: candidate has qualifier but query doesn't
  if (EDITION_QUALIFIERS.some((p) => p.test(candidate) && !p.test(query))) return true;
  // Spinoff: candidate has spinoff qualifier but query doesn't
  if (SPINOFF_QUALIFIERS.some((p) => p.test(candidate) && !p.test(query))) return true;
  return false;
}

// Status normalization imported via report-generator

// ============================================================================
// AniList (reuses the same Page query as ComicVine runner)
// ============================================================================

const ANILIST_API = 'https://graphql.anilist.co';
const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: MANGA) {
      id idMal title { english romaji native } synonyms
      chapters volumes status countryOfOrigin popularity
      startDate { year }
    }
  }
}`;

interface AniListMedia { id?: number; idMal?: number; title?: { english?: string; romaji?: string; native?: string }; synonyms?: string[]; chapters?: number; volumes?: number; status?: string; popularity?: number; startDate?: { year?: number } }

function pickBestAniListMedia(query: string, candidates: AniListMedia[]): AniListMedia | null {
  const q = query.toLowerCase();
  const scored = candidates.map((m) => {
    const titles = [m.title?.english, m.title?.romaji].filter((t): t is string => typeof t === 'string' && t.length > 0);
    let bestSim = 0;
    for (const t of titles) {
      const d = diceCoefficient(q, t.toLowerCase());
      const r = Math.min(q.length, t.length) / Math.max(q.length, t.length);
      if (d * r > bestSim) bestSim = d * r;
    }
    return { media: m, sim: bestSim, pop: m.popularity ?? 0 };
  });
  const eligible = scored.filter((s) => s.sim >= 0.4);
  if (eligible.length === 0) return scored[0]?.media ?? null;
  eligible.sort((a, b) => (Math.abs(b.sim - a.sim) > 0.05 ? b.sim - a.sim : b.pop - a.pop));
  return eligible[0]?.media ?? null;
}

async function fetchAniListData(search: string, retries = 3): Promise<AniListResult | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
    const resp = await fetch(ANILIST_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search } }),
    });
    if (resp.status === 429) {
      const wait = Math.min(60_000, (attempt + 1) * 10_000);
      process.stderr.write(`  [AniList 429, retry in ${wait / 1000}s]\n`);
      await delay(wait);
      continue;
    }
    if (!resp.ok) return null;
    const json = (await resp.json()) as { data?: { Page?: { media?: AniListMedia[] } } };
    const media = pickBestAniListMedia(search, json.data?.Page?.media ?? []);
    if (!media) return null;
    return {
      id: media.id ?? 0,
      idMal: media.idMal ?? null,
      chapters: media.chapters ?? null,
      volumes: media.volumes ?? null,
      status: media.status ?? 'UNKNOWN',
      titleEnglish: media.title?.english ?? null,
      titleRomaji: media.title?.romaji ?? 'Unknown',
      titleNative: media.title?.native ?? null,
      synonyms: media.synonyms ?? [],
      year: media.startDate?.year ?? null,
    };
    } catch { /* retry */ }
  }
  return null;
}

// ============================================================================
// MangaDex Discovery
// ============================================================================

function pickBestMangaDexMatch(
  results: MangaDexManga[],
  query: string,
  expectedAniListId?: number,
  expectedChapters?: number | null,
  expectedYear?: number | null,
): MangaDexManga | null {
  // Step 1: If we have an expected AniList ID, check if any candidate has links.al matching it
  if (expectedAniListId !== undefined) {
    const alMatches = results.filter((m) => {
      const al = m.attributes.links?.al;
      return al !== undefined && al !== null && parseInt(String(al), 10) === expectedAniListId;
    });
    if (alMatches.length > 0) {
      // Among cross-ref matches, prefer main edition (filter variants like Color/Colored)
      const mainEdition = scoreCandidates(alMatches, query, true, null, null);
      if (mainEdition) return mainEdition;

      // Fall back to any cross-ref match — links.al IS the verification
      return scoreCandidates(alMatches, query, false, null, null);
    }
  }

  // Step 2: Fallback to title-only scoring with edition filter + chapter/year proximity
  return scoreCandidates(results, query, true, expectedChapters ?? null, expectedYear ?? null);
}

function scoreCandidates(
  results: MangaDexManga[], query: string, applyEditionFilter: boolean,
  expectedChapters: number | null, expectedYear: number | null,
): MangaDexManga | null {
  const normalized = normalizeTitle(query);
  let best: MangaDexManga | null = null;
  let bestScore = 0;
  let bestLenDiff = Infinity;

  for (const manga of results) {
    const candidates: string[] = [];
    const t = manga.attributes.title;
    if (t.en) candidates.push(t.en);
    if (t['ja-ro']) candidates.push(t['ja-ro']);
    if (t.ja) candidates.push(t.ja);
    for (const alt of manga.attributes.altTitles) {
      candidates.push(...Object.values(alt).filter((v): v is string => typeof v === 'string'));
    }
    if (applyEditionFilter && hasEditionMismatch(query, candidates.join(' '))) continue;
    // Year proximity factor
    const candidateYear = manga.attributes.year ?? undefined;
    const yrFactor = (() => {
      if (!expectedYear || !candidateYear) return 1;
      const diff = Math.abs(candidateYear - expectedYear);
      if (diff === 0) return 1.15;
      if (diff <= 2) return 1.0;
      return 0.8;
    })();
    for (const c of candidates) {
      const dice = diceCoefficient(normalized, normalizeTitle(c));
      // Length-ratio penalty: prevents "Animalland Saga" matching "Vinland Saga"
      const lenRatio = Math.min(query.length, c.length) / Math.max(query.length, c.length);
      let score = dice * lenRatio * yrFactor;
      // Chapter proximity boost: when we know expected chapters, prefer candidates with similar count
      if (expectedChapters && expectedChapters > 0) {
        const mdCh = parseFloat(manga.attributes.lastChapter ?? '') || 0;
        if (mdCh > 0) {
          const chRatio = Math.min(mdCh, expectedChapters) / Math.max(mdCh, expectedChapters);
          score *= (0.7 + 0.3 * chRatio); // 0-30% boost based on chapter proximity
        }
      }
      const lenDiff = Math.abs(c.length - query.length);
      if (score > bestScore || (score === bestScore && lenDiff < bestLenDiff)) {
        bestScore = score;
        bestLenDiff = lenDiff;
        best = manga;
      }
    }
  }
  return bestScore >= 0.25 ? best : null;
}

// Types imported from ./report-generator

// ============================================================================
// Multi-query MangaDex search helper
// ============================================================================

async function multiQuerySearch(
  client: { searchManga: (params: { title: string }) => Promise<{ data: MangaDexManga | MangaDexManga[] }> },
  queries: Set<string>,
): Promise<MangaDexManga[]> {
  const seenIds = new Set<string>();
  const allResults: MangaDexManga[] = [];
  for (const q of queries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const searchResult = await Promise.race([
        client.searchManga({ title: q }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MangaDex search timeout')), 15_000)),
      ]);
      const dataArr = Array.isArray(searchResult.data) ? searchResult.data : [searchResult.data];
      for (const m of dataArr as MangaDexManga[]) {
        if (!seenIds.has(m.id)) { seenIds.add(m.id); allResults.push(m); }
      }
    } catch { /* search timeout — continue with other queries */ }
    await delay(300); // MangaDex inter-query delay
  }
  return allResults;
}

// ============================================================================
// Per-Title Runner
// ============================================================================

async function runMangaDexTest(
  manga: MangaDexTestManga,
  anilist: AniListResult | null,
): Promise<MangaDexResult | null> {
  const start = Date.now();
  // Need either AniList data or a verified MangaDex ID to proceed
  if (!anilist && !manga.mangadexId) return null;

  try {
    const { KaizokuMangaDexClient } = await import('@/server/services/mangadex/ts-client-factory');
    const client = new KaizokuMangaDexClient({ baseUrl: 'https://api.mangadex.org' });

    // Step B: multi-query search (corpus title + AniList title variants + native + synonyms)
    const searchQueries = new Set<string>([manga.anilistSearch]);
    if (manga.title !== manga.anilistSearch) searchQueries.add(manga.title);
    if (anilist) {
      if (anilist.titleRomaji && anilist.titleRomaji !== manga.anilistSearch) searchQueries.add(anilist.titleRomaji);
      if (anilist.titleEnglish && anilist.titleEnglish !== manga.anilistSearch) searchQueries.add(anilist.titleEnglish);
      if (anilist.titleNative) searchQueries.add(anilist.titleNative);
      for (const syn of anilist.synonyms.slice(0, 5)) {
        if (syn.length >= 3) searchQueries.add(syn);
      }
    }

    const allResults = await multiQuerySearch(client, searchQueries);

    // Score top candidates for debug
    const topCandidates: CandidateSummary[] = allResults.slice(0, 8).map((m) => ({
      mangaDexId: m.id, titleEn: m.attributes.title.en ?? null,
      titleJaRo: m.attributes.title['ja-ro'] ?? null,
      titleSimilarity: Number(diceCoefficient(normalizeTitle(manga.anilistSearch), normalizeTitle(m.attributes.title.en ?? m.attributes.title['ja-ro'] ?? '')).toFixed(3)),
      linksAl: m.attributes.links?.al ?? null, status: m.attributes.status,
      lastChapter: m.attributes.lastChapter ?? null, lastVolume: m.attributes.lastVolume ?? null,
    }));

    const matched = pickBestMangaDexMatch(
      allResults, manga.anilistSearch, anilist?.id,
      anilist?.chapters ?? manga.mangadexChapters ?? null,
      anilist?.year ?? null,
    );

    // Step C: cross-reference / ID match
    const linksAl = matched?.attributes.links?.al ?? null;
    const crossRefCorrect = anilist !== null && linksAl !== null && parseInt(linksAl, 10) === anilist.id;
    const idMatchCorrect = manga.verified === true && manga.mangadexId !== undefined && matched?.id === manga.mangadexId;

    const discovery: DiscoveryDiagnostics = {
      candidatesReturned: allResults.length,
      matchedMangaDexId: matched?.id ?? null,
      matchedTitle: matched ? (matched.attributes.title.en ?? matched.attributes.title['ja-ro'] ?? null) : null,
      titleSimilarity: matched ? diceCoefficient(normalizeTitle(manga.anilistSearch), normalizeTitle(matched.attributes.title.en ?? matched.attributes.title['ja-ro'] ?? '')) : 0,
      linksAl, expectedAniListId: anilist?.id ?? null, crossReferenceCorrect: crossRefCorrect,
      expectedMangaDexId: manga.mangadexId ?? null,
      expectedVerified: manga.verified === true,
      discoveryCorrect: idMatchCorrect,
      topCandidates,
    };

    if (!matched) {
      return { mangaDexId: null, status: null, lastChapter: null, lastVolume: null,
        chapterCount: 0, volumeCount: 0, hasEnglishChapters: false, linksAl: null,
        aggregate: null, discovery, durationMs: Date.now() - start, error: 'No match found' };
    }

    // Step D: metadata
    const attrs = matched.attributes;
    const chapterCount = parseFloat(attrs.lastChapter ?? '') || 0;
    const volumeCount = parseFloat(attrs.lastVolume ?? '') || 0;
    const hasEnglish = (attrs.availableTranslatedLanguages ?? []).includes('en');

    // Step E: aggregate (all languages for chapter count, then English for availability)
    let aggregate: AggregateMetrics | null = null;
    try {
      // Fetch all-language aggregate for total chapter/volume count
      const aggAll = await Promise.race([
        client.getMangaAggregate(matched.id),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Aggregate timeout')), 15_000)),
      ]);
      const vols = Object.entries(aggAll.volumes);
      let totalCh = 0; let maxCh = 0; let maxVol = 0;
      for (const [vk, vd] of vols) {
        const vn = parseFloat(vk);
        if (!isNaN(vn) && vn > maxVol) maxVol = vn;
        const chNums = Object.keys(vd.chapters).map(parseFloat).filter((n) => !isNaN(n));
        totalCh += chNums.length;
        for (const c of chNums) { if (c > maxCh) maxCh = c; }
      }
      aggregate = { totalVolumes: vols.length, totalChapters: totalCh, maxChapterNumber: maxCh, maxVolumeNumber: maxVol };
    } catch { /* aggregate is optional */ }

    // Use the best available chapter/volume count: prefer aggregate maxChapterNumber
    // when it's higher than lastChapter metadata (which is often incomplete)
    const aggCh = aggregate?.maxChapterNumber ?? 0;
    const finalChapterCount = Math.max(chapterCount, aggCh);
    const aggVol = aggregate?.maxVolumeNumber ?? 0;
    const finalVolumeCount = Math.max(volumeCount, aggVol);

    return {
      mangaDexId: matched.id, status: attrs.status, lastChapter: attrs.lastChapter ?? null,
      lastVolume: attrs.lastVolume ?? null, chapterCount: finalChapterCount, volumeCount: finalVolumeCount,
      hasEnglishChapters: hasEnglish,
      linksAl, aggregate, discovery, durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return { mangaDexId: null, status: null, lastChapter: null, lastVolume: null,
      chapterCount: 0, volumeCount: 0, hasEnglishChapters: false, linksAl: null,
      aggregate: null, discovery: {
        candidatesReturned: 0, matchedMangaDexId: null, matchedTitle: null, titleSimilarity: 0,
        linksAl: null, expectedAniListId: anilist?.id ?? null, crossReferenceCorrect: false,
        expectedMangaDexId: manga.mangadexId ?? null, expectedVerified: manga.verified === true,
        discoveryCorrect: false, topCandidates: [],
      }, durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err) };
  }
}

// Report generation functions imported from ./report-generator

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();
  print('MangaDex Accuracy Test'); print('======================');
  print(`Options: ${JSON.stringify(options)}`);
  ensureDir(OUTPUT_DIR); ensureDir(ITERATIONS_DIR);

  let corpus: MangaDexTestManga[] = MANGADEX_TEST_CORPUS;
  if (options.fastSample) corpus = corpus.filter((m) => m.fastSample === true);
  if (options.singleTitle) {
    const needle = options.singleTitle.toLowerCase();
    corpus = corpus.filter((m) => m.title.toLowerCase().includes(needle));
  }
  if (options.limit !== null && options.limit > 0 && corpus.length > options.limit) {
    corpus = corpus.slice(0, options.limit);
  }
  print(`\nTesting ${corpus.length} titles...\n`);

  const results: MangaTestResult[] = [];
  for (let i = 0; i < corpus.length; i++) {
    const manga = corpus[i];
    if (!manga) continue;
    const gt: GroundTruthSource = manga.groundTruth ?? 'anilist';
    print(`\n[${i + 1}/${corpus.length}] ${manga.title}${gt === 'mangadex' ? ' [MD-GT]' : ''}`);

    // Only query AniList when needed
    let anilist: AniListResult | null = null;
    if (gt === 'anilist' || gt === 'both') {
      anilist = await fetchAniListData(manga.anilistSearch);
      if (anilist) print(`  AniList: id=${anilist.id} mal=${anilist.idMal ?? '?'} ch=${anilist.chapters ?? '?'} vol=${anilist.volumes ?? '?'} ${anilist.status}`);
      await delay(1500); // AniList rate limit
    }

    // Fetch MAL data via Jikan (if MAL ID available from AniList or corpus)
    let mal: MALResult | null = null;
    const malId = anilist?.idMal ?? manga.malId ?? null;
    if (malId) {
      mal = await fetchMALData(malId);
      if (mal) print(`  MAL: id=${mal.malId} ch=${mal.chapters ?? '?'} vol=${mal.volumes ?? '?'} ${mal.status}`);
      await delay(300); // Jikan rate limit
    }

    // eslint-disable-next-line no-await-in-loop
    const md = await runMangaDexTest(manga, anilist);
    if (md) {
      const d = md.discovery;
      const verify = d.discoveryCorrect ? ' idMatch=✓' : '';
      print(`  MangaDex: ${d.matchedMangaDexId?.slice(0, 8) ?? 'none'} sim=${d.titleSimilarity.toFixed(2)} crossRef=${d.crossReferenceCorrect}${verify} ch=${md.chapterCount} vol=${md.volumeCount} en=${md.hasEnglishChapters}`);
    }
    const gtSource: GroundTruthSource = anilist && gt !== 'mangadex' ? (manga.mangadexId ? 'both' : 'anilist') : (manga.mangadexId ? 'mangadex' : 'none');
    const mangadexGT = manga.mangadexChapters !== undefined || manga.mangadexStatus !== undefined
      ? { chapters: manga.mangadexChapters, volumes: manga.mangadexVolumes, status: manga.mangadexStatus } : undefined;
    const result: MangaTestResult = { title: manga.title, slug: slugify(manga.title), anilist, mal, mangadex: md, timestamp: new Date().toISOString(), iteration: options.iteration, dataCeiling: manga.dataCeiling, groundTruthSource: gtSource, mangadexGT };
    saveResults(result);
    results.push(result);
    await delay(250); // MangaDex rate limit
  }

  print('\n\nGenerating report...');
  const report = generateReport(results);
  const reportPath = options.iteration !== undefined
    ? path.join(ITERATIONS_DIR, `RESULTS-iter-${options.iteration}.md`)
    : path.join(OUTPUT_DIR, 'RESULTS.md');
  fs.writeFileSync(reportPath, report);
  print(`Report saved to ${reportPath}`);

  // Summary
  print('\n' + '='.repeat(60)); print('SUMMARY'); print('='.repeat(60));
  for (const r of results) {
    const md = r.mangadex;
    const xref = md?.discovery.crossReferenceCorrect ? '✓' : '✗';
    print(`  ${r.title.padEnd(35)} AL:${String(r.anilist?.chapters ?? '?').padStart(5)}  MD:${String(md?.chapterCount ?? '-').padStart(5)}  xref:${xref}`);
  }
}

main().then(() => { print('\nDone.'); process.exit(0); }).catch((e: unknown) => { console.error('Fatal:', e); process.exit(1); });
