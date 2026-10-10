/**
 * The identifying scheme of the per-volume "volume-file" Chapter rows that
 * `ensure-volume-file-rows.ts` creates: `chapterNumber` NULL, `volume` set, and
 * `index` parked in a synthetic space partitioned by volume number.
 *
 * Shared with the stale-chapter sweep in `phase-db-persistence.ts`, which must
 * tell these intended rows from phantom stubs — both are numberless, file-less
 * and PENDING. Pure, so both sides can be unit-tested.
 */

/** First index of the synthetic space; numbered chapters never reach it. */
const VOLUME_FILE_INDEX_BASE = 100_000;
/** Index distance between consecutive volumes. */
const VOLUME_FILE_INDEX_STRIDE = 100;
/** How far past its base index a row may be bumped when that index is taken. */
export const VOLUME_FILE_INDEX_PROBE_LIMIT = 1000;

/** Preferred index of the volume-file row for a volume. */
export function volumeFileBaseIndex(volume: number): number {
  return VOLUME_FILE_INDEX_BASE + volume * VOLUME_FILE_INDEX_STRIDE;
}

export interface VolumeFileRowCandidate {
  chapterNumber: number | null;
  volume: number | null;
  index: number;
}

/** True when the row is a per-volume row created by `ensureVolumeFileRows`. */
export function isVolumeFileRow(row: VolumeFileRowCandidate): boolean {
  if (row.chapterNumber !== null || row.volume === null) return false;
  const base = volumeFileBaseIndex(row.volume);
  return row.index >= base && row.index <= base + VOLUME_FILE_INDEX_PROBE_LIMIT;
}

/**
 * Volume-file rows the stale sweep must keep: those whose volume still holds a
 * numbered chapter. Deleting them made finalize recreate every one with a new
 * id on each run. A row whose volume has lost all its numbered chapters is not
 * kept — it represents nothing and stays eligible for removal.
 */
export function findKeptVolumeFileRowIds(rows: ReadonlyArray<VolumeFileRowCandidate & { id: number }>): Set<number> {
  const volumesWithChapters = new Set<number>();
  for (const row of rows) {
    if (row.chapterNumber !== null && row.volume !== null) volumesWithChapters.add(row.volume);
  }
  const kept = new Set<number>();
  for (const row of rows) {
    if (isVolumeFileRow(row) && row.volume !== null && volumesWithChapters.has(row.volume)) kept.add(row.id);
  }
  return kept;
}

/** Largest value a Postgres `integer` (int4) column holds. */
export const INT4_MAX = 2_147_483_647;

/**
 * `Chapter.size` is int4, and a per-volume row stores the SUM of its chapters'
 * sizes: One Piece reached 2,558,355,943 bytes, the write failed with "out of
 * range for type integer" and aborted the step for the whole title on every
 * run. Clamping keeps the step alive; the stored size of such a volume is then
 * a floor, not the real total. Widening the column to bigint is the real fix
 * and needs a schema migration.
 */
export function clampToInt4(value: number): number {
  return Math.min(value, INT4_MAX);
}
