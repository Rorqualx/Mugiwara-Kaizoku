// @file-size-justified: orchestration entry point that owns the full
// dispatch pipeline (Prowlarr coverage estimate → native fill → manual
// Prowlarr scope dispatch). Splitting further would scatter the control
// flow across files and obscure the sequencing.
/**
 * Unified Release Dispatcher
 *
 * Single entry point for "find downloads for a manga's missing chapters
 * across every enabled source." Replaces today's split between
 * `autoDownloadScheduler.triggerManga` (Prowlarr-only) and the manual
 * per-manga download buttons (native-only) with one fan-out + ranker.
 *
 * Pack-first ranking (per user decision):
 *   1. Prowlarr packs that cover any missing chapters win first; legacy
 *      `autoDownloadScheduler.triggerManga` is invoked to dispatch them
 *      via the existing Prowlarr → external-client pipeline.
 *   2. For chapters NOT covered by parseable Prowlarr packs, native chapter
 *      candidates fill the gap (MangaDex → Suwayomi → GetComics).
 *   3. Idempotent: a chapter that already has a pending or active
 *      `NativeDownload` job is skipped.
 *
 * The legacy `autoDownloadWorker.processAutoDownload` still owns the
 * Prowlarr search → release scoring → external-client dispatch path; we
 * delegate to it so the existing pack-scoring logic (`prowlarr-scoring.ts`)
 * remains the single source of truth for picking *which* pack to grab.
 */
import * as path from 'path';

import { DownloadMethod, DownloadMode, JobType, NativeDownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { queueManager } from '@/server/queue/queueManager';
import { DownloadManager } from '@/server/services/download/downloadManager';
import type { MangaDexCandidatePayload } from '@/server/services/library/indexerSearch/adapters/mangadex-adapter';
import type { SuwayomiCandidatePayload } from '@/server/services/library/indexerSearch/adapters/suwayomi-adapter';
import { phaseIndexerSearch } from '@/server/services/library/indexerSearch/phase-indexer-search';
import type { ReleaseCandidate, ReleaseScope } from '@/server/services/library/indexerSearch/types';
import {
  emitChapterExhausted, loadDispatchMediaType, loadFailedSourcesForManga, recordDispatchSkip,
  recordDispatchAttempt, recordProwlarrDispatch,
} from '@/server/services/library/releaseDispatcher/dispatch-attempt';
import { applyModeBias, loadDownloadMode } from '@/server/services/library/releaseDispatcher/download-mode';
import type { DownloadModePreference } from '@/server/services/library/releaseDispatcher/download-mode';
import { enqueueGetComicsCandidate } from '@/server/services/library/releaseDispatcher/getcomics-enqueue';
import { createActiveNativeDownload } from '@/server/services/library/releaseDispatcher/native-download-guard';
import { filterProwlarrCandidatesToScope } from '@/server/services/library/releaseDispatcher/scope-filtering';
import { mangadexConfigService } from '@/server/services/mangadex/configService';
import { isPreferredLanguage } from '@/server/services/mangadex/language-match';
import { scoreAndSortResults, selectBestResult } from '@/server/services/quickDownload/scoringAlgorithm';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { QuickDownloadCriteria } from '@/types/quickDownload.types';
import { DEFAULT_QUICK_DOWNLOAD_CRITERIA } from '@/types/quickDownload.types';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const log = logger.child('UnifiedReleaseSearch');

export interface DispatchSummary {
  mangaId: number;
  triggeredProwlarr: boolean;
  prowlarrCoveredChapters: number[];
  /**
   * Populated only when manual-scope Prowlarr dispatch picked a specific
   * pack (so the UI can show which release was selected). Auto-trigger
   * dispatch leaves this undefined because the legacy path runs
   * fire-and-forget and doesn't surface its choice back.
   */
  prowlarrSelected?: {
    releaseTitle?: string;
    indexer?: string;
    score?: number;
  };
  nativeEnqueued: Array<{ chapterNumber: number; source: ReleaseCandidate['source'] }>;
  uncoveredChapters: number[];
}

/**
 * Options for {@link runUnifiedReleaseSearch}.
 *
 * - `scope`: narrow the search to a specific chapter / volume / explicit list.
 *   Falls through to `ALL_MISSING` (every monitored, not-completed chapter)
 *   when omitted — the original auto-trigger semantics.
 * - `bypassRuleCheck`: skip the `autoDownloadRule.enabled` gate. Manual
 *   callers (UI buttons) set this — auto-download being off doesn't mean
 *   the user can't click "download" by hand.
 * - `criteria`: release-selection preferences (formats, seeder thresholds,
 *   size bounds, language, blocklist). Applied to Prowlarr candidates only;
 *   native sources don't expose these knobs.
 */
export interface RunOptions {
  scope?: ReleaseScope;
  bypassRuleCheck?: boolean;
  criteria?: Partial<QuickDownloadCriteria>;
}

/** Per-chapter outcome surfaced from manual Prowlarr dispatch back to the caller. */
export interface ProwlarrDispatchOutcome {
  /** Title of the selected pack, if one was dispatched. */
  releaseTitle?: string;
  /** Indexer that returned the pack, if one was dispatched. */
  indexer?: string;
  /** Score the dispatcher gave the pack (higher is better). */
  score?: number;
  /** Chapter numbers covered by the dispatch (intersection of pack and scope). */
  coveredChapters: number[];
}

interface ChapterStub {
  id: number;
  chapterNumber: number | null;
  volume: number | null;
  mangadexId: string | null;
  suwayomiChapterId: string | null;
  /** MangaDex `translatedLanguage` of the bound UUID; gates the Phase 2b
   * language skip. Null on rows pre-backfill. */
  language: string | null;
}

/** Build the set of chapter numbers Prowlarr packs would deliver, based on
 * coverage parsed from each release title. Volume coverage is left for a
 * follow-up — today we only honor explicit chapter ranges. */
function estimateProwlarrCoverage(prowlarrCandidates: ReleaseCandidate[]): Set<number> {
  const covered = new Set<number>();
  for (const c of prowlarrCandidates) {
    for (const n of c.coverage.chapters) covered.add(n);
  }
  return covered;
}

/** Pick the best native chapter candidate for a given chapter number.
 *
 * Source priority by mediaType (iter-GC):
 *   - MANGA     → MangaDex → Suwayomi   (GetComics excluded; it's Western-only)
 *   - COMICBOOK → GetComics              (MangaDex/Suwayomi excluded; manga-only)
 *
 * iter-EX: `excludeSources` lets callers skip sources that have already
 * failed for this chapter, so a flaky source doesn't keep getting re-picked.
 */
function pickBestNativeForChapter(
  candidates: ReleaseCandidate[],
  chapterNumber: number,
  excludeSources?: ReadonlySet<string>,
  mediaType: 'MANGA' | 'COMICBOOK' = 'MANGA',
): ReleaseCandidate | null {
  const order: ReleaseCandidate['source'][] = mediaType === 'COMICBOOK'
    ? ['getcomics']
    : ['mangadex', 'suwayomi'];
  for (const src of order) {
    if (excludeSources?.has(src)) continue;
    // iter-N2: within a single native source, multiple variants may exist
    // (e.g. MangaDex emits one candidate per translated language). Pick the
    // highest-scored variant so English wins by default but other languages
    // remain a valid fallback when English isn't available.
    //
    // iter-GC2: GetComics emits pack-granularity candidates (every hit on
    // getcomics.org is a TPB/issue-bundle, never per-issue). Accept packs
    // here for the comic path — the enqueue helper resolves the pack URL
    // to the actual file at dispatch time. Empty coverage = "covers the
    // full in-scope chapter set" (same convention as Prowlarr packs whose
    // titles the coverage parser couldn't decode).
    const matches = candidates.filter(c => {
      if (c.source !== src) return false;
      const isComicPack = src === 'getcomics' && c.granularity === 'pack';
      if (isComicPack) return c.coverage.chapters.length === 0 || c.coverage.chapters.includes(chapterNumber);
      return c.granularity === 'chapter' && c.coverage.chapters.includes(chapterNumber);
    });
    if (matches.length === 0) continue;
    return matches.reduce((best, c) => (c.score > best.score ? c : best));
  }
  return null;
}

/** Phase 2b: read MangaDex preferred language from config once per dispatch
 * run. Defaults to 'en' on load failure (matches the metadata pipeline). */
async function loadPreferredLanguage(): Promise<string> {
  try {
    const cfg = await mangadexConfigService.getMetadataConfig();
    const lang = cfg.preferredLanguage.trim();
    return lang.length > 0 ? lang : 'en';
  } catch {
    return 'en';
  }
}

/** Return chapter numbers already in flight (NativeDownload row queued or
 * downloading) so we don't double-enqueue. */
async function readInFlightChapterNumbers(mangaId: number): Promise<Set<number>> {
  const rows = await prisma.nativeDownload.findMany({
    where: {
      mangaId,
      status: { in: [NativeDownloadStatus.QUEUED, NativeDownloadStatus.DOWNLOADING] },
    },
    select: { chapterNumber: true },
  });
  return new Set(rows.map(r => r.chapterNumber));
}

/**
 * Build the Prisma `where` for the chapters this run should consider, given
 * an optional scope. Mirrors the same logic used by `phaseIndexerSearch` so
 * the two functions agree on which chapters are "in scope".
 */
function buildChapterWhere(mangaId: number, scope?: ReleaseScope): Record<string, unknown> {
  const base = { mangaId, downloadStatus: { not: 'COMPLETED' as const } };
  if (!scope || scope.mode === 'ALL_MISSING') {
    return { ...base, monitored: true };
  }
  if ((scope.mode === 'SINGLE' || scope.mode === 'BULK') && scope.chapterIds && scope.chapterIds.length > 0) {
    return { ...base, id: { in: scope.chapterIds } };
  }
  if (scope.mode === 'VOLUME' && scope.volumeNumber !== undefined) {
    return { ...base, volume: scope.volumeNumber };
  }
  log.warn('Invalid scope in dispatcher; falling back to ALL_MISSING semantics', { scope });
  return { ...base, monitored: true };
}

async function loadMissingChapters(
  mangaId: number,
  scope?: ReleaseScope,
): Promise<ChapterStub[]> {
  return prisma.chapter.findMany({
    where: buildChapterWhere(mangaId, scope),
    select: { id: true, chapterNumber: true, volume: true, mangadexId: true, suwayomiChapterId: true, language: true },
  });
}

/**
 * Resolve the absolute on-disk destination for a chapter download, mirroring
 * the resolveDestinationPath() logic in native-download/mangadex-operations.ts:
 *
 *   - Prefer Manga.libraryPath when set.
 *   - Otherwise fall back to <Library.path>/<Manga.title>.
 *   - Returns null when the manga has no resolvable library.
 *
 * The previous /manga/${mangaId}/chapters/${id} path was a virtual placeholder
 * — the downloader treated it as absolute and tried to mkdir at filesystem
 * root, failing with EROFS. Real path now matches what the manual native-
 * download tRPC produces.
 */
export async function resolveChapterDestination(
  mangaId: number,
  chapterNumber: number,
): Promise<string | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: {
      title: true,
      libraryPath: true,
      Library: { select: { path: true } },
    },
  });
  if (!manga) return null;
  // The two-fallback path resolution mirrors native-download/mangadex-
  // operations.ts::resolveLibraryDir. Library is always present in this
  // select shape (manga must be in a library to be downloadable), so we
  // dereference unconditionally; libraryPath overrides when set.
  const baseDir = manga.libraryPath
    ? manga.libraryPath
    : path.join(manga.Library.path, manga.title);
  const formatted = Number.isInteger(chapterNumber)
    ? chapterNumber.toString().padStart(4, '0')
    : chapterNumber.toString();
  return path.join(baseDir, `Chapter ${formatted}.cbz`);
}

async function enqueueMangaDexCandidate(
  candidate: ReleaseCandidate,
  mangaId: number,
): Promise<boolean> {
  const p = candidate.payload as MangaDexCandidatePayload;
  const destinationPath = await resolveChapterDestination(mangaId, p.chapterNumber);
  if (destinationPath === null) {
    log.warn('Skipping MangaDex enqueue: manga has no resolvable library path', {
      mangaId,
      chapterNumber: p.chapterNumber,
    });
    return false;
  }
  const dl = await createActiveNativeDownload({
    mangaId,
    chapterId: p.chapterRowId,
    chapterNumber: p.chapterNumber,
    sourceType: 'MANGADEX',
    destinationPath,
  });
  if (dl === null) return false;
  try {
    await queueManager.enqueue(
      JobType.mangadex_download,
      {
        mangaId,
        downloadId: dl.id,
        mangadexChapterId: p.mangadexChapterId,
        chapterNumber: p.chapterNumber,
        destinationPath,
      },
      // Surface manga/chapter on the FK columns so the Jobs page can join
      // and show the manga title + chapter row instead of "System Task".
      //
      // Bump the retry budget above the default 3/60s: the at-home rate
      // limiter sheds jobs back to the queue under burst (a monitored search
      // enqueues thousands at once), so stragglers need more attempts spread
      // over a wider backoff window to recover instead of hard-failing. With
      // exponential backoff this spans ~11min (45,90,180,360s + jitter),
      // comfortably covering a paced drain.
      {
        mangaId,
        chapterId: p.chapterRowId,
        maxAttempts: 5,
        retryDelaySeconds: 45,
      },
    );
  } catch (err) {
    // queueManager.enqueue runs against the singleton prisma client, so it
    // can't share a transaction with the NativeDownload create above. If
    // it throws (circuit breaker open, queue config missing, DB blip), we
    // would otherwise leave the NativeDownload row orphaned in QUEUED
    // forever — see the B3 backfill that cancelled 244 such rows. Roll
    // back manually instead.
    await prisma.nativeDownload.update({
      where: { id: dl.id },
      data: {
        status: NativeDownloadStatus.CANCELLED,
        error: `Failed to enqueue companion job: ${err instanceof Error ? err.message : String(err)}`,
        endTime: new Date(),
      },
    });
    throw err;
  }
  return true;
}

async function enqueueSuwayomiCandidate(
  candidate: ReleaseCandidate,
  mangaId: number,
): Promise<boolean> {
  const p = candidate.payload as SuwayomiCandidatePayload;
  const destinationPath = await resolveChapterDestination(mangaId, p.chapterNumber);
  if (destinationPath === null) {
    log.warn('Skipping Suwayomi enqueue: manga has no resolvable library path', {
      mangaId,
      chapterNumber: p.chapterNumber,
    });
    return false;
  }
  const dl = await createActiveNativeDownload({
    mangaId,
    chapterId: p.chapterRowId,
    chapterNumber: p.chapterNumber,
    sourceType: 'SUWAYOMI',
    destinationPath,
  });
  if (dl === null) return false;
  try {
    await queueManager.enqueue(
      JobType.suwayomi_download,
      {
        mangaId,
        downloadId: dl.id,
        suwayomiChapterId: p.suwayomiChapterId,
        chapterNumber: p.chapterNumber,
        destinationPath,
      },
      // Surface manga/chapter on the FK columns so the Jobs page can join
      // and show the manga title + chapter row instead of "System Task".
      { mangaId, chapterId: p.chapterRowId },
    );
  } catch (err) {
    // Mirror the MangaDex path: roll back the NativeDownload row when
    // enqueue fails so we don't leave QUEUED orphans (B3).
    await prisma.nativeDownload.update({
      where: { id: dl.id },
      data: {
        status: NativeDownloadStatus.CANCELLED,
        error: `Failed to enqueue companion job: ${err instanceof Error ? err.message : String(err)}`,
        endTime: new Date(),
      },
    });
    throw err;
  }
  return true;
}

/**
 * Create a NativeDownload row + enqueue the appropriate JobType. Returns true
 * when an enqueue actually happened, false when the candidate was skipped
 * (e.g. unresolvable library path, unsupported source). Caller must
 * pre-filter by `readInFlightChapterNumbers` to honor idempotency.
 */
async function enqueueNativeCandidate(
  candidate: ReleaseCandidate,
  mangaId: number,
): Promise<boolean> {
  if (candidate.source === 'mangadex') {
    return enqueueMangaDexCandidate(candidate, mangaId);
  }
  if (candidate.source === 'suwayomi') {
    return enqueueSuwayomiCandidate(candidate, mangaId);
  }
  // GetComics: stub — adapter returns no candidates today.
  log.warn('Skipping unsupported native candidate', { source: candidate.source });
  return false;
}

interface DispatchContext {
  mangaId: number;
  missing: ChapterStub[];
  candidates: ReleaseCandidate[];
  prowlarrCoverage: Set<number>;
  inFlight: Set<number>;
  /**
   * iter-EX: per-chapter set of sources that have failed in the lookback
   * window. `pickBestNativeForChapter` skips entries in the set so we
   * automatically try the next-best source on the next dispatch.
   */
  failedSourcesByChapterId: Map<number, Set<string>>;
  /**
   * iter-GC: routing discriminator. Controls which native sources
   * `pickBestNativeForChapter` even considers. Defaults to 'MANGA' for
   * unenriched rows so we never accidentally route Japanese works
   * through GetComics.
   */
  mediaType: 'MANGA' | 'COMICBOOK';
  /** Phase 2b: MangaDex preferred language (e.g. 'en'). Loaded once via
   * `mangadexConfigService.getMetadataConfig()`. `fillNativeForChapter`
   * skips MangaDex when `Chapter.language` doesn't match. */
  preferredLanguage: string;
  /**
   * Global `download.mode` preference (mix / prefer-volume / prefer-chapter).
   * Loaded once via `loadDownloadMode()`. Read by Prowlarr scoring to bias
   * volume-pack vs chapter-granularity releases, and by `fillNativeForChapter`
   * to flip the native-vs-Prowlarr coverage yield when `prefer-chapter`.
   */
  downloadMode: DownloadModePreference;
}

/**
 * Pull the in-scope chapter numbers (i.e., `chapterNumber` for missing
 * chapters that have one). Used by manual-Prowlarr dispatch to filter
 * pack candidates by overlap with scope.
 */
function chapterNumbersInScope(missing: ChapterStub[]): Set<number> {
  const out = new Set<number>();
  for (const ch of missing) {
    if (ch.chapterNumber !== null) out.add(ch.chapterNumber);
  }
  return out;
}

/** Volume numbers in scope, derived from the missing-chapters' volume field. */
function volumesInScope(missing: ChapterStub[]): Set<number> {
  const out = new Set<number>();
  for (const ch of missing) {
    if (ch.volume !== null) out.add(ch.volume);
  }
  return out;
}

/**
 * Load the canonical title + synonyms for a manga. Used as the
 * title-relevance vocabulary against Prowlarr release titles (Prowlarr
 * fuzzy-matches on title, so unrelated releases regularly leak into the
 * candidate pool — e.g. an anime episode showing up for a similarly-named
 * manga). Returns an empty array on lookup failure; callers fall through
 * to the looser "no relevance check" behaviour in that case.
 */
async function loadMangaTitles(mangaId: number): Promise<string[]> {
  try {
    const row = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { title: true, Metadata: { select: { synonyms: true } } },
    });
    if (!row) return [];
    const synonyms = row.Metadata?.synonyms ?? [];
    return [row.title, ...synonyms].filter((t): t is string => typeof t === 'string' && t.length > 0);
  } catch (err: unknown) {
    log.warn('loadMangaTitles failed; title-relevance check will be skipped', {
      mangaId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Manual Prowlarr dispatch for explicit user scopes (SINGLE / VOLUME / BULK).
 *
 * Differs from {@link maybeTriggerProwlarr}: that function fires the legacy
 * `autoDownloadScheduler.triggerManga(mangaId)` which re-searches Prowlarr
 * with no scope awareness. This function instead reuses the candidates we
 * already fetched, filters them to scope, applies the user's criteria,
 * picks the best, and dispatches via DownloadManager directly.
 */
interface ManualScopeBundle {
  /** Chapter numbers (Chapter.chapterNumber) the user requested. */
  chapters: Set<number>;
  /** Volume numbers covered by the requested chapters. */
  volumes: Set<number>;
  /** Chapter row ids (Chapter.id) the request targets — passed to DownloadManager. */
  chapterIds: number[];
  /** Manga canonical title + synonyms — used for Prowlarr title-relevance check. */
  titles: string[];
}

async function dispatchProwlarrManual(
  ctx: DispatchContext,
  prowlarrCandidates: ReleaseCandidate[],
  scope: ManualScopeBundle,
  criteria: QuickDownloadCriteria,
): Promise<ProwlarrDispatchOutcome | null> {
  const { chapters: inScopeChapters, volumes: inScopeVolumes, chapterIds: scopedChapterIds, titles } = scope;
  const filtered = filterProwlarrCandidatesToScope(prowlarrCandidates, titles, inScopeChapters, inScopeVolumes);
  if (filtered.length === 0) {
    log.info('Manual Prowlarr: no candidates cover the requested scope', {
      mangaId: ctx.mangaId,
      candidates: prowlarrCandidates.length,
    });
    return null;
  }

  const releases = filtered.map(c => c.payload as ProwlarrSearchResult);
  // Score + sort under the default specs, then apply the global mode bias
  // (mix → no-op; prefer-volume/-chapter → re-rank by title-shape delta).
  const scored = scoreAndSortResults(releases, criteria);
  const reranked = applyModeBias(scored, ctx.downloadMode);
  const selected = selectBestResult(reranked);
  if (!selected) {
    log.info('Manual Prowlarr: scoring rejected every candidate', {
      mangaId: ctx.mangaId,
      candidates: filtered.length,
    });
    return null;
  }

  // Coverage MUST be computed BEFORE dispatch so we can pass only the
  // chapters this pack actually covers to processDownloadRequest. The
  // downloader otherwise (1) flips every passed chapterId to DOWNLOADING
  // and (2) tags every one to this packDownloadId — which hides the
  // uncovered chapters from the next loadMissingChapters poll and
  // prevents the next dispatcher cycle from picking a complementary
  // pack for them.
  //
  // Coverage derivation:
  //   - Explicit chapter list (e.g. "Ch.1-60") → intersect with scope.
  //   - Volume-only pack (e.g. "Vol. 08") → look up which chapter numbers
  //     belong to those volumes in the DB, intersect with scope.
  //   - Both empty → unparseable. Credit the full scope (legacy behavior)
  //     and rely on the post-import reconciliation pass in
  //     pack-import-handler.ts to free any chapter the archive didn't
  //     actually deliver. Crediting zero here would just create duplicate
  //     downloads via parallel dispatchers in the unparseable case.
  const selectedCandidate = selected.result.title
    ? filtered.find(c => (c.payload as ProwlarrSearchResult).title === selected.result.title)
    : undefined;
  const packChapters = selectedCandidate?.coverage.chapters ?? [];
  const packVolumes = selectedCandidate?.coverage.volumes ?? [];
  let coveredNumbers: number[];
  let coverageSource: 'explicit-chapters' | 'volume-lookup' | 'full-scope-fallback';
  if (packChapters.length > 0) {
    coveredNumbers = packChapters.filter(n => inScopeChapters.has(n));
    coverageSource = 'explicit-chapters';
  } else if (packVolumes.length > 0) {
    const volChapters = await prisma.chapter.findMany({
      where: {
        mangaId: ctx.mangaId,
        volume: { in: packVolumes },
        chapterNumber: { not: null },
      },
      select: { chapterNumber: true },
    });
    coveredNumbers = volChapters
      .map(c => c.chapterNumber)
      .filter((n): n is number => n !== null && inScopeChapters.has(n));
    coverageSource = 'volume-lookup';
  } else {
    coveredNumbers = [...inScopeChapters];
    coverageSource = 'full-scope-fallback';
  }

  // Map covered chapter NUMBERS back to Chapter row IDs in this scope.
  // These are the only IDs we hand to processDownloadRequest so the
  // downloader flips JUST those to DOWNLOADING + packDownloadId. The
  // remainder of scopedChapterIds stay PENDING for the next dispatch.
  const coveredChapterIds = coveredNumbers.length === 0
    ? []
    : (await prisma.chapter.findMany({
        where: {
          id: { in: scopedChapterIds },
          chapterNumber: { in: coveredNumbers },
        },
        select: { id: true },
      })).map(c => c.id);
  // Safety: if number→id mapping yielded nothing (every covered chapter
  // somehow fell out of scope), don't issue a zero-chapter dispatch —
  // fall back to the full scope so the pack still goes through, and let
  // post-import reconciliation clean up.
  const dispatchChapterIds = coveredChapterIds.length > 0 ? coveredChapterIds : scopedChapterIds;

  const downloadManager = new DownloadManager();
  const dispatch = await downloadManager.processDownloadRequest({
    mangaId: ctx.mangaId,
    chapterIds: dispatchChapterIds,
    method: DownloadMethod.PROWLARR,
    mode: DownloadMode.BULK,
    prowlarrResult: selected.result,
  });

  if (isError(dispatch)) {
    log.warn('Manual Prowlarr dispatch failed', {
      mangaId: ctx.mangaId,
      releaseTitle: selected.result.title,
      error: dispatch.error.message,
    });
    return null;
  }

  const covered = coveredNumbers;

  log.info('Manual Prowlarr dispatch issued', {
    mangaId: ctx.mangaId,
    releaseTitle: selected.result.title,
    indexer: selected.result.indexerName,
    score: selected.score,
    coveredChapters: covered.length,
    dispatchedChapterIdCount: dispatchChapterIds.length,
    coverageSource,
  });

  // iter-D1 + iter-EX: telemetry writes (coverage-claim + per-chapter
  // source history). Fire-and-forget; never breaks dispatch on failure.
  recordProwlarrDispatch({
    mangaId: ctx.mangaId,
    releaseTitle: selected.result.title,
    indexer: selected.result.indexerName,
    claimedVolumes: packVolumes,
    claimedChapters: packChapters,
    scopedChapterIds,
  });

  return {
    releaseTitle: selected.result.title,
    indexer: selected.result.indexerName,
    score: selected.score,
    coveredChapters: covered,
  };
}

/** Trigger the legacy Prowlarr path (fire-and-forget) when any Prowlarr
 * candidates exist. Returns whether the trigger was issued. */
function maybeTriggerProwlarr(
  ctx: DispatchContext,
  prowlarrCandidates: ReleaseCandidate[],
): boolean {
  if (prowlarrCandidates.length === 0) return false;
  log.info('Pack-first: triggering legacy Prowlarr dispatch', {
    mangaId: ctx.mangaId,
    prowlarrCandidates: prowlarrCandidates.length,
    estimatedCoverage: ctx.prowlarrCoverage.size,
  });
  // Lazy import: breaks autoDownloadWorker→DownloadManager→retry→dispatch→scheduler cycle.
  void import('@/server/queue/autoDownloadScheduler')
    .then(({ autoDownloadScheduler }) => autoDownloadScheduler.triggerManga(ctx.mangaId))
    .catch((err: unknown) => log.error('Prowlarr dispatch failed; native fill-in still applies', {
      mangaId: ctx.mangaId, error: err instanceof Error ? err.message : String(err),
    }));
  return true;
}

/** Phase 2b: expand the iter-EX `failedSourcesByChapterId` set with sources
 * we want to skip *up-front* for this chapter — currently just MangaDex
 * when the chapter's bound UUID is in a non-preferred language. Records a
 * `language_mismatch` ChapterDispatchAttempt so the skip is auditable. */
function computeExcludedSources(ctx: DispatchContext, ch: ChapterStub): Set<string> {
  const base = ctx.failedSourcesByChapterId.get(ch.id) ?? new Set<string>();
  if (ch.language && !isPreferredLanguage(ch.language, ctx.preferredLanguage)) {
    const merged = new Set(base);
    merged.add('mangadex');
    recordDispatchSkip({
      chapterId: ch.id, mangaId: ctx.mangaId, source: 'mangadex',
      reason: `bound UUID is ${ch.language}; preferred=${ctx.preferredLanguage}`,
    });
    return merged;
  }
  return base;
}

/** For each chapter not covered by Prowlarr or already in flight, enqueue
 * the best native candidate. Mutates `summary` with results. */
async function fillNativeForChapter(
  ctx: DispatchContext, ch: ChapterStub, summary: DispatchSummary,
): Promise<void> {
  if (ch.chapterNumber === null) return;
  // iter-GC2: for COMICBOOK, GetComics is the primary native — skip the
  // Prowlarr-coverage pre-empt so the comic source gets first shot. The
  // post-fillNativeGaps Prowlarr dispatch still runs for chapters native
  // didn't enqueue, matching the user-chosen "GetComics first, then Prowlarr".
  //
  // download.mode prefer-chapter: same effect as the COMICBOOK branch — never
  // yield to Prowlarr coverage. Native (chapter-granularity) sources always
  // get first crack, and Prowlarr fills only what native couldn't enqueue.
  // mix and prefer-volume keep the legacy yield-to-Prowlarr behavior, so
  // pack candidates still claim their chapters as today.
  const yieldToProwlarr = ctx.mediaType !== 'COMICBOOK' && ctx.downloadMode !== 'prefer-chapter';
  if (yieldToProwlarr && ctx.prowlarrCoverage.has(ch.chapterNumber)) return;
  if (ctx.inFlight.has(ch.chapterNumber)) return;
  const excluded = computeExcludedSources(ctx, ch);
  const best = pickBestNativeForChapter(ctx.candidates, ch.chapterNumber, excluded, ctx.mediaType);
  if (!best) {
    summary.uncoveredChapters.push(ch.chapterNumber);
    if (excluded.size > 0) emitChapterExhausted({
      mangaId: ctx.mangaId, chapterId: ch.id, chapterNumber: ch.chapterNumber, failedSources: excluded,
    });
    return;
  }
  const enqueued = await (best.source === 'getcomics' ? enqueueGetComicsCandidate(best, ctx.mangaId, ch.id, ch.chapterNumber) : enqueueNativeCandidate(best, ctx.mangaId)).catch(err => {
    log.warn('Native enqueue failed', {
      mangaId: ctx.mangaId, chapterNumber: ch.chapterNumber, source: best.source,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  });
  if (enqueued) {
    summary.nativeEnqueued.push({ chapterNumber: ch.chapterNumber, source: best.source });
    recordDispatchAttempt({ chapterId: ch.id, mangaId: ctx.mangaId, source: best.source });
  } else {
    summary.uncoveredChapters.push(ch.chapterNumber);
  }
}

async function fillNativeGaps(ctx: DispatchContext, summary: DispatchSummary): Promise<void> {
  for (const ch of ctx.missing) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential enqueue to honor unique constraints
    await fillNativeForChapter(ctx, ch, summary);
  }
}

/**
 * Iterate the Prowlarr pack picker until the missing-chapter pool is empty,
 * no candidate fits, or we hit the safety cap. Extracted from
 * {@link runUnifiedReleaseSearch} to keep that function's complexity in budget.
 *
 * Why iterate: a 62-chapter backlog with 48 candidate packs got 1 pack
 * (~4 chapters) dispatched per call (the old behavior) and ~15h to finish.
 * Iterating queues every complementary pack in ~6-10s and propagates the
 * new coverage into ctx.prowlarrCoverage so downstream telemetry is accurate.
 *
 * Safety: MAX_PACKS_PER_CALL caps runaway dispatches; dispatchedTitles
 * dedupes packs across iterations so we don't redispatch the same magnet
 * when its volumes only partially overlap the reduced scope.
 */
interface IterateDispatchResult {
  triggered: boolean;
  coveredChapters: number[];
  /** First (highest-scoring) pack picked — null when no iteration dispatched anything. */
  selected: ProwlarrDispatchOutcome | null;
}

async function iterateProwlarrManualDispatch(
  ctx: DispatchContext,
  prowlarrCands: ReleaseCandidate[],
  missing: ChapterStub[],
  nativeEnqueued: DispatchSummary['nativeEnqueued'],
  criteriaOverride: Partial<QuickDownloadCriteria> | undefined,
): Promise<IterateDispatchResult> {
  const empty: IterateDispatchResult = { triggered: false, coveredChapters: [], selected: null };
  const nativeCoveredNums = new Set(nativeEnqueued.map(n => n.chapterNumber));
  let remainingMissing = missing.filter(m =>
    m.chapterNumber === null || !nativeCoveredNums.has(m.chapterNumber));
  if (remainingMissing.length === 0) return empty;
  const titles = await loadMangaTitles(ctx.mangaId);
  const effectiveCriteria: QuickDownloadCriteria = {
    ...DEFAULT_QUICK_DOWNLOAD_CRITERIA,
    ...criteriaOverride,
  };
  const MAX_PACKS_PER_CALL = 20;
  const dispatchedTitles = new Set<string>();
  const aggregatedCovered: number[] = [];
  let firstOutcome: ProwlarrDispatchOutcome | null = null;
  for (let iter = 0; iter < MAX_PACKS_PER_CALL && remainingMissing.length > 0; iter += 1) {
    const eligibleCands = prowlarrCands.filter(c => {
      const title = (c.payload as ProwlarrSearchResult).title;
      return typeof title === 'string' && !dispatchedTitles.has(title);
    });
    if (eligibleCands.length === 0) break;
    const inScope = chapterNumbersInScope(remainingMissing);
    const inScopeVolumes = volumesInScope(remainingMissing);
    const scopedChapterIds = remainingMissing.map(m => m.id);
    // Sequential dispatch by design: each iteration mutates chapter status
    // (DOWNLOADING + packDownloadId) that the next iteration's scope filter
    // must observe.
    // eslint-disable-next-line no-await-in-loop
    const outcome = await dispatchProwlarrManual(
      ctx,
      eligibleCands,
      { chapters: inScope, volumes: inScopeVolumes, chapterIds: scopedChapterIds, titles },
      effectiveCriteria,
    );
    if (!outcome) break;
    firstOutcome ??= outcome;
    if (outcome.releaseTitle !== undefined) dispatchedTitles.add(outcome.releaseTitle);
    for (const n of outcome.coveredChapters) {
      aggregatedCovered.push(n);
      ctx.prowlarrCoverage.add(n);
    }
    const coveredSet = new Set(outcome.coveredChapters);
    remainingMissing = remainingMissing.filter(m =>
      m.chapterNumber === null || !coveredSet.has(m.chapterNumber));
  }
  return firstOutcome === null
    ? empty
    : { triggered: true, coveredChapters: aggregatedCovered, selected: firstOutcome };
}

/**
 * Run the unified release search for one manga. Returns a {@link DispatchSummary}
 * describing what was triggered. Callers (post-enrichment hook, manual UI,
 * scheduler) treat the summary as advisory and never gate on it.
 *
 * @param mangaId  Manga to search for
 * @param options  Optional narrowing: scope (manual SINGLE/VOLUME/BULK) and
 *                 `bypassRuleCheck` (skip the autoDownloadRule.enabled gate).
 */
export async function runUnifiedReleaseSearch(
  mangaId: number,
  options: RunOptions = {},
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    mangaId,
    triggeredProwlarr: false,
    prowlarrCoveredChapters: [],
    nativeEnqueued: [],
    uncoveredChapters: [],
  };

  if (!options.bypassRuleCheck) {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { autoDownloadRule: { select: { enabled: true } } },
    });
    if (manga?.autoDownloadRule?.enabled !== true) {
      log.info('Skipping run: autoDownloadRule disabled', { mangaId });
      return summary;
    }
  }

  const missing = await loadMissingChapters(mangaId, options.scope);
  if (missing.length === 0) {
    log.info('Skipping run: no chapters in scope', {
      mangaId,
      scope: options.scope?.mode ?? 'ALL_MISSING',
    });
    return summary;
  }

  const candidates = await phaseIndexerSearch(
    mangaId,
    options.scope ? { scope: options.scope } : undefined,
  );

  // Bridge the silent gap between indexer-search returning and the dispatch
  // loop completing. The toast otherwise freezes on the last per-source
  // count for several seconds on bulk runs (e.g. 153 chapters), which looks
  // identical to a hung request. mangaTitle is intentionally omitted —
  // `runUnifiedReleaseSearch` doesn't have it handy and the hook routes by
  // mangaId; the field is display-only.
  void realtimeEmitter.emitSearchProgress({
    mangaId,
    phase: 'dispatching',
    message: `Dispatching ${missing.length} chapter${missing.length === 1 ? '' : 's'} across enabled clients…`,
    totalCount: missing.length,
    resultCount: candidates.length,
  });

  const prowlarrCands = candidates.filter(c => c.source === 'prowlarr');
  const prowlarrCoverage = estimateProwlarrCoverage(prowlarrCands);
  const [inFlight, failedSourcesByChapterId, mediaType, preferredLanguage, downloadMode] = await Promise.all([
    readInFlightChapterNumbers(mangaId),
    loadFailedSourcesForManga(mangaId),
    loadDispatchMediaType(mangaId),
    loadPreferredLanguage(),
    loadDownloadMode(),
  ]);
  const ctx: DispatchContext = {
    mangaId, missing, candidates, prowlarrCoverage, inFlight, failedSourcesByChapterId, mediaType,
    preferredLanguage, downloadMode,
  };

  // iter-N native-first ordering (2026-05-10, manual-scope only): native
  // sources (mangadex/suwayomi/getcomics) ran in parallel during phase
  // search; enqueue every chapter they can cover BEFORE Prowlarr's manual
  // dispatch so Prowlarr only handles the residual.
  // Why: the iter-11 per-source breakdown showed mangadex 100% reliable
  // (2/2 readable) vs Prowlarr 13% (2/15) on the same sample. The legacy
  // ordering had Prowlarr claim coverage first and fillNativeGaps just
  // backfilled, which throws away the native-source reliability for any
  // chapter Prowlarr nominally covered. The legacy ALL_MISSING path is
  // unchanged — that path runs the Prowlarr scheduler anyway and doesn't
  // surface a per-chapter dispatch summary.
  const isManualScope = options.scope !== undefined && options.scope.mode !== 'ALL_MISSING';
  if (isManualScope) {
    await fillNativeGaps(ctx, summary);
    // Mark native-covered chapters in prowlarrCoverage so the subsequent
    // Prowlarr dispatch's filter naturally skips them (cleanest reuse of
    // the existing in-scope helpers without changing their signature).
    for (const enq of summary.nativeEnqueued) ctx.prowlarrCoverage.add(enq.chapterNumber);
  }

  if (!isManualScope) {
    summary.triggeredProwlarr = maybeTriggerProwlarr(ctx, prowlarrCands);
    summary.prowlarrCoveredChapters = [...prowlarrCoverage];
  } else if (prowlarrCands.length > 0) {
    const result = await iterateProwlarrManualDispatch(
      ctx, prowlarrCands, missing, summary.nativeEnqueued, options.criteria,
    );
    if (result.selected !== null) {
      summary.triggeredProwlarr = true;
      summary.prowlarrCoveredChapters = result.coveredChapters;
      // prowlarrSelected mirrors the first (highest-scoring) pack — gives the
      // UI a single representative title to render even when many packs were
      // dispatched in this call.
      summary.prowlarrSelected = {
        ...(result.selected.releaseTitle !== undefined ? { releaseTitle: result.selected.releaseTitle } : {}),
        ...(result.selected.indexer !== undefined ? { indexer: result.selected.indexer } : {}),
        ...(result.selected.score !== undefined ? { score: result.selected.score } : {}),
      };
    }
  }

  // Trailing fill is now defensive only (covers ALL_MISSING auto-trigger
  // semantics where native didn't run first). For manual scope, the
  // pre-Prowlarr fillNativeGaps above already enqueued everything native
  // could cover, so this is a noop.
  if (!isManualScope) await fillNativeGaps(ctx, summary);

  log.info('Unified release search complete', { ...summary, scope: options.scope?.mode ?? 'ALL_MISSING' });
  return summary;
}

/** Public surface for callers that want a stable handle. */
export const unifiedReleaseSearch = {
  run: runUnifiedReleaseSearch,
};
