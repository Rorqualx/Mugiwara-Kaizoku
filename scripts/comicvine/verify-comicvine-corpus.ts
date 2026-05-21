/**
 * ComicVine Corpus Verification Script
 *
 * Addresses the corpus accuracy caveat in `LOOP_WORKFLOW.md`: many corpus
 * entries were auto-populated with sequential placeholder ComicVine volume IDs
 * (4050-44550, 4050-44551, ...). The `discoveryCorrect` metric is meaningless
 * until these are cleaned.
 *
 * Approach — direct API validation only (no matcher):
 *
 *   For each corpus entry that has a `comicvineUrl`:
 *     1. Extract the volumeId
 *     2. Fetch it via `comicvineService.getBasicVolumeInfo`
 *     3. If the API returns a real volume AND its name matches the AniList
 *        title (dice ≥ 0.6), the corpus ID is REAL → propose `verified: true`.
 *     4. Otherwise the corpus ID is a PLACEHOLDER → leave as-is, report it.
 *
 * Why API validation only (and not the matcher fallback):
 *
 *   The matcher itself has known quality issues — it sometimes picks the
 *   wrong volume (e.g., a Darkwood French edition for English One Piece) and
 *   reports it as `highConfidenceMatch: true`. Auto-promoting matcher results
 *   would CORRUPT the corpus. The matcher's quality is itself the iter 2 fix
 *   target, measured by the loop's `discoveryCorrectness` metric — that
 *   metric only becomes trustworthy after this script runs first.
 *
 * Output:
 *   - Report: docs/research/comicvine-accuracy/corpus-verification-report.json
 *   - Default mode is read-only. Re-run with `--write` to mutate the corpus
 *     file (sets `verified: true` on confirmed entries).
 *
 * Usage:
 *   bun scripts/comicvine/verify-comicvine-corpus.ts --fast-sample
 *   bun scripts/comicvine/verify-comicvine-corpus.ts --fast-sample --limit 20 --write
 *   bun scripts/comicvine/verify-comicvine-corpus.ts --title "One Piece"
 *
 * @module scripts/comicvine/verify-comicvine-corpus
 */

import * as fs from 'fs';
import * as path from 'path';

import type { AniListMangaDetails } from '@/server/services/anilist/service';

import { COMICVINE_TEST_CORPUS, type ComicVineTestManga } from './test-comicvine-corpus';
import { applyCorpusUpdates, type CorpusUpdate } from './verify-comicvine-corpus/corpus-mutation';
import { discoverViaPublisher, type DiscoveryResult } from './verify-comicvine-corpus/publisher-discovery';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

// ============================================================================
// Constants
// ============================================================================

/** Title similarity floor for confirming a corpus ID is real (looser than the matcher's 0.85). */
const API_VALIDATION_TITLE_SIMILARITY = 0.6;
const ANILIST_API = 'https://graphql.anilist.co';
// Sort by POPULARITY_DESC to disambiguate generic queries like "Fairy Tail"
// where AniList's default search would return an obscure manga that just
// happens to have the query string as a synonym.
const ANILIST_QUERY = `
query ($search: String) {
  Page(perPage: 1) {
    media(search: $search, type: MANGA, format_in: [MANGA], sort: [POPULARITY_DESC]) {
      id
      title { english romaji native }
      synonyms
      chapters
      volumes
      status
      countryOfOrigin
    }
  }
}
`;

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/research/comicvine-accuracy');
const REPORT_PATH = path.join(OUTPUT_DIR, 'corpus-verification-report.json');
const CORPUS_PATH = path.resolve(process.cwd(), 'scripts/comicvine/test-comicvine-corpus.ts');

// ============================================================================
// Types
// ============================================================================

interface CliOptions {
  singleTitle: string | null;
  fastSample: boolean;
  limit: number | null;
  write: boolean;
}

type VerifyStatus =
  | 'already-verified'              // corpus already has verified: true
  | 'api-confirmed'                  // Stage 1: API returned a real volume + name matches → safe to mark verified
  | 'api-name-mismatch'              // Stage 1: API returned a volume but the name doesn't match → placeholder
  | 'api-not-found'                  // Stage 1: API returned null → ID does not exist on ComicVine
  | 'discovered-via-publisher'        // Stage 2: matcher fallback found a publisher-matched volume → safe to promote
  | 'discovered-no-publisher-match'   // Stage 2: found a candidate but expectedPublisher didn't match → suggestion only
  | 'placeholder-no-discovery'        // Stage 1 failed and Stage 2 couldn't find anything
  | 'no-corpus-url'                   // no comicvineUrl AND Stage 2 failed
  | 'no-anilist'                      // AniList lookup failed
  | 'api-error';                      // unexpected error fetching from API

interface VerifyEntry {
  title: string;
  alreadyVerified: boolean;
  corpusUrl: string | null;
  corpusVolumeId: number | null;
  /** Stage 1 result */
  apiVolumeName: string | null;
  apiPublisher: string | null;
  apiTitleSim: number;
  /** Stage 2 result (discovery via publisher-filtered search) */
  discoveredVolumeId: number | null;
  discoveredName: string | null;
  discoveredPublisher: string | null;
  discoveredTitleSim: number;
  /** True if Stage 2 found a candidate matching the expected publisher */
  discoveredPublisherMatched: boolean;
  status: VerifyStatus;
  /** New URL to write to the corpus (set for api-confirmed and discovered-via-publisher) */
  proposedUrl: string | null;
}

// ============================================================================
// CLI parsing
// ============================================================================

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { singleTitle: null, fastSample: false, limit: null, write: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--title' && args[i + 1]) {
      options.singleTitle = args[i + 1] ?? null;
      i++;
    } else if (arg === '--fast-sample') {
      options.fastSample = true;
    } else if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1] ?? '0', 10);
      i++;
    } else if (arg === '--write') {
      options.write = true;
    }
  }
  return options;
}

// ============================================================================
// Helpers
// ============================================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractIdFromUrl(url: string | undefined | null): number | null {
  if (!url) return null;
  const match = url.match(/4050-(\d+)/);
  if (!match?.[1]) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

/** Bigram dice coefficient — pure utility, no dependencies. */
function diceCoefficient(a: string, b: string): number {
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

function bestSimilarityVsAniList(volumeName: string, anilist: AniListMangaDetails): number {
  const variants = [
    anilist.title.english,
    anilist.title.romaji,
    anilist.title.native,
    ...(anilist.synonyms ?? []),
  ].filter((t): t is string => typeof t === 'string' && t.length > 0);
  let best = 0;
  for (const v of variants) {
    const score = diceCoefficient(volumeName, v);
    if (score > best) best = score;
  }
  return best;
}

interface AniListMediaResponse {
  id?: number;
  title?: { english?: string; romaji?: string; native?: string };
  synonyms?: string[];
  chapters?: number;
  volumes?: number;
  status?: string;
  countryOfOrigin?: string;
}

async function fetchAniListData(search: string): Promise<AniListMangaDetails | null> {
  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { search } }),
    });
    if (!response.ok) {
      print(`  [AniList] HTTP ${response.status} for "${search}"`);
      return null;
    }
    const json = (await response.json()) as {
      data?: { Page?: { media?: AniListMediaResponse[] } };
    };
    const media = json.data?.Page?.media?.[0];
    if (!media) {
      print(`  [AniList] No results for "${search}"`);
      return null;
    }
    return {
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    print(`  [AniList] Error: ${msg}`);
    return null;
  }
}

// ============================================================================
// API validation
// ============================================================================

interface ApiValidationResult {
  status: VerifyStatus;
  apiVolumeName: string | null;
  apiPublisher: string | null;
  apiTitleSim: number;
}

async function validateCorpusIdViaApi(
  corpusVolumeId: number,
  anilist: AniListMangaDetails,
): Promise<ApiValidationResult> {
  try {
    const { comicvineService } = await import('@/server/services/comicvine/service');
    const volume = await comicvineService.getBasicVolumeInfo(corpusVolumeId);
    if (!volume?.name) {
      return { status: 'api-not-found', apiVolumeName: null, apiPublisher: null, apiTitleSim: 0 };
    }
    const apiTitleSim = bestSimilarityVsAniList(volume.name, anilist);
    const status: VerifyStatus =
      apiTitleSim >= API_VALIDATION_TITLE_SIMILARITY ? 'api-confirmed' : 'api-name-mismatch';
    return {
      status,
      apiVolumeName: volume.name,
      apiPublisher: volume.publisher?.name ?? null,
      apiTitleSim,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    print(`  [API] Error fetching volume ${corpusVolumeId}: ${msg}`);
    return { status: 'api-error', apiVolumeName: null, apiPublisher: null, apiTitleSim: 0 };
  }
}

// ============================================================================
// Per-entry verification
// ============================================================================

const EMPTY_API_FIELDS = {
  apiVolumeName: null,
  apiPublisher: null,
  apiTitleSim: 0,
} as const;

const EMPTY_DISCOVERY_FIELDS = {
  discoveredVolumeId: null,
  discoveredName: null,
  discoveredPublisher: null,
  discoveredTitleSim: 0,
  discoveredPublisherMatched: false,
} as const;

function buildVolumeUrl(volumeId: number, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'volume';
  return `https://comicvine.gamespot.com/${slug}/4050-${volumeId}/`;
}

function buildBaseEntry(manga: ComicVineTestManga): Omit<VerifyEntry, 'status' | 'proposedUrl'> {
  return {
    title: manga.title,
    alreadyVerified: manga.verified === true,
    corpusUrl: manga.comicvineUrl ?? null,
    corpusVolumeId: extractIdFromUrl(manga.comicvineUrl),
    ...EMPTY_API_FIELDS,
    ...EMPTY_DISCOVERY_FIELDS,
  };
}

/**
 * Pick the best search query for Stage 2. When `expectedLanguage='en'` we
 * prefer the AniList English title (so ComicVine returns English editions
 * first); otherwise we fall back to the corpus's anilistSearch field.
 *
 * Without this, an entry like Attack on Titan whose `anilistSearch` is the
 * romaji "Shingeki no Kyojin" causes the discovery to surface the original
 * Japanese Kodansha edition instead of the English Kodansha Comics USA one.
 */
function pickStage2Query(manga: ComicVineTestManga, anilist: AniListMangaDetails): string {
  const wantEnglish = (manga.expectedLanguage ?? 'en') === 'en';
  if (wantEnglish && anilist.title.english && anilist.title.english.length > 1) {
    return anilist.title.english;
  }
  return manga.anilistSearch;
}

/**
 * Run Stage 2 publisher-filtered discovery for an entry whose corpus ID was a
 * placeholder. Returns a populated entry with the appropriate status.
 */
async function runStage2Discovery(
  base: Omit<VerifyEntry, 'status' | 'proposedUrl'>,
  manga: ComicVineTestManga,
  anilist: AniListMangaDetails,
): Promise<VerifyEntry> {
  const query = pickStage2Query(manga, anilist);
  print(`  [Stage2] Searching ComicVine for "${query}" (publisher: ${manga.expectedPublisher ?? 'any'})`);
  const result: DiscoveryResult | null = await discoverViaPublisher(
    query,
    manga.expectedPublisher,
    anilist,
  );
  if (!result) {
    return { ...base, status: 'placeholder-no-discovery', proposedUrl: null };
  }
  const populated: Omit<VerifyEntry, 'status' | 'proposedUrl'> = {
    ...base,
    discoveredVolumeId: result.volumeId,
    discoveredName: result.name,
    discoveredPublisher: result.publisher,
    discoveredTitleSim: result.titleSim,
    discoveredPublisherMatched: result.publisherMatched,
  };
  if (!result.publisherMatched) {
    return { ...populated, status: 'discovered-no-publisher-match', proposedUrl: null };
  }
  return {
    ...populated,
    status: 'discovered-via-publisher',
    proposedUrl: buildVolumeUrl(result.volumeId, result.name),
  };
}

async function verifyEntry(manga: ComicVineTestManga): Promise<VerifyEntry> {
  const baseEntry = buildBaseEntry(manga);

  if (manga.verified === true) {
    return { ...baseEntry, status: 'already-verified', proposedUrl: null };
  }

  print(`  [AniList] Fetching ${manga.anilistSearch}...`);
  const anilistDetails = await fetchAniListData(manga.anilistSearch);
  if (!anilistDetails) {
    return { ...baseEntry, status: 'no-anilist', proposedUrl: null };
  }
  await delay(700);

  // ───── Stage 1: validate the existing corpus ID via the API ─────
  if (baseEntry.corpusVolumeId !== null) {
    const apiResult = await validateCorpusIdViaApi(baseEntry.corpusVolumeId, anilistDetails);
    const populated = { ...baseEntry, ...apiResult };
    if (apiResult.status === 'api-confirmed') {
      return { ...populated, proposedUrl: baseEntry.corpusUrl };
    }
    if (apiResult.status === 'api-error') {
      return { ...populated, proposedUrl: null };
    }
    // Stage 1 said the corpus ID is a placeholder — fall through to Stage 2
    return await runStage2Discovery(populated, manga, anilistDetails);
  }

  // No corpus URL at all → Stage 2 only
  return await runStage2Discovery(baseEntry, manga, anilistDetails);
}

// ============================================================================
// Build CorpusUpdate list from verify results
// ============================================================================

function buildCorpusUpdates(entries: VerifyEntry[]): CorpusUpdate[] {
  const updates: CorpusUpdate[] = [];
  for (const e of entries) {
    if (e.status === 'api-confirmed') {
      // Existing URL is correct — just flip verified=true (no URL change)
      updates.push({ title: e.title, newComicvineUrl: null });
    } else if (e.status === 'discovered-via-publisher' && e.proposedUrl) {
      // Replace placeholder URL with discovered one + verified=true
      updates.push({ title: e.title, newComicvineUrl: e.proposedUrl });
    }
  }
  return updates;
}

// ============================================================================
// Reporting
// ============================================================================

const STATUS_LABELS: Record<VerifyStatus, string> = {
  'already-verified': 'already verified',
  'api-confirmed': 'API CONFIRMED',
  'api-name-mismatch': 'API name mismatch (placeholder)',
  'api-not-found': 'API not found (placeholder)',
  'discovered-via-publisher': 'STAGE2 DISCOVERED',
  'discovered-no-publisher-match': 'Stage2 candidate (no publisher match)',
  'placeholder-no-discovery': 'placeholder + Stage2 found nothing',
  'no-corpus-url': 'no corpus URL',
  'no-anilist': 'no AniList data',
  'api-error': 'API error',
};

function formatVerifyResult(r: VerifyEntry): string {
  const label = STATUS_LABELS[r.status];
  if (r.status === 'api-confirmed') {
    return `${label} → "${r.apiVolumeName}" (${r.apiPublisher ?? 'no publisher'}) sim=${r.apiTitleSim.toFixed(2)}`;
  }
  if (r.status === 'api-name-mismatch') {
    return `${label}: API returned "${r.apiVolumeName}" sim=${r.apiTitleSim.toFixed(2)}`;
  }
  if (r.status === 'discovered-via-publisher') {
    return `${label} → ${r.discoveredVolumeId} "${r.discoveredName}" (${r.discoveredPublisher}) sim=${r.discoveredTitleSim.toFixed(2)}`;
  }
  if (r.status === 'discovered-no-publisher-match') {
    return `${label}: ${r.discoveredVolumeId} "${r.discoveredName}" (${r.discoveredPublisher}) sim=${r.discoveredTitleSim.toFixed(2)}`;
  }
  return label;
}

function filterCorpus(options: CliOptions): ComicVineTestManga[] {
  let corpus: ComicVineTestManga[] = COMICVINE_TEST_CORPUS;
  if (options.fastSample) corpus = corpus.filter((m) => m.fastSample === true);
  if (options.singleTitle) {
    const needle = options.singleTitle.toLowerCase();
    corpus = corpus.filter((m) => m.title.toLowerCase().includes(needle));
  }
  if (options.limit !== null && options.limit > 0) corpus = corpus.slice(0, options.limit);
  return corpus;
}

function tallyStatuses(results: VerifyEntry[]): Record<VerifyStatus, number> {
  const counts: Record<VerifyStatus, number> = {
    'already-verified': 0,
    'api-confirmed': 0,
    'api-name-mismatch': 0,
    'api-not-found': 0,
    'discovered-via-publisher': 0,
    'discovered-no-publisher-match': 0,
    'placeholder-no-discovery': 0,
    'no-corpus-url': 0,
    'no-anilist': 0,
    'api-error': 0,
  };
  for (const r of results) counts[r.status]++;
  return counts;
}

function printSummary(total: number, counts: Record<VerifyStatus, number>): void {
  print('');
  print('===== Verification Summary =====');
  print(`  Total entries:                 ${total}`);
  print(`  Already verified:              ${counts['already-verified']}`);
  print(`  Stage1 API CONFIRMED:          ${counts['api-confirmed']}`);
  print(`  Stage1 API name mismatch:      ${counts['api-name-mismatch']}`);
  print(`  Stage1 API not found:          ${counts['api-not-found']}`);
  print(`  Stage2 DISCOVERED (publisher): ${counts['discovered-via-publisher']}`);
  print(`  Stage2 candidate (no pub):     ${counts['discovered-no-publisher-match']}`);
  print(`  Placeholder + no discovery:    ${counts['placeholder-no-discovery']}`);
  print(`  No corpus URL:                 ${counts['no-corpus-url']}`);
  print(`  No AniList data:               ${counts['no-anilist']}`);
  print(`  API errors:                    ${counts['api-error']}`);
  print('');
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();
  print('ComicVine Corpus Verification (API direct)');
  print('===========================================');
  print(`Options: ${JSON.stringify(options)}`);
  print('');

  ensureDir(OUTPUT_DIR);
  const corpus = filterCorpus(options);
  print(`Verifying ${corpus.length} corpus entries...\n`);

  const results: VerifyEntry[] = [];
  for (let i = 0; i < corpus.length; i++) {
    const manga = corpus[i];
    if (!manga) continue;
    print(`[${i + 1}/${corpus.length}] ${manga.title}`);
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential to honor AniList rate limit
      const result = await verifyEntry(manga);
      results.push(result);
      print(`  → ${formatVerifyResult(result)}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      print(`  → ERROR: ${msg}`);
      results.push({ ...buildBaseEntry(manga), status: 'api-error', proposedUrl: null });
    }
  }

  const counts = tallyStatuses(results);
  printSummary(results.length, counts);

  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({ timestamp: new Date().toISOString(), options, summary: counts, entries: results }, null, 2),
  );
  print(`Report saved to ${REPORT_PATH}`);

  const corpusUpdates = buildCorpusUpdates(results);

  if (options.write) {
    print('');
    print('Applying corpus updates (--write)...');
    const { updated, skipped } = applyCorpusUpdates(corpusUpdates);
    print(`  Updated: ${updated} entries`);
    print(`  Skipped: ${skipped} entries`);
    print('');
    print('Re-run the loop to confirm discoveryCorrectness improved:');
    print('  bun scripts/comicvine/test-comicvine-accuracy.ts --fast-sample --limit 20 --iteration 2');
    return;
  }

  if (corpusUpdates.length > 0) {
    print('');
    print(`Re-run with --write to apply ${corpusUpdates.length} corpus updates`);
    print(`  ${counts['api-confirmed']} from Stage1 (mark verified, no URL change)`);
    print(`  ${counts['discovered-via-publisher']} from Stage2 (replace placeholder URL + verify)`);
  }
}

main()
  .then(() => { print('\nDone.'); process.exit(0); })
  .catch((error: unknown) => { console.error('Fatal error:', error); process.exit(1); });
