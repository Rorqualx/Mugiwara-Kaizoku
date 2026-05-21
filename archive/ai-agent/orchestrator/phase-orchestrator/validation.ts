/**
 * Source Validation — Evaluate quality of scraped chapter data
 *
 * Provides validation functions used by the remediation loop to decide
 * whether a source's data is acceptable or needs further remediation.
 */

import { NON_ENGLISH_PUBLISHERS } from '@/server/services/comicvine/constants';
import type {
  ChapterDataItem,
  SourceDataCollection,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { logger } from '@/utils/logger';

const log = logger.child('SourceValidation');

// ============================================================================
// Types
// ============================================================================

export interface SourceValidation {
  /** Whether the data meets the minimum quality bar */
  isAcceptable: boolean;
  /** Percentage of expected chapters that have titles */
  coverage: number;
  /** Whether there's a large gap in chapter numbering */
  hasNumberingGaps: boolean;
  /** Overall quality rating */
  quality: 'good' | 'partial' | 'poor' | 'empty';
  /** Human-readable reason */
  reason: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Evaluate whether a source's chapter data is acceptable.
 *
 * Checks coverage (% of expected chapters with titles) and numbering gaps.
 * - good (>= 50%): Acceptable, no remediation needed
 * - partial (25–49%): Not acceptable, likely wrong page
 * - poor (< 25%): Not acceptable, very low coverage
 * - empty (0): No data at all
 */
export function validateSourceData(
  sourceName: string,
  chapters: ChapterDataItem[],
  expected: number,
): SourceValidation {
  if (chapters.length === 0) {
    return { isAcceptable: false, coverage: 0, hasNumberingGaps: false, quality: 'empty', reason: 'No data' };
  }

  const titled = chapters.filter(c => c.title).length;
  const coverage = expected > 0 ? Math.round((titled / expected) * 100) : 0;

  // Check for numbering gaps (e.g., 1,2,3...50, then jumps to 400)
  const sorted = chapters.map(c => c.number).sort((a, b) => a - b);
  const maxGap = findMaxGap(sorted);
  const hasNumberingGaps = maxGap > expected * 0.1; // Gap > 10% of expected

  if (coverage >= 50) {
    log.debug(`${sourceName}: coverage ${coverage}% — good`, { titled, expected });
    return { isAcceptable: true, coverage, hasNumberingGaps, quality: 'good', reason: 'Sufficient coverage' };
  }
  if (coverage >= 25) {
    log.debug(`${sourceName}: coverage ${coverage}% — partial`, { titled, expected });
    return { isAcceptable: false, coverage, hasNumberingGaps, quality: 'partial', reason: 'Partial data — likely wrong page' };
  }
  log.debug(`${sourceName}: coverage ${coverage}% — poor`, { titled, expected });
  return { isAcceptable: false, coverage, hasNumberingGaps, quality: 'poor', reason: 'Very low coverage' };
}

/**
 * Find the largest gap between consecutive sorted chapter numbers.
 */
export function findMaxGap(sorted: number[]): number {
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i] ?? 0) - (sorted[i - 1] ?? 0);
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

// ============================================================================
// AI Verification Checks (moved from phase-orchestrator.ts)
// ============================================================================

/**
 * Determine if AI URL correction is needed.
 * Checks beyond simple coverage — flags sources with suspiciously little data.
 */
export function needsAIVerification(data: SourceDataCollection): boolean {
  const expected = data.expectedChapterCount;
  if (expected === 0) return false;

  if (data.gaps.coveragePercent < 50) {
    log.info('AI verification: low coverage triggers URL correction', {
      coverage: data.gaps.coveragePercent,
    });
    return true;
  }

  const suspiciousSources = detectSuspiciousSources(data, expected);
  if (suspiciousSources.length > 0) {
    log.info('AI verification: suspicious source data detected', { suspiciousSources });
    return true;
  }

  return false;
}

// ============================================================================
// Volume-Chapter Map Validation
// ============================================================================

/**
 * Validate and fix chapter-volume mappings by removing implausible entries.
 *
 * Detects bad mappings like "Volume 48: chapters 49-414" (365 chapters in one
 * volume) by computing the median chapters-per-volume and rejecting volumes
 * with counts or spans exceeding 5x the median (or an absolute floor of 30).
 *
 * @param chapterVolumeMap - Map of chapter number → volume number
 * @returns Cleaned map with implausible entries removed
 */
export function validateAndFixVolumeMap(
  chapterVolumeMap: Record<number, number>,
): Record<number, number> {
  const entries = Object.entries(chapterVolumeMap);
  if (entries.length === 0) return chapterVolumeMap;

  // Step 1: Build per-volume chapter lists
  const volumeChapters = new Map<number, number[]>();
  for (const [chStr, vol] of entries) {
    const ch = Number(chStr);
    const existing = volumeChapters.get(vol);
    if (existing) {
      existing.push(ch);
    } else {
      volumeChapters.set(vol, [ch]);
    }
  }

  // Step 2: Calculate median chapter count per volume (expected ~7-12 for manga)
  const counts = [...volumeChapters.values()].map(chs => chs.length);
  const sortedCounts = [...counts].sort((a, b) => a - b);
  const median = sortedCounts[Math.floor(sortedCounts.length / 2)] ?? 10;

  // Step 3: Detect and remove implausible volumes
  const implausibleThreshold = Math.max(median * 5, 30);
  const validMap: Record<number, number> = {};
  let removedCount = 0;

  // Pre-compute per-volume spans for step 4
  const volumeSpans = new Map<number, number>();
  for (const [vol, chs] of volumeChapters) {
    const sorted = [...chs].sort((a, b) => a - b);
    const min = sorted[0] ?? 0;
    const max = sorted[sorted.length - 1] ?? 0;
    volumeSpans.set(vol, max - min + 1);
  }

  for (const [chStr, vol] of entries) {
    const volChs = volumeChapters.get(vol);
    if (!volChs) continue;

    // Reject volumes with too many chapters
    if (volChs.length > implausibleThreshold) {
      removedCount++;
      continue;
    }

    // Step 4: Reject if volume span is too wide (e.g., volume spanning 300+ chapters)
    const span = volumeSpans.get(vol) ?? 0;
    if (span > implausibleThreshold) {
      removedCount++;
      continue;
    }

    validMap[Number(chStr)] = vol;
  }

  if (removedCount > 0) {
    log.info(`Removed ${removedCount} implausible chapter-volume mappings`, {
      median, threshold: implausibleThreshold,
    });
  }

  return validMap;
}

// ============================================================================
// Unassigned Chapter Gap-Fill
// ============================================================================

/**
 * Fill unassigned chapters with volume assignments by building volume
 * boundaries (chapter ranges) from source data, then assigning chapters
 * that fall within those ranges.
 *
 * Unlike copying individual ch.volume values (which can be 1:1 issue-to-volume
 * from ComicVine), this uses the volume RANGES from sources to assign chapters.
 * Falls back to interpolation only for chapters no source covers.
 */
export function fillUnassignedChapterVolumes(
  chapterVolumeMap: Record<number, number>,
  expectedChapterCount: number,
  sourceData?: SourceDataCollection,
): Record<number, number> {
  const entries = Object.entries(chapterVolumeMap);
  if (entries.length === 0 || expectedChapterCount === 0) return chapterVolumeMap;

  const filled = { ...chapterVolumeMap };

  // Step 1: Build volume boundaries from source data (chapter ranges per volume).
  // Priority: Wikipedia > Fandom > ComicVine > MangaDex (highest wins on overlap).
  // We use boundaries (ranges) not individual mappings to avoid 1:1 issue-to-volume
  // data from ComicVine producing tiny volumes.
  if (sourceData) {
    const sourceBoundaries = buildSourceVolumeBoundaries(sourceData);
    let sourceFilledCount = 0;

    for (let ch = 1; ch <= expectedChapterCount; ch++) {
      if (filled[ch] !== undefined) continue;
      const vol = findVolumeFromBoundaries(ch, sourceBoundaries);
      if (vol !== null) {
        filled[ch] = vol;
        sourceFilledCount++;
      }
    }

    if (sourceFilledCount > 0) {
      log.info(`Cross-referenced ${sourceFilledCount} volume assignments from source boundaries`, {
        boundaryCount: sourceBoundaries.length,
      });
    }
  }

  // Step 2: Build boundaries from current assignments for interpolation
  const currentBoundaries = buildBoundariesFromMap(filled);
  if (currentBoundaries.length === 0) return filled;

  // Step 3: For remaining unassigned chapters, interpolate from boundaries
  const avgChaptersPerVol = Math.round(Object.keys(filled).length / currentBoundaries.length);
  if (avgChaptersPerVol <= 0) return filled;

  let interpolatedCount = 0;
  for (let ch = 1; ch <= expectedChapterCount; ch++) {
    if (filled[ch] !== undefined) continue;

    const vol = interpolateVolume(ch, currentBoundaries, avgChaptersPerVol);
    if (vol !== null) {
      filled[ch] = vol;
      interpolatedCount++;
    }
  }

  if (interpolatedCount > 0) {
    log.info(`Interpolated ${interpolatedCount} remaining chapter-volume mappings`, {
      avgChaptersPerVol, boundaries: currentBoundaries.length,
    });
  }

  return filled;
}

interface VolBoundary { vol: number; start: number; end: number }

/**
 * Build merged volume boundaries from all sources.
 * Each source contributes volume ranges (start–end chapter per volume).
 * Sources with >= 3 chapters per volume are trusted; sparser sources
 * (like ComicVine with 1:1 issue mapping) are filtered out.
 * Higher-priority sources overwrite lower-priority ones on overlap.
 */
function buildSourceVolumeBoundaries(data: SourceDataCollection): VolBoundary[] {
  // Priority order: lowest first, highest overwrites
  const sourceOrder: Array<[string, ChapterDataItem[]]> = [
    ['comicvine', data.sources.comicvine],
    ['fandom', data.sources.fandom],
    ['wikipedia', data.sources.wikipedia],
  ];

  // Merge boundaries across sources — higher priority overwrites
  const volMap = new Map<number, { start: number; end: number }>();

  for (const [name, chapters] of sourceOrder) {
    const perSourceBoundaries = buildBoundariesFromChapters(chapters);
    if (perSourceBoundaries.length === 0) continue;

    // Filter out sources where volumes average < 3 chapters (bad data)
    const totalChapters = perSourceBoundaries.reduce((sum, b) => sum + (b.end - b.start + 1), 0);
    const avgPerVol = totalChapters / perSourceBoundaries.length;
    if (avgPerVol < 3) {
      log.debug(`Skipping ${name} volume boundaries: avg ${avgPerVol.toFixed(1)} ch/vol (too sparse)`);
      continue;
    }

    // Compute median span to reject individual outlier boundaries
    const spans = perSourceBoundaries.map(b => b.end - b.start + 1).sort((a, b) => a - b);
    const medianSpan = spans[Math.floor(spans.length / 2)] ?? 10;
    const maxAllowedSpan = Math.max(medianSpan * 3, 20);

    for (const b of perSourceBoundaries) {
      const span = b.end - b.start + 1;
      if (span > maxAllowedSpan) {
        log.debug(`Skipping ${name} vol ${b.vol} boundary: span ${span} exceeds ${maxAllowedSpan}`);
        continue;
      }
      volMap.set(b.vol, { start: b.start, end: b.end });
    }
  }

  return [...volMap.entries()]
    .map(([vol, range]) => ({ vol, start: range.start, end: range.end }))
    .sort((a, b) => a.vol - b.vol);
}

/** Build volume boundaries from a list of chapters */
function buildBoundariesFromChapters(chapters: ChapterDataItem[]): VolBoundary[] {
  const volChapters = new Map<number, number[]>();
  for (const ch of chapters) {
    if (ch.volume === undefined) continue;
    const existing = volChapters.get(ch.volume);
    if (existing) existing.push(ch.number);
    else volChapters.set(ch.volume, [ch.number]);
  }

  const boundaries: VolBoundary[] = [];
  for (const [vol, chs] of volChapters) {
    const sorted = [...chs].sort((a, b) => a - b);
    boundaries.push({ vol, start: sorted[0] ?? 0, end: sorted[sorted.length - 1] ?? 0 });
  }

  return boundaries.sort((a, b) => a.vol - b.vol);
}

/** Build volume boundaries from a chapter-volume map */
function buildBoundariesFromMap(map: Record<number, number>): VolBoundary[] {
  const volChapters = new Map<number, number[]>();
  for (const [chStr, vol] of Object.entries(map)) {
    const ch = Number(chStr);
    const existing = volChapters.get(vol);
    if (existing) existing.push(ch);
    else volChapters.set(vol, [ch]);
  }

  return [...volChapters.entries()]
    .map(([vol, chs]) => {
      const sorted = [...chs].sort((a, b) => a - b);
      return { vol, start: sorted[0] ?? 0, end: sorted[sorted.length - 1] ?? 0 };
    })
    .sort((a, b) => a.vol - b.vol);
}

/** Find which volume a chapter belongs to based on boundary ranges */
function findVolumeFromBoundaries(ch: number, boundaries: VolBoundary[]): number | null {
  for (const b of boundaries) {
    if (ch >= b.start && ch <= b.end) return b.vol;
  }
  return null;
}

/** Interpolate volume number for an unassigned chapter using nearest boundaries */
function interpolateVolume(
  ch: number,
  boundaries: VolBoundary[],
  avgPerVol: number,
): number | null {
  const first = boundaries[0];
  if (!first) return null;

  // Before first boundary
  if (ch < first.start) {
    const volOffset = Math.floor((first.start - ch) / avgPerVol);
    return Math.max(1, first.vol - volOffset);
  }

  // After last boundary — assign to last known volume if close, otherwise leave unassigned.
  // Don't create phantom volumes beyond what sources know about, but also don't stuff
  // dozens of chapters into the last volume.
  const last = boundaries[boundaries.length - 1];
  if (!last) return null;
  if (ch > last.end) {
    const chaptersBeyond = ch - last.end;
    // Only assign if within ~1.5 volumes worth of chapters beyond the last boundary
    if (chaptersBeyond <= Math.ceil(avgPerVol * 1.5)) {
      return last.vol;
    }
    return null;
  }

  // Between two boundaries — proportional interpolation
  for (let i = 0; i < boundaries.length - 1; i++) {
    const curr = boundaries[i];
    const next = boundaries[i + 1];
    if (!curr || !next) continue;
    if (ch > curr.end && ch < next.start) {
      const gapSize = next.start - curr.end - 1;
      const position = ch - curr.end;
      const volRange = next.vol - curr.vol;
      const vol = curr.vol + Math.ceil((position / (gapSize + 1)) * volRange);
      return Math.min(vol, next.vol);
    }
  }

  return null;
}

/**
 * Detect sources that returned data but far less than expected.
 */
export function detectSuspiciousSources(
  data: SourceDataCollection,
  expected: number,
): string[] {
  const suspicious: string[] = [];
  const threshold = expected * 0.25;

  if (data.sources.fandom.length > 0 && data.sources.fandom.length < threshold) {
    suspicious.push(`fandom(${data.sources.fandom.length}/${expected})`);
  }
  if (data.sources.wikipedia.length > 0 && data.sources.wikipedia.length < threshold) {
    suspicious.push(`wikipedia(${data.sources.wikipedia.length}/${expected})`);
  }

  return suspicious;
}

// ============================================================================
// ComicVine Match Validation
// ============================================================================

export interface ComicVineValidation {
  /** Whether the ComicVine match appears correct */
  isAcceptable: boolean;
  /** Whether the publisher is a known non-English publisher */
  isNonEnglishPublisher: boolean;
  /** Whether chapter yield from descriptions is suspiciously low */
  hasLowChapterYield: boolean;
  /** Whether issue count deviates significantly from expected volume count */
  hasIssueCountMismatch: boolean;
  /** Human-readable reason */
  reason: string;
}

/**
 * Validate ComicVine match quality.
 *
 * Checks three signals:
 * 1. Publisher — is it a known non-English publisher? (Shueisha, Ki-Oon, etc.)
 * 2. Chapter yield — did we parse reasonable chapters from volume descriptions?
 * 3. Issue count — does issue count roughly match expected volumes?
 *
 * ComicVine often has empty descriptions (especially for later volumes), so
 * chapter yield uses a low threshold (10%). The primary signal is publisher.
 */
export function validateComicVineData(data: SourceDataCollection): ComicVineValidation {
  const { rawData, sources, expectedChapterCount } = data;

  // No ComicVine data at all — nothing to validate
  if (!rawData.comicvineVolumeId) {
    return { isAcceptable: true, isNonEnglishPublisher: false, hasLowChapterYield: false, hasIssueCountMismatch: false, reason: 'No ComicVine data' };
  }

  // 1. Publisher check — reuse existing language detection
  const isNonEnglishPublisher = checkNonEnglishPublisher(
    rawData.comicvineVolumeName ?? '',
    rawData.comicvinePublisher,
  );

  // 2. Chapter yield — how many chapters did descriptions produce vs expected?
  const cvChapterCount = sources.comicvine.length;
  // ComicVine often has empty descriptions, so 10% is the red flag threshold
  const hasLowChapterYield = expectedChapterCount > 20 && cvChapterCount < expectedChapterCount * 0.1;

  // 3. Issue count vs expected volume count
  const issueCount = rawData.comicvineIssueCount ?? 0;
  const expectedVolumes = getExpectedVolumeCount(data);
  const hasIssueCountMismatch = expectedVolumes > 5 && (
    issueCount < expectedVolumes * 0.3 || issueCount > expectedVolumes * 3
  );

  // Non-English publisher is the strongest signal — always flag
  if (isNonEnglishPublisher) {
    log.info('ComicVine validation: non-English publisher detected', {
      publisher: rawData.comicvinePublisher,
      volumeName: rawData.comicvineVolumeName,
    });
    return {
      isAcceptable: false, isNonEnglishPublisher, hasLowChapterYield, hasIssueCountMismatch,
      reason: `Non-English publisher: ${rawData.comicvinePublisher ?? 'unknown'}`,
    };
  }

  // Low chapter yield + issue count mismatch together suggest wrong match
  if (hasLowChapterYield && hasIssueCountMismatch) {
    log.info('ComicVine validation: low yield + issue count mismatch', {
      chapters: cvChapterCount, expected: expectedChapterCount,
      issues: issueCount, expectedVolumes,
    });
    return {
      isAcceptable: false, isNonEnglishPublisher, hasLowChapterYield, hasIssueCountMismatch,
      reason: `Low chapter yield (${cvChapterCount}/${expectedChapterCount}) and issue count mismatch (${issueCount} issues vs ~${expectedVolumes} expected volumes)`,
    };
  }

  return {
    isAcceptable: true, isNonEnglishPublisher, hasLowChapterYield, hasIssueCountMismatch,
    reason: 'ComicVine match appears acceptable',
  };
}

/** Check if the ComicVine match has a non-English publisher */
function checkNonEnglishPublisher(volumeName: string, publisherName: string | undefined): boolean {
  const normalizedPublisher = (publisherName?.toLowerCase() ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const pub of NON_ENGLISH_PUBLISHERS) {
    const normalizedPub = pub.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedPublisher.includes(normalizedPub)) return true;
  }

  // Also check volume title for language indicators
  const hasAsianChars = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(volumeName);
  if (hasAsianChars) return true;

  const langPatterns = /\(french\)|\(français\)|\(german\)|\(deutsch\)|\(spanish\)|\(español\)|\(italian\)|\(italiano\)|\(japanese\)|\(日本語\)/i;
  if (langPatterns.test(volumeName)) return true;

  return false;
}

/** Estimate expected volume count from available data */
function getExpectedVolumeCount(data: SourceDataCollection): number {
  // Use volume assignments from Fandom or Wikipedia if available
  const volNums = new Set<number>();
  for (const source of Object.values(data.sources)) {
    for (const ch of source) {
      if (ch.volume !== undefined) volNums.add(ch.volume);
    }
  }
  if (volNums.size > 3) return volNums.size;

  // Rough estimate: ~8-10 chapters per volume for manga
  return Math.ceil(data.expectedChapterCount / 9);
}
