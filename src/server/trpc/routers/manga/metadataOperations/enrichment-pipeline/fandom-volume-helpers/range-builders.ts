/**
 * Volume range building and validation helpers
 */

import { logger } from '@/utils/logger';

/** Build volume ranges from chapter-volume map, tracking evidence count */
export function buildVolRangesFromMap(
  chapterVolumeMap: Record<number, number>,
): Record<number, { start: number; end: number; chapterCount: number }> {
  const volRanges: Record<number, { start: number; end: number; chapterCount: number }> = {};
  for (const [chNumStr, vNum] of Object.entries(chapterVolumeMap)) {
    const chNum = Number(chNumStr);
    if (!volRanges[vNum]) {
      volRanges[vNum] = { start: chNum, end: chNum, chapterCount: 1 };
    } else {
      volRanges[vNum].start = Math.min(volRanges[vNum].start, chNum);
      volRanges[vNum].end = Math.max(volRanges[vNum].end, chNum);
      volRanges[vNum].chapterCount++;
    }
  }
  return volRanges;
}

/** Check if a chapterVolumeMap produces unreliable volume ranges (excessive overlaps).
 *  Exported for use in phase-fandom-enrichment to skip per-chapter volume assignments. */
export function isUnreliableVolumeMap(
  chapterVolumeMap: Record<number, number>,
): boolean {
  if (Object.keys(chapterVolumeMap).length === 0) return false;
  const volRanges = buildVolRangesFromMap(chapterVolumeMap);
  return hasExcessiveOverlaps(volRanges)
    || hasMonotonicityViolations(volRanges)
    || hasWideSpanVolumes(volRanges);
}

/** Check if volume start chapters decrease across increasing volume numbers (scrambled assignments).
 *  Returns true if more than 30% of consecutive volume pairs have decreasing start chapters. */
export function hasMonotonicityViolations(
  volRanges: Record<number, { start: number; end: number; chapterCount: number }>,
): boolean {
  const entries = Object.entries(volRanges)
    .map(([k, v]) => ({ volNum: Number(k), ...v }))
    .sort((a, b) => a.volNum - b.volNum);

  if (entries.length < 3) return false;

  let violations = 0;
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    if (!prev || !curr) continue;
    if (curr.start < prev.start) violations++;
  }

  const ratio = violations / (entries.length - 1);
  if (ratio > 0.3) {
    logger.warn(`[enrichmentPipeline] Monotonicity violations: ${violations}/${entries.length - 1} (${(ratio * 100).toFixed(0)}%)`);
    return true;
  }
  return false;
}

/** Check if volumes have unreasonably wide spans relative to their actual chapter count.
 *  Returns true if more than 30% of volumes span 3x+ their actual chapter count. */
export function hasWideSpanVolumes(
  volRanges: Record<number, { start: number; end: number; chapterCount: number }>,
): boolean {
  const entries = Object.values(volRanges);
  if (entries.length < 3) return false;

  let wideCount = 0;
  for (const range of entries) {
    const span = range.end - range.start + 1;
    if (range.chapterCount >= 2 && span > range.chapterCount * 3) wideCount++;
  }

  const ratio = wideCount / entries.length;
  if (ratio > 0.3) {
    logger.warn(`[enrichmentPipeline] Wide-span volumes: ${wideCount}/${entries.length} (${(ratio * 100).toFixed(0)}%)`);
    return true;
  }
  return false;
}

/** Check if volume ranges have excessive overlaps — indicates unreliable parser data.
 *  Returns true if more than 30% of volumes overlap with their neighbors. */
export function hasExcessiveOverlaps(
  volRanges: Record<number, { start: number; end: number; chapterCount: number }>,
): boolean {
  const entries = Object.entries(volRanges)
    .map(([k, v]) => ({ volNum: Number(k), ...v }))
    .sort((a, b) => a.volNum - b.volNum);

  if (entries.length < 3) return false;

  let overlapCount = 0;
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    if (!prev || !curr) continue;
    if (curr.start <= prev.end) overlapCount++;
  }

  const overlapRatio = overlapCount / (entries.length - 1);
  if (overlapRatio > 0.3) {
    logger.warn(`[enrichmentPipeline] Volume range overlap ratio: ${overlapCount}/${entries.length - 1} (${(overlapRatio * 100).toFixed(0)}%)`);
    return true;
  }
  return false;
}