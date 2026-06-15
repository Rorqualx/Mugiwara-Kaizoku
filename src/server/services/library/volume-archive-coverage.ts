/**
 * Volume-archive coverage helpers (pure).
 *
 * A "volume-file row" is a Chapter row with `chapterNumber === null` that
 * represents a whole-volume archive (e.g. `Akira V01.cbr`). When such a row is
 * COMPLETED **and file-backed** (has a real `filePath`), every numbered chapter
 * in that same `volume` is physically present on disk inside the archive — even
 * if those chapter rows were never individually downloaded.
 *
 * Two consumers share this logic:
 *  - `linkArchiveCoveredChapters` (enrichment finalize) flips the covered
 *    numbered chapters to COMPLETED and points their `filePath` at the archive,
 *    matching the pack-import `linkVolumeChapters` model. Without this, a
 *    range/manifest fix that re-homes chapters leaves them PENDING, so the
 *    download monitor keeps trying to fetch content that's already on disk.
 *  - The release dispatcher skips chapters whose volume is archive-covered, so
 *    a "reset for downloads" (or any PENDING drift) never re-downloads a volume
 *    that's already complete.
 *
 * Everything here is pure (no Prisma/IO) so it can be exhaustively unit-tested.
 */

/** Minimal chapter shape needed to reason about volume-archive coverage. */
export interface CoverageRow {
  id: number;
  chapterNumber: number | null;
  volume: number | null;
  filePath: string | null;
  downloadStatus: string;
  fileName?: string | null;
  fileFormat?: string | null;
  size?: number | null;
  pageCount?: number | null;
}

/** A link operation: point `chapterId` at the volume archive's file. */
export interface ChapterLink {
  chapterId: number;
  filePath: string;
  fileName: string;
  fileFormat: string | null;
  size: number;
  pageCount: number | null;
}

const COMPLETED = 'COMPLETED';

const hasFile = (r: CoverageRow): boolean => r.filePath !== null && r.filePath !== '';
const isArchiveRow = (r: CoverageRow): boolean => r.chapterNumber === null;
const isNumbered = (r: CoverageRow): boolean => r.chapterNumber !== null;
const isDone = (r: CoverageRow): boolean => r.downloadStatus === COMPLETED;
const isRealVolume = (v: number | null): v is number => typeof v === 'number' && v >= 0;

/** Pick the file-backed COMPLETED archive row for a volume, if any. */
function fileBackedArchive(rows: CoverageRow[]): CoverageRow | undefined {
  return rows.find(r => isArchiveRow(r) && isDone(r) && hasFile(r));
}

/**
 * Set of real volume numbers (>= 0) that have a file-backed COMPLETED
 * whole-volume archive. Numbered chapters in these volumes are covered on disk.
 */
export function volumesWithFileBackedArchive(rows: CoverageRow[]): Set<number> {
  const out = new Set<number>();
  for (const r of rows) {
    if (isArchiveRow(r) && isDone(r) && hasFile(r) && isRealVolume(r.volume)) {
      out.add(r.volume);
    }
  }
  return out;
}

/** Build the link payload for one chapter — keep an individual per-chapter file
 *  when the chapter has its own (different from the archive), otherwise point it
 *  at the volume archive. */
function buildLink(chapter: CoverageRow, archive: CoverageRow & { filePath: string }): ChapterLink {
  const ownsFile = hasFile(chapter) && chapter.filePath !== archive.filePath;
  const src = ownsFile ? chapter : archive;
  return {
    chapterId: chapter.id,
    filePath: src.filePath as string,
    fileName: src.fileName ?? '',
    fileFormat: src.fileFormat ?? null,
    size: src.size ?? 0,
    pageCount: src.pageCount ?? null,
  };
}

/**
 * For each real volume that has a file-backed archive, produce link ops for the
 * numbered chapters that are NOT yet COMPLETED — both chapters with no file (link
 * to the archive) and chapters already pointing at the archive but stuck PENDING
 * (re-complete them; this is the Kaiju case a download-reset leaves behind).
 * Chapters that are already COMPLETED are skipped (idempotent), and a chapter
 * carrying its own individual file keeps that file rather than the archive. The
 * archive row itself is never linked.
 */
export function selectChaptersToLink(rows: CoverageRow[]): ChapterLink[] {
  const byVolume = new Map<number, CoverageRow[]>();
  for (const r of rows) {
    if (!isRealVolume(r.volume)) continue;
    const bucket = byVolume.get(r.volume) ?? [];
    bucket.push(r);
    byVolume.set(r.volume, bucket);
  }

  const links: ChapterLink[] = [];
  for (const group of byVolume.values()) {
    const archive = fileBackedArchive(group);
    if (!archive?.filePath) continue;
    const fileBacked = archive as CoverageRow & { filePath: string };
    for (const r of group) {
      if (!isNumbered(r) || isDone(r)) continue; // skip archive row + already-complete chapters
      links.push(buildLink(r, fileBacked));
    }
  }
  return links;
}

/**
 * Drop download candidates whose volume is archive-covered. Candidates in the
 * unassigned bucket (null/negative volume) are always kept — there's no
 * whole-volume archive that can cover them.
 */
export function filterUncoveredCandidates<T extends { volume: number | null }>(
  candidates: T[],
  coveredVolumes: Set<number>,
): T[] {
  return candidates.filter(c => !(isRealVolume(c.volume) && coveredVolumes.has(c.volume)));
}
