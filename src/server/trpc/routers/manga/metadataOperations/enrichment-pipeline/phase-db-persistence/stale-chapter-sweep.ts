/**
 * The stale-chapter sweep of the Phase 2 chapter merge: which existing rows the
 * merge deletes because this run's provider list no longer names them.
 *
 * A deleted row loses its id, and its id is what download history, wanted
 * items, read state and volume links point at. So the sweep only deletes a
 * row that nothing later in the run would put back:
 *
 *   - A row numbered within the series' chapter count (1..N) is never stale.
 *     Chapter reconciliation (phase-chapter-reconciliation.ts) fills every
 *     missing number in 1..N with a placeholder right after the merge, so
 *     deleting it only re-created the same chapter under a new id with no
 *     volume. "Why Does Nobody Remember Me in this World" (66 chapters):
 *     MangaDex lists up to 59, the sweep deleted the pending rows 60-66 of
 *     volume 14 and reconciliation inserted them again, unlinked.
 *   - A row that carries user data (a wanted item, a native download, read
 *     progress, a bookmark, history, a chapter file) is never stale.
 *
 * Pure: no DB access.
 */

import { chapterHasUserData } from '@/server/trpc/routers/manga/metadataOperations/refresh/clear-auto-bindings';

import { findKeptVolumeFileRowIds } from '../phase-finalize/volume-file-row-scheme';

/** The fields of an existing chapter row the sweep reads. */
export interface StaleSweepRow {
  id: number;
  index: number;
  chapterNumber: number | null;
  filePath: string | null;
  downloadStatus: string;
  title: string;
  volume: number | null;
  packDownloadId: bigint | null;
  _count: {
    chapterFiles: number;
    ReadingProgress: number;
    ReaderBookmark: number;
    ReadingHistory: number;
    WantedItem: number;
    NativeDownload: number;
  };
}

/** Same pattern as the merge's generic-title check ("Chapter 12", "c012.cbz", "Ch. 5"). */
const GENERIC_TITLE_RE = /^(?:chapter[\s_-]+\d|ch[.\s]+\d|c\d{1,4}(?:\.\w+)?$)/i;

/** A titled chapter 0 is a prologue the provider list does not number, so its absence there does not make it stale; the sweep deleted Bleach's "side-A the sand" and the Fandom phase re-created it under a new id on every refresh. */
function isTitledPrologue(ch: StaleSweepRow): boolean {
  return ch.chapterNumber === 0 && ch.title.trim() !== '' && !GENERIC_TITLE_RE.test(ch.title);
}

/** True when `chapterNumber` is one of the series' own chapters 1..`seriesChapterCount`. */
export function isWithinSeriesCount(chapterNumber: number, seriesChapterCount: number): boolean {
  return seriesChapterCount > 0 && chapterNumber >= 1 && chapterNumber <= seriesChapterCount;
}

/**
 * Find stale PENDING chapter IDs that should be removed.
 *
 * Two passes:
 *   1. Numbered-but-orphaned — rows whose chapterNumber isn't in providerNumbers
 *      and aren't matched by file content. Only runs when provider coverage ≥ 80%,
 *      and never takes a row within the series' chapter count or one with user data.
 *   2. Phantom-stub — rows with chapterNumber=null AND filePath=null AND zero
 *      user-data signals. These are remnants from prior wrong bindings (CV
 *      issues misread as chapters) or from reidentify passes that nulled the
 *      row's chapterNumber. Per-volume rows from `ensureVolumeFileRows` look
 *      the same and are kept.
 *
 * @param seriesChapterCount the series' chapter count this run (Metadata.chapters);
 *   0 when unknown, which leaves the numbered pass as it was.
 */
export function findStaleChapterIds(
  existing: StaleSweepRow[],
  providerNumbers: Set<number>,
  matchedIds: Set<number>,
  expectedChapterCount: number,
  seriesChapterCount = 0,
): number[] {
  const coverageRatio = expectedChapterCount > 0
    ? providerNumbers.size / expectedChapterCount
    : 0;

  const numberedStale = coverageRatio < 0.8 ? [] : existing
    .filter(ch =>
      ch.downloadStatus === 'PENDING' &&
      ch.filePath === null &&
      ch.chapterNumber !== null &&
      Number.isInteger(ch.chapterNumber) &&
      !providerNumbers.has(ch.chapterNumber) &&
      !isWithinSeriesCount(ch.chapterNumber, seriesChapterCount) &&
      !isTitledPrologue(ch) &&
      !matchedIds.has(ch.id) &&
      !chapterHasUserData(ch)
    )
    .map(ch => ch.id);

  // Phantom sweep runs regardless of coverage: a row with no chapterNumber AND
  // no filePath AND no user-data signals carries no information and only
  // exists to clutter the UI.
  const keptVolumeFileRows = findKeptVolumeFileRowIds(existing);
  const phantomStale = existing
    .filter(ch =>
      !keptVolumeFileRows.has(ch.id) &&
      ch.chapterNumber === null &&
      ch.filePath === null &&
      ch.downloadStatus === 'PENDING' &&
      !matchedIds.has(ch.id) &&
      !chapterHasUserData(ch)
    )
    .map(ch => ch.id);

  return [...numberedStale, ...phantomStale];
}
