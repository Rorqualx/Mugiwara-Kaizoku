/**
 * The stale-chapter sweep's delete, run after chapter reconciliation instead of
 * inside the Phase 2 merge.
 *
 * The merge finds PENDING rows this run's provider chapter list no longer names
 * (stale-chapter-sweep.ts). Reconciliation, which runs right after it, merges
 * the Fandom / Wikipedia / ComicVine / MangaDex chapter lists and fills 1..N,
 * and inserts every number it has no row for. When the merge had already
 * deleted such a row, reconciliation inserted the same chapter again under a new
 * id on every refresh: One Piece (Official Colored) chapter 1142 and Dandadan
 * chapter 249 sat past the series' chapter count, missing from the primary
 * list but present in another source. Deferring the delete lets reconciliation
 * see the row, and the sweep then spares every number reconciliation wants.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/** A row the merge judged stale. */
export interface StaleChapterCandidate {
  id: number;
  chapterNumber: number | null;
}

/**
 * The candidates to delete: numberless rows always (reconciliation never
 * creates those), numbered rows only when reconciliation does not want that
 * number. `wanted` null means reconciliation did not run — delete them all.
 */
export function selectStaleToDelete(
  candidates: ReadonlyArray<StaleChapterCandidate>,
  wanted: ReadonlySet<number> | null,
): number[] {
  return candidates
    .filter(c => c.chapterNumber === null || !wanted?.has(c.chapterNumber))
    .map(c => c.id);
}

/** Delete the stale rows reconciliation does not want; returns how many went. */
export async function sweepDeferredStaleChapters(
  mangaId: number,
  candidates: ReadonlyArray<StaleChapterCandidate>,
  wanted: ReadonlySet<number> | null,
): Promise<number> {
  const ids = selectStaleToDelete(candidates, wanted);
  const spared = candidates.length - ids.length;
  if (ids.length === 0) {
    if (spared > 0) logger.info(`[enrichmentPipeline] Kept ${spared} PENDING chapter(s) for manga ${mangaId} that reconciliation names`);
    return 0;
  }
  // Re-check the merge's conditions: nothing may have attached a file since.
  const res = await prisma.chapter.deleteMany({
    where: { id: { in: ids }, mangaId, downloadStatus: 'PENDING', filePath: null },
  });
  logger.info(`Cleaned up ${res.count} stale PENDING chapters for manga ${mangaId} (kept ${spared} reconciliation names)`);
  return res.count;
}
