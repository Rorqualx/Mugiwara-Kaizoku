/**
 * Volume File-Stub Cleanup
 *
 * A whole-volume archive (`vN.zip` = one tankōbon) is legitimately represented by ONE "volume-file"
 * row — an empty file-backed row (chapterNumber=NULL, empty title) the browser renders as the
 * volume's chapter range ("128-137") and reads as the whole-volume compilation. Imports scaffold
 * MANY such rows for the same archive; the duplicates inflate the volume's CHAPTERS count and its
 * PAGES badge (each carries the whole-archive pageCount). This phase keeps one volume-file row per
 * archive and deletes the duplicates, and repairs per-chapter page counts that were stamped with
 * the whole-archive total — so a reidentify self-heals the data.
 *
 * The `Chapter_one_null_per_volume` partial index can't catch the duplicates — it requires
 * filePath IS NULL; these are file-backed.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

interface StubRow {
  id: number;
  chapterNumber: number | null;
  title: string | null;
  filePath: string | null;
  packDownloadId: bigint | null;
  index: number;
}

/** True when `title` is absent or whitespace-only — an unlabeled placeholder row. */
function isEmptyTitle(title: string | null): boolean {
  return title === null || title.trim() === '';
}

/**
 * Duplicate volume-file rows to delete.
 *
 * Groups empty file-backed rows (chapterNumber=NULL, empty title — the volume-file compilation
 * entries) by their archive path and keeps exactly one per archive (lowest index), deleting the
 * rest.
 *
 * - Never touch packDownloadId rows: a pack download legitimately emits N pre-numbering rows for
 *   the same volume (see Chapter_one_null_per_volume.sql).
 * - Real omake/extras + numbered chapters (which carry a chapterNumber) are never matched here and
 *   are always preserved.
 */
export function selectVolumeFileStubsToDelete(stubs: StubRow[]): number[] {
  const byPath = new Map<string, StubRow[]>();
  for (const s of stubs) {
    const isEmptyFileStub =
      s.packDownloadId === null &&
      s.filePath !== null &&
      s.chapterNumber === null &&
      isEmptyTitle(s.title);
    if (!isEmptyFileStub) continue;
    const key = s.filePath as string;
    const arr = byPath.get(key);
    if (arr) arr.push(s);
    else byPath.set(key, [s]);
  }

  const toDelete: number[] = [];
  for (const arr of byPath.values()) {
    if (arr.length <= 1) continue;
    arr.sort((a, b) => a.index - b.index);
    for (const s of arr.slice(1)) toDelete.push(s.id);
  }
  return toDelete;
}

/**
 * A chapter's pageCount is a mis-stamped whole-archive total when it claims ~the entire volume
 * archive while sharing that archive with other chapters — so it must really be a slice. (The
 * file-derived page counter writes the whole-archive count onto every row pointing at a
 * whole-volume archive; only rows the provider gave per-chapter pages for escaped it.)
 */
export function isMisStampedArchiveCount(
  pageCount: number | null,
  volumePageCount: number | null,
  sharedFileChapterCount: number,
): boolean {
  if (pageCount === null || volumePageCount === null || volumePageCount <= 0) return false;
  if (sharedFileChapterCount < 2) return false;
  return pageCount >= volumePageCount * 0.9;
}

/** The correct slice count for a mis-stamped row: the provider `pages` value, else unknown. */
export function correctedSlicePageCount(pages: number | null): number | null {
  return pages !== null && pages > 0 ? pages : null;
}

interface VolumeChapterRow extends StubRow {
  volumeId: number | null;
  pageCount: number | null;
  pages: number | null;
}

export type PageCountRepair = { id: number; pageCount: number | null };

/** Composite grouping key for "shared archive within a volume". */
function volumeFileKey(volumeId: number, filePath: string): string {
  return `${volumeId}|${filePath}`;
}

/**
 * Mis-stamped page-count repairs, keyed by (volumeId, filePath) so "shared archive" is judged
 * within a volume. A real chapter that claims ~the entire volume archive while sharing it with
 * other rows is a slice that inherited the whole-archive count → reset to the provider `pages`.
 *
 * The volume-file row (chapterNumber=NULL) is deliberately skipped: it IS the whole volume, so its
 * whole-archive count is correct and feeds the volume's page badge.
 */
export function planPageCountRepairs(
  chapters: VolumeChapterRow[],
  volumePageCount: Map<number, number | null>,
): PageCountRepair[] {
  const sharedCount = new Map<string, number>();
  for (const c of chapters) {
    if (c.volumeId === null || c.filePath === null) continue;
    const key = volumeFileKey(c.volumeId, c.filePath);
    sharedCount.set(key, (sharedCount.get(key) ?? 0) + 1);
  }

  const repairs: PageCountRepair[] = [];
  for (const c of chapters) {
    if (c.chapterNumber === null || c.volumeId === null || c.filePath === null) continue;
    const shared = sharedCount.get(volumeFileKey(c.volumeId, c.filePath)) ?? 0;
    if (!isMisStampedArchiveCount(c.pageCount, volumePageCount.get(c.volumeId) ?? null, shared)) continue;
    const corrected = correctedSlicePageCount(c.pages);
    if (corrected === c.pageCount) continue;
    repairs.push({ id: c.id, pageCount: corrected });
  }
  return repairs;
}

/**
 * Stamp each kept volume-file row's pageCount with its volume's canonical page count
 * (Volume.pageCount, cross-validated from providers). The file-derived counter sometimes mis-counts
 * a whole-volume archive row (e.g. Dorohedoro v23 came out 24 instead of 354); since this row IS the
 * volume, its count should equal the volume total — and the volume page badge reads from it. The
 * owning volume is resolved via the archive filePath shared with the volume's numbered chapters
 * (robust to the row's own volumeId being transiently NULL during a reidentify).
 */
export function planVolumeFilePageStamps(
  chapters: VolumeChapterRow[],
  deletedIds: Set<number>,
  volumePageCount: Map<number, number | null>,
): PageCountRepair[] {
  const filePathToVolPages = new Map<string, number>();
  for (const c of chapters) {
    if (c.chapterNumber === null || c.volumeId === null || c.filePath === null) continue;
    const vp = volumePageCount.get(c.volumeId);
    if (typeof vp === 'number' && vp > 0) filePathToVolPages.set(c.filePath, vp);
  }

  const stamps: PageCountRepair[] = [];
  for (const c of chapters) {
    if (deletedIds.has(c.id) || c.chapterNumber !== null || c.filePath === null) continue;
    const target = filePathToVolPages.get(c.filePath);
    if (target === undefined || target === c.pageCount) continue;
    stamps.push({ id: c.id, pageCount: target });
  }
  return stamps;
}

/**
 * Prune duplicate volume-file rows and repair mis-stamped per-chapter page counts.
 *
 * Queried by mangaId, NOT volumeId: during a reidentify the Volume rows are dropped and recreated,
 * which NULLs each stub's volumeId via FK cascade, and a later raw-SQL pass re-homes them — so at
 * this phase a stub may not yet sit in any volume. Dedup matches stubs by archive filePath (a
 * whole-volume `vN.zip` path is unique to one volume), which is stable regardless of volume-
 * assignment timing. The page-count repair is volume-scoped and only touches rows already assigned.
 */
export async function pruneRedundantVolumeFileStubs(mangaId: number): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 } },
    select: { id: true, pageCount: true },
  });
  const volPageCount = new Map(volumes.map(v => [v.id, v.pageCount]));

  const chapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: {
      id: true, volumeId: true, chapterNumber: true, title: true, filePath: true,
      packDownloadId: true, index: true, pageCount: true, pages: true,
    },
  });
  if (chapters.length === 0) return;

  const stubIds = selectVolumeFileStubsToDelete(chapters);
  const deletedSet = new Set(stubIds);
  const updates: PageCountRepair[] = [
    ...planPageCountRepairs(chapters.filter(c => !deletedSet.has(c.id)), volPageCount),
    ...planVolumeFilePageStamps(chapters, deletedSet, volPageCount),
  ];

  if (stubIds.length > 0) {
    await prisma.chapter.deleteMany({ where: { id: { in: stubIds } } });
  }
  if (updates.length > 0) {
    await prisma.$transaction(
      updates.map(u => prisma.chapter.update({ where: { id: u.id }, data: { pageCount: u.pageCount } })),
    );
  }

  if (stubIds.length > 0 || updates.length > 0) {
    logger.info(
      `[enrichmentPipeline] Stub cleanup for manga ${mangaId}: deleted ${stubIds.length} ` +
      `duplicate volume-file rows, set ${updates.length} page counts`,
    );
  }
}
