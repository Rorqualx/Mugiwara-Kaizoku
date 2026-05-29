/**
 * Suwayomi Manga Matcher
 *
 * Resolves a Kaizoku `Manga` record to a Suwayomi-internal manga id by
 * searching a single Mihon source extension and scoring candidates with the
 * existing dice-coefficient / edition-mismatch helpers used by the MangaDex
 * matcher.
 *
 * Persists the match (suwayomiSourceId, suwayomiMangaId, slug, confidence,
 * lastMatchedAt) onto `Manga.suwayomiPluginConfig` JSON when the score
 * crosses the threshold.
 */

import { prisma } from '@/server/db';
import {
  diceCoefficient,
  hasEditionMismatch,
  normalizeTitle,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/utils';
import { logger } from '@/utils/logger';

import { suwayomiConfigService } from './configService';
import { getSuwayomiGraphQLClient } from './graphql/client';

import type { MangaType } from './graphql/types';
import type { Prisma } from '@prisma/client';

const log = logger.child('SuwayomiMatcher');

/** Confidence threshold below which we refuse to persist a match */
const MATCH_THRESHOLD = 0.85;

/** Per-manga config persisted to Manga.suwayomiPluginConfig */
export interface SuwayomiPluginConfig {
  enabled: boolean;
  sourceId?: string;
  mangaId?: number;
  slug?: string;
  matchConfidence?: number;
  lastMatchedAt?: string;
  lastSyncedAt?: string;
  totalChapters?: number;
  unmatchedChapters?: number;
}

/** Result returned to callers (tRPC, smoke scripts) */
export interface SuwayomiMatchResult {
  matched: boolean;
  suwayomiMangaId?: number;
  suwayomiUrl?: string;
  suwayomiTitle?: string;
  slug?: string;
  confidence: number;
  candidatesConsidered: number;
  reason: string;
}

interface ScoredCandidate {
  manga: MangaType;
  score: number;
  matchedTitle: string;
}

interface MangaContext {
  queryTitle: string;
  altTitles: string[];
  expectedChapters: number | null;
  currentConfig: SuwayomiPluginConfig;
}

/** Read suwayomiPluginConfig defensively. The DB column is JSON so the raw
 * value may be any shape; we guarantee `enabled: boolean` for downstream code. */
export function readSuwayomiPluginConfig(raw: unknown): SuwayomiPluginConfig {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return { enabled: false };
  }
  const obj = raw as Record<string, unknown>;
  return {
    ...obj,
    enabled: typeof obj['enabled'] === 'boolean' ? obj['enabled'] : false,
  } as SuwayomiPluginConfig;
}

/** Extract a slug from MangaType.url. Suwayomi extensions report different
 * shapes — sometimes a path (`/title/abc-def`), sometimes an absolute URL,
 * sometimes already a slug. Pick the last non-empty path segment. */
function extractSlug(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '');
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? url;
}

/** Chapter proximity multiplier (0.7–1.0). Mirrors mangadex-matcher.ts:42. */
function chapterProximityFactor(
  candidateChapterCount: number | undefined,
  expectedChapters: number | null,
): number {
  if (!expectedChapters || expectedChapters <= 0) return 1;
  if (!candidateChapterCount || candidateChapterCount <= 0) return 1;
  const ratio = Math.min(candidateChapterCount, expectedChapters)
    / Math.max(candidateChapterCount, expectedChapters);
  return 0.7 + 0.3 * ratio;
}

/** Score Suwayomi candidates against a query title, applying edition-mismatch
 * filtering and chapter-count proximity boosting. */
function scoreCandidates(
  candidates: MangaType[],
  query: string,
  expectedChapters: number | null,
  altTitles: string[],
): ScoredCandidate | null {
  const normalizedQuery = normalizeTitle(query);
  let best: ScoredCandidate | null = null;

  for (const manga of candidates) {
    if (hasEditionMismatch(query, manga.title)) continue;
    const chFactor = chapterProximityFactor(manga.chapterCount, expectedChapters);
    const titlesToScore = [manga.title, ...altTitles];
    for (const candTitle of titlesToScore) {
      const dice = diceCoefficient(normalizedQuery, normalizeTitle(candTitle));
      const lenRatio = Math.min(query.length, candTitle.length)
        / Math.max(query.length, candTitle.length);
      const score = dice * lenRatio * chFactor;
      if (!best || score > best.score) {
        best = { manga, score, matchedTitle: candTitle };
      }
    }
  }

  return best;
}

/** Load Manga + metadata + current plugin config. Returns null if not found. */
async function loadMangaContext(mangaId: number): Promise<MangaContext | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Metadata: { select: { chapters: true, synonyms: true } } },
  });
  if (!manga) return null;
  return {
    queryTitle: manga.mangaTitle ?? manga.title,
    altTitles: manga.Metadata?.synonyms ?? [],
    expectedChapters: manga.Metadata?.chapters ?? null,
    currentConfig: readSuwayomiPluginConfig(manga.suwayomiPluginConfig),
  };
}

/** Run the source search and pick the best candidate. */
async function searchAndScore(
  sourceId: string,
  ctx: MangaContext,
): Promise<{ best: ScoredCandidate | null; total: number; error?: string }> {
  const config = await suwayomiConfigService.loadConfig();
  const client = getSuwayomiGraphQLClient({
    httpUrl: `http://localhost:${config.port}/api/graphql`,
    wsUrl: `ws://localhost:${config.port}/api/graphql`,
  });
  try {
    const result = await client.searchSourceManga(sourceId, ctx.queryTitle, 1);
    const candidates = result.mangas;
    return {
      best: scoreCandidates(candidates, ctx.queryTitle, ctx.expectedChapters, ctx.altTitles),
      total: candidates.length,
    };
  } catch (err) {
    return {
      best: null,
      total: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Persist a match into Manga.suwayomiPluginConfig (preserves enabled flag). */
async function persistMatch(
  mangaId: number,
  current: SuwayomiPluginConfig,
  sourceId: string,
  best: ScoredCandidate,
  slug: string,
): Promise<void> {
  const next: SuwayomiPluginConfig = {
    ...current,
    sourceId,
    mangaId: best.manga.id,
    slug,
    matchConfidence: best.score,
    lastMatchedAt: new Date().toISOString(),
  };
  await prisma.manga.update({
    where: { id: mangaId },
    data: { suwayomiPluginConfig: next as unknown as Prisma.InputJsonValue },
  });
  log.info('Suwayomi match persisted', {
    mangaId, sourceId, suwayomiMangaId: best.manga.id, slug, confidence: best.score,
  });
}

interface MatchOptions {
  mangaId: number;
  sourceId: string;
  /** Skip persistence when running diagnostic / dry-run scripts. */
  persist?: boolean;
}

/** Run the matcher for one manga + one Suwayomi source. */
export async function matchMangaOnSuwayomi(
  options: MatchOptions,
): Promise<SuwayomiMatchResult> {
  const { mangaId, sourceId, persist = true } = options;

  const ctx = await loadMangaContext(mangaId);
  if (!ctx) {
    return {
      matched: false, confidence: 0, candidatesConsidered: 0,
      reason: `Manga ${mangaId} not found`,
    };
  }

  const { best, total, error } = await searchAndScore(sourceId, ctx);
  if (error) {
    log.error('Suwayomi search failed', { mangaId, sourceId, error });
    return {
      matched: false, confidence: 0, candidatesConsidered: 0,
      reason: `Suwayomi search failed: ${error}`,
    };
  }
  if (total === 0) {
    return {
      matched: false, confidence: 0, candidatesConsidered: 0,
      reason: `No results from source ${sourceId} for query "${ctx.queryTitle}"`,
    };
  }
  if (!best || best.score < MATCH_THRESHOLD) {
    return {
      matched: false,
      confidence: best?.score ?? 0,
      candidatesConsidered: total,
      reason: best
        ? `Best score ${best.score.toFixed(3)} below threshold ${MATCH_THRESHOLD}`
        : 'No scorable candidates after edition-mismatch filter',
    };
  }

  const slug = extractSlug(best.manga.url);
  if (persist) await persistMatch(mangaId, ctx.currentConfig, sourceId, best, slug);

  return {
    matched: true,
    suwayomiMangaId: best.manga.id,
    suwayomiUrl: best.manga.url,
    suwayomiTitle: best.manga.title,
    slug,
    confidence: best.score,
    candidatesConsidered: total,
    reason: `Matched "${best.matchedTitle}" with score ${best.score.toFixed(3)}`,
  };
}

/**
 * Trigger a chapter scrape and check whether the source returns at least
 * one chapter for this manga. Suwayomi caches chapter lists lazily —
 * `getChapters` only returns the cached list, which is empty until the
 * first scrape. Auto-discovery has to *trigger* the scrape (via the
 * `fetchChapters` mutation) to know whether a source actually has
 * anything to offer.
 *
 * The scrape result is cached server-side, so the adapter's later
 * `getChapters` call (during candidate building) will short-circuit to
 * the warm cache instead of re-scraping. Cost: one extra mutation per
 * winning candidate considered (typically 1–3 sources tried before one
 * passes).
 */
async function sourceHasChapters(suwayomiMangaId: number): Promise<boolean> {
  try {
    const client = getSuwayomiGraphQLClient();
    const chapters = await client.fetchChapters(suwayomiMangaId);
    return chapters.length > 0;
  } catch (err) {
    log.warn('Suwayomi: chapter scrape failed; treating as empty', {
      suwayomiMangaId, error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Per-source fanout for {@link matchMangaAcrossAllSuwayomiSources}: bounded
 * rolling concurrency, settled-style.
 *
 * An unbounded `Promise.allSettled` over ~30 installed sources × the parallel
 * `quickDownloadWithSearch` mutations a user can fire (one per volume) saturates
 * Suwayomi's thread pool — observed 2026-05-29 with 535 chapters across 5
 * concurrent mutations, every wrapper hit the upstream `suwayomi-search exceeded
 * 120000ms — returning null` timeout. A cap of 4 lets slow Cloudflare-gated
 * sources cool down without starving fast ones (a worker drains a shared cursor
 * so as soon as one finishes the next starts — same pattern as `runLimited` in
 * scanner/chapter-creator/chapter-file-service.ts).
 */
const SOURCE_FANOUT_CONCURRENCY = 4;

async function runSourceFanout<S, R>(
  sources: readonly S[],
  fn: (s: S) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(sources.length);
  const cursor = { value: 0 };
  const worker = async (): Promise<void> => {
    for (let idx = cursor.value++; idx < sources.length; idx = cursor.value++) {
      const item = sources[idx];
      if (item === undefined) continue;
      try {
        // eslint-disable-next-line no-await-in-loop -- worker drains a shared cursor; sequential by design for bounded concurrency
        results[idx] = { status: 'fulfilled', value: await fn(item) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  };
  const workerCount = Math.max(1, Math.min(SOURCE_FANOUT_CONCURRENCY, sources.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Auto-discover binding by fanning out across every installed Suwayomi source
 * in parallel, ranking matches by confidence, and walking the ranked list
 * top-down — accepting the first candidate that *also* has at least one
 * chapter listed. Used by the Suwayomi adapter when no per-manga binding
 * exists yet.
 *
 * The chapter-availability gate is the key piece: a source can score 1.00
 * on title match but still have zero chapters in its index (Weeb Central
 * has this pattern for some titles). Without the gate, auto-discovery
 * would persist that source and the dispatcher would never get any
 * candidates from it. With the gate, we walk down the list and bind to
 * the first source that *will* yield chapters.
 *
 * Persists the winning binding (sourceId + suwayomiMangaId + slug) onto
 * `Manga.suwayomiPluginConfig`. Best-effort: failures per source are
 * logged and dropped, the function never throws.
 */
export async function matchMangaAcrossAllSuwayomiSources(
  mangaId: number,
): Promise<SuwayomiMatchResult> {
  const ctx = await loadMangaContext(mangaId);
  if (!ctx) {
    return {
      matched: false, confidence: 0, candidatesConsidered: 0,
      reason: `Manga ${mangaId} not found`,
    };
  }

  let sources: Array<{ id: number; name: string }> = [];
  try {
    const client = getSuwayomiGraphQLClient();
    const all = await client.getSources();
    sources = all.map((s) => ({ id: s.id, name: s.name }));
  } catch (err) {
    log.error('Failed to list Suwayomi sources for auto-discovery', {
      mangaId, error: err instanceof Error ? err.message : String(err),
    });
    return {
      matched: false, confidence: 0, candidatesConsidered: 0,
      reason: 'Failed to list Suwayomi sources',
    };
  }
  if (sources.length === 0) {
    return {
      matched: false, confidence: 0, candidatesConsidered: 0,
      reason: 'No Suwayomi sources installed',
    };
  }

  log.info('Suwayomi: auto-discovering across all sources', {
    mangaId, title: ctx.queryTitle, sourceCount: sources.length,
  });

  const results = await runSourceFanout(sources, async (s) => ({
    sourceId: String(s.id),
    name: s.name,
    ...(await searchAndScore(String(s.id), ctx)),
  }));

  // Collect every above-threshold winner across all sources, sorted by
  // score desc, so we can walk the ranked list and accept the first one
  // that has chapters available.
  const ranked: Array<{ sourceId: string; name: string; best: ScoredCandidate }> = [];
  let totalCandidates = 0;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    totalCandidates += r.value.total;
    if (r.value.best === null) continue;
    if (r.value.best.score < MATCH_THRESHOLD) continue;
    ranked.push({ sourceId: r.value.sourceId, name: r.value.name, best: r.value.best });
  }
  ranked.sort((a, b) => b.best.score - a.best.score);

  if (ranked.length === 0) {
    return {
      matched: false,
      confidence: 0,
      candidatesConsidered: totalCandidates,
      reason: `No candidates above threshold ${MATCH_THRESHOLD} from any of ${sources.length} sources`,
    };
  }

  // Walk the ranked list. First one with ≥1 chapter wins.
  const skipped: Array<{ name: string; score: number }> = [];
  for (const candidate of ranked) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential probe; we want to stop as soon as one passes
    const hasChapters = await sourceHasChapters(candidate.best.manga.id);
    if (!hasChapters) {
      log.info('Suwayomi: auto-discovery skipping empty source', {
        mangaId, source: candidate.name, score: candidate.best.score,
      });
      skipped.push({ name: candidate.name, score: candidate.best.score });
      continue;
    }
    const slug = extractSlug(candidate.best.manga.url);
    // eslint-disable-next-line no-await-in-loop -- only fires for the winning candidate; the loop returns immediately after
    await persistMatch(mangaId, ctx.currentConfig, candidate.sourceId, candidate.best, slug);
    log.info('Suwayomi: auto-discovery picked source', {
      mangaId, source: candidate.name, sourceId: candidate.sourceId,
      suwayomiMangaId: candidate.best.manga.id,
      confidence: candidate.best.score,
      skippedSources: skipped.map(s => s.name).join(',') || 'none',
    });
    return {
      matched: true,
      suwayomiMangaId: candidate.best.manga.id,
      suwayomiUrl: candidate.best.manga.url,
      suwayomiTitle: candidate.best.manga.title,
      slug,
      confidence: candidate.best.score,
      candidatesConsidered: totalCandidates,
      reason: `Auto-matched on ${candidate.name} with score ${candidate.best.score.toFixed(3)}`
        + (skipped.length > 0 ? ` (skipped ${skipped.length} empty source(s))` : ''),
    };
  }

  // All ranked candidates had zero chapters.
  return {
    matched: false,
    confidence: ranked[0]?.best.score ?? 0,
    candidatesConsidered: totalCandidates,
    reason: `${ranked.length} source(s) matched the title but none had chapters available`,
  };
}
