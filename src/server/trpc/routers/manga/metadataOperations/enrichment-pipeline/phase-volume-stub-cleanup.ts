/**
 * Volume File-Stub Cleanup
 *
 * Whole-volume-archive imports (one `vN.zip` = one tankōbon) scaffold one chapter row per
 * expected chapter, all sharing that single archive file. Reconciliation numbers the rows that
 * match a provider chapter list and orphans the rest as empty stubs (chapterNumber=NULL, empty
 * title, filePath=vN.zip) that still carry the whole archive's pageCount. These inflate both the
 * volume's CHAPTERS count and its PAGES badge (useVolumeStatistics sums every chapter's pageCount).
 *
 * The `Chapter_one_null_per_volume` partial index can't catch them — it requires filePath IS NULL;
 * these are file-backed. This phase prunes the redundant stubs and repairs the per-chapter page
 * counts that were stamped with the whole-archive total, so a reidentify self-heals the data.
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
 * Stub rows to delete within a single volume.
 *
 * - Empty file-backed rows duplicating a numbered chapter's archive are fully redundant (the
 *   numbered chapters already represent that archive) → delete all of them.
 * - Among remaining empty stubs whose file no numbered chapter covers, keep one per filePath as
 *   the legitimate "volume file" entry the browser renders → delete the rest.
 * - Never touch packDownloadId rows: a pack download legitimately emits N pre-numbering rows for
 *   the same volume (see Chapter_one_null_per_volume.sql).
 *
 * Real omake/extras (which carry a chapterNumber and a title) never match and are preserved.
 */
export function selectVolumeFileStubsToDelete(
  stubs: StubRow[],
  numberedFilePaths: Set<string>,
): number[] {
  const toDelete = new Set<number>();
  const uncovered: StubRow[] = [];

  for (const s of stubs) {
    const isEmptyFileStub =
      s.packDownloadId === null &&
      s.filePath !== null &&
      s.chapterNumber === null &&
      isEmptyTitle(s.title);
    if (!isEmptyFileStub) continue;

    if (numberedFilePaths.has(s.filePath as string)) {
      toDelete.add(s.id);
    } else {
      uncovered.push(s);
    }
  }

  const byPath = new Map<string, StubRow[]>();
  for (const s of uncovered) {
    const key = s.filePath as string;
    const arr = byPath.get(key);
    if (arr) arr.push(s);
    else byPath.set(key, [s]);
  }
  for (const arr of byPath.values()) {
    if (arr.length <= 1) continue;
    arr.sort((a, b) => a.index - b.index);
    for (const s of arr.slice(1)) toDelete.add(s.id);
  }

  return [...toDelete];
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
  pageCount: number | null;
  pages: number | null;
}

export interface VolumeCleanupPlan {
  stubIds: number[];
  repairs: Array<{ id: number; pageCount: number | null }>;
}

/**
 * Pure per-volume plan: which empty stub rows to delete and which mis-stamped page counts to
 * repair. Composes the three guards above so the async runner stays a thin read → plan → write.
 */
export function planVolumeCleanup(
  chapters: VolumeChapterRow[],
  volumePageCount: number | null,
): VolumeCleanupPlan {
  const numberedFilePaths = new Set<string>();
  for (const c of chapters) {
    if (c.chapterNumber !== null && c.filePath !== null) numberedFilePaths.add(c.filePath);
  }
  const stubIds = selectVolumeFileStubsToDelete(chapters, numberedFilePaths);

  const deletedSet = new Set(stubIds);
  const survivors = chapters.filter(c => !deletedSet.has(c.id));
  const sharedCount = new Map<string, number>();
  for (const c of survivors) {
    if (c.filePath !== null) sharedCount.set(c.filePath, (sharedCount.get(c.filePath) ?? 0) + 1);
  }

  const repairs: VolumeCleanupPlan['repairs'] = [];
  for (const c of survivors) {
    if (c.filePath === null) continue;
    const shared = sharedCount.get(c.filePath) ?? 0;
    if (!isMisStampedArchiveCount(c.pageCount, volumePageCount, shared)) continue;
    const corrected = correctedSlicePageCount(c.pages);
    if (corrected === c.pageCount) continue;
    repairs.push({ id: c.id, pageCount: corrected });
  }
  return { stubIds, repairs };
}

/**
 * Prune redundant file-backed volume stubs and repair mis-stamped per-chapter page counts.
 * Runs late in the pipeline (after numbering, overflow, and bonus reassignment) so the surviving
 * rows are the canonical chapter list before this cleanup compares against it.
 */
export async function pruneRedundantVolumeFileStubs(mangaId: number): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 } },
    select: { id: true, pageCount: true },
  });
  if (volumes.length === 0) return;

  const chapters = await prisma.chapter.findMany({
    where: { volumeId: { in: volumes.map(v => v.id) } },
    select: {
      id: true, volumeId: true, chapterNumber: true, title: true, filePath: true,
      packDownloadId: true, index: true, pageCount: true, pages: true,
    },
  });
  if (chapters.length === 0) return;

  const byVolume = new Map<number, typeof chapters>();
  for (const c of chapters) {
    if (c.volumeId === null) continue;
    const arr = byVolume.get(c.volumeId);
    if (arr) arr.push(c);
    else byVolume.set(c.volumeId, [c]);
  }

  const volPageCount = new Map(volumes.map(v => [v.id, v.pageCount]));
  const stubIdsToDelete: number[] = [];
  const pageCountRepairs: VolumeCleanupPlan['repairs'] = [];
  for (const [volumeId, volChapters] of byVolume) {
    const plan = planVolumeCleanup(volChapters, volPageCount.get(volumeId) ?? null);
    stubIdsToDelete.push(...plan.stubIds);
    pageCountRepairs.push(...plan.repairs);
  }

  if (stubIdsToDelete.length > 0) {
    await prisma.chapter.deleteMany({ where: { id: { in: stubIdsToDelete } } });
  }
  if (pageCountRepairs.length > 0) {
    await prisma.$transaction(
      pageCountRepairs.map(r =>
        prisma.chapter.update({ where: { id: r.id }, data: { pageCount: r.pageCount } })),
    );
  }

  if (stubIdsToDelete.length > 0 || pageCountRepairs.length > 0) {
    logger.info(
      `[enrichmentPipeline] Stub cleanup for manga ${mangaId}: deleted ${stubIdsToDelete.length} ` +
      `redundant file-backed volume stubs, repaired ${pageCountRepairs.length} mis-stamped page counts`,
    );
  }
}
