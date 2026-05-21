/**
 * MangaUpdates Accuracy Test Runner
 *
 * Assesses MangaUpdates API data quality across 100 diverse manga titles.
 * Compares MU metadata against AniList + MAL ground truth.
 *
 * Metrics: search accuracy, publisher coverage, genre overlap,
 * category richness, status concordance, chapter concordance, licensing,
 * author concordance, recommendations, publications, anime mapping,
 * type classification, year concordance, rating confidence.
 *
 * Usage:
 *   bun scripts/mangaupdates/test-mangaupdates-accuracy.ts
 *   bun scripts/mangaupdates/test-mangaupdates-accuracy.ts --title "Naruto"
 *   bun scripts/mangaupdates/test-mangaupdates-accuracy.ts --limit 5
 *   bun scripts/mangaupdates/test-mangaupdates-accuracy.ts --force
 *
 * @module scripts/mangaupdates/test-mangaupdates-accuracy
 */

import * as fs from 'fs';
import * as path from 'path';

import { MU_CORPUS } from './corpus';

import type { CorpusEntry } from './corpus';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };
function delay(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
function ensureDir(d: string): void { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function slugify(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================================
// CLI
// ============================================================================

interface CliOptions {
  singleTitle: string | null;
  limit: number | null;
  force: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const o: CliOptions = { singleTitle: null, limit: null, force: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--title' && args[i + 1]) { o.singleTitle = args[i + 1] ?? null; i++; }
    else if (a === '--limit' && args[i + 1]) { o.limit = parseInt(args[i + 1] ?? '0', 10); i++; }
    else if (a === '--force') { o.force = true; }
  }
  return o;
}

// ============================================================================
// AniList Fetch
// ============================================================================

const ANILIST_API = 'https://graphql.anilist.co';
const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: MANGA) {
      id idMal title { english romaji native } synonyms
      chapters volumes status genres tags { name }
      averageScore popularity startDate { year }
      staff { edges { role node { name { full } } } }
      format countryOfOrigin
    }
  }
}`;

interface AniListMedia {
  id?: number; idMal?: number;
  title?: { english?: string; romaji?: string; native?: string };
  synonyms?: string[]; chapters?: number; volumes?: number;
  status?: string; genres?: string[]; tags?: Array<{ name?: string }>;
  averageScore?: number; popularity?: number;
  startDate?: { year?: number };
  staff?: { edges?: Array<{ role?: string; node?: { name?: { full?: string } } }> };
  format?: string; countryOfOrigin?: string;
}

interface AniListResult {
  id: number; idMal: number | null;
  chapters: number | null; volumes: number | null;
  status: string; genres: string[]; tags: string[];
  averageScore: number | null; popularity: number;
  titleEnglish: string | null; titleRomaji: string;
  year: number | null;
  authors: string[];
  artists: string[];
  format: string | null;
  countryOfOrigin: string | null;
}

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

function normalizeAuthorName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function pickBestAniList(query: string, candidates: AniListMedia[]): AniListMedia | null {
  const q = query.toLowerCase();
  const scored = candidates.map((m) => {
    const titles = [m.title?.english, m.title?.romaji].filter((t): t is string => typeof t === 'string');
    let bestSim = 0;
    for (const t of titles) {
      const d = diceCoefficient(q, t.toLowerCase());
      if (d > bestSim) bestSim = d;
    }
    return { media: m, sim: bestSim, pop: m.popularity ?? 0 };
  });
  const eligible = scored.filter((s) => s.sim >= 0.4);
  if (eligible.length === 0) return scored[0]?.media ?? null;
  eligible.sort((a, b) => (Math.abs(b.sim - a.sim) > 0.05 ? b.sim - a.sim : b.pop - a.pop));
  return eligible[0]?.media ?? null;
}

function extractStaff(media: AniListMedia): { authors: string[]; artists: string[] } {
  const authors: string[] = [];
  const artists: string[] = [];
  for (const edge of media.staff?.edges ?? []) {
    const name = edge.node?.name?.full;
    if (!name) continue;
    const role = (edge.role ?? '').toLowerCase();
    if (role.includes('story') || role.includes('original creator') || role.includes('author')) {
      authors.push(name);
    }
    if (role.includes('art') || role.includes('illustration')) {
      artists.push(name);
    }
  }
  return { authors, artists };
}

async function fetchAniList(search: string, retries = 3): Promise<AniListResult | null> {
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
      const media = pickBestAniList(search, json.data?.Page?.media ?? []);
      if (!media) return null;
      const staff = extractStaff(media);
      return {
        id: media.id ?? 0, idMal: media.idMal ?? null,
        chapters: media.chapters ?? null, volumes: media.volumes ?? null,
        status: media.status ?? 'UNKNOWN',
        genres: media.genres ?? [],
        tags: (media.tags ?? []).map(t => t.name).filter((n): n is string => typeof n === 'string'),
        averageScore: media.averageScore ?? null,
        popularity: media.popularity ?? 0,
        titleEnglish: media.title?.english ?? null,
        titleRomaji: media.title?.romaji ?? 'Unknown',
        year: media.startDate?.year ?? null,
        authors: staff.authors,
        artists: staff.artists,
        format: media.format ?? null,
        countryOfOrigin: media.countryOfOrigin ?? null,
      };
    } catch { /* retry */ }
  }
  return null;
}

// ============================================================================
// MAL Fetch
// ============================================================================

const JIKAN_BASE = 'https://api.jikan.moe/v4/manga/';
const MAL_STATUS_MAP: Record<string, string> = {
  Publishing: 'RELEASING', Finished: 'FINISHED',
  'On Hiatus': 'HIATUS', Discontinued: 'CANCELLED',
};

interface MALResult {
  malId: number; title: string; chapters: number | null;
  volumes: number | null; status: string; score: number | null;
}

async function fetchMAL(malId: number, retries = 3): Promise<MALResult | null> {
  if (!Number.isInteger(malId) || malId <= 0) return null;
  const url = `${JIKAN_BASE}${malId}`;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const resp = await fetch(url);
      if (resp.status === 429) {
        await delay(Math.min(10_000, (attempt + 1) * 2_000));
        continue;
      }
      if (!resp.ok) return null;
      const json = (await resp.json()) as { data?: Record<string, unknown> };
      const d = json.data;
      if (!d) return null;
      return {
        malId: (d['mal_id'] as number) ?? malId,
        title: (d['title'] as string) ?? 'Unknown',
        chapters: (d['chapters'] as number | null) ?? null,
        volumes: (d['volumes'] as number | null) ?? null,
        status: MAL_STATUS_MAP[(d['status'] as string) ?? ''] ?? 'UNKNOWN',
        score: (d['score'] as number | null) ?? null,
      };
    } catch {
      if (attempt < retries - 1) await delay(1000);
    }
  }
  return null;
}

// ============================================================================
// MangaUpdates Fetch (direct API, no @/ imports)
// ============================================================================

const MU_BASE = 'https://api.mangaupdates.com/v1';

interface MUSearchHit {
  hit_title: string;
  record: {
    series_id: number; title: string; url: string;
    description: string; type: string; year: string;
    bayesian_rating: number; rating_votes: number;
    genres: Array<{ genre: string }>;
    latest_chapter: number;
    image: { url: { original: string; thumb: string } };
  };
}

interface MUSearchResponse {
  total_hits: number; page: number; per_page: number;
  results: MUSearchHit[];
}

interface MUSeriesDetails {
  series_id: number; title: string; url: string;
  description: string; type: string; year: string;
  bayesian_rating: number; rating_votes: number;
  status: string; licensed: boolean; completed: boolean;
  genres: Array<{ genre: string }>;
  categories: Array<{ category: string; votes_plus: number; votes_minus: number }>;
  authors: Array<{ name: string; author_id: number; type: string }>;
  publishers: Array<{ publisher_name: string; publisher_id: number; type: string; notes: string }>;
  publications: Array<{ publication_name: string; publisher_name: string }>;
  associated: Array<{ title: string }>;
  latest_chapter: number;
  related_series: Array<{ related_series_name: string; related_series_id: number; relation_type: string }>;
  recommendations: Array<{ series_name: string; series_id: number; weight: number }>;
  anime: { start: string; end: string };
}

async function muFetch<T>(urlPath: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const resp = await fetch(`${MU_BASE}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`MU API ${resp.status}: ${await resp.text().catch(() => 'unknown')}`);
  return await resp.json() as T;
}

async function searchMU(title: string): Promise<MUSearchHit[]> {
  const result = await muFetch<MUSearchResponse>('/series/search', {
    method: 'POST', body: { search: title, per_page: 15 },
  });
  return result.results;
}

async function getSeriesDetails(seriesId: number): Promise<MUSeriesDetails> {
  return muFetch<MUSeriesDetails>(`/series/${seriesId}`);
}

/** Pattern to detect doujinshi titles (fan works, not official series) */
const DOUJINSHI_PATTERN = /\bdj\b|\bdoujin/i;

/** Edition/spinoff qualifiers that indicate a different work */
const EDITION_QUALIFIERS = [
  /\bcolou?red?\b/i, /\bdigital\s*colou?red?\b/i, /\bomnibus\b/i,
  /\bbox\s*set\b/i, /\bdeluxe\b/i, /\bfull\s*colou?r\b/i,
];
const SPINOFF_QUALIFIERS = [
  /\bshin\b/i, /\bgaiden\b/i, /\bpart\s*\d/i,
  /\b4-?koma\b/i, /\bantho(logy)?\b/i,
];

function hasEditionMismatch(query: string, candidateTitle: string): boolean {
  for (const pattern of EDITION_QUALIFIERS) {
    if (pattern.test(query) !== pattern.test(candidateTitle)) return true;
  }
  for (const pattern of SPINOFF_QUALIFIERS) {
    if (pattern.test(candidateTitle) && !pattern.test(query)) return true;
  }
  return false;
}

/** Map AniList countryOfOrigin to expected MU type */
const COUNTRY_TO_MU_TYPE: Record<string, string> = {
  JP: 'manga', KR: 'manhwa', CN: 'manhua', TW: 'manhua',
};

function pickBestMUMatch(hits: MUSearchHit[], query: string, hints?: MUSearchHints): MUSearchHit | null {
  const normalized = normalizeTitle(query);
  let best: MUSearchHit | null = null;
  let bestScore = 0;

  for (const hit of hits) {
    const title = hit.record.title;

    // Skip doujinshi (fan works)
    if (DOUJINSHI_PATTERN.test(title) || DOUJINSHI_PATTERN.test(hit.hit_title)) continue;

    // Skip edition/spinoff mismatches
    if (hasEditionMismatch(query, title)) continue;

    // Score from both hit_title and record.title, also check against alternative titles
    let titleScore = 0;
    const queryVariants = [normalized, ...(hints?.alternativeTitles ?? []).map(normalizeTitle)];
    for (const c of [hit.hit_title, title].filter(Boolean)) {
      const normC = normalizeTitle(c);
      for (const qv of queryVariants) {
        const s = diceCoefficient(qv, normC);
        if (s > titleScore) titleScore = s;
      }
    }

    // Penalize substring inflation: candidate much longer than query
    const normCandidate = normalizeTitle(title);
    const lengthRatio = normCandidate.length / Math.max(normalized.length, 1);
    if (lengthRatio > 1.5) {
      titleScore *= Math.max(0.5, 1 / lengthRatio);
    }

    // Popularity boost (log scale, max +0.15)
    const votes = hit.record.rating_votes ?? 0;
    const popularityBonus = votes > 0 ? Math.min(0.15, Math.log10(votes) / 25) : 0;

    // Cross-validation from AniList hints
    let hintAdjustment = 0;
    if (hints) {
      const muType = (hit.record.type ?? '').toLowerCase();
      const muYear = parseInt(hit.record.year, 10);

      // Country/type concordance
      if (hints.countryOfOrigin) {
        const expectedType = COUNTRY_TO_MU_TYPE[hints.countryOfOrigin];
        if (expectedType) {
          if (muType === expectedType) hintAdjustment += 0.15;
          else if (muType && muType !== expectedType) hintAdjustment -= 0.3;
        }
      }

      // Year concordance
      if (hints.year && !isNaN(muYear)) {
        const yearDiff = Math.abs(hints.year - muYear);
        if (yearDiff <= 2) hintAdjustment += 0.1;
        else if (yearDiff > 5) hintAdjustment -= 0.25;
      }
    }

    const finalScore = titleScore + popularityBonus + hintAdjustment;
    if (finalScore > bestScore) { bestScore = finalScore; best = hit; }
  }

  return bestScore >= 0.3 ? best : null;
}

// ============================================================================
// Result Types
// ============================================================================

interface MUResult {
  found: boolean;
  seriesId: number | null;
  matchedTitle: string | null;
  titleSimilarity: number;
  publisher: { english: string | null; original: string | null };
  genres: string[];
  categories: string[];
  status: string | null;
  latestChapter: number;
  licensed: boolean;
  completed: boolean;
  authors: Array<{ name: string; type: string }>;
  alternativeTitles: string[];
  bayesianRating: number;
  ratingVotes: number;
  type: string | null;
  year: string | null;
  relatedSeries: number;
  url: string | null;
  candidateCount: number;
  // New fields
  recommendations: Array<{ name: string; seriesId: number; weight: number }>;
  recommendationCount: number;
  publications: Array<{ publicationName: string; publisherName: string }>;
  publicationCount: number;
  animeMapping: { start: string; end: string } | null;
  hasAnimeMapping: boolean;
  publisherDetails: Array<{ name: string; type: string; notes: string }>;
  authorDetails: Array<{ name: string; type: string; authorId: number }>;
}

interface ComparisonResult {
  searchCorrect: boolean;
  statusConcordance: string;
  chapterConcordance: string;
  genreOverlap: number;
  genreUniqueToMU: string[];
  genreUniqueToAL: string[];
  categoryCount: number;
  publisherFilled: boolean;
  scoreDelta: number | null;
  // New comparison fields
  authorConcordance: string;
  authorOverlap: number;
  authorUniqueToMU: string[];
  authorUniqueToAL: string[];
  hasPublications: boolean;
  hasRecommendations: boolean;
  recommendationCount: number;
  hasAnimeMapping: boolean;
  animeMappingValue: string | null;
  typeConcordance: string;
  yearConcordance: string;
  publisherDetailCount: number;
  publisherHasNotes: boolean;
  ratingVotes: number;
  ratingConfidence: string;
}

interface TitleResult {
  title: string;
  note: string;
  category: string;
  anilist: AniListResult | null;
  mal: MALResult | null;
  mu: MUResult;
  comparison: ComparisonResult;
}

// ============================================================================
// Status Normalization
// ============================================================================

const STATUS_MAP: Record<string, string> = {
  RELEASING: 'ONGOING', FINISHED: 'COMPLETED', HIATUS: 'HIATUS',
  CANCELLED: 'CANCELLED', NOT_YET_RELEASED: 'UPCOMING',
};

function normalizeALStatus(s: string): string {
  return STATUS_MAP[s] ?? 'UNKNOWN';
}

function normalizeMUStatus(s: string, completed: boolean): string {
  if (completed) return 'COMPLETED';
  const lower = s.toLowerCase();
  if (lower.includes('hiatus')) return 'HIATUS';
  if (lower.includes('cancel') || lower.includes('discontin')) return 'CANCELLED';
  if (lower.includes('ongoing') || lower.includes('year') || lower.includes('volume')) return 'ONGOING';
  if (lower.includes('complete')) return 'COMPLETED';
  return 'UNKNOWN';
}

function normalizeMALStatus(s: string): string {
  const map: Record<string, string> = {
    RELEASING: 'ONGOING', FINISHED: 'COMPLETED', HIATUS: 'HIATUS', CANCELLED: 'CANCELLED',
  };
  return map[s] ?? 'UNKNOWN';
}

/** Statuses that both mean "the series has ended" regardless of reason */
const ENDED_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

/** Check if two statuses are concordant (allowing cancelled≈completed) */
function statusesMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // CANCELLED and COMPLETED both mean "ended" — treat as match
  if (ENDED_STATUSES.has(a) && ENDED_STATUSES.has(b)) return true;
  return false;
}

// ============================================================================
// Type/Format Normalization
// ============================================================================

function normalizeALFormat(format: string | null, country: string | null): string {
  if (country === 'KR') return 'MANHWA';
  if (country === 'CN' || country === 'TW') return 'MANHUA';
  if (format === 'NOVEL') return 'NOVEL';
  if (format === 'ONE_SHOT') return 'ONE_SHOT';
  return 'MANGA';
}

function normalizeMUType(type: string | null): string {
  if (!type) return 'UNKNOWN';
  const lower = type.toLowerCase();
  if (lower.includes('manhwa') || lower.includes('korean')) return 'MANHWA';
  if (lower.includes('manhua') || lower.includes('chinese')) return 'MANHUA';
  if (lower.includes('novel')) return 'NOVEL';
  return 'MANGA';
}

// ============================================================================
// Author Comparison
// ============================================================================

/** Generate name variants for fuzzy matching: original, reversed, surname-only */
function nameVariants(name: string): string[] {
  const norm = normalizeAuthorName(name);
  const parts = norm.split(/\s+/).filter(Boolean);
  const variants = [norm];
  // Reversed order: "george morikawa" ↔ "morikawa george"
  if (parts.length >= 2) {
    variants.push(parts.slice().reverse().join(' '));
    // Surname only (last part or first part)
    variants.push(parts[0]!);
    variants.push(parts[parts.length - 1]!);
  }
  return variants;
}

/** Check if two author names match using fuzzy + name-order reversal */
function authorNamesMatch(a: string, b: string): boolean {
  const aVars = nameVariants(a);
  const bVars = nameVariants(b);
  for (const av of aVars) {
    for (const bv of bVars) {
      if (av === bv) return true;
      if (av.includes(bv) || bv.includes(av)) return true;
      if (diceCoefficient(av, bv) >= 0.65) return true;
    }
  }
  return false;
}

function compareAuthors(
  alAuthors: string[],
  muAuthors: Array<{ name: string; type: string }>,
): { concordance: string; overlap: number; uniqueToMU: string[]; uniqueToAL: string[] } {
  // Deduplicate AL authors (AL often lists same person as author+artist)
  const alUnique = [...new Set(alAuthors.map(normalizeAuthorName))];
  // Filter out translators/editors/letterers from AL staff (they inflate mismatch)
  const muAuthorNames = muAuthors.filter(a => a.type === 'Author').map(a => a.name);
  const muArtistNames = muAuthors.filter(a => a.type === 'Artist').map(a => a.name);
  const muAllNamesDedup = [...new Set([...muAuthorNames, ...muArtistNames].map(normalizeAuthorName))];

  let overlap = 0;
  const matchedMU = new Set<string>();
  const matchedAL = new Set<string>();

  for (const alName of alUnique) {
    for (const muName of muAllNamesDedup) {
      if (matchedMU.has(muName)) continue;
      if (authorNamesMatch(alName, muName)) {
        overlap++;
        matchedMU.add(muName);
        matchedAL.add(alName);
        break;
      }
    }
  }

  const muAllNames = [...muAuthorNames, ...muArtistNames];
  const uniqueToMU = muAllNames.filter(n => !matchedMU.has(normalizeAuthorName(n)));
  const uniqueToAL = alAuthors.filter(n => !matchedAL.has(normalizeAuthorName(n)));

  let concordance: string;
  if (alUnique.length === 0 && muAllNamesDedup.length === 0) {
    concordance = 'BOTH_EMPTY';
  } else if (alUnique.length === 0) {
    concordance = `MU_ONLY (${muAllNames.length} authors)`;
  } else if (muAllNamesDedup.length === 0) {
    concordance = `AL_ONLY (${alAuthors.length} authors)`;
  } else if (overlap > 0) {
    concordance = `MATCH (${overlap}/${Math.max(alUnique.length, muAllNamesDedup.length)})`;
  } else {
    concordance = `MISMATCH (AL: ${alAuthors.join(', ')} vs MU: ${muAllNames.join(', ')})`;
  }

  return { concordance, overlap, uniqueToMU, uniqueToAL };
}

// ============================================================================
// Build Empty MU Result
// ============================================================================

function emptyMUResult(): MUResult {
  return {
    found: false, seriesId: null, matchedTitle: null, titleSimilarity: 0,
    publisher: { english: null, original: null }, genres: [], categories: [],
    status: null, latestChapter: 0, licensed: false, completed: false,
    authors: [], alternativeTitles: [], bayesianRating: 0, ratingVotes: 0,
    type: null, year: null, relatedSeries: 0, url: null, candidateCount: 0,
    recommendations: [], recommendationCount: 0,
    publications: [], publicationCount: 0,
    animeMapping: null, hasAnimeMapping: false,
    publisherDetails: [], authorDetails: [],
  };
}

// ============================================================================
// Per-Title Runner
// ============================================================================

async function runTest(entry: CorpusEntry): Promise<TitleResult> {
  // 1. AniList
  const anilist = await fetchAniList(entry.anilistSearch);
  if (anilist) {
    print(`  AniList: id=${anilist.id} mal=${anilist.idMal ?? '?'} ch=${anilist.chapters ?? '?'} vol=${anilist.volumes ?? '?'} ${anilist.status} score=${anilist.averageScore ?? '?'}`);
    print(`    Authors: ${anilist.authors.join(', ') || 'none'} | Artists: ${anilist.artists.join(', ') || 'none'}`);
  } else {
    print(`  AniList: NOT FOUND`);
  }
  await delay(1500);

  // 2. MAL
  let mal: MALResult | null = null;
  const malId = anilist?.idMal ?? null;
  if (malId) {
    mal = await fetchMAL(malId);
    if (mal) print(`  MAL: id=${mal.malId} ch=${mal.chapters ?? '?'} vol=${mal.volumes ?? '?'} ${mal.status} score=${mal.score ?? '?'}`);
    await delay(350);
  }

  // 3. MangaUpdates (with AniList cross-validation hints)
  const mu = await fetchMUData(entry, anilist);

  // 4. Comparison
  const comparison = buildComparison(anilist, mal, mu, entry);

  return { title: entry.title, note: entry.note, category: entry.category, anilist, mal, mu, comparison };
}

interface MUSearchHints {
  year?: number;
  countryOfOrigin?: string;
  alternativeTitles?: string[];
}

async function fetchMUData(entry: CorpusEntry, anilist: AniListResult | null): Promise<MUResult> {
  const mu = emptyMUResult();

  // Build hints from AniList data for cross-validation
  const hints: MUSearchHints | undefined = anilist ? {
    year: anilist.year ?? undefined,
    countryOfOrigin: anilist.countryOfOrigin ?? undefined,
    alternativeTitles: [anilist.titleRomaji, anilist.titleEnglish].filter((t): t is string => typeof t === 'string' && t.length >= 3),
  } : undefined;

  try {
    // Search with multiple title variants when hints available
    const queries = new Set([entry.title]);
    for (const alt of hints?.alternativeTitles ?? []) {
      if (alt.length >= 3) queries.add(alt);
    }
    const seenIds = new Set<number>();
    const allHits: MUSearchHit[] = [];
    for (const q of queries) {
      const hits = await searchMU(q);
      for (const hit of hits) {
        if (!seenIds.has(hit.record.series_id)) {
          seenIds.add(hit.record.series_id);
          allHits.push(hit);
        }
      }
      await delay(500);
    }
    mu.candidateCount = allHits.length;

    const bestHit = pickBestMUMatch(allHits, entry.title, hints);
    if (bestHit) {
      mu.titleSimilarity = diceCoefficient(normalizeTitle(entry.title), normalizeTitle(bestHit.record.title));

      const details = await getSeriesDetails(bestHit.record.series_id);
      await delay(500);

      const engPub = details.publishers.find(p => p.type === 'English');
      const origPub = details.publishers.find(p => p.type === 'Original');

      // Parse anime mapping
      const hasAnime = Boolean(details.anime?.start || details.anime?.end);
      const animeMapping = hasAnime
        ? { start: details.anime.start, end: details.anime.end }
        : null;

      Object.assign(mu, {
        found: true,
        seriesId: details.series_id,
        matchedTitle: details.title,
        titleSimilarity: diceCoefficient(normalizeTitle(entry.title), normalizeTitle(details.title)),
        publisher: { english: engPub?.publisher_name ?? null, original: origPub?.publisher_name ?? null },
        genres: details.genres.map(g => g.genre),
        categories: details.categories.filter(c => c.votes_plus > c.votes_minus).map(c => c.category),
        status: details.status,
        latestChapter: details.latest_chapter,
        licensed: details.licensed,
        completed: details.completed,
        authors: details.authors.map(a => ({ name: a.name, type: a.type })),
        alternativeTitles: details.associated.map(a => a.title),
        bayesianRating: details.bayesian_rating,
        ratingVotes: details.rating_votes,
        type: details.type,
        year: details.year,
        relatedSeries: details.related_series.length,
        url: details.url,
        candidateCount: allHits.length,
        // New fields
        recommendations: (details.recommendations ?? []).map(r => ({ name: r.series_name, seriesId: r.series_id, weight: r.weight })),
        recommendationCount: (details.recommendations ?? []).length,
        publications: (details.publications ?? []).map(p => ({ publicationName: p.publication_name, publisherName: p.publisher_name })),
        publicationCount: (details.publications ?? []).length,
        animeMapping,
        hasAnimeMapping: hasAnime,
        publisherDetails: details.publishers.map(p => ({ name: p.publisher_name, type: p.type, notes: p.notes ?? '' })),
        authorDetails: details.authors.map(a => ({ name: a.name, type: a.type, authorId: a.author_id })),
      } satisfies MUResult);

      print(`  MangaUpdates: id=${mu.seriesId} sim=${mu.titleSimilarity.toFixed(2)} ch=${mu.latestChapter} status="${mu.status}" type=${mu.type}`);
      print(`    Publisher: ${mu.publisher.original ?? '?'} (Original), ${mu.publisher.english ?? '?'} (English)`);
      print(`    Genres: ${mu.genres.join(', ')}`);
      print(`    Categories: ${mu.categories.slice(0, 6).join(', ')}${mu.categories.length > 6 ? ` (+${mu.categories.length - 6} more)` : ''}`);
      print(`    Rating: ${mu.bayesianRating.toFixed(2)} (${mu.ratingVotes} votes) | Licensed: ${mu.licensed} | Completed: ${mu.completed}`);
      print(`    Authors: ${mu.authors.map(a => `${a.name} (${a.type})`).join(', ') || 'none'}`);
      print(`    Recommendations: ${mu.recommendationCount} | Publications: ${mu.publicationCount} | Related: ${mu.relatedSeries}`);
      if (mu.hasAnimeMapping) print(`    Anime: ${mu.animeMapping?.start} → ${mu.animeMapping?.end}`);
    } else {
      print(`  MangaUpdates: NO MATCH (${allHits.length} candidates, none above threshold)`);
    }
  } catch (err: unknown) {
    print(`  MangaUpdates: ERROR — ${err instanceof Error ? err.message : String(err)}`);
  }

  return mu;
}

function buildComparison(anilist: AniListResult | null, mal: MALResult | null, mu: MUResult, entry: CorpusEntry): ComparisonResult {
  // Genre comparison
  const alGenres = new Set((anilist?.genres ?? []).map(g => g.toLowerCase()));
  const muGenres = new Set(mu.genres.map(g => g.toLowerCase()));
  const genreOverlap = [...alGenres].filter(g => muGenres.has(g)).length;
  const genreUniqueToMU = mu.genres.filter(g => !alGenres.has(g.toLowerCase()));
  const genreUniqueToAL = (anilist?.genres ?? []).filter(g => !muGenres.has(g.toLowerCase()));

  // Status comparison
  const alStatus = anilist ? normalizeALStatus(anilist.status) : null;
  const muStatus = mu.found ? normalizeMUStatus(mu.status ?? '', mu.completed) : null;
  const malStatus = mal ? normalizeMALStatus(mal.status) : null;

  let statusConcordance = 'N/A';
  if (alStatus && muStatus) {
    statusConcordance = statusesMatch(alStatus, muStatus) ? 'MATCH' : `MISMATCH (AL=${alStatus}, MU=${muStatus})`;
  }

  // Chapter comparison
  let chapterConcordance = 'N/A';
  if (anilist?.chapters && mu.latestChapter > 0) {
    const ratio = Math.min(anilist.chapters, mu.latestChapter) / Math.max(anilist.chapters, mu.latestChapter);
    chapterConcordance = ratio >= 0.95 ? `MATCH (${ratio.toFixed(2)})` : `DIVERGENT (AL=${anilist.chapters}, MU=${mu.latestChapter}, ratio=${ratio.toFixed(2)})`;
  } else if (mal?.chapters && mu.latestChapter > 0) {
    const ratio = Math.min(mal.chapters, mu.latestChapter) / Math.max(mal.chapters, mu.latestChapter);
    chapterConcordance = ratio >= 0.95 ? `MATCH-via-MAL (${ratio.toFixed(2)})` : `DIVERGENT-vs-MAL (MAL=${mal.chapters}, MU=${mu.latestChapter})`;
  }

  // Score delta
  let scoreDelta: number | null = null;
  if (anilist?.averageScore && mu.bayesianRating > 0) {
    scoreDelta = anilist.averageScore - (mu.bayesianRating * 10);
  }

  // Author concordance
  const alAllAuthors = [...(anilist?.authors ?? []), ...(anilist?.artists ?? [])];
  const authorComp = compareAuthors(alAllAuthors, mu.authors);

  // Type concordance
  const alType = anilist ? normalizeALFormat(anilist.format, anilist.countryOfOrigin) : null;
  const muType = normalizeMUType(mu.type);
  let typeConcordance = 'N/A';
  if (alType && mu.found) {
    if (alType === muType) {
      typeConcordance = 'MATCH';
    } else if (alType === 'NOVEL' && muType === 'MANGA') {
      // AL shows source as NOVEL, MU shows the manga adaptation — both correct
      typeConcordance = 'MATCH (LN→Manga)';
    } else if (alType === 'ONE_SHOT' && muType === 'MANGA') {
      // AL ONE_SHOT classification often inaccurate for serialized manga
      typeConcordance = 'MATCH (ONE_SHOT≈Manga)';
    } else {
      typeConcordance = `MISMATCH (AL=${alType}, MU=${muType})`;
    }
  }

  // Year concordance
  const alYear = anilist?.year;
  const muYear = mu.year ? parseInt(mu.year, 10) : null;
  let yearConcordance = 'N/A';
  if (alYear && muYear) {
    const diff = Math.abs(alYear - muYear);
    yearConcordance = diff === 0 ? 'MATCH' : diff <= 1 ? `CLOSE (AL=${alYear}, MU=${muYear})` : `MISMATCH (AL=${alYear}, MU=${muYear})`;
  }

  // Rating confidence
  let ratingConfidence = 'NONE';
  if (mu.ratingVotes >= 1000) ratingConfidence = 'HIGH';
  else if (mu.ratingVotes >= 100) ratingConfidence = 'MEDIUM';
  else if (mu.ratingVotes > 0) ratingConfidence = 'LOW';

  // Anime mapping
  const animeMappingValue = mu.animeMapping
    ? `${mu.animeMapping.start} → ${mu.animeMapping.end}`
    : null;

  // Publisher notes
  const publisherHasNotes = mu.publisherDetails.some(p => (p.notes ?? '').length > 0);

  if (malStatus && muStatus && alStatus) {
    print(`  Status: AL=${alStatus} MAL=${malStatus} MU=${muStatus} → ${statusConcordance}`);
  }
  print(`  Chapters: ${chapterConcordance}`);
  print(`  Authors: ${authorComp.concordance}`);
  print(`  Type: ${typeConcordance} | Year: ${yearConcordance}`);

  return {
    searchCorrect: mu.found,
    statusConcordance,
    chapterConcordance,
    genreOverlap,
    genreUniqueToMU,
    genreUniqueToAL,
    categoryCount: mu.categories.length,
    publisherFilled: mu.publisher.english !== null || mu.publisher.original !== null,
    scoreDelta,
    // New fields
    authorConcordance: authorComp.concordance,
    authorOverlap: authorComp.overlap,
    authorUniqueToMU: authorComp.uniqueToMU,
    authorUniqueToAL: authorComp.uniqueToAL,
    hasPublications: mu.publicationCount > 0,
    hasRecommendations: mu.recommendationCount > 0,
    recommendationCount: mu.recommendationCount,
    hasAnimeMapping: mu.hasAnimeMapping,
    animeMappingValue,
    typeConcordance,
    yearConcordance,
    publisherDetailCount: mu.publisherDetails.length,
    publisherHasNotes,
    ratingVotes: mu.ratingVotes,
    ratingConfidence,
  };
}

// ============================================================================
// Report Generator
// ============================================================================

function generateReport(results: TitleResult[]): string {
  const lines: string[] = [];
  const found = results.filter(r => r.mu.found);

  lines.push('# MangaUpdates Accuracy Assessment');
  lines.push(`\n*Generated: ${new Date().toISOString()}*`);
  lines.push(`*Titles tested: ${results.length}*\n`);

  // === Search Accuracy ===
  lines.push('## Search Accuracy\n');
  lines.push('| # | Title | Category | MU Match | Sim | Status | Licensed |');
  lines.push('|---|-------|----------|----------|-----|--------|----------|');
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const sim = r.mu.found ? r.mu.titleSimilarity.toFixed(2) : '-';
    lines.push(`| ${i + 1} | ${r.title} | ${r.category} | ${r.mu.found ? r.mu.matchedTitle : 'NOT FOUND'} | ${sim} | ${r.comparison.statusConcordance} | ${r.mu.licensed} |`);
  }

  // === Aggregate Metrics ===
  appendAggregateMetrics(lines, results, found);

  // === Type Classification ===
  appendTypeClassification(lines, found);

  // === Author Concordance ===
  appendAuthorConcordance(lines, found);

  // === Recommendations Coverage ===
  appendRecommendations(lines, found);

  // === Publications Coverage ===
  appendPublications(lines, found);

  // === Anime Mapping ===
  appendAnimeMapping(lines, found);

  // === Year Concordance ===
  appendYearConcordance(lines, found);

  // === Rating Confidence ===
  appendRatingConfidence(lines, found);

  // === Publisher Data ===
  appendPublisherData(lines, found);

  // === Genre Analysis ===
  appendGenreAnalysis(lines, found);

  // === Category Richness ===
  appendCategoryRichness(lines, found);

  // === Score Comparison ===
  appendScoreComparison(lines, found);

  return lines.join('\n');
}

function appendAggregateMetrics(lines: string[], results: TitleResult[], found: TitleResult[]): void {
  const withPublisher = found.filter(r => r.comparison.publisherFilled);
  const withEngPub = found.filter(r => r.mu.publisher.english !== null);
  const statusMatches = results.filter(r => r.comparison.statusConcordance === 'MATCH');
  const licensed = found.filter(r => r.mu.licensed);
  const totalCategories = found.reduce((sum, r) => sum + (r.mu.categories?.length ?? 0), 0);
  const totalUniqueGenres = found.reduce((sum, r) => sum + r.comparison.genreUniqueToMU.length, 0);
  const avgGenreOverlap = found.length > 0 ? found.reduce((sum, r) => sum + r.comparison.genreOverlap, 0) / found.length : 0;
  const withRecs = found.filter(r => r.comparison.hasRecommendations);
  const withPubs = found.filter(r => r.comparison.hasPublications);
  const withAnime = found.filter(r => r.comparison.hasAnimeMapping);
  const typeMatches = found.filter(r => r.comparison.typeConcordance.startsWith('MATCH'));
  const yearMatches = found.filter(r => r.comparison.yearConcordance === 'MATCH' || r.comparison.yearConcordance.startsWith('CLOSE'));

  lines.push('\n## Aggregate Metrics\n');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Search accuracy | ${found.length}/${results.length} (${((found.length / results.length) * 100).toFixed(0)}%) |`);
  lines.push(`| Publisher coverage (any) | ${withPublisher.length}/${found.length} |`);
  lines.push(`| English publisher | ${withEngPub.length}/${found.length} |`);
  lines.push(`| Status concordance (vs AniList) | ${statusMatches.length}/${results.length} |`);
  lines.push(`| Licensed titles | ${licensed.length}/${found.length} |`);
  lines.push(`| Type concordance (AL vs MU) | ${typeMatches.length}/${found.length} |`);
  lines.push(`| Year concordance (exact+close) | ${yearMatches.length}/${found.length} |`);
  lines.push(`| Avg genre overlap with AniList | ${avgGenreOverlap.toFixed(1)} genres |`);
  lines.push(`| Total unique MU genres (not in AL) | ${totalUniqueGenres} |`);
  lines.push(`| Avg categories per title | ${found.length > 0 ? (totalCategories / found.length).toFixed(1) : 0} |`);
  lines.push(`| Titles with recommendations | ${withRecs.length}/${found.length} (${found.length > 0 ? ((withRecs.length / found.length) * 100).toFixed(0) : 0}%) |`);
  lines.push(`| Titles with publications | ${withPubs.length}/${found.length} (${found.length > 0 ? ((withPubs.length / found.length) * 100).toFixed(0) : 0}%) |`);
  lines.push(`| Titles with anime mapping | ${withAnime.length}/${found.length} (${found.length > 0 ? ((withAnime.length / found.length) * 100).toFixed(0) : 0}%) |`);
}

function appendTypeClassification(lines: string[], found: TitleResult[]): void {
  lines.push('\n## Type Classification (AL Format vs MU Type)\n');
  lines.push('| Title | AL Format | MU Type | Concordance |');
  lines.push('|-------|-----------|---------|-------------|');
  for (const r of found) {
    const alType = r.anilist ? normalizeALFormat(r.anilist.format, r.anilist.countryOfOrigin) : '-';
    lines.push(`| ${r.title} | ${alType} | ${r.mu.type ?? '-'} | ${r.comparison.typeConcordance} |`);
  }
}

function appendAuthorConcordance(lines: string[], found: TitleResult[]): void {
  const withMatch = found.filter(r => r.comparison.authorConcordance.startsWith('MATCH'));
  const muOnly = found.filter(r => r.comparison.authorConcordance.startsWith('MU_ONLY'));

  lines.push('\n## Author Concordance\n');
  lines.push(`*Author match rate: ${withMatch.length}/${found.length} | MU-only: ${muOnly.length}*\n`);
  lines.push('| Title | AL Authors | MU Authors | Concordance |');
  lines.push('|-------|-----------|-----------|-------------|');
  for (const r of found) {
    const alA = r.anilist ? [...r.anilist.authors, ...r.anilist.artists].join(', ') : '-';
    const muA = r.mu.authors.map(a => `${a.name} (${a.type})`).join(', ') || '-';
    lines.push(`| ${r.title} | ${alA || '-'} | ${muA} | ${r.comparison.authorConcordance} |`);
  }
}

function appendRecommendations(lines: string[], found: TitleResult[]): void {
  const withRecs = found.filter(r => r.mu.recommendationCount > 0);
  const avgRecs = withRecs.length > 0 ? withRecs.reduce((s, r) => s + r.mu.recommendationCount, 0) / withRecs.length : 0;

  lines.push('\n## Recommendations Coverage\n');
  lines.push(`*${withRecs.length}/${found.length} have recommendations | Avg: ${avgRecs.toFixed(1)} per title*\n`);
  lines.push('| Title | Count | Top Recommendations |');
  lines.push('|-------|-------|---------------------|');
  for (const r of found) {
    const top = r.mu.recommendations.slice(0, 3).map(rec => `${rec.name} (w:${rec.weight})`).join(', ') || '-';
    lines.push(`| ${r.title} | ${r.mu.recommendationCount} | ${top} |`);
  }
}

function appendPublications(lines: string[], found: TitleResult[]): void {
  const withPubs = found.filter(r => r.mu.publicationCount > 0);

  lines.push('\n## Publications (Magazine/Imprint)\n');
  lines.push(`*${withPubs.length}/${found.length} have publication data*\n`);
  lines.push('| Title | Publications |');
  lines.push('|-------|-------------|');
  for (const r of found.filter(r => r.mu.publicationCount > 0)) {
    const pubs = r.mu.publications.map(p => `${p.publicationName} (${p.publisherName})`).join(', ');
    lines.push(`| ${r.title} | ${pubs} |`);
  }
}

function appendAnimeMapping(lines: string[], found: TitleResult[]): void {
  const withAnime = found.filter(r => r.comparison.hasAnimeMapping);

  lines.push('\n## Anime Adaptation Mapping\n');
  lines.push(`*${withAnime.length}/${found.length} have anime mapping data*\n`);
  if (withAnime.length > 0) {
    lines.push('| Title | Anime Range |');
    lines.push('|-------|-------------|');
    for (const r of withAnime) {
      lines.push(`| ${r.title} | ${r.comparison.animeMappingValue ?? '-'} |`);
    }
  }
}

function appendYearConcordance(lines: string[], found: TitleResult[]): void {
  lines.push('\n## Year Concordance\n');
  lines.push('| Title | AL Year | MU Year | Concordance |');
  lines.push('|-------|---------|---------|-------------|');
  for (const r of found) {
    lines.push(`| ${r.title} | ${r.anilist?.year ?? '-'} | ${r.mu.year ?? '-'} | ${r.comparison.yearConcordance} |`);
  }
}

function appendRatingConfidence(lines: string[], found: TitleResult[]): void {
  const high = found.filter(r => r.comparison.ratingConfidence === 'HIGH');
  const medium = found.filter(r => r.comparison.ratingConfidence === 'MEDIUM');
  const low = found.filter(r => r.comparison.ratingConfidence === 'LOW');
  const none = found.filter(r => r.comparison.ratingConfidence === 'NONE');

  lines.push('\n## Rating Confidence Distribution\n');
  lines.push(`| Confidence | Count | % |`);
  lines.push(`|------------|-------|---|`);
  lines.push(`| HIGH (1000+ votes) | ${high.length} | ${found.length > 0 ? ((high.length / found.length) * 100).toFixed(0) : 0}% |`);
  lines.push(`| MEDIUM (100-999) | ${medium.length} | ${found.length > 0 ? ((medium.length / found.length) * 100).toFixed(0) : 0}% |`);
  lines.push(`| LOW (<100) | ${low.length} | ${found.length > 0 ? ((low.length / found.length) * 100).toFixed(0) : 0}% |`);
  lines.push(`| NONE (0 votes) | ${none.length} | ${found.length > 0 ? ((none.length / found.length) * 100).toFixed(0) : 0}% |`);
}

function appendPublisherData(lines: string[], found: TitleResult[]): void {
  const withNotes = found.filter(r => r.comparison.publisherHasNotes);
  const avgPubCount = found.length > 0 ? found.reduce((s, r) => s + r.comparison.publisherDetailCount, 0) / found.length : 0;

  lines.push('\n## Publisher Detail Richness\n');
  lines.push(`*Avg publisher entries: ${avgPubCount.toFixed(1)} | With notes: ${withNotes.length}/${found.length}*\n`);
  lines.push('| Title | Original Publisher | English Publisher | Total Entries | Has Notes |');
  lines.push('|-------|--------------------|-------------------|---------------|-----------|');
  for (const r of found) {
    lines.push(`| ${r.title} | ${r.mu.publisher.original ?? '-'} | ${r.mu.publisher.english ?? '-'} | ${r.comparison.publisherDetailCount} | ${r.comparison.publisherHasNotes} |`);
  }
}

function appendGenreAnalysis(lines: string[], found: TitleResult[]): void {
  lines.push('\n## Genre Analysis\n');
  lines.push('| Title | AL Genres | MU Genres | Overlap | Unique to MU |');
  lines.push('|-------|----------|----------|---------|-------------|');
  for (const r of found) {
    const alCount = r.anilist?.genres.length ?? 0;
    lines.push(`| ${r.title} | ${alCount} | ${r.mu.genres.length} | ${r.comparison.genreOverlap} | ${r.comparison.genreUniqueToMU.join(', ') || '-'} |`);
  }
}

function appendCategoryRichness(lines: string[], found: TitleResult[]): void {
  lines.push('\n## Category Richness (MU-Exclusive Data)\n');
  lines.push('| Title | Categories | Top Categories |');
  lines.push('|-------|-----------|---------------|');
  for (const r of found) {
    lines.push(`| ${r.title} | ${r.mu.categories?.length ?? 0} | ${(r.mu.categories ?? []).slice(0, 5).join(', ') || '-'} |`);
  }
}

function appendScoreComparison(lines: string[], found: TitleResult[]): void {
  lines.push('\n## Score Comparison\n');
  lines.push('| Title | AniList (/100) | MU Rating (/10) | MU Votes | Confidence | Delta |');
  lines.push('|-------|---------------|----------------|----------|------------|-------|');
  for (const r of found) {
    const alScore = r.anilist?.averageScore ?? '-';
    const delta = r.comparison.scoreDelta !== null ? r.comparison.scoreDelta.toFixed(0) : '-';
    const muRating = r.mu.bayesianRating ?? 0;
    lines.push(`| ${r.title} | ${alScore} | ${muRating.toFixed(2)} | ${r.mu.ratingVotes ?? 0} | ${r.comparison.ratingConfidence} | ${delta} |`);
  }
}

// ============================================================================
// Main
// ============================================================================

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/research/mangaupdates-accuracy');
const ITERATIONS_DIR = path.resolve(OUTPUT_DIR, 'iterations');

async function main(): Promise<void> {
  const options = parseArgs();
  print('MangaUpdates Accuracy Assessment');
  print('================================');
  ensureDir(OUTPUT_DIR);
  ensureDir(ITERATIONS_DIR);

  let corpus: CorpusEntry[] = [...MU_CORPUS];
  if (options.singleTitle) {
    const needle = options.singleTitle.toLowerCase();
    corpus = corpus.filter(m => m.title.toLowerCase().includes(needle));
  }
  if (options.limit !== null && options.limit > 0) {
    corpus = corpus.slice(0, options.limit);
  }
  print(`Testing ${corpus.length} titles (force=${options.force})...\n`);

  const results: TitleResult[] = [];
  let skipped = 0;

  for (let i = 0; i < corpus.length; i++) {
    const entry = corpus[i]!;
    const slug = slugify(entry.title);
    const existingPath = path.join(ITERATIONS_DIR, slug, 'summary.json');

    // Incremental mode: skip if already tested (unless --force)
    if (!options.force && fs.existsSync(existingPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8')) as TitleResult;
        // Check if existing result has new fields (recommendations, publications, etc.)
        if (existing.mu && 'recommendationCount' in existing.mu) {
          results.push(existing);
          skipped++;
          continue;
        }
        // If missing new fields, re-run this title
        print(`\n[${i + 1}/${corpus.length}] ${entry.title} (re-running: missing new fields)`);
      } catch {
        // Corrupted JSON, re-run
      }
    } else if (!options.force && fs.existsSync(existingPath)) {
      // Shouldn't reach here but safeguard
    }

    print(`\n[${i + 1}/${corpus.length}] ${entry.title} (${entry.note}) [${entry.category}]`);
    print('-'.repeat(60));

    const result = await runTest(entry);
    results.push(result);

    // Save per-title JSON incrementally
    const titleDir = path.join(ITERATIONS_DIR, slug);
    ensureDir(titleDir);
    fs.writeFileSync(path.join(titleDir, 'summary.json'), JSON.stringify(result, null, 2));
  }

  if (skipped > 0) print(`\nSkipped ${skipped} titles with existing results (use --force to re-run all)`);

  // Generate report
  print('\n\n' + '='.repeat(60));
  print('GENERATING REPORT');
  print('='.repeat(60));

  const report = generateReport(results);
  const reportPath = path.join(OUTPUT_DIR, 'RESULTS.md');
  fs.writeFileSync(reportPath, report);
  print(`\nReport saved to ${reportPath}`);

  // Quick summary
  printSummary(results);
}

function printSummary(results: TitleResult[]): void {
  print('\n' + '='.repeat(60));
  print('SUMMARY');
  print('='.repeat(60));

  const found = results.filter(r => r.mu.found);
  const pubs = results.filter(r => r.comparison.publisherFilled).length;
  const statusMatch = results.filter(r => r.comparison.statusConcordance === 'MATCH').length;
  const typeMatch = found.filter(r => r.comparison.typeConcordance.startsWith('MATCH')).length;
  const withRecs = found.filter(r => r.comparison.hasRecommendations).length;
  const withPubData = found.filter(r => r.comparison.hasPublications).length;
  const withAnime = found.filter(r => r.comparison.hasAnimeMapping).length;
  const authorMatch = found.filter(r => r.comparison.authorConcordance.startsWith('MATCH')).length;

  print(`  Search accuracy:    ${found.length}/${results.length} (${((found.length / results.length) * 100).toFixed(0)}%)`);
  print(`  Publisher data:     ${pubs}/${found.length} titles`);
  print(`  Status concordance: ${statusMatch}/${results.length} match AniList`);
  print(`  Type concordance:   ${typeMatch}/${found.length} match AniList`);
  print(`  Author concordance: ${authorMatch}/${found.length} match AniList`);
  print(`  Recommendations:    ${withRecs}/${found.length} titles`);
  print(`  Publications:       ${withPubData}/${found.length} titles`);
  print(`  Anime mapping:      ${withAnime}/${found.length} titles`);
  print(`  Avg categories:     ${found.length > 0 ? (found.reduce((s, r) => s + (r.mu.categories?.length ?? 0), 0) / found.length).toFixed(1) : 0} per title`);

  // Per-category breakdown
  const categories = [...new Set(results.map(r => r.category))];
  print('\n  By Category:');
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catFound = catResults.filter(r => r.mu.found).length;
    print(`    ${cat.padEnd(15)} ${catFound}/${catResults.length} found`);
  }
}

main().then(() => { print('\nDone.'); process.exit(0); }).catch((e: unknown) => { console.error('Fatal:', e); process.exit(1); });
