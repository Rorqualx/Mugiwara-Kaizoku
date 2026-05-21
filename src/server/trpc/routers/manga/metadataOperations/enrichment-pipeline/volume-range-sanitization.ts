/**
 * Volume Range Sanitization
 *
 * Single-pass sanitization that detects and fixes implausible, overlapping,
 * or absurd volume chapter ranges from upstream providers.
 */

import { logger } from '@/utils/logger';

export type MutableVolume = { number: number; chapterStart: number | null; chapterEnd: number | null };

/**
 * Unified sanitization: detect catch-all volumes, implausible spans, and overlaps
 * in a single pass. Returns both valid and excluded volumes so the caller can
 * gap-fill the excluded ones.
 */
export function sanitizeVolumeRanges(
  volumes: MutableVolume[],
): { valid: MutableVolume[]; excluded: MutableVolume[] } {
  const withRanges = volumes.filter(v => v.chapterStart !== null && v.chapterEnd !== null);
  if (withRanges.length === 0) {
    return { valid: [], excluded: [...volumes] };
  }

  // Step 1: Null out ranges that overlap 3+ other volumes (catch-all detection)
  excludeCatchAllVolumes(withRanges);

  // Step 2+3: Null out implausibly small/large ranges vs median
  excludeImplausibleSpans(withRanges);

  // Step 4: Fix remaining overlaps by trimming later volumes
  trimOverlappingRanges(withRanges);

  const valid = volumes.filter(v => v.chapterStart !== null && v.chapterEnd !== null);
  const excluded = volumes.filter(v => v.chapterStart === null || v.chapterEnd === null);
  return { valid, excluded };
}

/** Null out volumes whose range overlaps 3+ other volumes */
function excludeCatchAllVolumes(volumes: MutableVolume[]): void {
  for (const vol of volumes) {
    if (vol.chapterStart === null || vol.chapterEnd === null) continue;
    const overlapCount = countOverlaps(vol, volumes);
    if (overlapCount >= 3) {
      logger.warn(`[sanitize] Volume ${vol.number} range ${vol.chapterStart}-${vol.chapterEnd} overlaps ${overlapCount} — excluding`);
      vol.chapterStart = null;
      vol.chapterEnd = null;
    }
  }
}

/** Count how many other volumes a given volume's range overlaps */
function countOverlaps(vol: MutableVolume, allVolumes: MutableVolume[]): number {
  return allVolumes.filter(other =>
    other !== vol &&
    other.chapterStart !== null && other.chapterEnd !== null &&
    (vol.chapterStart ?? 0) <= other.chapterEnd && (vol.chapterEnd ?? 0) >= other.chapterStart,
  ).length;
}

/** Null out ranges that are implausibly small or large compared to the median span */
function excludeImplausibleSpans(volumes: MutableVolume[]): void {
  const withRanges = volumes.filter(v => v.chapterStart !== null && v.chapterEnd !== null);
  if (withRanges.length < 4) return;

  const spans = withRanges.map(v => (v.chapterEnd ?? 0) - (v.chapterStart ?? 0) + 1);
  const sorted = [...spans].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (median <= 1) return;

  for (const vol of withRanges) {
    if (vol.chapterStart === null || vol.chapterEnd === null) continue;
    const span = vol.chapterEnd - vol.chapterStart + 1;
    if (span < median / 3 || span > median * 5) {
      logger.warn(`[sanitize] Volume ${vol.number} (${span} ch) implausible vs median ${median} — excluding`);
      vol.chapterStart = null;
      vol.chapterEnd = null;
    }
  }
}

/** Fix remaining overlaps by trimming or removing later volumes */
function trimOverlappingRanges(volumes: MutableVolume[]): void {
  const sorted = volumes
    .filter(v => v.chapterStart !== null && v.chapterEnd !== null)
    .sort((a, b) => (a.chapterStart ?? 0) - (b.chapterStart ?? 0));

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev?.chapterEnd || !curr?.chapterStart) continue;
    if (curr.chapterStart > prev.chapterEnd) continue;

    const fixedStart = prev.chapterEnd + 1;
    if (fixedStart > (curr.chapterEnd ?? 0)) {
      logger.warn(`[sanitize] Removing fully-overlapped volume ${curr.number} range`);
      curr.chapterStart = null;
      curr.chapterEnd = null;
    } else {
      logger.info(`[sanitize] Trimmed volume ${curr.number} range start: ${curr.chapterStart} → ${fixedStart}`);
      curr.chapterStart = fixedStart;
    }
  }
}
