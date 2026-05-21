/**
 * Sparse-Volume Range Pruner
 *
 * Detects and corrects the ComicVine "sparse-then-dense" bug surfaced
 * by iter-B0 audit on Frieren + That Time I Got Reincarnated as a
 * Slime: provider returned Vols 1-3 each with `chapterStart = chapterEnd`
 * (so "Volume 1 contains chapter 1 only" — wrong; real Frieren Vol 1
 * has chapters 1-9), then Vols 4+ have proper multi-chapter spans.
 * The bogus ranges teach the UI to render `Volume 1 (1-1)` and trick
 * downstream assignment passes into linking the wrong chapters.
 *
 * Detection (conservative):
 *   1. A run of ≥ 2 leading volumes (sorted by `number` ASC) all have
 *      `chapterEnd - chapterStart = 0` (single-chapter span).
 *   2. The volumes AFTER the run have median span ≥ 5 chapters.
 *
 * When both hold, NULL out `chapterStart` + `chapterEnd` on the leading
 * sparse volumes. Their `Chapter.volume` assignments are preserved so
 * existing chapters stay grouped under those volume headers — only the
 * range claim is removed, so the UI stops showing the misleading
 * "(1-1)" annotation.
 *
 * Does NOT touch trailing single-chapter volumes (Frieren Vols 11-14
 * each have chapterStart=chapterEnd because the manga is ongoing and
 * only one chapter has been published in those volumes so far —
 * legitimately sparse, not bogus).
 *
 * Runs late in the pipeline (after correctVolumeAssignments) so its
 * NULLing doesn't cause earlier passes to orphan-unlink the affected
 * chapters.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const LEADING_SPARSE_MIN = 2;
const REST_MEDIAN_MIN = 5;
const INTERLEAVED_RUN_MIN = 2;
const NEIGHBOR_DENSE_MIN = 3;

interface VolumeLite {
  id: number;
  number: number;
  chapterStart: number;
  chapterEnd: number;
}

function spanOf(v: VolumeLite): number {
  return v.chapterEnd - v.chapterStart;
}

function medianOf(spans: number[]): number {
  if (spans.length === 0) return 0;
  const sorted = [...spans].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Find the prefix of leading single-chapter volumes if the volume tree
 * matches the sparse-then-dense pattern. Returns the IDs to prune, or
 * an empty array when the pattern doesn't apply.
 */
export function detectSparseLeadingRange(volumes: VolumeLite[]): number[] {
  if (volumes.length < 4) return [];
  let leading = 0;
  for (const v of volumes) {
    if (spanOf(v) === 0) leading++;
    else break;
  }
  if (leading < LEADING_SPARSE_MIN) return [];
  const restSpans = volumes.slice(leading).map(spanOf).map(s => s + 1);
  if (restSpans.length < 3) return [];
  const restMedian = medianOf(restSpans);
  if (restMedian < REST_MEDIAN_MIN) return [];
  return volumes.slice(0, leading).map(v => v.id);
}

/**
 * iter-B3: detect runs of consecutive single-chapter volumes that are
 * INTERLEAVED between multi-chapter neighbors — the same ComicVine
 * sparse-data bug as the leading case, but the bogus rows aren't at
 * the beginning of the volume sequence.
 *
 * Slime is the canonical case: Vols 1-4 single-chapter, Vols 5-8
 * 9-chapter, Vols 9-16 single-chapter (sandwiched between Vol 8
 * span=8 and Vol 17 span=4), Vols 17+ medium dense. iter-B1's
 * leading detector rejected Slime because the OVERALL rest-median
 * was pulled down by the interleaved sparse — but a local-sandwich
 * check confirms both Vols 1-4 and Vols 9-16 are wrong.
 *
 * Rules:
 *   - Run length ≥ 2 (single isolated sparse vols could be real)
 *   - LEADING run (no prev neighbor): next vol must have span ≥ 3
 *   - INTERIOR run: BOTH prev AND next vols must have span ≥ 3
 *   - TRAILING run (no next): SKIPPED — could be an ongoing manga
 *     whose latest volumes only have one chapter published so far
 *     (Frieren Vols 11-14 — legitimately single-chapter, must not
 *     be touched)
 *
 * Neighbor threshold is 3 (looser than the leading detector's 5)
 * because Slime's Vol 17 only has span=4 yet the sandwiched run is
 * clearly bogus. The neighbor just needs to be "multi-chapter, not
 * a single".
 */
export function detectInterleavedSparseRuns(volumes: VolumeLite[]): number[] {
  if (volumes.length < 4) return [];
  const ids: number[] = [];
  let i = 0;
  while (i < volumes.length) {
    if (spanOf(volumes[i] as VolumeLite) !== 0) { i++; continue; }
    // Found start of a sparse run.
    let j = i;
    while (j < volumes.length && spanOf(volumes[j] as VolumeLite) === 0) j++;
    const runLen = j - i;
    if (runLen >= INTERLEAVED_RUN_MIN) {
      const prev = i === 0 ? null : volumes[i - 1];
      const next = j === volumes.length ? null : volumes[j];
      const prevDense = prev !== undefined && prev !== null && spanOf(prev) >= NEIGHBOR_DENSE_MIN;
      const nextDense = next !== undefined && next !== null && spanOf(next) >= NEIGHBOR_DENSE_MIN;
      const isLeading = prev === null;
      const isTrailing = next === null;
      const shouldPrune = isTrailing
        ? false
        : isLeading
          ? nextDense
          : (prevDense && nextDense);
      if (shouldPrune) {
        for (let k = i; k < j; k++) ids.push((volumes[k] as VolumeLite).id);
      }
    }
    i = j;
  }
  return ids;
}

/**
 * Detect the "majority-sparse with isolated wide outlier" pattern, the
 * Sweat-and-Soap ComicVine bug: nearly every volume claims a single-
 * chapter span (e.g. vol 3 = ch 3..3, vol 4 = ch 4..4) AND one volume
 * claims a wide range that doesn't fit the others (vol 7 = ch 53..62).
 *
 * The wide outlier is the one that creates phantom duplicates — its
 * chapter numbers don't align with any other source, so the merge
 * recreates ch 53-62 stubs even after manual cleanup. The single-
 * chapter ranges are also wrong (no manga vol holds exactly 1 chapter
 * across most of its run) but they're individually harmless.
 *
 * Conservative thresholds — avoid false-firing on:
 *   - Short manga (≤4 vols): could legitimately be a 1-chapter-per-vol
 *     compilation/one-shot series.
 *   - Series with normal span variation: median span ≥ 2 means the
 *     provider's data is internally consistent; don't touch.
 *   - Ongoing series with several trailing one-shot vols: handled by
 *     the leading/interleaved detectors above; if those don't fire, we
 *     also leave the trailing alone here.
 *
 * Rules:
 *   - ≥ 5 volumes total
 *   - ≥ 70% of volumes have span = 0
 *   - Median span across all volumes ≤ 1
 *   - At least one volume has span ≥ 4 (the outlier — without it, this
 *     is just a one-shot collection, not the bug)
 *
 * When the pattern matches, returns IDs of ALL volumes (sparse + wide
 * outlier). The whole provider's volume-range data is unreliable, so
 * we let the downstream reconciliation phase compute ranges from chapter
 * assignment instead.
 */
const MAJORITY_SPARSE_MIN_VOLS = 5;
const MAJORITY_SPARSE_RATIO = 0.7;
const MAJORITY_SPARSE_MEDIAN_MAX = 1;
const MAJORITY_SPARSE_OUTLIER_MIN = 4;

export function detectMajoritySparseRuns(volumes: VolumeLite[]): number[] {
  if (volumes.length < MAJORITY_SPARSE_MIN_VOLS) return [];
  const spans = volumes.map(spanOf);
  const sparseCount = spans.filter(s => s === 0).length;
  const sparseRatio = sparseCount / spans.length;
  if (sparseRatio < MAJORITY_SPARSE_RATIO) return [];
  if (medianOf(spans) > MAJORITY_SPARSE_MEDIAN_MAX) return [];
  const hasWideOutlier = spans.some(s => s >= MAJORITY_SPARSE_OUTLIER_MIN);
  if (!hasWideOutlier) return [];
  return volumes.map(v => v.id);
}

async function loadVolumes(mangaId: number): Promise<VolumeLite[]> {
  const rows = await prisma.volume.findMany({
    where: {
      mangaId, number: { gt: 0 },
      chapterStart: { not: null }, chapterEnd: { not: null },
    },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });
  return rows
    .filter((r): r is typeof r & { chapterStart: number; chapterEnd: number } =>
      r.chapterStart !== null && r.chapterEnd !== null,
    )
    .map(r => ({ id: r.id, number: r.number, chapterStart: r.chapterStart, chapterEnd: r.chapterEnd }));
}

/**
 * NULL out `chapterStart`/`chapterEnd` on the leading sparse volumes
 * for `mangaId`. Returns the number of rows pruned (0 when the pattern
 * doesn't apply or the manga has too few volumes).
 *
 * Chapter rows that reference the pruned volumes keep their
 * `Chapter.volume` value — the volumes still exist, they just no
 * longer claim a specific chapter range.
 */
export async function pruneSparseLeadingVolumeRanges(mangaId: number): Promise<number> {
  const volumes = await loadVolumes(mangaId);
  const sparseIds = detectSparseLeadingRange(volumes);
  if (sparseIds.length === 0) return 0;

  await prisma.volume.updateMany({
    where: { id: { in: sparseIds } },
    data: { chapterStart: null, chapterEnd: null },
  });
  logger.info(
    `[enrichmentPipeline] Pruned ${sparseIds.length} sparse leading volume range(s) for manga ${mangaId} ` +
    `(Frieren-class ComicVine sparse-then-dense bug)`,
  );
  return sparseIds.length;
}

/**
 * iter-B3: like `pruneSparseLeadingVolumeRanges` but for the
 * interleaved pattern. Detects ALL sparse runs that are sandwiched
 * between dense vols (or only have a dense follower for leading
 * runs) and prunes them in one updateMany. Slime is the canonical
 * case (Vols 1-4 leading sparse + Vols 9-16 interior sparse).
 *
 * Trailing-sparse runs are deliberately left alone — covering the
 * ongoing-manga case where the latest volume genuinely has one
 * chapter published so far.
 */
export async function pruneInterleavedSparseVolumeRanges(mangaId: number): Promise<number> {
  const volumes = await loadVolumes(mangaId);
  const sparseIds = detectInterleavedSparseRuns(volumes);
  if (sparseIds.length === 0) return 0;

  await prisma.volume.updateMany({
    where: { id: { in: sparseIds } },
    data: { chapterStart: null, chapterEnd: null },
  });
  logger.info(
    `[enrichmentPipeline] Pruned ${sparseIds.length} interleaved sparse volume range(s) for manga ${mangaId} ` +
    `(Slime-class ComicVine sparse-data bug)`,
  );
  return sparseIds.length;
}

/**
 * Detects the majority-sparse + wide-outlier pattern (Sweat and Soap CV
 * bug). When matched, NULLs `chapterStart`/`chapterEnd` on every volume
 * (the whole provider's range data is unreliable). Downstream
 * reconciliation rebuilds ranges from chapter assignments instead.
 */
export async function pruneMajoritySparseVolumeRanges(mangaId: number): Promise<number> {
  const volumes = await loadVolumes(mangaId);
  const sparseIds = detectMajoritySparseRuns(volumes);
  if (sparseIds.length === 0) return 0;

  await prisma.volume.updateMany({
    where: { id: { in: sparseIds } },
    data: { chapterStart: null, chapterEnd: null },
  });
  logger.info(
    `[enrichmentPipeline] Pruned ${sparseIds.length} majority-sparse volume range(s) for manga ${mangaId} ` +
    `(Sweat-and-Soap-class ComicVine isolated-wide-outlier bug)`,
  );
  return sparseIds.length;
}
