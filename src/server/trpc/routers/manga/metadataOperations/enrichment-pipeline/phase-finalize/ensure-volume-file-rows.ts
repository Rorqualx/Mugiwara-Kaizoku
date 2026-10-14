/**
 * Phase-finalize step: ensure each volume with chapter rows has exactly one
 * "volume-file" Chapter row representing the volume as a whole.
 *
 * Two import shapes converge here:
 *  - **Compendium archive** (e.g., Chainsaw Man Color "V01.cbz" with chs 1-8):
 *    a single archive file shared across N chapter rows. The volume-file row
 *    has `filePath` set to that archive and `size` copied from one of the
 *    chapter rows (each carries the archive's size); `pageCount` is the sum
 *    of the chapters' own page counts.
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
import { chapterNumberFromFileName, isSingleChapterFile } from '@/server/services/library/chapter-file-name';
import { logger } from '@/utils/logger';

import { VOLUME_FILE_INDEX_PROBE_LIMIT, volumeFileBaseIndex } from './volume-file-row-scheme';

interface ChapterAggregate {
  count: number;
  completedCount: number;
  totalPages: number;
  /** Bytes. Kept as bigint end to end: read from and written back to the
   *  BigInt `Chapter.size` column, and a long series' volume exceeds int4. */
  totalSize: bigint;
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
  size: bigint;
  filePath: string | null;
  downloadStatus: ChapterStatus;
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
    select: { id: true, pageCount: true, size: true, filePath: true, downloadStatus: true },
  });
}

/**
 * The one archive a volume's chapter rows share, or null.
 *
 * At least two rows must point at it. A volume where a single chapter has a
 * file (the rest are pending) has one distinct path too, but that file is the
 * chapter, not the volume: Blue Exorcist volume 10 got a second file-backed
 * row for `c039.cbz`, which read as that chapter deleted and re-created.
 *
 * A file named for one chapter is never the volume's archive, however many rows
 * point at it: SPY x FAMILY volume 17's rows 119, 120.1, 123.1 … all held
 * `V17 C119.cbz`, and adopting it as the archive kept linking the rest of the
 * volume to chapter 119's file on every refresh.
 */
export function sharedArchivePath(rows: Array<{ filePath: string | null }>): string | null {
  const holders = new Map<string, number>();
  for (const r of rows) {
    if (r.filePath) holders.set(r.filePath, (holders.get(r.filePath) ?? 0) + 1);
  }
  if (holders.size !== 1) return null;
  const [only] = [...holders.entries()];
  if (only === undefined || only[1] < 2 || isSingleChapterFile(only[0])) return null;
  return only[0];
}

/**
 * True when a numberless row holding a single-chapter file may drop it: the
 * chapter's own numbered row holds the file too (so it stays linked), and the
 * volume has no other file-less numberless row (only one may exist:
 * `Chapter_one_null_per_volume`). Neon Genesis Evangelion's numberless row is
 * the only holder of `Chapter 0029.cbz`; clearing it would orphan the file.
 */
async function mayReleaseChapterFile(mangaId: number, volume: number, row: { id: number; filePath: string }): Promise<boolean> {
  const fileChapter = chapterNumberFromFileName(row.filePath);
  if (fileChapter === null) return false;
  const [owner, twin] = await Promise.all([
    prisma.chapter.findFirst({ where: { mangaId, filePath: row.filePath, chapterNumber: fileChapter }, select: { id: true } }),
    prisma.chapter.findFirst({
      where: { mangaId, volume, chapterNumber: null, filePath: null, packDownloadId: null, id: { not: row.id } },
      select: { id: true },
    }),
  ]);
  return owner !== null && twin === null;
}

/**
 * True when `archivePath` already has a numberless row and this volume's own
 * row is not one of them. One archive is one row: Bleach's `V74.cbz` row sits
 * in volume 74, its mis-numbered chapter rows in volume 75, and every refresh
 * added another file-backed row for the same archive to volume 75. A volume
 * whose own row holds the archive is still refreshed.
 */
export function archiveHasOtherRow(
  archivePath: string | null,
  archiveRowIds: Map<string, number[]>,
  ownRowId: number | null,
): boolean {
  if (archivePath === null) return false;
  const holders = archiveRowIds.get(archivePath) ?? [];
  return holders.length > 0 && (ownRowId === null || !holders.includes(ownRowId));
}

/** Ids of the manga's numberless file-backed rows, by archive path. */
async function loadArchiveRowIds(mangaId: number): Promise<Map<string, number[]>> {
  const rows = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: null, filePath: { not: null } },
    select: { id: true, filePath: true },
  });
  const byPath = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.filePath) continue;
    byPath.set(r.filePath, [...(byPath.get(r.filePath) ?? []), r.id]);
  }
  return byPath;
}

function aggregateChapterRows(
  rows: Array<{ index: number; pageCount: number | null; size: bigint; filePath: string | null; fileName: string; fileFormat: string | null; downloadStatus: string }>,
): ChapterAggregate {
  let completedCount = 0;
  let totalPages = 0;
  let totalSize = BigInt(0);
  let largestSize = BigInt(0);
  let seedIndex = rows[0]?.index ?? 0;
  for (const r of rows) {
    if (r.downloadStatus === ChapterStatus.COMPLETED) completedCount++;
    totalPages += r.pageCount ?? 0;
    totalSize += r.size;
    if (r.size > largestSize) largestSize = r.size;
    if (r.index < seedIndex) seedIndex = r.index;
  }
  const sharedFilePath = sharedArchivePath(rows);
  const carrier = sharedFilePath !== null ? rows.find(r => r.filePath === sharedFilePath) : undefined;
  const firstFileName = carrier?.fileName ?? null;
  const firstFileFormat = carrier?.fileFormat ?? null;
  return {
    count: rows.length,
    completedCount,
    totalPages,
    // Every chapter row of a shared archive stores the WHOLE archive's size, so
    // summing them counted the archive once per chapter (One Piece vol 1:
    // 8 × 152 MB). A shared archive's size is the size of one row.
    totalSize: sharedFilePath !== null ? largestSize : totalSize,
    sharedFilePath,
    sharedFileName: sharedFilePath !== null ? firstFileName : null,
    sharedFileFormat: sharedFilePath !== null ? firstFileFormat : null,
    seedIndex,
  };
}

/** Bring a volume's existing numberless row in line with its chapters' aggregate. */
async function refreshExistingRow(
  mangaId: number,
  volume: number,
  existing: VolumeFileRow,
  agg: ChapterAggregate,
  downloadStatus: ChapterStatus,
): Promise<'updated' | 'skipped'> {
  // A file-backed volume row whose numbered chapters do NOT share one
  // archive path is a pack-import compendium pointer (chapters may be
  // pending or in per-chapter files from another source). Leave it alone:
  // nulling its filePath / overwriting its archive-derived stats with
  // chapter-row aggregates would orphan the archive on disk.
  // A row holding a file named for one chapter is not a compendium pointer:
  // it held that chapter's file as if it were the volume's archive, and
  // linkArchiveCoveredChapters spread the file to the volume's other rows.
  // It is cleared to the per-chapter shape below when its chapter's own row
  // holds the file.
  if (existing.filePath !== null && agg.sharedFilePath === null) {
    const releasable = isSingleChapterFile(existing.filePath)
      && await mayReleaseChapterFile(mangaId, volume, { id: existing.id, filePath: existing.filePath });
    if (!releasable) return 'skipped';
  }
  // Status is compared too: chapters can complete (or lose their files)
  // without the page or size totals moving, which left the row's status stale.
  const needsUpdate = (existing.pageCount ?? 0) !== agg.totalPages
    || existing.size !== agg.totalSize
    || existing.filePath !== agg.sharedFilePath
    || existing.downloadStatus !== downloadStatus;
  if (!needsUpdate) return 'skipped';
  await prisma.chapter.update({
    where: { id: existing.id },
    data: {
      pageCount: agg.totalPages,
      size: agg.totalSize,
      downloadStatus,
      ...(agg.sharedFilePath !== null
        ? { filePath: agg.sharedFilePath, fileName: agg.sharedFileName ?? '', fileFormat: agg.sharedFileFormat }
        : { filePath: null, ...(existing.filePath !== null ? { fileName: '', fileFormat: null } : {}) }),
    },
  });
  return 'updated';
}

async function ensureRowForVolume(
  mangaId: number,
  volume: number,
  volumeId: number | null,
  agg: ChapterAggregate,
  archiveRowIds: Map<string, number[]>,
): Promise<'created' | 'updated' | 'skipped'> {
  const existing = await findExistingVolumeFileRow(mangaId, volume);
  if (archiveHasOtherRow(agg.sharedFilePath, archiveRowIds, existing?.id ?? null)) return 'skipped';
  const downloadStatus: ChapterStatus = agg.completedCount === agg.count
    ? ChapterStatus.COMPLETED
    : ChapterStatus.PENDING;
  const size = agg.totalSize;

  if (existing) return refreshExistingRow(mangaId, volume, existing, agg, downloadStatus);

  // No existing row — create one. Index strategy: park in the synthetic
  // 100_000+ space partitioned by volume number so it doesn't collide with
  // numbered chapter indices. On collision (already used), bump until free.
  const baseIndex = volumeFileBaseIndex(volume);
  let index = baseIndex;
  // eslint-disable-next-line no-await-in-loop -- bounded probe, almost always one iteration
  while (await prisma.chapter.findFirst({ where: { mangaId, index }, select: { id: true } })) {
    index++;
    if (index > baseIndex + VOLUME_FILE_INDEX_PROBE_LIMIT) {
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
      size,
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
 * Delete file-less volume-file rows stranded in a volume that no longer holds
 * any numbered chapters. These orphans appear when reconciliation rewrites
 * `Chapter.volume` for the numbered rows but leaves their companion volume-file
 * row behind in the old volume — the row then represents nothing on disk yet
 * still reads as a COMPLETED "whole-volume archive", inflating coverage. Only
 * file-LESS rows are removed; a row with a real `filePath` points at an actual
 * archive on disk and is preserved even when its volume has no numbered rows.
 *
 * @param volumesWithChapters volume numbers that currently have numbered chapters.
 */
async function removeOrphanedVolumeFileRows(
  mangaId: number,
  volumesWithChapters: Set<number>,
): Promise<number> {
  const containers = await prisma.chapter.findMany({
    where: {
      mangaId,
      chapterNumber: null,
      OR: [{ filePath: null }, { filePath: '' }],
    },
    select: { id: true, volume: true },
  });
  const orphanIds = containers
    .filter(c => c.volume !== null && !volumesWithChapters.has(c.volume))
    .map(c => c.id);
  if (orphanIds.length === 0) return 0;
  const result = await prisma.chapter.deleteMany({ where: { id: { in: orphanIds } } });
  return result.count;
}

/**
 * Phase-finalize entry point. Walks every volume that has at least one
 * chapter row for the manga and ensures a volume-file (NULL-chapterNumber)
 * companion row exists with aggregated stats.
 */
export async function ensureVolumeFileRows(mangaId: number): Promise<void> {
  try {
    // Volume -1 is "unassigned", not a volume: a row for it was a numberless,
    // file-less stub the next run's stale sweep deleted and this step re-created.
    const chapters = await prisma.chapter.findMany({
      where: { mangaId, chapterNumber: { not: null }, volume: { gte: 0 } },
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

    const archiveRowIds = await loadArchiveRowIds(mangaId);
    let created = 0, updated = 0, skipped = 0;
    for (const [volume, { volumeId, rows }] of byVolume.entries()) {
      const agg = aggregateChapterRows(rows);
      // eslint-disable-next-line no-await-in-loop -- per-volume sequential write keeps DB pressure low
      const verdict = await ensureRowForVolume(mangaId, volume, volumeId, agg, archiveRowIds);
      if (verdict === 'created') created++;
      else if (verdict === 'updated') updated++;
      else skipped++;
    }

    const orphansRemoved = await removeOrphanedVolumeFileRows(mangaId, new Set(byVolume.keys()));

    if (created > 0 || updated > 0 || orphansRemoved > 0) {
      logger.info(`[ensureVolumeFileRows] mangaId=${mangaId} created=${created} updated=${updated} skipped=${skipped} orphansRemoved=${orphansRemoved} (${byVolume.size} volumes)`);
    }
  } catch (err) {
    logger.warn(`[ensureVolumeFileRows] failed for manga ${mangaId} (non-critical)`, err);
  }
}
