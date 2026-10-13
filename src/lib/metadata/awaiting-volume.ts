/**
 * Chapters awaiting a volume.
 *
 * An ongoing series publishes chapters before the tankōbon that collects them
 * (Sakamoto Days 256-278 after volume 28; One Piece 1180-1195 after volume
 * 115). No provider gives those chapters a volume or a range yet, so none is
 * written: the chapter keeps `volumeId = NULL` and carries `volume = -1`, the
 * one stored signal for "past the last released volume, waiting for it".
 *
 * `volume = NULL` stays "volume unknown" (an orphan the pipeline could not
 * place). When the real volume is published, the refresh rebuilds its range
 * and the range backfill links these rows to it, replacing the -1 — the rows
 * themselves (files, read progress, monitoring) are never recreated.
 *
 * Pure — shared by the enrichment pipeline, the daily sweep and the UI.
 */

/** `Chapter.volume` value of a chapter released past the last volume. */
export const AWAITING_VOLUME = -1;

/** True when a stored `Chapter.volume` marks the chapter as awaiting its volume. */
export function isAwaitingVolume(volume: number | null | undefined): boolean {
  return volume === AWAITING_VOLUME;
}

/** A chapter row as the awaiting-volume planner needs it. */
export interface AwaitingCandidateRow {
  id: number;
  chapterNumber: number | null;
  volume: number | null;
  volumeId: number | null;
  filePath: string | null;
}

/** The series' volume rows as the planner needs them. */
export interface AwaitingVolumeRow {
  number: number;
  chapterStart: number | null;
  chapterEnd: number | null;
}

/**
 * Rows to tag `volume = -1`: chapters numbered past the end of the last ranged
 * volume that no volume holds.
 *
 * - "Past the end" is by the integer part: a decimal extra (255.5 after a
 *   volume ending at 255) belongs to that volume and is left for the decimal
 *   placement pass.
 * - A row with no volume number is tagged.
 * - A file-less row whose stale number names a ranged volume (Fandom said
 *   "volume 28" for chapter 256, volume 28 ends at 255) or a volume that does
 *   not exist (a deleted "Vol 116 (placeholder)") is tagged.
 * - A file-backed row keeps the number its import gave it, and a row whose
 *   number names a volume without a range is left for the backfill to link.
 * - Rows already tagged, linked to a volume, or excluded by `isCounted`
 *   (a finished series' own chapters) are left alone.
 */
export function planAwaitingVolumeTags(
  rows: readonly AwaitingCandidateRow[],
  volumes: readonly AwaitingVolumeRow[],
  isCounted: (chapterNumber: number) => boolean = () => false,
): number[] {
  const lastEnd = lastRangedVolumeEnd(volumes);
  if (lastEnd === null) return [];
  const ranged = new Set(volumes.filter(v => v.chapterStart !== null && v.chapterEnd !== null).map(v => v.number));
  const existing = new Set(volumes.map(v => v.number));
  const ids: number[] = [];
  for (const row of rows) {
    const n = row.chapterNumber;
    if (n === null || row.volumeId !== null || isAwaitingVolume(row.volume) || isCounted(n)) continue;
    if (Math.floor(n) <= lastEnd) continue;
    const unplaced = row.volume === null
      || (row.filePath === null && (ranged.has(row.volume) || !existing.has(row.volume)));
    if (unplaced) ids.push(row.id);
  }
  return ids;
}

/** Highest `chapterEnd` among numbered (> 0) volumes with a full range, or null. */
export function lastRangedVolumeEnd(volumes: readonly AwaitingVolumeRow[]): number | null {
  let last: number | null = null;
  for (const v of volumes) {
    if (v.number <= 0 || v.chapterStart === null || v.chapterEnd === null) continue;
    if (last === null || v.chapterEnd > last) last = v.chapterEnd;
  }
  return last;
}
