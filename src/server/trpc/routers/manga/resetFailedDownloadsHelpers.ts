/**
 * Reset Failed Downloads — shared helpers
 *
 * Extracted from downloadOperations.ts to keep that router under the 800-line
 * cap. Used by both the per-volume `resetFailedDownloads` mutation and the
 * manga-wide `resetAllFailedDownloads` mutation: clear failed dispatch
 * attempts, flip chapter status PENDING, bust the manga cache, then await a
 * unified dispatch and translate the summary into a user-facing toast message.
 */

import { logger } from '@/utils/logger';

export interface ResetFailedDownloadsResult {
  success: boolean;
  clearedCount: number;
  queuedCount: number;
  uncoveredCount: number;
  prowlarrPackTitle?: string;
  message: string;
}

export interface ResetDispatchSummary {
  queuedCount: number;
  uncoveredCount: number;
  prowlarrPackTitle?: string;
}

/** Bust the unified + hot manga-detail caches so the post-reset UI refetch
 *  reflects the new PENDING state instead of the pre-reset ERROR snapshot. */
export async function invalidateMangaCacheFor(mangaId: number): Promise<void> {
  const { invalidateMangaCache } = await import('./crud-operations/get-manga-cache');
  await invalidateMangaCache(mangaId);
}

/**
 * Self-heal archive-covered chapters before a reset/redownload. Any chapter
 * already on disk inside a file-backed volume archive is flipped to COMPLETED
 * (and pointed at the archive) so the reset never resets or re-downloads
 * content that's actually present — the Kaiju/Akira case — without needing a
 * full re-enrichment. Cheap and idempotent (a no-op when nothing needs linking).
 * Returns how many chapters were healed and busts the manga cache when > 0.
 */
export async function healArchiveCoveredBeforeReset(mangaId: number): Promise<number> {
  const { linkArchiveCoveredChapters } = await import('@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-finalize/link-archive-covered-chapters');
  const healed = await linkArchiveCoveredChapters(mangaId);
  if (healed > 0) await invalidateMangaCacheFor(mangaId);
  return healed;
}

/**
 * Single-chapter variant: heal the chapter's manga, then report whether this
 * chapter is now COMPLETED (covered by a volume archive — nothing to retry).
 * `mangaId` is null when the chapter doesn't exist.
 */
export async function healChapterIfCovered(
  chapterId: number,
): Promise<{ mangaId: number | null; covered: boolean }> {
  const { prisma } = await import('@/server/db');
  const target = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { mangaId: true } });
  if (!target) return { mangaId: null, covered: false };
  const healed = await healArchiveCoveredBeforeReset(target.mangaId);
  if (healed === 0) return { mangaId: target.mangaId, covered: false };
  const after = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { downloadStatus: true } });
  return { mangaId: target.mangaId, covered: after?.downloadStatus === 'COMPLETED' };
}

/** Run the unified dispatcher for a reset, swallow + log any error so the
 *  reset itself still reports success. Caller maps the summary into a
 *  user-facing message. */
export async function runDispatchForReset(
  mangaId: number,
  volumeNumber: number | undefined,
): Promise<ResetDispatchSummary | null> {
  const { runUnifiedReleaseSearch } = await import('@/server/services/library/releaseDispatcher/dispatch');
  const scope = volumeNumber !== undefined
    ? { mode: 'VOLUME' as const, volumeNumber }
    : undefined;
  try {
    const summary = await runUnifiedReleaseSearch(mangaId, {
      bypassRuleCheck: true,
      ...(scope ? { scope } : {}),
    });
    return {
      queuedCount: summary.prowlarrCoveredChapters.length + summary.nativeEnqueued.length,
      uncoveredCount: summary.uncoveredChapters.length,
      ...(summary.prowlarrSelected?.releaseTitle !== undefined
        ? { prowlarrPackTitle: summary.prowlarrSelected.releaseTitle }
        : {}),
    };
  } catch (err: unknown) {
    logger.error('Post-reset dispatch failed', {
      mangaId,
      ...(volumeNumber !== undefined ? { volumeNumber } : {}),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Turn the reset + dispatch outcome into a `{ success, ..., message }`
 *  payload the client renders in a single toast — replaces the prior
 *  fire-and-forget "searching enabled sources…" string that never reflected
 *  actual results. */
export function buildResetResult(
  clearedCount: number,
  summary: ResetDispatchSummary | null,
  scopeLabel: string,
): ResetFailedDownloadsResult {
  const queuedCount = summary?.queuedCount ?? 0;
  const uncoveredCount = summary?.uncoveredCount ?? 0;
  const packTitle = summary?.prowlarrPackTitle;
  const plural = clearedCount === 1 ? '' : 's';
  let message: string;
  if (summary === null) {
    message = `Reset ${clearedCount} failed chapter${plural}${scopeLabel}, but the dispatcher errored — see logs.`;
  } else if (queuedCount === 0) {
    message = `Reset ${clearedCount} failed chapter${plural}${scopeLabel} but no available sources were found — try again later or enable more indexers.`;
  } else if (packTitle !== undefined) {
    message = `Reset ${clearedCount} failed chapter${plural}${scopeLabel} → queued ${queuedCount} (${packTitle})`;
  } else {
    message = `Reset ${clearedCount} failed chapter${plural}${scopeLabel} → queued ${queuedCount} download${queuedCount === 1 ? '' : 's'}`;
  }
  return {
    success: true,
    clearedCount,
    queuedCount,
    uncoveredCount,
    ...(packTitle !== undefined ? { prowlarrPackTitle: packTitle } : {}),
    message,
  };
}
