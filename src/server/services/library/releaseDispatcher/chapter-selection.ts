/**
 * Chapter selection for the release dispatcher.
 *
 * Decides which chapters a dispatch run should attempt to download, given an
 * optional scope, and excludes chapters already covered on disk by a file-backed
 * whole-volume archive (see volume-archive-coverage). Extracted from dispatch.ts.
 */

import { prisma } from '@/server/db';
import type { ReleaseScope } from '@/server/services/library/indexerSearch/types';
import {
  volumesWithFileBackedArchive, filterUncoveredCandidates, type CoverageRow,
} from '@/server/services/library/volume-archive-coverage';
import { logger } from '@/utils/logger';

const log = logger.child('UnifiedReleaseSearch');

export interface ChapterStub {
  id: number;
  chapterNumber: number | null;
  volume: number | null;
  mangadexId: string | null;
  suwayomiChapterId: string | null;
  /** MangaDex `translatedLanguage` of the bound UUID; gates the Phase 2b
   * language skip. Null on rows pre-backfill. */
  language: string | null;
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

export async function loadMissingChapters(
  mangaId: number,
  scope?: ReleaseScope,
): Promise<ChapterStub[]> {
  const candidates = await prisma.chapter.findMany({
    where: buildChapterWhere(mangaId, scope),
    select: { id: true, chapterNumber: true, volume: true, mangadexId: true, suwayomiChapterId: true, language: true },
  });
  if (candidates.length === 0) return candidates;

  // Defense-in-depth: never dispatch a download for a chapter whose volume is
  // already on disk inside a file-backed whole-volume archive. Normally these
  // chapters are COMPLETED (see linkArchiveCoveredChapters) and excluded by the
  // status filter, but a "reset for downloads" or stale PENDING state can leave
  // them eligible — re-downloading would just duplicate the archive's content.
  const archiveRows = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: null, downloadStatus: 'COMPLETED', filePath: { not: null } },
    select: { id: true, chapterNumber: true, volume: true, filePath: true, downloadStatus: true },
  });
  const covered = volumesWithFileBackedArchive(archiveRows as CoverageRow[]);
  if (covered.size === 0) return candidates;
  return filterUncoveredCandidates(candidates, covered);
}
