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
import { findChapterFileSquatters } from '@/server/services/library/chapter-file-name';
import { selectChaptersToLink, type ChapterLink, type CoverageRow } from '@/server/services/library/volume-archive-coverage';
import { nullifyMissingArchives } from '@/server/services/library/volume-archive-coverage-fs';
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

/**
 * Leave out file-less chapters numbered past every volume's range. Such a row
 * is a provider phantom (Stone Ocean "164: Author's Comments" in a 158-chapter
 * series); linked to the archive it counts as downloaded and the phantom prune
 * can no longer remove it. A decimal extra right after the last chapter (139.5)
 * still links.
 */
export function withoutChaptersPastLastVolume(rows: CoverageRow[], lastChapterEnd: number | null): CoverageRow[] {
  if (lastChapterEnd === null) return rows;
  return rows.filter(r => r.chapterNumber === null || Boolean(r.filePath) || Math.floor(r.chapterNumber) <= lastChapterEnd);
}

/**
 * Phase-finalize step, run before `ensureVolumeFileRows`: clear the file from
 * numbered rows that hold another chapter's file (SPY x FAMILY 120.1, 123.1 …
 * on `V17 C119.cbz`). They go back to file-less PENDING; the link step below
 * points them at their volume's archive when the volume has a real one.
 * Running first means the volume-file rows are summed without them.
 */
export async function releaseChapterFileSquatters(mangaId: number): Promise<number> {
  try {
    const rows = await prisma.chapter.findMany({
      where: { mangaId, filePath: { not: null } },
      select: { id: true, chapterNumber: true, filePath: true },
    });
    const squatters = findChapterFileSquatters(rows);
    if (squatters.length === 0) return 0;
    const result = await prisma.chapter.updateMany({
      where: { id: { in: squatters }, mangaId },
      data: {
        filePath: null, fileName: '', fileFormat: null, size: 0, pageCount: null,
        downloadStatus: ChapterStatus.PENDING, updatedAt: new Date(),
      },
    });
    logger.info(`[releaseChapterFileSquatters] mangaId=${mangaId} released ${result.count} chapter row(s) holding another chapter's file`);
    return result.count;
  } catch (err) {
    logger.warn(`[releaseChapterFileSquatters] failed for manga ${mangaId} (non-critical)`, err);
    return 0;
  }
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

    const lastVolume = await prisma.volume.aggregate({ where: { mangaId }, _max: { chapterEnd: true } });
    const verified = await nullifyMissingArchives(rows as CoverageRow[]);
    const links = selectChaptersToLink(withoutChaptersPastLastVolume(verified, lastVolume._max.chapterEnd));
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
