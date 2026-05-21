/**
 * iter-EX — Per-chapter per-source dispatch history helpers.
 *
 * Extracted from dispatch.ts to keep that file under 500 lines.
 * - `loadFailedSourcesForManga` builds the read-side guard map so
 *   `pickBestNativeForChapter` can skip sources that have already
 *   failed for a given chapter.
 * - `recordDispatchAttempt` is a fire-and-forget write of the dispatch
 *   event; the periodic resolver in chapter-manager.ts resolves the
 *   outcome later by checking the chapter's eventual state.
 */
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

const EXHAUSTION_LOOKBACK_DAYS = 7;

export type DispatchMediaType = 'MANGA' | 'COMICBOOK';

/**
 * iter-GC: routing discriminator for a manga. Defaults to MANGA when
 * the row is missing or the column is unset so unenriched works never
 * accidentally route through GetComics.
 */
export async function loadDispatchMediaType(mangaId: number): Promise<DispatchMediaType> {
  const row = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { mediaType: true },
  });
  return row?.mediaType === 'COMICBOOK' ? 'COMICBOOK' : 'MANGA';
}

const log = {
  warn: (msg: string, meta?: Record<string, unknown>): void => {
    logger.warn(`[dispatch-attempt] ${msg}`, meta ?? {});
  },
};

/**
 * Load each chapter's set of sources that failed in the last
 * EXHAUSTION_LOOKBACK_DAYS days. Keyed by chapterId.
 */
export async function loadFailedSourcesForManga(
  mangaId: number,
): Promise<Map<number, Set<string>>> {
  const cutoff = new Date(Date.now() - EXHAUSTION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.chapterDispatchAttempt.findMany({
    where: { mangaId, outcome: 'failed', createdAt: { gte: cutoff } },
    select: { chapterId: true, source: true },
  });
  const out = new Map<number, Set<string>>();
  for (const r of rows) {
    const set = out.get(r.chapterId) ?? new Set<string>();
    set.add(r.source);
    out.set(r.chapterId, set);
  }
  return out;
}

export interface DispatchAttemptArgs {
  chapterId: number;
  mangaId: number;
  source: string;
  releaseTitle?: string;
  indexer?: string;
  jobId?: bigint;
}

export interface ChapterExhaustedArgs {
  mangaId: number;
  chapterId: number;
  chapterNumber: number;
  failedSources: Set<string>;
}

/**
 * Emit the exhaustion signal: warn-log + realtime event. Called when
 * `pickBestNativeForChapter` returns null AND the chapter has prior
 * failed-source attempts AND Prowlarr didn't cover it either.
 */
export function emitChapterExhausted(args: ChapterExhaustedArgs): void {
  log.warn('Chapter dispatch exhausted — every tried source has failed', {
    mangaId: args.mangaId, chapterId: args.chapterId, chapterNumber: args.chapterNumber,
    failedSources: [...args.failedSources],
  });
  void realtimeEmitter.emitSystemEvent({
    eventType: 'download:chapter:exhausted',
    source: 'releaseDispatcher',
    message: `Chapter ${args.chapterNumber} has exhausted every known source`,
    data: {
      mangaId: args.mangaId, chapterId: args.chapterId, chapterNumber: args.chapterNumber,
      failedSources: [...args.failedSources],
    },
  });
}

/**
 * Fire-and-forget write of a dispatch attempt row. Resolved later by the
 * periodic resolver to set the outcome from the chapter's eventual state
 * (COMPLETED / re-PENDING / orphan).
 */
export function recordDispatchAttempt(args: DispatchAttemptArgs): void {
  void prisma.chapterDispatchAttempt.create({
    data: {
      chapterId: args.chapterId,
      mangaId: args.mangaId,
      source: args.source,
      releaseTitle: args.releaseTitle ?? null,
      indexer: args.indexer ?? null,
      jobId: args.jobId ?? null,
      outcome: 'dispatched',
    },
  }).catch((err: unknown) => {
    log.warn('Failed to write ChapterDispatchAttempt', {
      mangaId: args.mangaId, chapterId: args.chapterId, source: args.source, err,
    });
  });
}

interface SkipAttemptArgs {
  chapterId: number;
  mangaId: number;
  source: string;
  reason: string;
}

/**
 * Fire-and-forget write of a dispatch *skip* — a source that was considered
 * for this chapter but ruled out before a job was enqueued (e.g. the bound
 * MangaDex UUID is in a non-preferred language, so we skip MangaDex and let
 * Prowlarr take over).
 *
 * Outcome is a free `String` column so we don't need a schema migration to
 * introduce new values. Resolver ignores rows with `resolvedAt IS NOT NULL`,
 * so we pre-resolve them with `now()` — the chapter never actually got
 * dispatched through this source, no transition to wait for.
 */
export function recordDispatchSkip(args: SkipAttemptArgs): void {
  void prisma.chapterDispatchAttempt.create({
    data: {
      chapterId: args.chapterId,
      mangaId: args.mangaId,
      source: args.source,
      outcome: 'language_mismatch',
      failureReason: args.reason,
      resolvedAt: new Date(),
    },
  }).catch((err: unknown) => {
    log.warn('Failed to write ChapterDispatchAttempt (skip)', {
      mangaId: args.mangaId, chapterId: args.chapterId, source: args.source, err,
    });
  });
}

/**
 * Hard-reset the dispatch-attempt ledger for every ERROR chapter in a manga,
 * optionally narrowed to a single volume. The 7-day exhaustion lookback in
 * `loadFailedSourcesForManga` is what keeps a previously-failed chapter from
 * being retried automatically; nuking those rows is the only way to give
 * dispatch a clean slate without re-identifying metadata (which deletes stub
 * chapters and re-binds providers).
 *
 * Returns the IDs of chapters whose attempts were cleared so the caller can
 * flip them from ERROR → PENDING in the same transaction boundary it chooses.
 */
export async function clearFailedAttemptsForManga(
  mangaId: number,
  volumeNumber?: number,
): Promise<number[]> {
  const errorChapters = await prisma.chapter.findMany({
    where: {
      mangaId,
      downloadStatus: 'ERROR',
      ...(volumeNumber !== undefined ? { volume: volumeNumber } : {}),
    },
    select: { id: true },
  });
  const chapterIds = errorChapters.map(c => c.id);
  if (chapterIds.length === 0) return [];
  await prisma.chapterDispatchAttempt.deleteMany({
    where: { chapterId: { in: chapterIds } },
  });
  return chapterIds;
}

/**
 * Single-chapter variant of {@link clearFailedAttemptsForManga} — used by the
 * Actions-column retry button on a single ERROR row. Returns true if the row
 * existed in ERROR and had its attempts cleared, false otherwise (so the
 * caller can skip the chapter status flip + dispatch when there's nothing to
 * do).
 */
export async function clearFailedAttemptsForChapter(chapterId: number): Promise<boolean> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, downloadStatus: true },
  });
  if (chapter?.downloadStatus !== 'ERROR') return false;
  await prisma.chapterDispatchAttempt.deleteMany({ where: { chapterId } });
  return true;
}

/**
 * Combined write helper for a Prowlarr release dispatch: emits both the
 * iter-D1 `ProwlarrCoverageAttempt` (claim row for the coverage-parser
 * loop) AND the iter-EX `ChapterDispatchAttempt` rows (per-chapter source
 * history for the exhaustion guard). Pulled into one helper so dispatch.ts
 * stays under the file-size cap.
 */
export function recordProwlarrDispatch(args: {
  mangaId: number;
  releaseTitle: string;
  indexer: string;
  claimedVolumes: number[];
  claimedChapters: number[];
  scopedChapterIds: number[];
}): void {
  void prisma.prowlarrCoverageAttempt.create({
    data: {
      mangaId: args.mangaId,
      releaseTitle: args.releaseTitle,
      indexer: args.indexer,
      claimedVolumes: args.claimedVolumes,
      claimedChapters: args.claimedChapters,
      scopedChapterIds: args.scopedChapterIds,
      status: 'claimed',
    },
  }).catch((err: unknown) => {
    log.warn('Failed to write ProwlarrCoverageAttempt', { mangaId: args.mangaId, err });
  });
  for (const chapterId of args.scopedChapterIds) {
    recordDispatchAttempt({
      chapterId, mangaId: args.mangaId, source: 'prowlarr',
      releaseTitle: args.releaseTitle, indexer: args.indexer,
    });
  }
}
