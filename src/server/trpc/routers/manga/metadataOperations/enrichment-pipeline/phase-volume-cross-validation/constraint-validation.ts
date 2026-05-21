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
): ValidatedVolumeRange[] {
  if (ranges.length <= 1) return ranges;

  const median = computeMedianChapterCount(ranges);
  const validated: ValidatedVolumeRange[] = [];

  for (const range of ranges) {
    const adjusted = validateSingleRange(range, validated, median, ranges.length);
    if (adjusted) validated.push(adjusted);
  }

  logCoverageWarning(validated, expectedChapterCount);

  return validated;
}

/**
 * Cap volume count to prevent runaway volume creation when provider data is inconsistent.
 * Allows up to 10% above expected count to accommodate bonus/special volumes.
 */
export function capVolumeCount(
  ranges: ValidatedVolumeRange[],
  expectedVolumeCount: number,
): ValidatedVolumeRange[] {
  if (expectedVolumeCount <= 0 || ranges.length <= expectedVolumeCount) return ranges;
  const maxAllowed = Math.ceil(expectedVolumeCount * 1.1);
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
): ValidatedVolumeRange | null {
  const count = range.chapterEnd - range.chapterStart + 1;

  // Anomaly: volume has > 3x the median chapter count -> likely misparse
  if (count > median * 3 && totalCount > 3) {
    log.warn('Dropping anomalous volume range', {
      volumeNumber: range.volumeNumber, chapterCount: count, median,
    });
    return null;
  }

  // Sequential check against previous validated range
  if (validated.length > 0) {
    return applySequentialConstraints(range, validated);
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
): ValidatedVolumeRange | null {
  const prev = validated[validated.length - 1];
  if (!prev) return range;
  const gap = range.chapterStart - prev.chapterEnd - 1;

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
