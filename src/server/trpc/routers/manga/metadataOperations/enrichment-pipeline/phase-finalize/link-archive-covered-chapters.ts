/**
 * Phase-finalize step: link numbered chapters to their whole-volume archive.
 *
 * When a volume has a file-backed COMPLETED volume-file row (e.g. `Akira
 * V02.cbr`), the numbered chapters in that volume are physically present inside
 * the archive. This flips those chapters to COMPLETED and points their
 * `filePath` at the archive — the same model `linkVolumeChapters` applies at
 * pack-import time — so they are readable (open the volume archive) and the
 * download monitor stops trying to fetch content that's already on disk.
 *
 * Runs after `ensureVolumeFileRows` (which heals the volume-file rows) and after
 * `reapplyManualManifestToDb` (which re-homes chapters to corrected volumes), so
 * a range/manifest fix never leaves archive-covered chapters stranded as
 * PENDING. Chapters that carry their own individual file are left untouched, and
 * re-running is a no-op (idempotent).
 */

import { ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { selectChaptersToLink, type ChapterLink, type CoverageRow } from '@/server/services/library/volume-archive-coverage';
import { logger } from '@/utils/logger';

/** Apply one volume's archive payload to all its covered chapters. */
async function applyArchiveLink(filePath: string, group: ChapterLink[]): Promise<number> {
  const first = group[0];
  if (!first) return 0;
  const result = await prisma.chapter.updateMany({
    where: { id: { in: group.map(g => g.chapterId) } },
    data: {
      filePath,
      fileName: first.fileName,
      fileFormat: first.fileFormat,
      size: first.size,
      pageCount: first.pageCount,
      downloadStatus: ChapterStatus.COMPLETED,
      downloadUrl: null,
      updatedAt: new Date(),
    },
  });
  return result.count;
}

export async function linkArchiveCoveredChapters(mangaId: number): Promise<number> {
  try {
    const rows = await prisma.chapter.findMany({
      where: { mangaId },
      select: {
        id: true, chapterNumber: true, volume: true, filePath: true,
        downloadStatus: true, fileName: true, fileFormat: true, size: true, pageCount: true,
      },
    });

    const links = selectChaptersToLink(rows as CoverageRow[]);
    if (links.length === 0) return 0;

    // Chapters in the same volume share one archive payload — batch by filePath.
    const byFile = new Map<string, ChapterLink[]>();
    for (const link of links) {
      const bucket = byFile.get(link.filePath) ?? [];
      bucket.push(link);
      byFile.set(link.filePath, bucket);
    }

    let linked = 0;
    for (const [filePath, group] of byFile.entries()) {
      // eslint-disable-next-line no-await-in-loop -- per-volume sequential write keeps DB pressure low
      linked += await applyArchiveLink(filePath, group);
    }

    logger.info(`[linkArchiveCoveredChapters] mangaId=${mangaId} linked ${linked} archive-covered chapter(s) across ${byFile.size} volume(s)`);
    return linked;
  } catch (err) {
    logger.warn(`[linkArchiveCoveredChapters] failed for manga ${mangaId} (non-critical)`, err);
    return 0;
  }
}
