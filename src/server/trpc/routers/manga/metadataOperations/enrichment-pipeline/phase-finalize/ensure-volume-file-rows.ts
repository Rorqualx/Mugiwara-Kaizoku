/**
 * Phase-finalize step: ensure each volume with chapter rows has exactly one
 * "volume-file" Chapter row representing the volume as a whole.
 *
 * Two import shapes converge here:
 *  - **Compendium archive** (e.g., Chainsaw Man Color "V01.cbz" with chs 1-8):
 *    a single archive file shared across N chapter rows. The volume-file row
 *    has `filePath` set to that archive, `pageCount` and `size` copied from
 *    one of the chapter rows (which all share the archive's totals).
 *  - **Per-chapter files** (e.g., Kaiju "Chapter 0001.cbz" ... "0007.cbz"):
 *    N separate files. The volume-file row has `filePath = NULL` (no single
 *    archive to point at); `pageCount` and `size` are SUMMED across all
 *    chapter rows in the volume.
 *
 * Either way the UI gets a single "1-N" row alongside the numbered chapter
 * rows so the volume can be expressed as one entry in the chapter table.
 *
 * Idempotent: re-running just refreshes the aggregate stats on existing
 * volume-file rows; only creates one when none exists for the volume.
 */

import { ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

interface ChapterAggregate {
  count: number;
  completedCount: number;
  totalPages: number;
  totalSize: number;
  /** Single archive file shared by every chapter row in the volume (compendium).
   *  null when chapters are in distinct files (per-chapter import). */
  sharedFilePath: string | null;
  sharedFileName: string | null;
  sharedFileFormat: string | null;
  /** A representative carrier-row id used as the seed for index selection. */
  seedIndex: number;
}

interface VolumeFileRow {
  id: number;
  pageCount: number | null;
  size: number;
  filePath: string | null;
}

/**
 * Look up the existing volume-file row for a given volume, if any.
 * A volume-file row = same mangaId, same volume, chapterNumber IS NULL.
 */
async function findExistingVolumeFileRow(
  mangaId: number,
  volume: number,
): Promise<VolumeFileRow | null> {
  return prisma.chapter.findFirst({
    where: { mangaId, volume, chapterNumber: null },
    select: { id: true, pageCount: true, size: true, filePath: true },
  });
}

function aggregateChapterRows(
  rows: Array<{ index: number; pageCount: number | null; size: number; filePath: string | null; fileName: string; fileFormat: string | null; downloadStatus: string }>,
): ChapterAggregate {
  let completedCount = 0;
  let totalPages = 0;
  let totalSize = 0;
  const filePaths = new Set<string>();
  let firstFileName: string | null = null;
  let firstFileFormat: string | null = null;
  let seedIndex = rows[0]?.index ?? 0;
  for (const r of rows) {
    if (r.downloadStatus === ChapterStatus.COMPLETED) completedCount++;
    totalPages += r.pageCount ?? 0;
    totalSize += r.size;
    if (r.filePath) filePaths.add(r.filePath);
    firstFileName ??= r.fileName;
    firstFileFormat ??= r.fileFormat;
    if (r.index < seedIndex) seedIndex = r.index;
  }
  const sharedFilePath = filePaths.size === 1 ? [...filePaths][0] ?? null : null;
  return {
    count: rows.length,
    completedCount,
    totalPages,
    totalSize,
    sharedFilePath,
    sharedFileName: sharedFilePath !== null ? firstFileName : null,
    sharedFileFormat: sharedFilePath !== null ? firstFileFormat : null,
    seedIndex,
  };
}

async function ensureRowForVolume(
  mangaId: number,
  volume: number,
  volumeId: number | null,
  agg: ChapterAggregate,
): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await findExistingVolumeFileRow(mangaId, volume);
  const downloadStatus: ChapterStatus = agg.completedCount === agg.count
    ? ChapterStatus.COMPLETED
    : ChapterStatus.PENDING;

  if (existing) {
    // A file-backed volume row whose numbered chapters do NOT share one
    // archive path is a pack-import compendium pointer (chapters may be
    // pending or in per-chapter files from another source). Leave it alone:
    // nulling its filePath / overwriting its archive-derived stats with
    // chapter-row aggregates would orphan the archive on disk.
    if (existing.filePath !== null && agg.sharedFilePath === null) return 'skipped';
    const needsUpdate = (existing.pageCount ?? 0) !== agg.totalPages
      || existing.size !== agg.totalSize
      || existing.filePath !== agg.sharedFilePath;
    if (!needsUpdate) return 'skipped';
    await prisma.chapter.update({
      where: { id: existing.id },
      data: {
        pageCount: agg.totalPages,
        size: agg.totalSize,
        downloadStatus,
        ...(agg.sharedFilePath !== null
          ? { filePath: agg.sharedFilePath, fileName: agg.sharedFileName ?? '', fileFormat: agg.sharedFileFormat }
          : { filePath: null }),
      },
    });
    return 'updated';
  }

  // No existing row — create one. Index strategy: park in the synthetic
  // 100_000+ space partitioned by volume number so it doesn't collide with
  // numbered chapter indices. On collision (already used), bump until free.
  const baseIndex = 100_000 + volume * 100;
  let index = baseIndex;
  // eslint-disable-next-line no-await-in-loop -- bounded probe, almost always one iteration
  while (await prisma.chapter.findFirst({ where: { mangaId, index }, select: { id: true } })) {
    index++;
    if (index > baseIndex + 1000) {
      logger.warn(`[ensureVolumeFileRows] Could not find free index for mangaId=${mangaId} volume=${volume}`);
      return 'skipped';
    }
  }
  await prisma.chapter.create({
    data: {
      mangaId,
      fileName: agg.sharedFileName ?? '',
      filePath: agg.sharedFilePath,
      fileFormat: agg.sharedFileFormat,
      index,
      title: '',
      size: agg.totalSize,
      downloadStatus,
      volume,
      volumeId,
      pageCount: agg.totalPages,
      updatedAt: new Date(),
    },
  });
  return 'created';
}

/**
 * Phase-finalize entry point. Walks every volume that has at least one
 * chapter row for the manga and ensures a volume-file (NULL-chapterNumber)
 * companion row exists with aggregated stats.
 */
export async function ensureVolumeFileRows(mangaId: number): Promise<void> {
  try {
    const chapters = await prisma.chapter.findMany({
      where: { mangaId, chapterNumber: { not: null }, volume: { not: null } },
      select: {
        index: true, pageCount: true, size: true,
        filePath: true, fileName: true, fileFormat: true,
        volume: true, volumeId: true, downloadStatus: true,
      },
    });
    if (chapters.length === 0) return;

    const byVolume = new Map<number, { volumeId: number | null; rows: typeof chapters }>();
    for (const c of chapters) {
      if (c.volume === null) continue;
      const bucket = byVolume.get(c.volume) ?? { volumeId: c.volumeId, rows: [] };
      bucket.rows.push(c);
      // Prefer non-null volumeId once we see one
      if (bucket.volumeId === null && c.volumeId !== null) bucket.volumeId = c.volumeId;
      byVolume.set(c.volume, bucket);
    }

    let created = 0, updated = 0, skipped = 0;
    for (const [volume, { volumeId, rows }] of byVolume.entries()) {
      const agg = aggregateChapterRows(rows);
      // eslint-disable-next-line no-await-in-loop -- per-volume sequential write keeps DB pressure low
      const verdict = await ensureRowForVolume(mangaId, volume, volumeId, agg);
      if (verdict === 'created') created++;
      else if (verdict === 'updated') updated++;
      else skipped++;
    }

    if (created > 0 || updated > 0) {
      logger.info(`[ensureVolumeFileRows] mangaId=${mangaId} created=${created} updated=${updated} skipped=${skipped} (${byVolume.size} volumes)`);
    }
  } catch (err) {
    logger.warn(`[ensureVolumeFileRows] failed for manga ${mangaId} (non-critical)`, err);
  }
}
