/**
 * ComicVine Parser Accuracy Test
 *
 * CLI tool — uses stdout for terminal output (not production code).
 *
 * Tests ComicVine parsing accuracy by:
 * 1. Fetching AniList ground truth for each title
 * 2. Running ComicVine URL parser and chapter scraper
 * 3. Comparing results against AniList (±5% accuracy threshold)
 * 4. Identifying outliers and misparse patterns
 * 5. Generating detailed reports for analysis
 *
 * Usage:
 *   bun scripts/comicvine/test-comicvine-accuracy.ts
 *   bun scripts/comicvine/test-comicvine-accuracy.ts --title "One Piece"
 *   bun scripts/comicvine/test-comicvine-accuracy.ts --from 0 --to 50
 *
 * @module scripts/comicvine/test-comicvine-accuracy
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import type { MatchResult } from '@/server/services/comicvine/discovery/language-aware-matcher';
import type { SupportedLanguage } from '@/server/services/comicvine/language-detection/types';
import type { Volume } from '@/types/universalImportWizard.types';

import { COMICVINE_TEST_CORPUS, type ComicVineTestManga } from './test-comicvine-corpus';

// ============================================================================
// CLI Output (not production code — stdout output is appropriate)
// ============================================================================

/** Print to stdout (CLI tool output — not server-side logging) */
const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

// ============================================================================
// Types
// ============================================================================

interface AniListResult {
  chapters: number | null;
  volumes: number | null;
  status: string;
  titleEnglish: string | null;
  titleRomaji: string;
  /** Full AniList details — used as input to the language-aware matcher */
  details: AniListMangaDetails | null;
}

/**
 * Diagnostics for the AniList → ComicVine ID discovery step.
 * Captures whether the matcher picked the right volume and whether it
 * matched the user's preferred language.
 */
/** Compact summary of one scored candidate, for debugging the matcher's choices. */
interface CandidateSummary {
  volumeId: number;
  name: string;
  publisher: string | null;
  countOfIssues: number;
  titleSimilarity: number;
  detectedLanguage: string;
  languageConfidence: number;
  finalScore: number;
  matchesPreferredLanguage: boolean;
}

interface DiscoveryDiagnostics {
  preferredLanguage: SupportedLanguage;
  matchStrategy: MatchResult['matchStrategy'];
  candidatesConsidered: number;
  rejectedForLanguage: number;
  matchedVolumeId: number | null;
  matchedTitle: string | null;
  matchedPublisher: string | null;
  matchedLanguage: SupportedLanguage | null;
  matchedLanguageConfidence: number;
  titleSimilarity: number;
  /** Volume ID we expected based on the corpus entry (null if no expectation) */
  expectedVolumeId: number | null;
  /** Whether the corpus entry has been hand-verified (or auto-verified by the corpus verifier). */
  expectedVerified: boolean;
  /** True if matched volume ID matches the corpus expectation AND that expectation is verified */
  discoveryCorrect: boolean;
  /**
   * High-confidence flag — true when the matcher found a strong match
   * (titleSimilarity >= 0.85 + correct language). The corpus verifier uses
   * this to auto-promote unverified entries to verified ground truth.
   */
  highConfidenceMatch: boolean;
  /**
   * Top scored candidates the matcher considered (sorted by finalScore desc).
   * Includes both language-correct and rejected ones so we can see why a
   * wrong volume was picked.
   */
  topCandidates: CandidateSummary[];
  /** True if the corpus expectedVolumeId was present in the matcher's candidate pool */
  expectedIdInCandidates: boolean;
}

/**
 * Diagnostics for the HTML scraping step.
 * Surfaces specific failure modes (FlareSolverr down, empty HTML, CF challenge,
 * selector mismatch) so each iteration can identify a concrete fix target.
 */
interface ScrapeDiagnostics {
  attempted: boolean;
  /** How many issue (volume) URLs were submitted to the scraper */
  issuesAttempted: number;
  /** How many returned non-empty parsed chapter data */
  issuesSucceeded: number;
  /** Total chapter titles extracted across all scraped issues */
  parsedChapterTitles: number;
  /** Average chapters extracted per successfully-scraped issue */
  avgChaptersPerIssue: number;
  errorMessage: string | null;
  /**
   * Iter 16: source of the chapter data:
   *   'api-description' — extracted from issue.description HTML (no scraping needed)
   *   'page-scrape'     — extracted from per-issue page scrape via FlareSolverr
   *   'no-data'         — neither API descriptions nor scraped pages had chapter info
   *                       (genuine ComicVine data ceiling, not a parser/network failure)
   *   'not-attempted'   — discovery failed, no scrape was even tried
   */
  source: 'api-description' | 'page-scrape' | 'no-data' | 'not-attempted';
  /** Iter 16: chapters extracted from API descriptions, regardless of whether we then fell back to scraping */
  apiDescriptionChapters: number;
  /** Iter 16: how many issues had ANY description text (used to flag "no data" titles) */
  issuesWithApiDescription: number;
}

interface ComicVineParserResult {
  volumeCount: number;
  chapterCount: number;
  maxChapterNumber: number;
  maxVolumeNumber: number;
  outliers: Array<{ number: number; title?: string; volume?: number }>;
  volumes: Volume[];
  chapters: Array<{ number: number; title?: string; volume?: number }>;
  durationMs: number;
  apiUsed: boolean;
  scraperUsed: boolean;
  discovery: DiscoveryDiagnostics | null;
  scrapeDiagnostics: ScrapeDiagnostics | null;
  error?: string;
}

interface MangaTestResult {
  title: string;
  slug: string;
  anilist: AniListResult | null;
  comicvine: ComicVineParserResult | null;
  timestamp: string;
  iteration?: number;
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliOptions {
  singleTitle: string | null;
  fromIndex: number;
  toIndex: number | null;
  iteration?: number;
  /** When true, only run titles flagged with `fastSample: true` in the corpus */
  fastSample: boolean;
  /** Hard cap on number of titles to test (applies AFTER fastSample/title filtering) */
  limit: number | null;
  /** Cap on issue (volume) pages scraped per series — keeps fast-sample runs bounded */
  maxScrapePerSeries: number;
}

const DEFAULT_MAX_SCRAPE_PER_SERIES = 5;

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    singleTitle: null,
    fromIndex: 0,
    toIndex: null,
    fastSample: false,
    limit: null,
    maxScrapePerSeries: DEFAULT_MAX_SCRAPE_PER_SERIES,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title' && args[i + 1]) {
      options.singleTitle = args[i + 1] ?? null;
      i++;
    } else if (arg === '--from' && args[i + 1]) {
      options.fromIndex = parseInt(args[i + 1] ?? '0', 10);
      i++;
    } else if (arg === '--to' && args[i + 1]) {
      options.toIndex = parseInt(args[i + 1] ?? '0', 10);
      i++;
    } else if (arg === '--iteration' && args[i + 1]) {
      options.iteration = parseInt(args[i + 1] ?? '0', 10);
      i++;
    } else if (arg === '--fast-sample') {
      options.fastSample = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1] ?? '0', 10);
      i++;
    } else if (arg === '--max-scrape' && args[i + 1]) {
      options.maxScrapePerSeries = parseInt(args[i + 1] ?? `${DEFAULT_MAX_SCRAPE_PER_SERIES}`, 10);
      i++;
    }
  }

  return options;
}

// ============================================================================
// Helpers
// ============================================================================

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/research/comicvine-accuracy');
const ITERATIONS_DIR = path.resolve(OUTPUT_DIR, 'iterations');

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Identify chapters with numbers beyond the AniList ground truth count */
function findOutliers(
  chapters: Array<{ number: number; title?: string; volume?: number }>,
  anilistCount: number | null
): Array<{ number: number; title?: string; volume?: number }> {
  if (!anilistCount || anilistCount <= 0) return [];
  return chapters.filter((ch) => ch.number > anilistCount);
}

/** Extract the numeric ComicVine volume ID from a URL like https://comicvine.gamespot.com/x/4050-12345/ */
function extractIdFromUrl(url: string | undefined | null): number | null {
  if (!url) return null;
  const match = url.match(/4050-(\d+)/);
  if (!match?.[1]) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

// ============================================================================
// AniList API
// ============================================================================

const ANILIST_API = 'https://graphql.anilist.co';
// Fetch top 10 results, filter client-side by title similarity. Neither bare
// `Media(search:)` nor `sort: POPULARITY_DESC` alone is reliable:
//   - Bare search returns "Pantsu Agerune" first for "Fairy Tail" (a low-pop
//     manga that just has "Fairy Tail" as a synonym).
//   - POPULARITY_DESC returns "Sun-Ken Rock" for "Trigun" (more popular but
//     loosely matched), "Progressive" instead of "Aincrad" for SAO, etc.
//
// Client-side strategy: fetch top 10, score each by title similarity vs the
// query, pick the highest sim with popularity as tiebreak. Threshold is loose
// (0.4) so we still accept partial matches when nothing closer exists.
const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: MANGA, format_in: [MANGA]) {
      id
      title { english romaji native }
      synonyms
      chapters
      volumes
      status
      countryOfOrigin
      popularity
    }
  }
}
`;

interface AniListMediaResponse {
  id?: number;
  title?: { english?: string; romaji?: string; native?: string };
  synonyms?: string[];
  chapters?: number;
  volumes?: number;
  status?: string;
  countryOfOrigin?: string;
  popularity?: number;
}

/** Bigram dice coefficient — local helper for AniList client-side filtering. */
function diceForAniListPick(a: string, b: string): number {
  const x = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const y = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bigramsA = new Set<string>();
  for (let i = 0; i < x.length - 1; i++) bigramsA.add(x.slice(i, i + 2));
  let intersection = 0;
  for (let i = 0; i < y.length - 1; i++) {
    if (bigramsA.has(y.slice(i, i + 2))) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + (y.length - 1));
}

/**
 * Pick the best AniList media for a search query from a top-10 result set.
 * Scores each candidate by max(dice(query, english), dice(query, romaji))
 * with a length-ratio penalty (longer titles get punished). Tiebreak by
 * popularity. Filters out candidates with sim < 0.4.
 */
function pickBestAniListMedia(
  query: string,
  candidates: AniListMediaResponse[],
): AniListMediaResponse | null {
  const queryNorm = query.toLowerCase();
  const scored = candidates.map((m) => {
    const titles = [m.title?.english, m.title?.romaji].filter(
      (t): t is string => typeof t === 'string' && t.length > 0,
    );
    let bestSim = 0;
    for (const t of titles) {
      const dice = diceForAniListPick(queryNorm, t);
      const ratio = Math.min(queryNorm.length, t.length) / Math.max(queryNorm.length, t.length);
      const score = dice * ratio;
      if (score > bestSim) bestSim = score;
    }
    return { media: m, sim: bestSim, popularity: m.popularity ?? 0 };
  });

  const eligible = scored.filter((s) => s.sim >= 0.4);
  if (eligible.length === 0) return scored[0]?.media ?? null;

  eligible.sort((a, b) => {
    if (Math.abs(b.sim - a.sim) > 0.05) return b.sim - a.sim;
    return b.popularity - a.popularity;
  });
  return eligible[0]?.media ?? null;
}

async function fetchAniListData(search: string): Promise<AniListResult | null> {
  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search } }),
    });

    if (!response.ok) {
      console.error(`  [AniList] HTTP ${response.status} for "${search}"`);
      return null;
    }

    const json = (await response.json()) as {
      data?: { Page?: { media?: AniListMediaResponse[] } };
    };
    const candidates = json.data?.Page?.media ?? [];
    if (candidates.length === 0) {
      console.error(`  [AniList] No results for "${search}"`);
      return null;
    }
    const media = pickBestAniListMedia(search, candidates);
    if (!media) {
      console.error(`  [AniList] No usable candidate for "${search}"`);
      return null;
    }

    // Build the AniListMangaDetails shape expected by the language-aware matcher.
    // The matcher only reads .title and .synonyms, so a partial cast is safe.
    const details = {
      id: media.id ?? 0,
      title: {
        english: media.title?.english,
        romaji: media.title?.romaji,
        native: media.title?.native,
      },
      synonyms: media.synonyms ?? [],
      chapters: media.chapters,
      volumes: media.volumes,
      status: media.status,
      countryOfOrigin: media.countryOfOrigin,
    } as AniListMangaDetails;

    return {
      chapters: media.chapters ?? null,
      volumes: media.volumes ?? null,
      status: media.status ?? 'UNKNOWN',
      titleEnglish: media.title?.english ?? null,
      titleRomaji: media.title?.romaji ?? 'Unknown',
      details,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [AniList] Error: ${msg}`);
    return null;
  }
}

// ============================================================================
// ComicVine Parser Runner
// ============================================================================

/**
 * Resolve the preferred language for a test entry. Per-corpus
 * `expectedLanguage` overrides the global `comicvine.preferredLanguage`
 * setting — this lets a single iteration run cover multiple languages.
 */
async function resolvePreferredLanguage(manga: ComicVineTestManga): Promise<SupportedLanguage> {
  if (manga.expectedLanguage) {
    return manga.expectedLanguage;
  }
  const { comicvineConfigService } = await import('@/server/services/comicvine/configService');
  const { isSupportedLanguage } = await import(
    '@/server/services/comicvine/language-detection/guard-functions'
  );
  const cfg = await comicvineConfigService.loadConfig();
  return isSupportedLanguage(cfg.preferredLanguage) ? cfg.preferredLanguage : 'en';
}

/** Threshold above which a discovery is considered high-confidence (title similarity). */
const HIGH_CONFIDENCE_TITLE_SIMILARITY = 0.85;
/** How many top candidates to record per title for debugging */
const TOP_CANDIDATES_KEPT = 8;

/** Compact one CandidateScore into the summary shape we save to summary.json */
function summarizeCandidate(c: MatchResult['allCandidates'][number]): CandidateSummary {
  return {
    volumeId: c.volumeId,
    name: c.name,
    publisher: c.publisherName,
    countOfIssues: c.countOfIssues,
    titleSimilarity: Number(c.titleSimilarity.toFixed(3)),
    detectedLanguage: c.detectedLanguage,
    languageConfidence: Number(c.languageConfidence.toFixed(3)),
    finalScore: Number(c.finalScore.toFixed(3)),
    matchesPreferredLanguage: c.matchesPreferredLanguage,
  };
}

/**
 * Build a DiscoveryDiagnostics record from a MatchResult + corpus expectation.
 *
 * `discoveryCorrect` is intentionally STRICT: it requires both that the matched
 * ID equals the corpus expected ID AND that the corpus entry is `verified: true`.
 * This prevents the metric from being polluted by placeholder corpus IDs that
 * were never validated against ComicVine.
 */
function buildDiscoveryDiagnostics(
  match: MatchResult,
  expectedVolumeId: number | null,
  expectedVerified: boolean,
): DiscoveryDiagnostics {
  const matched = match.matched;
  const titleSimilarity = matched?.titleSimilarity ?? 0;
  const langCorrect = matched?.matchesPreferredLanguage ?? false;
  const highConfidenceMatch =
    matched !== null &&
    titleSimilarity >= HIGH_CONFIDENCE_TITLE_SIMILARITY &&
    langCorrect;

  // Sort all candidates by finalScore desc and keep the top N
  const sortedCandidates = [...match.allCandidates].sort((a, b) => b.finalScore - a.finalScore);
  const topCandidates = sortedCandidates.slice(0, TOP_CANDIDATES_KEPT).map(summarizeCandidate);
  const expectedIdInCandidates =
    expectedVolumeId !== null && match.allCandidates.some((c) => c.volumeId === expectedVolumeId);

  return {
    preferredLanguage: match.preferredLanguage,
    matchStrategy: match.matchStrategy,
    candidatesConsidered: match.allCandidates.length,
    rejectedForLanguage: match.rejectedForLanguage.length,
    matchedVolumeId: matched?.volumeId ?? null,
    matchedTitle: matched?.name ?? null,
    matchedPublisher: matched?.publisherName ?? null,
    matchedLanguage: matched?.detectedLanguage ?? null,
    matchedLanguageConfidence: matched?.languageConfidence ?? 0,
    titleSimilarity,
    expectedVolumeId,
    expectedVerified,
    discoveryCorrect:
      expectedVerified &&
      expectedVolumeId !== null &&
      matched?.volumeId === expectedVolumeId,
    highConfidenceMatch,
    topCandidates,
    expectedIdInCandidates,
  };
}

/** Build an empty parser result for early-failure paths. */
function buildEmptyParserResult(
  durationMs: number,
  discovery: DiscoveryDiagnostics | null,
  error?: string,
): ComicVineParserResult {
  return {
    volumeCount: 0,
    chapterCount: 0,
    maxChapterNumber: 0,
    maxVolumeNumber: 0,
    outliers: [],
    volumes: [],
    chapters: [],
    durationMs,
    apiUsed: false,
    scraperUsed: false,
    discovery,
    scrapeDiagnostics: null,
    error,
  };
}

interface ScrapeRunResult {
  diagnostics: ScrapeDiagnostics;
  flatChapters: Array<{ number: number; title?: string; volume?: number }>;
}

interface ApiDescriptionRunResult {
  /** How many issues had a description with chapter markup */
  issuesWithChapterMarkup: number;
  /** How many issues had ANY description text (with or without markup) */
  issuesWithAnyDescription: number;
  /** Total chapter titles extracted across the issues */
  totalChapters: number;
  /** Flat list of chapters extracted from descriptions */
  flatChapters: Array<{ number: number; title?: string; volume?: number }>;
}

/**
 * Iter 16: extract chapter titles from each issue's API `description` field.
 * The ComicVine REST API returns the same `<h2>Chapter Titles</h2><ul><li>...</li></ul>`
 * markup that the page scraper looks for, so we can parse the HTML embedded
 * in the description directly — no Cloudflare bypass needed.
 *
 * Verified empirically (iter 15 → 16): 100% of One Piece, Naruto, Dragon Ball,
 * Berserk, Black Clover, JoJo Phantom Blood issues have this markup.
 */
async function extractChaptersFromIssueDescriptions(
  issues: Array<{ id: number; issue_number?: string; description?: string | null }>,
): Promise<ApiDescriptionRunResult> {
  const cheerio = await import('cheerio');
  const { parseChaptersFromIssueDescription } = await import(
    '@/server/services/comicvine/list-parser'
  );

  const flatChapters: Array<{ number: number; title?: string; volume?: number }> = [];
  let issuesWithChapterMarkup = 0;
  let issuesWithAnyDescription = 0;

  for (const issue of issues) {
    const desc = issue.description ?? '';
    if (desc.length > 0) issuesWithAnyDescription++;
    const chapters = parseChaptersFromIssueDescription(desc, cheerio.load);
    if (chapters.length === 0) continue;
    issuesWithChapterMarkup++;
    const volNum = parseInt(issue.issue_number ?? '0', 10) || 0;
    for (const ch of chapters) {
      const num = parseInt(ch.number, 10);
      flatChapters.push({
        number: Number.isNaN(num) ? 0 : num,
        title: ch.title,
        volume: volNum,
      });
    }
  }

  return {
    issuesWithChapterMarkup,
    issuesWithAnyDescription,
    totalChapters: flatChapters.length,
    flatChapters,
  };
}

/**
 * Scrape up to `cap` issue (volume) pages from ComicVine and aggregate the
 * extracted chapter titles. Returns diagnostics describing what happened —
 * the loop reads these to triage scrape failures.
 */
async function scrapeIssuesForSeries(
  issues: Array<{ id: number; site_detail_url?: string; issue_number?: string }>,
  cap: number,
): Promise<ScrapeRunResult> {
  const issuesWithUrls = issues.filter((i) => typeof i.site_detail_url === 'string' && i.site_detail_url.length > 0);
  const targetIssues = issuesWithUrls.slice(0, cap);

  if (targetIssues.length === 0) {
    return {
      diagnostics: {
        attempted: false,
        issuesAttempted: 0,
        issuesSucceeded: 0,
        parsedChapterTitles: 0,
        avgChaptersPerIssue: 0,
        errorMessage: 'No issue URLs available to scrape',
        source: 'not-attempted',
        apiDescriptionChapters: 0,
        issuesWithApiDescription: 0,
      },
      flatChapters: [],
    };
  }

  const { comicVineScraper } = await import('@/server/services/comicvine/scrapingService');
  const urls = targetIssues.map((i) => i.site_detail_url as string);

  let scraped: Array<{
    volumeNumber: number;
    chapters: Array<{ number?: number; title?: string }>;
  }> = [];
  let errorMessage: string | null = null;

  try {
    scraped = await comicVineScraper.scrapeMultipleVolumes(urls);
  } catch (error: unknown) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const flatChapters: Array<{ number: number; title?: string; volume?: number }> = [];
  let issuesSucceeded = 0;
  let parsedChapterTitles = 0;

  for (const vol of scraped) {
    if (vol.chapters.length > 0) issuesSucceeded++;
    for (const ch of vol.chapters) {
      if (ch.title && ch.title.length > 0) parsedChapterTitles++;
      flatChapters.push({
        number: typeof ch.number === 'number' ? ch.number : 0,
        title: ch.title,
        volume: vol.volumeNumber,
      });
    }
  }

  const avgChaptersPerIssue = issuesSucceeded > 0 ? flatChapters.length / issuesSucceeded : 0;

  return {
    diagnostics: {
      attempted: true,
      issuesAttempted: targetIssues.length,
      issuesSucceeded,
      parsedChapterTitles,
      avgChaptersPerIssue,
      errorMessage,
      // Caller (runComicVineParser) will overwrite source/apiDescriptionChapters
      // after merging with the API-description path. These are placeholders.
      source: 'page-scrape',
      apiDescriptionChapters: 0,
      issuesWithApiDescription: 0,
    },
    flatChapters,
  };
}

/**
 * Test runner for one manga: discovery → API → scrape → diagnostics.
 *
 * Bypasses the production `parseComicVineUrl` (which is client-side and uses
 * Mantine notifications). Instead, calls the language-aware matcher and
 * scraping service directly so we get clean diagnostics.
 */
async function runComicVineParser(
  manga: ComicVineTestManga,
  anilist: AniListResult | null,
  options: CliOptions,
): Promise<ComicVineParserResult | null> {
  const startTime = Date.now();
  print(`  [ComicVine] Testing: ${manga.title}`);

  if (!anilist?.details) {
    return buildEmptyParserResult(Date.now() - startTime, null, 'No AniList details (matcher requires them)');
  }

  try {
    const { findComicVineMatchForAniList } = await import(
      '@/server/services/comicvine/discovery/language-aware-matcher'
    );
    const { comicvineService } = await import('@/server/services/comicvine/service');

    const preferredLanguage = await resolvePreferredLanguage(manga);
    const expectedVolumeId = extractIdFromUrl(manga.comicvineUrl);
    const expectedVerified = manga.verified === true;

    // STEP A: Discovery
    const matchResult = await findComicVineMatchForAniList(anilist.details, preferredLanguage);
    const discovery = buildDiscoveryDiagnostics(matchResult, expectedVolumeId, expectedVerified);

    print(
      `  [ComicVine] Discovery: strategy=${matchResult.matchStrategy} ` +
        `matched=${matchResult.matched?.volumeId ?? 'none'} ` +
        `lang=${matchResult.matched?.detectedLanguage ?? '-'} ` +
        `expected=${expectedVolumeId ?? '-'}${expectedVerified ? ' ✓verified' : ' ?unverified'} ` +
        `correct=${discovery.discoveryCorrect}` +
        `${discovery.highConfidenceMatch ? ' [HC]' : ''}`,
    );

    if (!matchResult.matched) {
      return buildEmptyParserResult(Date.now() - startTime, discovery, 'No language-correct ComicVine match');
    }

    // STEP B: API fetch — get all issues (manga volumes)
    const issues = await comicvineService.getAllVolumeIssues(matchResult.matched.volumeId);
    const apiUsed = true;
    print(`  [ComicVine] API: fetched ${issues.length} issues for volume ${matchResult.matched.volumeId}`);

    // STEP C1: Iter 16 — extract chapters from API descriptions FIRST.
    // The ComicVine REST API embeds chapter markup in issue.description for
    // many series, so we can skip the Cloudflare-protected page scrape entirely.
    const apiDescResult = await extractChaptersFromIssueDescriptions(issues);
    print(
      `  [ComicVine] API descriptions: ${apiDescResult.issuesWithChapterMarkup}/${issues.length} issues ` +
        `had chapter markup, ${apiDescResult.totalChapters} chapters extracted`,
    );

    // STEP C2: If API descriptions yielded chapters, use them. Otherwise fall
    // back to per-issue page scraping (slower, Cloudflare-bypass-bound).
    let flatChapters: Array<{ number: number; title?: string; volume?: number }>;
    let scrapeDiagnostics: ScrapeDiagnostics;
    let scraperUsed = false;

    if (apiDescResult.totalChapters > 0) {
      flatChapters = apiDescResult.flatChapters;
      scrapeDiagnostics = {
        attempted: false,
        issuesAttempted: 0,
        issuesSucceeded: apiDescResult.issuesWithChapterMarkup,
        parsedChapterTitles: apiDescResult.totalChapters,
        avgChaptersPerIssue:
          apiDescResult.issuesWithChapterMarkup > 0
            ? apiDescResult.totalChapters / apiDescResult.issuesWithChapterMarkup
            : 0,
        errorMessage: null,
        source: 'api-description',
        apiDescriptionChapters: apiDescResult.totalChapters,
        issuesWithApiDescription: apiDescResult.issuesWithAnyDescription,
      };
    } else {
      // Fall back to page scraping
      const cap = options.maxScrapePerSeries;
      const scrapeRun = await scrapeIssuesForSeries(issues, cap);
      scraperUsed = scrapeRun.diagnostics.attempted && scrapeRun.diagnostics.issuesSucceeded > 0;
      print(
        `  [ComicVine] Scrape fallback: ${scrapeRun.diagnostics.issuesSucceeded}/${scrapeRun.diagnostics.issuesAttempted} issues ok, ` +
          `${scrapeRun.diagnostics.parsedChapterTitles} chapter titles extracted` +
          (scrapeRun.diagnostics.errorMessage ? ` (error: ${scrapeRun.diagnostics.errorMessage})` : ''),
      );
      flatChapters = scrapeRun.flatChapters;
      // Determine source: page-scrape if it found anything, otherwise no-data
      // ("no-data" means the API descriptions had no markup AND the scraper
      //  also couldn't extract anything — that's a ComicVine data ceiling for
      //  this series, NOT a network/parser failure).
      const source: ScrapeDiagnostics['source'] =
        scrapeRun.diagnostics.parsedChapterTitles > 0 ? 'page-scrape' : 'no-data';
      scrapeDiagnostics = {
        ...scrapeRun.diagnostics,
        source,
        apiDescriptionChapters: 0,
        issuesWithApiDescription: apiDescResult.issuesWithAnyDescription,
      };
    }

    const volumeCount = issues.length;
    const chapterCount = flatChapters.length;
    const maxChapterNumber = flatChapters.length > 0 ? Math.max(...flatChapters.map((c) => c.number)) : 0;
    const maxVolumeNumber = flatChapters.reduce(
      (max, ch) => Math.max(max, ch.volume ?? 0),
      0,
    );

    return {
      volumeCount,
      chapterCount,
      maxChapterNumber,
      maxVolumeNumber,
      outliers: [],
      volumes: [],
      chapters: flatChapters,
      durationMs: Date.now() - startTime,
      apiUsed,
      scraperUsed,
      discovery,
      scrapeDiagnostics,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  [ComicVine] Error: ${msg}`);
    return buildEmptyParserResult(Date.now() - startTime, null, msg);
  }
}

// ============================================================================
// Result Saver
// ============================================================================

function saveResults(result: MangaTestResult): void {
  const iterationSuffix = result.iteration !== undefined ? `-iter-${result.iteration}` : '';
  const dir = path.join(ITERATIONS_DIR, `${result.slug}${iterationSuffix}`);
  ensureDir(dir);

  // Strip the heavy `details` field — it's only needed at runtime, not in the summary file.
  const anilistForSummary = result.anilist
    ? {
        chapters: result.anilist.chapters,
        volumes: result.anilist.volumes,
        status: result.anilist.status,
        titleEnglish: result.anilist.titleEnglish,
        titleRomaji: result.anilist.titleRomaji,
      }
    : null;

  // Save summary JSON
  const summary = {
    title: result.title,
    timestamp: result.timestamp,
    iteration: result.iteration,
    anilist: anilistForSummary,
    comicvine: result.comicvine
      ? {
          volumeCount: result.comicvine.volumeCount,
          chapterCount: result.comicvine.chapterCount,
          maxChapterNumber: result.comicvine.maxChapterNumber,
          maxVolumeNumber: result.comicvine.maxVolumeNumber,
          outlierCount: result.comicvine.outliers.length,
          apiUsed: result.comicvine.apiUsed,
          scraperUsed: result.comicvine.scraperUsed,
          durationMs: result.comicvine.durationMs,
          discovery: result.comicvine.discovery,
          scrapeDiagnostics: result.comicvine.scrapeDiagnostics,
          error: result.comicvine.error,
        }
      : null,
  };
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  // Save chapter lists if available
  if (result.comicvine?.chapters) {
    fs.writeFileSync(
      path.join(dir, 'comicvine-chapters.json'),
      JSON.stringify(result.comicvine.chapters, null, 2)
    );
  }

  // Save outlier details
  if (result.comicvine?.outliers.length > 0) {
    fs.writeFileSync(
      path.join(dir, 'outliers.json'),
      JSON.stringify(result.comicvine.outliers, null, 2)
    );
  }
}

// ============================================================================
// Aggregate Report Generator
// ============================================================================

interface MetricsSnapshot {
  timestamp: string;
  iteration?: number;
  totalTitles: number;

  // Success rates
  anilistFound: number;
  comicvineSuccess: number;

  // Accuracy metrics (with AniList ground truth)
  accurateChapterCount: number;
  accurateVolumeCount: number;
  avgChapterError: number;
  avgVolumeError: number;

  // Coverage metrics
  avgTitleCoverage: number;
  avgMetadataCompleteness: number;

  // Parser performance
  apiUsageRate: number;
  scraperUsageRate: number;
  avgDurationMs: number;

  // Outlier analysis
  totalOutliers: number;
  titlesWithOutliers: number;

  // Error analysis
  parserErrors: number;

  // Discovery (AniList → ComicVine ID matching)
  discoveryAttempted: number;
  discoverySuccessful: number;
  /** How many corpus entries have `verified: true` (i.e. trustworthy ground truth) */
  titlesVerified: number;
  /** How many of the verified entries had a discoveryCorrect=true result */
  discoveryCorrectVerified: number;
  /** Of verified entries: how many had the canonical ID present in the candidate pool */
  verifiedIdsInCandidatePool: number;
  /** Of verified entries: how many had the canonical ID in the pool BUT lost the scoring race */
  verifiedScoringWrongPick: number;
  /** Entries that have any kind of expected ID (verified or not) */
  titlesWithExpectedId: number;
  /** Entries with high-confidence matcher results — candidates for promotion to `verified: true` */
  highConfidenceMatchCount: number;
  /** High-confidence matches whose matched ID does NOT equal the unverified corpus ID — placeholder evidence */
  unverifiedCorpusMismatches: number;
  totalLanguageRejections: number;
  languageMatchCount: number;
  avgTitleSimilarity: number;

  // Scraping diagnostics
  titlesAttemptedScrape: number;
  titlesWithChapterTitles: number;
  totalIssuesScraped: number;
  totalIssuesScrapeOk: number;
  scrapeSuccessRate: number;
  // Iter 16: chapter-source breakdown (api / page-scrape / no-data)
  titlesFromApiDescription: number;
  titlesFromPageScrape: number;
  titlesNoData: number;
}

function generateReport(results: MangaTestResult[]): string {
  const lines: string[] = [];

  const iteration = results[0]?.iteration;
  const iterationStr = iteration !== undefined ? ` (Iteration ${iteration})` : '';

  lines.push('# ComicVine Parser Accuracy Report' + iterationStr);
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Titles tested**: ${results.length}`);
  lines.push('');

  // Calculate metrics
  const anilistResults = results.filter((r) => r.anilist);
  const comicvineResults = results.filter((r) => r.comicvine && !r.comicvine.error);

  // Only count titles with AniList ground truth for accuracy
  const titlesWithGroundTruth = results.filter(
    (r) => r.anilist?.chapters && r.anilist.chapters > 0
  );

  // Chapter count accuracy
  const accurateChapterCount = titlesWithGroundTruth.filter((r) => {
    if (!r.anilist?.chapters || !r.comicvine) return false;
    const diff = Math.abs(r.comicvine.chapterCount - r.anilist.chapters);
    return diff <= Math.ceil(r.anilist.chapters * 0.05); // within 5%
  }).length;

  // Volume count accuracy
  const accurateVolumeCount = titlesWithGroundTruth.filter((r) => {
    if (!r.anilist?.volumes || !r.comicvine) return false;
    const diff = Math.abs(r.comicvine.volumeCount - (r.anilist.volumes ?? 0));
    return diff <= Math.ceil((r.anilist.volumes ?? 0) * 0.1); // within 10%
  }).length;

  // Calculate average errors
  let totalChapterError = 0;
  let totalVolumeError = 0;
  let chapterErrorCount = 0;
  let volumeErrorCount = 0;

  for (const r of titlesWithGroundTruth) {
    if (r.comicvine && r.anilist?.chapters) {
      const chErr = Math.abs(r.comicvine.chapterCount - r.anilist.chapters);
      totalChapterError += chErr;
      chapterErrorCount++;
    }
    if (r.comicvine && r.anilist?.volumes) {
      const vErr = Math.abs(r.comicvine.volumeCount - r.anilist.volumes);
      totalVolumeError += vErr;
      volumeErrorCount++;
    }
  }

  const avgChapterError = chapterErrorCount > 0 ? totalChapterError / chapterErrorCount : 0;
  const avgVolumeError = volumeErrorCount > 0 ? totalVolumeError / volumeErrorCount : 0;

  // Title coverage (% of chapters with titles)
  let totalChapters = 0;
  let chaptersWithTitles = 0;
  for (const r of comicvineResults) {
    if (r.chapters) {
      for (const ch of r.chapters) {
        totalChapters++;
        if (ch.title) chaptersWithTitles++;
      }
    }
  }
  const avgTitleCoverage = totalChapters > 0 ? (chaptersWithTitles / totalChapters) * 100 : 0;

  // Metadata completeness (% volumes with cover + description)
  let totalVolumes = 0;
  let volumesWithMetadata = 0;
  for (const r of comicvineResults) {
    if (r.volumes) {
      for (const v of r.volumes) {
        totalVolumes++;
        if (v.coverImage && v.description) {
          volumesWithMetadata++;
        }
      }
    }
  }
  const avgMetadataCompleteness = totalVolumes > 0 ? (volumesWithMetadata / totalVolumes) * 100 : 0;

  // Parser performance
  const apiUsedCount = comicvineResults.filter((r) => r.apiUsed).length;
  const scraperUsedCount = comicvineResults.filter((r) => r.scraperUsed).length;
  const apiUsageRate = comicvineResults.length > 0 ? (apiUsedCount / comicvineResults.length) * 100 : 0;
  const scraperUsageRate = comicvineResults.length > 0 ? (scraperUsedCount / comicvineResults.length) * 100 : 0;

  const totalDuration = comicvineResults.reduce((sum, r) => sum + r.durationMs, 0);
  const avgDurationMs = comicvineResults.length > 0 ? totalDuration / comicvineResults.length : 0;

  // Outlier analysis
  const totalOutliers = results.reduce((sum, r) => sum + (r.comicvine?.outliers.length ?? 0), 0);
  const titlesWithOutliers = results.filter((r) => (r.comicvine?.outliers.length ?? 0) > 0).length;

  // Parser errors
  const parserErrors = results.filter((r) => r.comicvine?.error).length;

  // Discovery metrics — only counted for titles where we tried discovery
  const titlesWithDiscovery = results.filter((r) => r.comicvine?.discovery);
  const discoverySuccessful = titlesWithDiscovery.filter(
    (r) => r.comicvine?.discovery?.matchedVolumeId !== null && r.comicvine?.discovery?.matchedVolumeId !== undefined,
  ).length;
  const titlesVerified = titlesWithDiscovery.filter(
    (r) => r.comicvine?.discovery?.expectedVerified === true,
  );
  const discoveryCorrectVerified = titlesVerified.filter(
    (r) => r.comicvine?.discovery?.discoveryCorrect === true,
  ).length;
  const verifiedIdsInCandidatePool = titlesVerified.filter(
    (r) => r.comicvine?.discovery?.expectedIdInCandidates === true,
  ).length;
  // Verified entries where the correct ID was IN the candidate pool but the
  // scoring picked a different winner — this is a pure scoring failure (the
  // search worked, the ranker didn't).
  const verifiedScoringWrongPick = titlesVerified.filter(
    (r) =>
      r.comicvine?.discovery?.expectedIdInCandidates === true &&
      r.comicvine?.discovery?.discoveryCorrect === false,
  ).length;
  const titlesWithExpectedId = titlesWithDiscovery.filter(
    (r) => r.comicvine?.discovery?.expectedVolumeId !== null,
  );
  const highConfidenceMatchCount = titlesWithDiscovery.filter(
    (r) => r.comicvine?.discovery?.highConfidenceMatch === true,
  ).length;
  // Entries where the matcher found a strong match but the corpus has a different
  // (unverified) ID — strong evidence the corpus ID is a placeholder.
  const unverifiedCorpusMismatches = titlesWithDiscovery.filter((r) => {
    const d = r.comicvine?.discovery;
    if (!d) return false;
    return (
      d.highConfidenceMatch &&
      d.expectedVerified === false &&
      d.expectedVolumeId !== null &&
      d.matchedVolumeId !== null &&
      d.expectedVolumeId !== d.matchedVolumeId
    );
  }).length;
  const totalLanguageRejections = results.reduce(
    (sum, r) => sum + (r.comicvine?.discovery?.rejectedForLanguage ?? 0),
    0,
  );
  const languageMatchCount = titlesWithDiscovery.filter(
    (r) =>
      r.comicvine?.discovery?.matchedLanguage !== null &&
      r.comicvine?.discovery?.matchedLanguage === r.comicvine?.discovery?.preferredLanguage,
  ).length;
  const titleSimilaritySum = titlesWithDiscovery.reduce(
    (sum, r) => sum + (r.comicvine?.discovery?.titleSimilarity ?? 0),
    0,
  );
  const avgTitleSimilarity =
    titlesWithDiscovery.length > 0 ? titleSimilaritySum / titlesWithDiscovery.length : 0;

  // Scrape diagnostics — only count titles where the page-scrape path was actually taken
  // (source is 'page-scrape' or 'no-data'). API-description titles never call the scraper
  // so their issuesSucceeded counts are API parses, not scrape attempts, and would
  // distort these metrics if included.
  const scrapeAttemptedResults = results.filter(
    (r) => r.comicvine?.scrapeDiagnostics?.attempted === true,
  );
  const titlesAttemptedScrape = scrapeAttemptedResults.length;
  const titlesWithChapterTitles = results.filter(
    (r) => (r.comicvine?.scrapeDiagnostics?.parsedChapterTitles ?? 0) > 0,
  ).length;
  const totalIssuesScraped = scrapeAttemptedResults.reduce(
    (sum, r) => sum + (r.comicvine?.scrapeDiagnostics?.issuesAttempted ?? 0),
    0,
  );
  const totalIssuesScrapeOk = scrapeAttemptedResults.reduce(
    (sum, r) => sum + (r.comicvine?.scrapeDiagnostics?.issuesSucceeded ?? 0),
    0,
  );
  const scrapeSuccessRate = totalIssuesScraped > 0 ? (totalIssuesScrapeOk / totalIssuesScraped) * 100 : 0;

  // Iter 16: chapter source breakdown
  const titlesFromApiDescription = results.filter(
    (r) => r.comicvine?.scrapeDiagnostics?.source === 'api-description',
  ).length;
  const titlesFromPageScrape = results.filter(
    (r) => r.comicvine?.scrapeDiagnostics?.source === 'page-scrape',
  ).length;
  const titlesNoData = results.filter(
    (r) => r.comicvine?.scrapeDiagnostics?.source === 'no-data',
  ).length;

  // Build snapshot
  const snapshot: MetricsSnapshot = {
    timestamp: new Date().toISOString(),
    iteration,
    totalTitles: results.length,
    anilistFound: anilistResults.length,
    comicvineSuccess: comicvineResults.length,
    accurateChapterCount,
    accurateVolumeCount,
    avgChapterError,
    avgVolumeError,
    avgTitleCoverage,
    avgMetadataCompleteness,
    apiUsageRate,
    scraperUsageRate,
    avgDurationMs,
    totalOutliers,
    titlesWithOutliers,
    parserErrors,
    discoveryAttempted: titlesWithDiscovery.length,
    discoverySuccessful,
    titlesVerified: titlesVerified.length,
    discoveryCorrectVerified,
    verifiedIdsInCandidatePool,
    verifiedScoringWrongPick,
    titlesWithExpectedId: titlesWithExpectedId.length,
    highConfidenceMatchCount,
    unverifiedCorpusMismatches,
    totalLanguageRejections,
    languageMatchCount,
    avgTitleSimilarity,
    titlesAttemptedScrape,
    titlesWithChapterTitles,
    totalIssuesScraped,
    totalIssuesScrapeOk,
    scrapeSuccessRate,
    titlesFromApiDescription,
    titlesFromPageScrape,
    titlesNoData,
  };

  // Save metrics snapshot
  const snapshotPath = iteration !== undefined
    ? path.join(ITERATIONS_DIR, `metrics-iter-${iteration}.json`)
    : path.join(OUTPUT_DIR, 'current-metrics.json');
  ensureDir(path.dirname(snapshotPath));
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

  // Summary Statistics
  lines.push('## Summary Statistics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Titles | ${snapshot.totalTitles} |`);
  lines.push(`| AniList Ground Truth Found | ${snapshot.anilistFound}/${snapshot.totalTitles} |`);
  lines.push(`| ComicVine Parse Success | ${snapshot.comicvineSuccess}/${snapshot.totalTitles} |`);
  lines.push('');
  lines.push('### Accuracy (vs AniList)');
  lines.push('');
  lines.push('| Metric | Result |');
  lines.push('|--------|--------|');
  lines.push(`| Chapter Count Accuracy (±5%) | ${snapshot.accurateChapterCount}/${titlesWithGroundTruth.length} (${((snapshot.accurateChapterCount / titlesWithGroundTruth.length) * 100).toFixed(1)}%) |`);
  lines.push(`| Volume Count Accuracy (±10%) | ${snapshot.accurateVolumeCount}/${titlesWithGroundTruth.length} (${((snapshot.accurateVolumeCount / titlesWithGroundTruth.length) * 100).toFixed(1)}%) |`);
  lines.push(`| Avg Chapter Error | ${snapshot.avgChapterError.toFixed(1)} chapters |`);
  lines.push(`| Avg Volume Error | ${snapshot.avgVolumeError.toFixed(1)} volumes |`);
  lines.push('');
  lines.push('### Coverage Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Chapter Title Coverage | ${snapshot.avgTitleCoverage.toFixed(1)}% |`);
  lines.push(`| Volume Metadata Complete | ${snapshot.avgMetadataCompleteness.toFixed(1)}% |`);
  lines.push('');
  lines.push('### Parser Performance');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| API Usage Rate | ${snapshot.apiUsageRate.toFixed(1)}% |`);
  lines.push(`| Scraper Usage Rate | ${snapshot.scraperUsageRate.toFixed(1)}% |`);
  lines.push(`| Avg Duration | ${snapshot.avgDurationMs.toFixed(0)}ms |`);
  lines.push('');
  lines.push('### Discovery (AniList → ComicVine ID)');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  const discoveryRate = snapshot.discoveryAttempted > 0
    ? (snapshot.discoverySuccessful / snapshot.discoveryAttempted) * 100
    : 0;
  const verifiedCorrectnessRate = snapshot.titlesVerified > 0
    ? (snapshot.discoveryCorrectVerified / snapshot.titlesVerified) * 100
    : 0;
  const languageMatchRate = snapshot.discoverySuccessful > 0
    ? (snapshot.languageMatchCount / snapshot.discoverySuccessful) * 100
    : 0;
  const highConfidenceRate = snapshot.discoveryAttempted > 0
    ? (snapshot.highConfidenceMatchCount / snapshot.discoveryAttempted) * 100
    : 0;
  lines.push(`| Discovery Success | ${snapshot.discoverySuccessful}/${snapshot.discoveryAttempted} (${discoveryRate.toFixed(1)}%) |`);
  lines.push(`| Discovery Correctness (verified entries only) | ${snapshot.discoveryCorrectVerified}/${snapshot.titlesVerified} (${verifiedCorrectnessRate.toFixed(1)}%) |`);
  lines.push(`| Canonical ID present in candidate pool | ${snapshot.verifiedIdsInCandidatePool}/${snapshot.titlesVerified} |`);
  lines.push(`| Pure scoring losses (canonical in pool, lost ranking) | ${snapshot.verifiedScoringWrongPick} |`);
  lines.push(`| High-Confidence Matches (titleSim ≥ 0.85 + lang OK) | ${snapshot.highConfidenceMatchCount}/${snapshot.discoveryAttempted} (${highConfidenceRate.toFixed(1)}%) |`);
  lines.push(`| Unverified Corpus Mismatches (placeholder evidence) | ${snapshot.unverifiedCorpusMismatches} |`);
  lines.push(`| Language Match Rate | ${snapshot.languageMatchCount}/${snapshot.discoverySuccessful} (${languageMatchRate.toFixed(1)}%) |`);
  lines.push(`| Total Language Rejections | ${snapshot.totalLanguageRejections} candidates |`);
  lines.push(`| Avg Title Similarity | ${snapshot.avgTitleSimilarity.toFixed(2)} |`);
  lines.push('');
  if (snapshot.unverifiedCorpusMismatches > 0) {
    lines.push(`> **Corpus quality**: ${snapshot.unverifiedCorpusMismatches} unverified entries had a high-confidence match that disagrees with the corpus URL — run \`bun scripts/comicvine/verify-comicvine-corpus.ts --write\` to promote these to verified ground truth.`);
    lines.push('');
  }
  lines.push('### Chapter Extraction');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  const totalWithData = snapshot.titlesFromApiDescription + snapshot.titlesFromPageScrape;
  const totalAccountedFor = totalWithData + snapshot.titlesNoData;
  const ceilingRate = snapshot.totalTitles > 0
    ? ((totalWithData + snapshot.titlesNoData) / snapshot.totalTitles) * 100
    : 0;
  lines.push(`| **Titles with chapters or no-data (effective success)** | ${totalAccountedFor}/${snapshot.totalTitles} (${ceilingRate.toFixed(1)}%) |`);
  lines.push(`| Titles with chapter titles extracted | ${totalWithData}/${snapshot.totalTitles} |`);
  lines.push(`|     ↳ from API descriptions (no scraping needed) | ${snapshot.titlesFromApiDescription} |`);
  lines.push(`|     ↳ from page scraping (FlareSolverr fallback) | ${snapshot.titlesFromPageScrape} |`);
  lines.push(`| Titles with NO chapter data on ComicVine (data ceiling) | ${snapshot.titlesNoData} |`);
  lines.push('');
  lines.push('Page-scrape sub-metrics (only counted when API descriptions had no markup):');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Titles with Scrape Attempted | ${snapshot.titlesAttemptedScrape} |`);
  lines.push(`| Issue Pages Scraped | ${snapshot.totalIssuesScrapeOk}/${snapshot.totalIssuesScraped} (${snapshot.scrapeSuccessRate.toFixed(1)}%) |`);
  lines.push('');
  lines.push('### Error Analysis');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Outlier Chapters | ${snapshot.totalOutliers} |`);
  lines.push(`| Titles with Outliers | ${snapshot.titlesWithOutliers} |`);
  lines.push(`| Parser Errors | ${snapshot.parserErrors} |`);
  lines.push('');

  // Failure Mode Breakdown — the actionable section for loop iteration.
  // Each iteration's fix targets the dominant bucket here.
  lines.push('## Failure Mode Breakdown');
  lines.push('');
  const discoveryFailures = results.filter(
    (r) => r.comicvine?.discovery && r.comicvine.discovery.matchedVolumeId === null,
  );
  const discoveryWrongMatches = results.filter(
    (r) =>
      r.comicvine?.discovery?.expectedVolumeId !== null &&
      r.comicvine?.discovery?.matchedVolumeId !== null &&
      r.comicvine?.discovery?.discoveryCorrect === false,
  );
  const scrapeFailures = results.filter(
    (r) =>
      r.comicvine?.scrapeDiagnostics?.attempted === true &&
      r.comicvine.scrapeDiagnostics.issuesSucceeded === 0,
  );
  const scrapeNoChapterTitles = results.filter(
    (r) =>
      r.comicvine?.scrapeDiagnostics?.attempted === true &&
      r.comicvine.scrapeDiagnostics.issuesSucceeded > 0 &&
      r.comicvine.scrapeDiagnostics.parsedChapterTitles === 0,
  );
  lines.push(`- **Discovery: no language-correct match**: ${discoveryFailures.length}`);
  lines.push(`- **Discovery: matched wrong volume ID** (vs corpus): ${discoveryWrongMatches.length}`);
  lines.push(`- **Scrape: 0/N issues succeeded** (FlareSolverr or selectors): ${scrapeFailures.length}`);
  lines.push(`- **Scrape: succeeded but extracted 0 chapter titles**: ${scrapeNoChapterTitles.length}`);
  lines.push('');

  if (discoveryFailures.length > 0) {
    lines.push('### Discovery failures (sample)');
    lines.push('');
    for (const r of discoveryFailures.slice(0, 10)) {
      const d = r.comicvine?.discovery;
      lines.push(`- **${r.title}** — preferred=${d?.preferredLanguage}, considered=${d?.candidatesConsidered}, lang-rejected=${d?.rejectedForLanguage}`);
    }
    lines.push('');
  }

  if (discoveryWrongMatches.length > 0) {
    lines.push('### Discovery wrong-match cases (sample)');
    lines.push('');
    for (const r of discoveryWrongMatches.slice(0, 10)) {
      const d = r.comicvine?.discovery;
      lines.push(`- **${r.title}** — matched=${d?.matchedVolumeId} (${d?.matchedTitle}), expected=${d?.expectedVolumeId}, similarity=${d?.titleSimilarity.toFixed(2)}`);
    }
    lines.push('');
  }

  if (scrapeFailures.length > 0) {
    lines.push('### Scrape failures (sample)');
    lines.push('');
    for (const r of scrapeFailures.slice(0, 10)) {
      const s = r.comicvine?.scrapeDiagnostics;
      lines.push(`- **${r.title}** — ${s?.issuesAttempted} URLs attempted, error: ${s?.errorMessage ?? 'none'}`);
    }
    lines.push('');
  }

  // Detailed Results Table
  lines.push('## Detailed Results');
  lines.push('');
  lines.push('| Title | AniList Ch | AniList Vol | CV Parsed Ch | CV Max Ch | CV Parsed Vol | CV Max Vol | API | Scraper | Outliers | Error |');
  lines.push('|-------|-----------|-------------|--------------|-----------|---------------|-------------|-----|---------|----------|------|');

  for (const r of results) {
    const al = r.anilist;
    const cv = r.comicvine;

    lines.push(
      `| ${r.title} ` +
        `| ${al?.chapters ?? '?'} ` +
        `| ${al?.volumes ?? '?'} ` +
        `| ${cv?.chapterCount ?? '-'} ` +
        `| ${cv?.maxChapterNumber ?? '-'} ` +
        `| ${cv?.volumeCount ?? '-'} ` +
        `| ${cv?.maxVolumeNumber ?? '-'} ` +
        `| ${cv?.apiUsed ? '✓' : '-'} ` +
        `| ${cv?.scraperUsed ? '✓' : '-'} ` +
        `| ${cv?.outliers.length ?? '-'} ` +
        `| ${cv?.error ? '✗' : ''} |`
    );
  }

  lines.push('');

  // Outlier Details
  if (snapshot.totalOutliers > 0) {
    lines.push('## Outlier Analysis');
    lines.push('');
    lines.push('Chapters with numbers exceeding the AniList ground truth count:');
    lines.push('');

    for (const r of results) {
      if (!r.comicvine?.outliers.length) continue;

      lines.push(`### ${r.title}`);
      lines.push('');
      lines.push(`**AniList:** ${r.anilist?.chapters ?? '?'} chapters`);
      lines.push(`**ComicVine:** ${r.comicvine.chapterCount} chapters parsed`);
      lines.push('');
      lines.push(`**Outliers** (${r.comicvine.outliers.length}):`);
      for (const o of r.comicvine.outliers.slice(0, 20)) {
        lines.push(
          `- Ch.${o.number}${o.title ? ` "${o.title}"` : ''}${o.volume ? ` (Vol.${o.volume})` : ''}`
        );
      }
      if (r.comicvine.outliers.length > 20) {
        lines.push(`- ... and ${r.comicvine.outliers.length - 20} more`);
      }
      lines.push('');
    }
  }

  // Error Details
  if (snapshot.parserErrors > 0) {
    lines.push('## Parser Errors');
    lines.push('');
    lines.push('Titles where ComicVine parsing failed:');
    lines.push('');

    for (const r of results) {
      if (r.comicvine?.error) {
        lines.push(`- **${r.title}**: ${r.comicvine.error}`);
      }
    }
    lines.push('');
  }

  lines.push('');
  lines.push('---');
  lines.push('*Generated by scripts/comicvine/test-comicvine-accuracy.ts*');

  return lines.join('\n');
}

// ============================================================================
// Main
// ============================================================================

async function testSingleManga(
  manga: ComicVineTestManga,
  options: CliOptions
): Promise<MangaTestResult> {
  const slug = slugify(manga.title);
  print(`\n${'='.repeat(60)}`);
  print(`Testing: ${manga.title} (${slug})`);
  print('='.repeat(60));

  // Step 1: AniList ground truth
  print('  Fetching AniList ground truth...');
  const anilist = await fetchAniListData(manga.anilistSearch);

  // Apply chapter override for multi-part series
  if (anilist && manga.overrideChapters) {
    print(`  [AniList] Override: ${anilist.chapters ?? '?'} → ${manga.overrideChapters} chapters`);
    anilist.chapters = manga.overrideChapters;
  }

  if (anilist) {
    print(`  [AniList] ${anilist.titleRomaji}: ${anilist.chapters ?? '?'} chapters, ${anilist.volumes ?? '?'} volumes (${anilist.status})`);
  }

  // Rate limit: AniList allows 90 req/min
  await delay(700);

  // Step 2: ComicVine parser (discovery + scrape)
  const comicvine = await runComicVineParser(manga, anilist, options);

  // Step 3: Compare — identify outliers
  if (comicvine && anilist?.chapters) {
    comicvine.outliers = findOutliers(comicvine.chapters, anilist.chapters);
    if (comicvine.outliers.length > 0) {
      print(`  [ComicVine] ${comicvine.outliers.length} outlier chapters (> AniList count ${anilist.chapters})`);
    }
  }

  const result: MangaTestResult = {
    title: manga.title,
    slug,
    anilist,
    comicvine,
    timestamp: new Date().toISOString(),
    iteration: options.iteration,
  };

  // Save per-manga results incrementally
  saveResults(result);

  return result;
}

async function main(): Promise<void> {
  const options = parseArgs();
  print('ComicVine Parser Accuracy Test');
  print('===========================');
  print(`Options: ${JSON.stringify(options)}`);

  ensureDir(OUTPUT_DIR);
  ensureDir(ITERATIONS_DIR);

  // Filter corpus. Discovery uses AniList → CV matching, so we no longer
  // require `comicvineUrl` to be set (it becomes the expected-id ground truth).
  let corpus: ComicVineTestManga[] = COMICVINE_TEST_CORPUS;

  if (options.fastSample) {
    corpus = corpus.filter((m) => m.fastSample === true);
    print(`\nFast sample: ${corpus.length} flagged titles`);
  }

  if (options.singleTitle) {
    corpus = corpus.filter((m) =>
      m.title.toLowerCase().includes(options.singleTitle!.toLowerCase())
    );
    if (corpus.length === 0) {
      console.error(`No manga found matching "${options.singleTitle}"`);
      process.exit(1);
    }
  } else if (!options.fastSample) {
    // Apply from/to slice for resumable runs (only when not in fast-sample mode)
    const start = options.fromIndex;
    const end = options.toIndex !== null ? options.toIndex : corpus.length;
    corpus = corpus.slice(start, end);
    print(`\nSlice [${start}..${end}): ${corpus.length} titles`);
  }

  // Apply --limit AFTER all filters so it composes with --fast-sample / --title
  if (options.limit !== null && options.limit > 0 && corpus.length > options.limit) {
    corpus = corpus.slice(0, options.limit);
    print(`\nLimit applied: ${corpus.length} titles`);
  }

  print(`\nTesting ${corpus.length} manga titles...\n`);

  const results: MangaTestResult[] = [];

  for (let titleIdx = 0; titleIdx < corpus.length; titleIdx++) {
    const manga = corpus[titleIdx];
    if (!manga) continue;
    try {
      const result = await testSingleManga(manga, options);
      results.push(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`\nFATAL ERROR testing ${manga.title}: ${msg}`);
      results.push({
        title: manga.title,
        slug: slugify(manga.title),
        anilist: null,
        comicvine: null,
        timestamp: new Date().toISOString(),
        iteration: options.iteration,
      });
    }
    // Iter 14: 8s gap between titles. Cloudflare rate-limits FlareSolverr
    // when scrape batches happen back-to-back; an explicit gap between
    // titles lets CF cool down before the next series' first issue request.
    if (titleIdx < corpus.length - 1) {
      await delay(8000);
    }
  }

  // Generate aggregate report
  print('\n\nGenerating aggregate report...');
  const report = generateReport(results);

  const reportPath = options.iteration !== undefined
    ? path.join(ITERATIONS_DIR, `RESULTS-iter-${options.iteration}.md`)
    : path.join(OUTPUT_DIR, 'RESULTS.md');
  fs.writeFileSync(reportPath, report);
  print(`\nReport saved to ${reportPath}`);

  // Print summary
  print('\n' + '='.repeat(60));
  print('SUMMARY');
  print('='.repeat(60));
  for (const r of results) {
    const al = r.anilist?.chapters ?? '?';
    const cvCh = r.comicvine?.chapterCount ?? '-';
    const cvOutliers = r.comicvine?.outliers.length ?? 0;
    const flag = cvOutliers > 0 ? ' !!!' : '';
    print(`  ${r.title.padEnd(30)} AniList:${String(al).padStart(5)}  CV:${String(cvCh).padStart(5)}  Outliers:${cvOutliers}${flag}`);
  }
}

main()
  .then(() => {
    print('\nDone.');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
