/**
 * Chapter Manager Module
 *
 * Manage chapter download statuses and job updates.
 * Uses Prisma updateMany to avoid await-in-loop violations.
 *
 * Extracted from: downloadMonitor.ts (lines 161-169, 247-268)
 * Created: 2025-11-21
 */

import fs from 'fs/promises';
import path from 'path';

import { countPagesInArchive } from '@/server/services/download/fileImporter/page-counter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/**
 * Fetch chapters that are currently downloading
 * For PACK mode, returns empty array (chapters created during import)
 *
 * @param prisma - Prisma client instance
 * @param mangaId - Manga ID to fetch chapters for
 * @param isPack - Whether this is a PACK mode download
 * @returns AsyncResult containing array of chapter IDs
 */
export async function fetchDownloadingChapters(
  prisma: PrismaClient,
  mangaId: number,
  isPack: boolean
): Promise<AsyncResult<number[], Error>> {
  try {
    if (isPack) {
      logger.info(`[DownloadMonitor] PACK mode - chapters will be created during import`);
      return createSuccessResult([]);
    }

    // Lines 161-169 from source
    const downloadingChapters = await prisma.chapter.findMany({
      where: {
        mangaId,
        downloadStatus: 'DOWNLOADING'
      },
      select: {
        id: true
      }
    });

    return createSuccessResult(downloadingChapters.map(ch => ch.id));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DownloadMonitor] Failed to fetch downloading chapters:', error);
    return createErrorResult(err);
  }
}

/**
 * Update chapters to COMPLETED status
 * Uses updateMany to avoid await-in-loop
 *
 * @param prisma - Prisma client instance
 * @param chapterIds - Array of chapter IDs to update
 * @param mangaId - Optional manga ID for WebSocket emission
 * @returns AsyncResult indicating success or failure
 */
export async function updateChaptersToCompleted(
  prisma: PrismaClient,
  chapterIds: number[],
  mangaId?: number
): Promise<AsyncResult<void, Error>> {
  try {
    if (chapterIds.length === 0) {
      return createSuccessResult(undefined);
    }

    await prisma.chapter.updateMany({
      where: { id: { in: chapterIds } },
      data: { downloadStatus: 'COMPLETED' }
    });

    logger.info(`[DownloadMonitor] Updated ${chapterIds.length} chapters to COMPLETED status`);

    // Emit WebSocket event for real-time sync
    if (mangaId !== undefined) {
      void realtimeEmitter.emitChapterUpdate({
        chapterId: 0, // Batch update indicator
        mangaId,
        action: 'downloaded',
        data: { chapterIds }
      });
    }

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DownloadMonitor] Failed to update chapters to COMPLETED:', error);
    return createErrorResult(err);
  }
}

/**
 * Update chapters to ERROR status
 * Uses updateMany to avoid await-in-loop
 *
 * Lines 247-254 from source
 *
 * @param prisma - Prisma client instance
 * @param chapterIds - Array of chapter IDs to update
 * @param mangaId - Optional manga ID for WebSocket emission
 * @returns AsyncResult indicating success or failure
 */
export async function updateChaptersToError(
  prisma: PrismaClient,
  chapterIds: number[],
  mangaId?: number
): Promise<AsyncResult<void, Error>> {
  try {
    if (chapterIds.length === 0) {
      return createSuccessResult(undefined);
    }

    await prisma.chapter.updateMany({
      where: {
        id: { in: chapterIds }
      },
      data: {
        downloadStatus: 'ERROR'
      }
    });

    logger.info(`[DownloadMonitor] Updated ${chapterIds.length} chapters to ERROR status`);

    // Emit WebSocket event for real-time sync
    if (mangaId !== undefined) {
      void realtimeEmitter.emitChapterUpdate({
        chapterId: 0, // Batch update indicator
        mangaId,
        action: 'failed',
        data: { chapterIds }
      });
    }

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DownloadMonitor] Failed to update chapters to ERROR:', error);
    return createErrorResult(err);
  }
}

/**
 * Reset chapters back to PENDING after a soft-failure (e.g. torrent stalled
 * or 0-seeder). Used by `torrent-health.handleProgressFailure` instead of
 * `updateChaptersToError` so the rows stay eligible for the next dispatch
 * pass. The job itself remains `failed` on the jobs table — that is the
 * audit trail; chapter rows just shouldn't be terminal.
 *
 * Same call shape as `updateChaptersToError` so the swap is a one-line
 * change at the call site.
 */
export async function resetChaptersToPending(
  prisma: PrismaClient,
  chapterIds: number[],
  mangaId?: number
): Promise<AsyncResult<void, Error>> {
  try {
    if (chapterIds.length === 0) {
      return createSuccessResult(undefined);
    }

    await prisma.chapter.updateMany({
      where: { id: { in: chapterIds } },
      data: { downloadStatus: 'PENDING' }
    });

    logger.info(`[DownloadMonitor] Reset ${chapterIds.length} chapters to PENDING after soft-failure`);

    if (mangaId !== undefined) {
      void realtimeEmitter.emitChapterUpdate({
        chapterId: 0,
        mangaId,
        action: 'failed',
        data: { chapterIds }
      });
    }

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DownloadMonitor] Failed to reset chapters to PENDING:', error);
    return createErrorResult(err);
  }
}

/**
 * Update job status to FAILED
 * Lines 257-268 from source
 *
 * @param prisma - Prisma client instance
 * @param jobId - Job ID to update
 * @param partitionKey - Partition key for job lookup
 * @param errorMessage - Error message to store
 * @returns AsyncResult indicating success or failure
 */
export async function updateJobToFailed(
  prisma: PrismaClient,
  jobId: bigint,
  partitionKey: string,
  errorMessage: string
): Promise<AsyncResult<void, Error>> {
  try {
    const where = { id_partition_key: { id: jobId, partition_key: partitionKey } };
    const data = { status: 'failed' as const, last_error: { message: errorMessage } };
    await prisma.jobs.update({ where, data });

    logger.info(`[DownloadMonitor] Updated job ${jobId} to FAILED status`);
    return createSuccessResult(undefined);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[DownloadMonitor] Failed to update job status:', error);
    return createErrorResult(err);
  }
}

/** Get manga IDs that have active download jobs (should not be cleaned up) */
async function getActiveMangaIds(prisma: PrismaClient): Promise<number[]> {
  const activeJobs = await prisma.jobs.findMany({
    where: { job_type: 'chapter_download', status: { in: ['active', 'pending', 'retrying'] } },
    select: { manga_id: true },
    distinct: ['manga_id']
  });
  return activeJobs.map(j => j.manga_id).filter((id): id is number => id !== null);
}

/** Group chapter IDs by mangaId and emit WebSocket events for each manga */
function emitOrphanCleanupEvents(chapters: Array<{ id: number; mangaId: number }>): void {
  const grouped = new Map<number, number[]>();
  for (const ch of chapters) {
    const ids = grouped.get(ch.mangaId) ?? [];
    ids.push(ch.id);
    grouped.set(ch.mangaId, ids);
  }
  for (const [mangaId, chapterIds] of grouped) {
    void realtimeEmitter.emitChapterUpdate({
      chapterId: 0, mangaId, action: 'failed', data: { chapterIds }
    });
  }
}

/**
 * Clean up orphaned chapters stuck in DOWNLOADING status.
 *
 * Finds chapters with downloadStatus='DOWNLOADING', no filePath, stale >30min,
 * and belonging to manga with no active/pending/retrying jobs.
 * Resets them to PENDING so the user can retry the download.
 *
 * @param prisma - Prisma client instance
 * @returns Number of chapters cleaned up
 */
export async function cleanupOrphanedDownloadingChapters(prisma: PrismaClient): Promise<number> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  try {
    const activeMangaIds = await getActiveMangaIds(prisma);
    const excludeManga = activeMangaIds.length > 0 ? { mangaId: { notIn: activeMangaIds } } : {};

    const orphaned = await prisma.chapter.findMany({
      where: { downloadStatus: 'DOWNLOADING', filePath: null, updatedAt: { lt: thirtyMinutesAgo }, ...excludeManga },
      select: { id: true, mangaId: true }
    });

    if (orphaned.length === 0) return 0;

    await prisma.chapter.updateMany({
      where: { id: { in: orphaned.map(ch => ch.id) } },
      data: { downloadStatus: 'PENDING' }
    });

    emitOrphanCleanupEvents(orphaned);
    const mangaCount = new Set(orphaned.map(ch => ch.mangaId)).size;
    logger.info(`[DownloadMonitor] Cleaned up ${orphaned.length} orphaned DOWNLOADING chapters across ${mangaCount} manga`);
    return orphaned.length;
  } catch (error: unknown) {
    logger.error('[DownloadMonitor] Failed to cleanup orphaned downloading chapters:', error);
    return 0;
  }
}

/** Result of one ghost-row recount cycle. */
export interface GhostRecountStats {
  scanned: number;
  recovered: number;
  stillZero: number;
  fileMissing: number;
  errors: number;
}

/**
 * Recount pages for COMPLETED chapters that have a filePath but pageCount=0.
 *
 * These rows show as completed in the UI but fail to render in the reader because
 * pageCount drives readability. Cause is usually that countPagesInArchive ran when
 * the storage mount was offline (returned 0) and was never re-attempted.
 *
 * Strategy: for each ghost row, fs.access the filePath. If reachable, recount via
 * countPagesInArchive and update if >0. If missing, log only — downgrading to
 * PENDING is risky during transient mount outages, so left for a follow-up sweep
 * with stronger health checks.
 *
 * Bounded to `maxPerCycle` rows per call to avoid burning the worker on a backlog.
 */
export async function cleanupGhostCompletedChapters(
  prisma: PrismaClient,
  maxPerCycle = 50
): Promise<GhostRecountStats> {
  const stats: GhostRecountStats = { scanned: 0, recovered: 0, stillZero: 0, fileMissing: 0, errors: 0 };

  // iter-IM2: include pageCount=1 alongside 0/null. The Lookism class
  // synthetic-volume placeholder rows have pageCount=1 (set by pack-
  // import to a sentinel, not derived from the archive); Re:ZERO's 4
  // ghost EPUB rows similarly. The fs.access gate below distinguishes
  // genuine 1-page chapters (rare but real for single-page volume
  // placeholders) from ghosts whose source file is missing.
  const ghosts = await prisma.chapter.findMany({
    where: {
      downloadStatus: 'COMPLETED',
      filePath: { not: null },
      OR: [{ pageCount: 0 }, { pageCount: null }, { pageCount: 1 }],
      // Stop spamming the log on rows that have failed too many times in a row.
      // Reset by re-importing the chapter or by zeroing pageCountAttempts via
      // scripts/surveys/recover-ghost-completed-chapters.ts.
      pageCountAttempts: { lt: 3 },
    },
    select: { id: true, mangaId: true, filePath: true },
    take: maxPerCycle,
  });
  stats.scanned = ghosts.length;
  if (ghosts.length === 0) return stats;

  for (const ch of ghosts) {
    if (ch.filePath === null) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential to avoid spiking SMB/NFS read load
      await fs.access(ch.filePath);
    } catch {
      stats.fileMissing += 1;
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop -- countPagesInArchive opens the file; serialize for IO sanity
      const pages = await countPagesInArchive(ch.filePath);
      if (pages > 0) {
        // eslint-disable-next-line no-await-in-loop -- per-row update, sequential by design
        await prisma.chapter.update({
          where: { id: ch.id },
          data: { pageCount: pages, pageCountAttempts: 0, updatedAt: new Date() },
        });
        stats.recovered += 1;
      } else {
        // eslint-disable-next-line no-await-in-loop -- per-row update, sequential by design
        await prisma.chapter.update({
          where: { id: ch.id },
          data: { pageCountAttempts: { increment: 1 } },
        });
        stats.stillZero += 1;
      }
    } catch (err: unknown) {
      stats.errors += 1;
      logger.warn(`[DownloadMonitor] Ghost recount failed for chapter ${ch.id}`, { err });
      try {
        // eslint-disable-next-line no-await-in-loop -- per-row update, sequential by design
        await prisma.chapter.update({
          where: { id: ch.id },
          data: { pageCountAttempts: { increment: 1 } },
        });
      } catch {
        // swallow — error counter already bumped above
      }
    }
  }

  if (stats.recovered > 0 || stats.fileMissing > 0) {
    logger.info(
      `[DownloadMonitor] Ghost recount: scanned=${stats.scanned} recovered=${stats.recovered} ` +
      `stillZero=${stats.stillZero} fileMissing=${stats.fileMissing} errors=${stats.errors}`
    );
  }
  return stats;
}

/** Result of one vanished-file ghost downgrade cycle. */
export interface VanishedFileStats {
  scanned: number;
  downgraded: number;
  mountOutages: number;
  parentDirExists: number;
  errors: number;
}

/**
 * iter-IM: downgrade COMPLETED chapters whose `filePath` no longer
 * exists on disk to PENDING (clearing filePath/fileFormat/size/pageCount
 * so the row is eligible for re-download).
 *
 * Companion to `cleanupGhostCompletedChapters` which docstring calls out
 * the gap explicitly: "downgrading to PENDING is risky during transient
 * mount outages, so left for a follow-up sweep with stronger health
 * checks." This is that follow-up sweep.
 *
 * The stronger health check: only downgrade when the file's PARENT
 * directory is reachable. If the parent dir is ALSO missing, the
 * filesystem mount probably dropped — skip the row and log a
 * mount-outage counter. If the parent dir IS reachable but the file
 * inside it is gone, the file was deleted (cleanup script, external
 * actor, manual rm) and the chapter row is genuinely stale.
 *
 * Detected library-wide on 2026-05-10 audit: 106 chapter rows across
 * 4 manga (Pluto 59, Tales of Demons 20, Re:ZERO 17, Sakamoto 10)
 * pointed at `/Users/.../Manga/<title>/Volumes/<title> V0N/<title> V0N.cbz`
 * paths where the leaf .cbz files had been deleted but the parent
 * `Volumes/<title> V0N/` dirs still existed.
 */
export async function cleanupVanishedFileChapters(
  prisma: PrismaClient,
  maxPerCycle = 50,
): Promise<VanishedFileStats> {
  const stats: VanishedFileStats = {
    scanned: 0, downgraded: 0, mountOutages: 0, parentDirExists: 0, errors: 0,
  };

  // Same shape as cleanupGhostCompletedChapters — only the disposition differs.
  // iter-IM2: filter also matches pageCount=1 (Lookism / Re:ZERO synthetic
  // ghost-row pattern). fs.access below gates real-vs-missing.
  const ghosts = await prisma.chapter.findMany({
    where: {
      downloadStatus: 'COMPLETED',
      filePath: { not: null },
      OR: [{ pageCount: 0 }, { pageCount: null }, { pageCount: 1 }],
    },
    select: { id: true, mangaId: true, filePath: true },
    take: maxPerCycle,
  });
  stats.scanned = ghosts.length;
  if (ghosts.length === 0) return stats;

  for (const ch of ghosts) {
    if (ch.filePath === null) continue;
    // eslint-disable-next-line no-await-in-loop -- serial to avoid SMB/NFS spike
    const fileExists = await fs.access(ch.filePath).then(() => true, () => false);
    if (fileExists) continue;

    const parent = path.dirname(ch.filePath);
    // eslint-disable-next-line no-await-in-loop -- serial mount probe per row
    const parentExists = await fs.access(parent).then(() => true, () => false);
    if (!parentExists) {
      stats.mountOutages++;
      continue;
    }
    stats.parentDirExists++;

    try {
      // eslint-disable-next-line no-await-in-loop -- per-row update by design
      await prisma.chapter.update({
        where: { id: ch.id },
        data: {
          downloadStatus: 'PENDING',
          filePath: null, fileFormat: null, size: 0, pageCount: null,
          updatedAt: new Date(),
        },
      });
      stats.downgraded++;
    } catch (err: unknown) {
      stats.errors++;
      logger.warn(`[DownloadMonitor] Vanished-file downgrade failed for chapter ${ch.id}`, { err });
    }
  }

  if (stats.downgraded > 0 || stats.mountOutages > 0) {
    logger.info(
      `[DownloadMonitor] Vanished-file downgrade: scanned=${stats.scanned} ` +
      `downgraded=${stats.downgraded} mountOutages=${stats.mountOutages} ` +
      `errors=${stats.errors}`,
    );
  }
  return stats;
}

export interface CoverageResolveStats {
  scanned: number;
  resolved: number;
  orphaned: number;
}

const COVERAGE_RESOLVE_GRACE_MS = 10 * 60 * 1000; // 10 min
const COVERAGE_ORPHAN_MS = 24 * 60 * 60 * 1000;    // 24h
/**
 * How long a pack may deliver *nothing* before we declare the claim empty and
 * fall back to native. Long enough for a healthy pack to extract at least one
 * chapter, short enough that a dead/blocked pack (the common Prowlarr failure)
 * doesn't strand its chapters for the full 24h orphan window. Native fill-in is
 * non-destructive, so racing a still-downloading pack only risks dedup, not
 * data loss.
 */
const COVERAGE_NO_DELIVERY_MS = 30 * 60 * 1000;    // 30 min

function intToNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Chapter ids a Prowlarr pack claimed (was dispatched to cover) but never
 * delivered — the scoped set minus whatever actually completed. These are the
 * chapters that should fall back to a native source.
 */
export function unfulfilledChapterIds(scopedIds: number[], fulfilledIds: number[]): number[] {
  if (scopedIds.length === 0) return [];
  const fulfilled = new Set(fulfilledIds);
  return scopedIds.filter(id => !fulfilled.has(id));
}

/**
 * Fire native-only re-dispatch for chapters a pack claimed but didn't deliver.
 * One run per manga (the search re-evaluates all its missing chapters anyway),
 * fire-and-forget. `nativeOnly` ensures we never re-trigger the failing pack —
 * chapters a native source can serve get enqueued; the rest are left for the
 * next monitored cycle. Lazy import breaks the
 * download-monitor → releaseDispatcher → scheduler require cycle.
 */
function triggerNativeFallbacks(byManga: Map<number, Set<number>>): void {
  for (const [mangaId, ids] of byManga) {
    const chapterIds = [...ids];
    if (chapterIds.length === 0) continue;
    logger.info(
      `[DownloadMonitor] Pack claim unfulfilled; native fallback for manga ${mangaId} ` +
      `(${chapterIds.length} chapter(s))`,
    );
    void import('@/server/services/library/releaseDispatcher/dispatch')
      .then(({ runUnifiedReleaseSearch }) =>
        runUnifiedReleaseSearch(mangaId, {
          scope: { mode: 'BULK', chapterIds },
          nativeOnly: true,
          bypassRuleCheck: true,
        }),
      )
      .catch((err: unknown) => {
        logger.warn(`[DownloadMonitor] Native fallback dispatch failed for manga ${mangaId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }
}

/**
 * iter-D1: Resolve claim-vs-fulfilled for ProwlarrCoverageAttempt rows.
 *
 * Strategy:
 *   - Pick claim rows older than COVERAGE_RESOLVE_GRACE_MS that are
 *     still status='claimed'. The grace period gives the dispatch
 *     pipeline time to actually complete the download.
 *   - For each, look up Chapter rows whose id is in scopedChapterIds
 *     and whose downloadStatus = 'COMPLETED' AND updatedAt >= createdAt.
 *     Their chapterNumber set is the "fulfilled" cohort.
 *   - Intersect claimedChapters with fulfilled chapterNumbers to compute
 *     accuracy. Set status: 'fulfilled' (≥ claimed.length), 'partial'
 *     (>0), 'empty' (=0). Past COVERAGE_ORPHAN_MS without resolution,
 *     mark 'orphan' (download never completed).
 *   - Pure observation — no chapter/job mutations.
 */
export async function resolveCoverageAttempts(
  prisma: PrismaClient,
  maxPerCycle = 50,
): Promise<CoverageResolveStats> {
  const stats: CoverageResolveStats = { scanned: 0, resolved: 0, orphaned: 0 };
  const now = Date.now();
  const graceCutoff = new Date(now - COVERAGE_RESOLVE_GRACE_MS);
  const orphanCutoff = new Date(now - COVERAGE_ORPHAN_MS);
  const noDeliveryCutoff = new Date(now - COVERAGE_NO_DELIVERY_MS);
  // mangaId -> chapter ids a pack claimed but never delivered, accumulated
  // across this cycle's resolutions and re-dispatched native-only at the end.
  const nativeFallbackByManga = new Map<number, Set<number>>();
  const recordUnfulfilled = (mangaId: number, ids: number[]): void => {
    if (ids.length === 0) return;
    const set = nativeFallbackByManga.get(mangaId) ?? new Set<number>();
    for (const id of ids) set.add(id);
    nativeFallbackByManga.set(mangaId, set);
  };

  const pending = await prisma.prowlarrCoverageAttempt.findMany({
    where: { status: 'claimed', createdAt: { lt: graceCutoff } },
    orderBy: { createdAt: 'asc' },
    take: maxPerCycle,
  });
  stats.scanned = pending.length;
  if (pending.length === 0) return stats;

  for (const attempt of pending) {
    const scopedIds = intToNumberArray(attempt.scopedChapterIds);
    const claimedChapters = intToNumberArray(attempt.claimedChapters);

    if (scopedIds.length === 0) {
      // No scoped ids — can't resolve. Mark orphan after grace.
      if (attempt.createdAt < orphanCutoff) {
        // eslint-disable-next-line no-await-in-loop -- per-row resolve by design
        await prisma.prowlarrCoverageAttempt.update({
          where: { id: attempt.id },
          data: { status: 'orphan', resolvedAt: new Date() },
        });
        stats.orphaned++;
      }
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- per-row resolve by design
    const completed = await prisma.chapter.findMany({
      where: {
        id: { in: scopedIds },
        downloadStatus: 'COMPLETED',
        updatedAt: { gte: attempt.createdAt },
      },
      select: { id: true, chapterNumber: true },
    });

    if (completed.length === 0) {
      // Pack delivered nothing past the no-delivery window — declare the claim
      // empty and fall back to native for every scoped chapter. (The 24h
      // `orphan` status is reserved for claims we can't even scope, below.)
      if (attempt.createdAt < noDeliveryCutoff) {
        // eslint-disable-next-line no-await-in-loop -- per-row resolve by design
        await prisma.prowlarrCoverageAttempt.update({
          where: { id: attempt.id },
          data: { status: 'empty', claimAccuracy: 0, resolvedAt: new Date() },
        });
        stats.resolved++;
        recordUnfulfilled(attempt.mangaId, scopedIds);
      }
      continue;
    }

    const fulfilledIds = completed.map(c => c.id);
    const fulfilledChapterNumbers = new Set(
      completed.map(c => c.chapterNumber).filter((n): n is number => n !== null),
    );
    const claimedSet = new Set(claimedChapters);
    const intersection = [...fulfilledChapterNumbers].filter(n => claimedSet.has(n));

    let newStatus: 'fulfilled' | 'partial' | 'empty';
    let accuracy: number;
    if (claimedSet.size === 0) {
      // Unparseable pack — we credited the full scope. Score against scope-fulfillment.
      accuracy = fulfilledIds.length / scopedIds.length;
      newStatus = accuracy >= 1 ? 'fulfilled' : accuracy > 0 ? 'partial' : 'empty';
    } else {
      accuracy = intersection.length / claimedSet.size;
      newStatus = accuracy >= 1 ? 'fulfilled' : accuracy > 0 ? 'partial' : 'empty';
    }

    // eslint-disable-next-line no-await-in-loop -- per-row resolve by design
    await prisma.prowlarrCoverageAttempt.update({
      where: { id: attempt.id },
      data: {
        status: newStatus,
        fulfilledChapterIds: fulfilledIds,
        claimAccuracy: accuracy,
        resolvedAt: new Date(),
      },
    });
    stats.resolved++;
    if (newStatus !== 'fulfilled') {
      recordUnfulfilled(attempt.mangaId, unfulfilledChapterIds(scopedIds, fulfilledIds));
    }
  }

  if (nativeFallbackByManga.size > 0) triggerNativeFallbacks(nativeFallbackByManga);

  if (stats.resolved > 0 || stats.orphaned > 0) {
    logger.info(
      `[DownloadMonitor] Coverage resolve: scanned=${stats.scanned} ` +
      `resolved=${stats.resolved} orphaned=${stats.orphaned}`,
    );
  }
  return stats;
}
