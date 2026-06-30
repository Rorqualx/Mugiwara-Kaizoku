/**
 * Constraint Validation Helpers
 *
 * Validates cross-validated volume ranges against sequential,
 * anomaly, coverage, and count constraints.
 */

import { logger } from '@/utils/logger';

import type { ValidatedVolumeRange } from '../phase-volume-cross-validation';

const log = logger.child('VolumeCrossValidation');

/**
 * A volume whose chapterStart sits this far past the previous volume's end (or
 * `median * GAP_MEDIAN_MULTIPLIER`, whichever is larger) marks a provider
 * numbering discontinuity — e.g. ComicVine's vol 10 ends at ch 45 and vol 11
 * starts at ch 91. No real inter-volume gap is this wide, so the volume (and the
 * broken tail after it) is dropped rather than just confidence-penalized.
 */
const MAX_VOLUME_GAP = 15;
const GAP_MEDIAN_MULTIPLIER = 4;
/** Margin above `expectedChapterCount` past which a volume start is implausible. */
const CHAPTER_CEILING_MARGIN = 1.1;

/**
 * Validate constraints on the full set of resolved ranges:
 * 1. Sequential: vol N end + 1 approx vol N+1 start (tolerance: 2)
 * 2. No anomalies: no volume has > 3x the median chapter count
 * 3. Coverage: chapter 1 should be in vol 1
 * 4. No huge gaps: gap between consecutive volumes <= 3 chapters
 *
 * Drops volumes that violate constraints and reduces confidence
 * for ranges with minor issues.
 */
export function validateConstraints(
  ranges: ValidatedVolumeRange[],
  expectedChapterCount: number | null,
  trusted = false,
): ValidatedVolumeRange[] {
  if (ranges.length <= 1) return ranges;

  const median = computeMedianChapterCount(ranges);
  const validated: ValidatedVolumeRange[] = [];

  // A finished series with a trusted final-chapter scalar uses an exact ceiling
  // (margin 1.0) so a volume starting one chapter past the end is rejected;
  // otherwise the usual 10% tolerance applies.
  const ceilingMargin = trusted ? 1.0 : CHAPTER_CEILING_MARGIN;
  const chapterCeiling = expectedChapterCount !== null && expectedChapterCount > 0
    ? expectedChapterCount * ceilingMargin
    : null;

  for (const range of ranges) {
    const adjusted = validateSingleRange(range, validated, median, ranges.length, chapterCeiling);
    if (adjusted) validated.push(adjusted);
  }

  logCoverageWarning(validated, expectedChapterCount);

  return validated;
}

/**
 * Cap volume count to prevent runaway volume creation when provider data is inconsistent.
 * Allows up to 10% above expected count to accommodate bonus/special volumes — except for
 * a finished series with a trusted volume scalar (`trusted`), where the cap is the EXACT
 * known volume count so an end-of-series phantom volume (AoT "Volume 35" past 34) is dropped.
 */
export function capVolumeCount(
  ranges: ValidatedVolumeRange[],
  expectedVolumeCount: number,
  trusted = false,
): ValidatedVolumeRange[] {
  if (expectedVolumeCount <= 0 || ranges.length <= expectedVolumeCount) return ranges;
  const maxAllowed = trusted ? expectedVolumeCount : Math.ceil(expectedVolumeCount * 1.1);
  if (ranges.length <= maxAllowed) return ranges;

  const capped = ranges.filter(r => r.volumeNumber <= maxAllowed);
  if (capped.length < ranges.length) {
    log.info('Capped volume count to stay within expected range', {
      expected: expectedVolumeCount, maxAllowed, before: ranges.length, after: capped.length,
    });
  }
  return capped;
}

/** Compute median chapter count across all ranges */
function computeMedianChapterCount(ranges: ValidatedVolumeRange[]): number {
  const counts = ranges.map(r => r.chapterEnd - r.chapterStart + 1);
  const sorted = [...counts].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 10;
}

/** Validate a single range against constraints and preceding validated ranges */
function validateSingleRange(
  range: ValidatedVolumeRange,
  validated: ValidatedVolumeRange[],
  median: number,
  totalCount: number,
  chapterCeiling: number | null,
): ValidatedVolumeRange | null {
  const count = range.chapterEnd - range.chapterStart + 1;

  // Discontinuity guard: a volume that starts beyond the manga's total chapter
  // count is a provider numbering artifact (ComicVine listing vol 11 as chapters
  // 91-99 for a 48-chapter series). Drop it — and because each later volume is
  // measured against the last KEPT volume, the whole broken tail cascades out.
  // `chapterCeiling` already folds in the trusted/exact-vs-1.1× margin choice.
  if (chapterCeiling !== null && range.chapterStart > chapterCeiling) {
    log.warn('Dropping volume range starting beyond expected chapter count', {
      volumeNumber: range.volumeNumber, chapterStart: range.chapterStart, chapterCeiling,
    });
    return null;
  }

  // Anomaly: volume has > 3x the median chapter count -> likely misparse
  if (count > median * 3 && totalCount > 3) {
    log.warn('Dropping anomalous volume range', {
      volumeNumber: range.volumeNumber, chapterCount: count, median,
    });
    return null;
  }

  // Sequential check against previous validated range
  if (validated.length > 0) {
    return applySequentialConstraints(range, validated, median);
  }

  // Coverage: vol 1 should start near chapter 1
  if (range.volumeNumber === 1 && range.chapterStart > 3) {
    return { ...range, confidence: Math.max(0.1, range.confidence - 0.2) };
  }

  return range;
}

/** Apply sequential constraints between a range and the last validated range */
function applySequentialConstraints(
  range: ValidatedVolumeRange,
  validated: ValidatedVolumeRange[],
  median: number,
): ValidatedVolumeRange | null {
  const prev = validated[validated.length - 1];
  if (!prev) return range;
  const gap = range.chapterStart - prev.chapterEnd - 1;

  // Discontinuity guard (covers the no-expected-count case): a forward jump
  // wider than any real inter-volume gap means the provider's chapter numbering
  // broke (vol 10 ends ch 45, vol 11 starts ch 91). Drop the volume; later
  // volumes measure against the last KEPT one, so the tail cascades out.
  const maxGap = Math.max(MAX_VOLUME_GAP, median * GAP_MEDIAN_MULTIPLIER);
  if (gap > maxGap) {
    log.warn('Dropping volume range after numbering discontinuity', {
      volumeNumber: range.volumeNumber, gap, maxGap, prevEnd: prev.chapterEnd, start: range.chapterStart,
    });
    return null;
  }

  let adjusted = range;

  // Close 1-chapter gaps by pulling the next volume's start back.
  // A gap of 1 is almost always a rounding/source disagreement, not intentional.
  if (gap === 1) {
    adjusted = { ...adjusted, chapterStart: prev.chapterEnd + 1 };
  }

  if (gap > 3) {
    adjusted = { ...adjusted, confidence: Math.max(0.1, adjusted.confidence - 0.2) };
  }

  if (gap < -1) {
    const newStart = prev.chapterEnd + 1;
    if (newStart > adjusted.chapterEnd) return null;
    adjusted = { ...adjusted, chapterStart: newStart, confidence: Math.max(0.1, adjusted.confidence - 0.15) };
  }

  return adjusted;
}

/** Log warning if validated ranges cover less than 50% of expected chapters */
function logCoverageWarning(
  validated: ValidatedVolumeRange[],
  expectedChapterCount: number | null,
): void {
  if (!expectedChapterCount || validated.length === 0) return;

  const lastRange = validated[validated.length - 1];
  if (!lastRange) return;
  const coverage = lastRange.chapterEnd / expectedChapterCount;
  if (coverage < 0.5) {
    log.warn('Volume ranges cover less than 50% of expected chapters', {
      lastChapterEnd: lastRange.chapterEnd,
      expectedChapterCount,
      coverage: Math.round(coverage * 100),
    });
  }
}
