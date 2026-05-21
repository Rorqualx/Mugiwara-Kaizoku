/**
 * Cross-Provider Selection Utilities
 *
 * Helper functions for selecting chapters across different providers.
 * Enables volume selection from one provider (e.g., Wikipedia) to
 * automatically select chapters from another provider (e.g., Fandom).
 *
 * @module cross-provider-selection
 */

import { isRecord, hasProperty } from '../index';

/**
 * Extract a chapter number from a chapter object
 * Handles all provider formats: Fandom, Wikipedia, ComicVine
 */
export function extractChapterNumber(ch: Record<string, unknown>): number | null {
  // Try all known property names in order of specificity
  const num = hasProperty(ch, 'chapterNumber') ? ch['chapterNumber'] :
              hasProperty(ch, 'number') ? ch['number'] :
              hasProperty(ch, 'issue_number') ? ch['issue_number'] :
              hasProperty(ch, 'issueNumber') ? ch['issueNumber'] : undefined;

  if (num === undefined || num === null) return null;

  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  return typeof parsed === 'number' && !isNaN(parsed) ? parsed : null;
}

/**
 * Extract chapter number range from a volume
 * Used for cross-provider chapter selection sync
 * Handles all provider formats: Fandom, Wikipedia, ComicVine
 */
// eslint-disable-next-line complexity -- Necessary to handle all provider data formats in one place
export function getVolumeChapterRange(volume: Record<string, unknown>): { start: number; end: number } | null {
  // Try chapterStart/chapterEnd first (database/some providers include this)
  const chapterStart = hasProperty(volume, 'chapterStart') ? volume['chapterStart'] : undefined;
  const chapterEnd = hasProperty(volume, 'chapterEnd') ? volume['chapterEnd'] : undefined;

  if (typeof chapterStart === 'number' && typeof chapterEnd === 'number') {
    return { start: chapterStart, end: chapterEnd };
  }

  // Try Wikipedia-style chapterRange string (e.g., "1-10" or "5")
  const chapterRange = hasProperty(volume, 'chapterRange') ? volume['chapterRange'] : undefined;
  if (typeof chapterRange === 'string') {
    const rangeParts = chapterRange.split('-').map(s => parseFloat(s.trim()));
    const firstPart = rangeParts[0];
    const secondPart = rangeParts[1];
    if (rangeParts.length === 2 && firstPart !== undefined && secondPart !== undefined &&
        !isNaN(firstPart) && !isNaN(secondPart)) {
      return { start: firstPart, end: secondPart };
    }
    if (rangeParts.length === 1 && firstPart !== undefined && !isNaN(firstPart)) {
      return { start: firstPart, end: firstPart };
    }
  }

  // Try extracting from chapters/issues array
  const chapters = hasProperty(volume, 'chapters') ? volume['chapters'] :
                   hasProperty(volume, 'issues') ? volume['issues'] : undefined;
  if (Array.isArray(chapters) && chapters.length > 0) {
    const numbers: number[] = [];
    for (const ch of chapters) {
      if (!isRecord(ch)) continue;
      const num = extractChapterNumber(ch);
      if (num !== null) {
        numbers.push(num);
      }
    }
    if (numbers.length > 0) {
      return { start: Math.min(...numbers), end: Math.max(...numbers) };
    }
  }

  // Try ComicVine first_issue/last_issue pattern
  const firstIssue = hasProperty(volume, 'first_issue') ? volume['first_issue'] : undefined;
  const lastIssue = hasProperty(volume, 'last_issue') ? volume['last_issue'] : undefined;
  if (isRecord(firstIssue) && isRecord(lastIssue)) {
    const startNum = extractChapterNumber(firstIssue);
    const endNum = extractChapterNumber(lastIssue);
    if (startNum !== null && endNum !== null) {
      return { start: startNum, end: endNum };
    }
  }

  return null;
}

/**
 * Get chapter identifiers from allChapterUrls that fall within a number range
 * Enables cross-provider selection: volumes from one source, chapters from another
 * Handles all provider formats: Fandom, Wikipedia, ComicVine
 */
export function getChaptersInRange(allChapterUrls: unknown[], range: { start: number; end: number }): unknown[] {
  const result: unknown[] = [];

  for (const ch of allChapterUrls) {
    if (!isRecord(ch)) {
      // If it's a string URL, we can't determine the chapter number
      continue;
    }

    const num = extractChapterNumber(ch);
    if (num !== null && num >= range.start && num <= range.end) {
      result.push(ch);
    }
  }

  return result;
}

/**
 * Get volume number from a volume object
 */
function getVolumeNumber(volume: Record<string, unknown>, index: number): number | string {
  const volumeNumberProp = hasProperty(volume, 'volumeNumber') ? volume['volumeNumber'] : undefined;
  const numberProp = hasProperty(volume, 'number') ? volume['number'] : undefined;

  if (typeof volumeNumberProp === 'number' || typeof volumeNumberProp === 'string') {
    return volumeNumberProp;
  }
  if (typeof numberProp === 'number' || typeof numberProp === 'string') {
    return numberProp;
  }
  return index + 1;
}

/**
 * Calculate cumulative chapter ranges for volumes based on chapterCount
 * Used when volumes don't have explicit chapter range data
 *
 * @param displayVolumes - Array of volume objects
 * @param firstChapterNumber - The first chapter number from allChapterUrls (handles manga starting at 0 or 1)
 */
export function calculateCumulativeRanges(
  displayVolumes: unknown[],
  firstChapterNumber: number = 1
): Map<number | string, { start: number; end: number }> {
  const ranges: Map<number | string, { start: number; end: number }> = new Map();
  // Start from the actual first chapter number (0 for Fire Force, 1 for most manga)
  let cumulativeStart = firstChapterNumber;

  displayVolumes.forEach((volume: unknown, index: number) => {
    if (!isRecord(volume)) return;

    const volumeNumber = getVolumeNumber(volume, index);

    // First check if volume has explicit range data
    const explicitRange = getVolumeChapterRange(volume);
    if (explicitRange) {
      ranges.set(volumeNumber, explicitRange);
      cumulativeStart = explicitRange.end + 1;
      return;
    }

    // Fall back to calculating from chapterCount
    const chapterCount = hasProperty(volume, 'chapterCount') ? volume['chapterCount'] :
                        hasProperty(volume, 'chapters') ? volume['chapters'] : undefined;

    // Parse chapterCount - can be number, array, or string like "8 CH"
    let count = 0;
    if (typeof chapterCount === 'number') {
      count = chapterCount;
    } else if (Array.isArray(chapterCount)) {
      count = chapterCount.length;
    } else if (typeof chapterCount === 'string') {
      // Parse strings like "8 CH", "10 chapters", "5", etc.
      const match = chapterCount.match(/^(\d+)/);
      const matchedNumber = match?.[1];
      if (matchedNumber !== undefined) {
        count = parseInt(matchedNumber, 10);
      }
    }

    if (count > 0) {
      const end = cumulativeStart + count - 1;
      ranges.set(volumeNumber, { start: cumulativeStart, end });
      cumulativeStart = end + 1;
    }
  });

  return ranges;
}

/**
 * Detect the first chapter number from a list of chapter URLs/objects
 * Handles manga that start at chapter 0 (like Fire Force)
 */
export function detectFirstChapterNumber(allChapterUrls: unknown[]): number {
  if (allChapterUrls.length === 0) return 1;

  // Find the minimum chapter number in allChapterUrls
  let minNumber: number | null = null;
  for (const ch of allChapterUrls) {
    if (!isRecord(ch)) continue;
    const num = extractChapterNumber(ch);
    if (num !== null && (minNumber === null || num < minNumber)) {
      minNumber = num;
    }
  }
  return minNumber ?? 1;
}
