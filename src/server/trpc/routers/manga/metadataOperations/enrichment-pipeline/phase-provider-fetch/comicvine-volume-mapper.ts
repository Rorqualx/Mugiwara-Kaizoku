/**
 * ComicVine Volume Mapper
 *
 * Maps ComicVine issues (tankobon volumes) to the volume format
 * expected by downstream persistence. Extracts explicit chapter ranges
 * from descriptions (e.g., "Chapters 2-8") and preserves them as
 * startChapter/endChapter. Falls back to cumulative range computation
 * only for volumes without explicit ranges.
 */

import { CHAPTER_RANGE_PATTERN } from '@/server/services/comicvine/constants';
import type { ComicVineIssue } from '@/server/services/comicvine/service';
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';
import { logger } from '@/utils/logger';

import { isBonusTitle } from '../types';

const log = logger.child('ComicVineVolumeMapper');

/** Result of extracting chapter range info from a description */
interface ChapterRangeResult {
  /** Explicit start chapter (null when derived from title count only) */
  start: number | null;
  /** Explicit end chapter (null when derived from title count only) */
  end: number | null;
  /** Total chapter count */
  count: number;
}

/**
 * Map ComicVine issues to the volume format downstream expects.
 * Preserves explicit chapter ranges from descriptions and only uses
 * cumulative computation for volumes without explicit ranges.
 */
export function mapComicVineIssuesToVolumes(
  issues: ComicVineIssue[],
): Array<Record<string, unknown>> {
  const volumes = issues
    .map(issue => mapSingleIssueToVolume(issue))
    .filter((v): v is Record<string, unknown> => v !== null)
    .sort((a, b) => Number(a['volumeNumber'] ?? 0) - Number(b['volumeNumber'] ?? 0));

  computeCumulativeChapterRanges(volumes);

  return volumes;
}

/** Map a single ComicVine issue to a volume entry */
// eslint-disable-next-line complexity -- complexity 22: each ComicVine field is conditionally copied, with normalization for several optional shapes (cover_date, image variants, person_credits)
function mapSingleIssueToVolume(issue: ComicVineIssue): Record<string, unknown> | null {
  const issueNum = issue.issue_number;
  if (!issueNum) return null;

  const volNum = parseInt(issueNum, 10);
  if (isNaN(volNum) || volNum <= 0) return null;

  const volume: Record<string, unknown> = {
    volumeNumber: String(volNum),
    number: volNum,
    id: String(issue.id),
  };

  if (issue.name) volume['title'] = issue.name;
  if (issue.description) volume['description'] = issue.description;
  const coverImage = issue.image?.super_url ?? issue.image?.original_url;
  if (coverImage) volume['coverImage'] = coverImage;
  if (issue.cover_date) volume['releaseDate'] = issue.cover_date;
  // ComicVine's API returns page_count per issue — the fieldOptimizer already
  // requests it, but the TypeScript ComicVineIssue type omits it. Runtime-read.
  const pageCount = (issue as unknown as { page_count?: number }).page_count;
  if (typeof pageCount === 'number' && pageCount > 0) volume['pageCount'] = pageCount;

  if (Array.isArray(issue.associated_images) && issue.associated_images.length > 0) {
    const urls = issue.associated_images
      .map(img => img.original_url)
      .filter((u): u is string => typeof u === 'string' && u.length > 0);
    if (urls.length > 0) volume['associatedImages'] = urls;
  }

  if (typeof issue.aliases === 'string' && issue.aliases.trim().length > 0) {
    const firstAlias = issue.aliases.split(/\r?\n/).map(s => s.trim()).find(s => s.length > 0);
    if (firstAlias) volume['alternativeTitle'] = firstAlias;
  }

  // Extract chapter range from description
  const rangeResult = extractChapterRange(issue.description);
  if (rangeResult) {
    volume['chapterCount'] = rangeResult.count;
    // Store explicit ranges when available (from "Chapters X-Y" patterns)
    if (rangeResult.start !== null && rangeResult.end !== null) {
      volume['startChapter'] = String(rangeResult.start);
      volume['endChapter'] = String(rangeResult.end);
      volume['hasExplicitRange'] = true;
    }
  }

  return volume;
}

/**
 * Extract chapter range from a ComicVine issue description.
 * Tries chapter range patterns first (e.g., "Contains Chapters 1-23")
 * to preserve the explicit start/end, then falls back to counting
 * parsed chapter title bullet points (count only, no explicit range).
 */
function extractChapterRange(description: string | undefined | null): ChapterRangeResult | null {
  if (!description) return null;

  // Try the chapter range pattern first — preserves explicit start/end
  const cleanedDesc = description
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');

  for (const line of cleanedDesc.split('\n')) {
    const match = CHAPTER_RANGE_PATTERN.exec(line.trim());
    if (match?.[1] && match[2]) {
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      if (!isNaN(start) && !isNaN(end) && end > start && end - start < 500) {
        return { start, end, count: Math.ceil(end - start) + 1 };
      }
    }
  }

  // Fall back to parsed chapter titles. Exclude bonus/extra chapters from
  // counts and ranges so cumulative ranges stay accurate.
  const parsed = parseChaptersFromDescription(description);
  if (parsed.length > 0) {
    const regular = parsed.filter(ch => !isBonusTitle(ch.title));
    const counted = regular.length > 0 ? regular : parsed;
    // When every regular chapter has a real "Chapter N:" number parsed from
    // the description, prefer those as the explicit start/end. Without this,
    // the cumulative running counter inflates ranges for series with many
    // volumes (One Piece vol 74 → chapterEnd=1472 instead of the real 742).
    if (regular.length >= 2 && regular.every(ch => ch.hasRealNumber)) {
      const sortedNums = [...regular.map(ch => ch.chapterNumber)].sort((a, b) => a - b);
      const start = sortedNums.at(0);
      const end = sortedNums.at(-1);
      if (start !== undefined && end !== undefined) {
        // Density check: parsed chapters must be densely consecutive. AoT
        // ComicVine descriptions sometimes list cross-volume chapter
        // references (recaps, "Previously on…") alongside the volume's actual
        // chapters, which would otherwise inflate vol1 to span ch2-137. Allow
        // gaps for bonus chapters but require count to cover at least half
        // the span. Skip dense check for tight ranges (≤8 chapters span).
        const span = end - start + 1;
        const dense = span <= 8 || regular.length >= span / 2;
        if (end > start && end - start < 500 && dense) {
          return { start, end, count: counted.length };
        }
      }
    }
    return { start: null, end: null, count: counted.length };
  }

  return null;
}

/**
 * Compute cumulative chapterStart/chapterEnd ranges for volumes without
 * explicit ranges. Volumes that already have explicit startChapter/endChapter
 * from description parsing are skipped — their ranges are ground truth.
 *
 * If explicit ranges create gaps or overlaps, falls back to cumulative
 * computation for the entire set.
 */
function computeCumulativeChapterRanges(volumes: Array<Record<string, unknown>>): void {
  const volumesWithCounts = volumes.filter(
    v => typeof v['chapterCount'] === 'number' && (v['chapterCount'] as number) > 0,
  );
  // Less than 30% have counts — fall back to default estimate instead of bailing
  if (volumesWithCounts.length < volumes.length * 0.3) {
    const DEFAULT_CHAPTER_ESTIMATE = 9;
    let chStart = 1;
    for (const vol of volumes) {
      if (vol['hasExplicitRange'] === true) {
        const end = parseInt(String(vol['endChapter']), 10);
        if (!isNaN(end)) chStart = end + 1;
        continue;
      }
      vol['startChapter'] = String(chStart);
      vol['endChapter'] = String(chStart + DEFAULT_CHAPTER_ESTIMATE - 1);
      chStart += DEFAULT_CHAPTER_ESTIMATE;
    }
    log.info('Used default chapter estimate for volumes (insufficient count data)', {
      totalVolumes: volumes.length,
      volumesWithCounts: volumesWithCounts.length,
      defaultEstimate: DEFAULT_CHAPTER_ESTIMATE,
    });
    return;
  }

  // Check if explicit ranges are consistent (no gaps/overlaps)
  const explicitVolumes = volumes.filter(v => v['hasExplicitRange'] === true);
  if (explicitVolumes.length > 0 && !validateExplicitRanges(explicitVolumes)) {
    // Explicit ranges are inconsistent — fall back to full cumulative
    log.warn('Explicit chapter ranges have gaps/overlaps, falling back to cumulative computation', {
      explicitCount: explicitVolumes.length,
    });
    computeFullCumulative(volumes);
    return;
  }

  // Hybrid: use explicit ranges where available, cumulative for the rest
  const DEFAULT_CHAPTER_ESTIMATE = 9;
  let nextChapterStart = 1;

  for (const vol of volumes) {
    if (vol['hasExplicitRange'] === true) {
      // Already has explicit range from description — skip cumulative
      const end = parseInt(String(vol['endChapter']), 10);
      if (!isNaN(end)) {
        nextChapterStart = end + 1;
      }
      continue;
    }

    const count = typeof vol['chapterCount'] === 'number' ? (vol['chapterCount'] as number) : 0;
    const effective = count > 0 ? count : DEFAULT_CHAPTER_ESTIMATE;

    vol['startChapter'] = String(nextChapterStart);
    vol['endChapter'] = String(nextChapterStart + effective - 1);
    nextChapterStart += effective;
  }

  log.info('Computed chapter ranges from ComicVine (hybrid explicit + cumulative)', {
    totalVolumes: volumes.length,
    explicitRanges: explicitVolumes.length,
    cumulativeRanges: volumes.length - explicitVolumes.length,
    volumesWithCounts: volumesWithCounts.length,
  });
}

/** Validate that explicit ranges are sequential without gaps > 1 or overlaps */
function validateExplicitRanges(explicitVolumes: Array<Record<string, unknown>>): boolean {
  const sorted = [...explicitVolumes].sort(
    (a, b) => Number(a['volumeNumber'] ?? 0) - Number(b['volumeNumber'] ?? 0),
  );

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) continue;

    const prevEnd = parseInt(String(prev['endChapter']), 10);
    const currStart = parseInt(String(curr['startChapter']), 10);
    if (isNaN(prevEnd) || isNaN(currStart)) continue;

    // Gap tolerance: allow up to 1 chapter gap (some volumes skip bonus chapters)
    const gap = currStart - prevEnd - 1;
    if (gap > 1 || gap < -1) return false;
  }
  return true;
}

/** Fallback when validateExplicitRanges flags inconsistency: still trust
 *  per-volume explicit ranges (extractChapterRange found a dense, well-formed
 *  chapter list in the description), gap-fill only the volumes that lack them.
 *
 *  The previous implementation wiped EVERY volume's explicit range and rebuilt
 *  from chapterCount starting at 1. For OP Colored this turned vol 88 (real
 *  chs 880-889, correctly parsed by extractChapterRange) into chs 1767-1776,
 *  because the cumulative counter accumulated the chapter counts of the prior
 *  87 vols on top of those vols' own explicit numbers — effectively doubling.
 *  One bad explicit range (causing validation to fail) shouldn't poison all
 *  the good ones. */
function computeFullCumulative(volumes: Array<Record<string, unknown>>): void {
  const DEFAULT_CHAPTER_ESTIMATE = 9;
  let nextChapterStart = 1;
  let preservedExplicit = 0;
  let cumulativeFilled = 0;

  for (const vol of volumes) {
    if (vol['hasExplicitRange'] === true) {
      const end = parseInt(String(vol['endChapter']), 10);
      if (!isNaN(end) && end >= nextChapterStart) {
        nextChapterStart = end + 1;
      }
      preservedExplicit++;
      continue;
    }

    const count = typeof vol['chapterCount'] === 'number' ? (vol['chapterCount'] as number) : 0;
    const effective = count > 0 ? count : DEFAULT_CHAPTER_ESTIMATE;

    vol['startChapter'] = String(nextChapterStart);
    vol['endChapter'] = String(nextChapterStart + effective - 1);
    nextChapterStart += effective;
    cumulativeFilled++;
  }

  log.info('Fallback range computation (preserve explicit + cumulative-fill the rest)', {
    totalVolumes: volumes.length,
    preservedExplicit,
    cumulativeFilled,
    totalChapters: nextChapterStart - 1,
  });
}
