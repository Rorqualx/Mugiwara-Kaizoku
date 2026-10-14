/**
 * Stale orphan volume detection for volume reconciliation.
 */

/**
 * True when an orphan `Chapter.volume` is a stale number rather than a missing volume: it is
 * numbered past every existing volume and past the expected count, and each of its chapters
 * already sits inside an existing volume's range. One Piece: rows 1145-1152 kept volume 117 from
 * an older run while the providers' volume 113 is 1145-1155, and every refresh rebuilt a
 * "reconciliation" volume 117 over them. Not rebuilding it leaves the rows to the range-based
 * volumeId backfill, which links them to the volume that holds their chapters.
 */
type RangedVolume = { number: number; chapterStart: number | null; chapterEnd: number | null };

function isCovered(n: number, volumes: readonly RangedVolume[]): boolean {
  return volumes.some(v => v.chapterStart !== null && v.chapterEnd !== null && n >= v.chapterStart && n <= v.chapterEnd);
}

/**
 * An orphan's chapter span with the ends other volumes' ranges already hold
 * trimmed off, or null when nothing is left. Used when an orphan is rebuilt
 * from its own rows: "Why Does Nobody Remember Me in this World" rows 48-59
 * still carried volume 13 after MangaDex's volume 11 took 48, and rebuilding
 * 48-59 would overlap volume 11.
 */
export function uncoveredOrphanSpan(
  orphan: { min_ch: number | null; max_ch: number | null },
  existingVolumes: readonly RangedVolume[],
): { start: number; end: number } | null {
  if (orphan.min_ch === null || orphan.max_ch === null) return null;
  let start = orphan.min_ch;
  let end = orphan.max_ch;
  while (start <= end && isCovered(Math.floor(start), existingVolumes)) start = Math.floor(start) + 1;
  while (end >= start && isCovered(Math.floor(end), existingVolumes)) end = Math.ceil(end) - 1;
  return start <= end ? { start, end } : null;
}

export function isStaleOrphanCoveredByRanges(
  orphan: { volume: number; min_ch: number | null; max_ch: number | null },
  existingVolumes: Array<{ number: number; chapterStart: number | null; chapterEnd: number | null }>,
  expectedVolumeCount: number | null,
): boolean {
  if (orphan.min_ch === null || orphan.max_ch === null) return false;
  if (expectedVolumeCount !== null && expectedVolumeCount > 0 && orphan.volume <= expectedVolumeCount) return false;
  if (existingVolumes.some(v => v.number >= orphan.volume)) return false;
  const ranged = existingVolumes.filter(v => v.chapterStart !== null && v.chapterEnd !== null);
  if (ranged.length === 0) return false;
  for (let n = Math.floor(orphan.min_ch); n <= Math.floor(orphan.max_ch); n++) {
    const covered = ranged.some(v => n >= (v.chapterStart ?? Infinity) && n <= (v.chapterEnd ?? -Infinity));
    if (!covered) return false;
  }
  return true;
}
