/**
 * Validation Helpers
 *
 * Core validation functions for the validation tool.
 */

import { diceCoefficient, normalizeTitle } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/utils';

/**
 * Validate provider match similarity (based on validateProviderMatch from phase-provider-fetch.ts)
 */
export function validateProviderMatch(
  title1: string,
  title2: string,
  threshold: number
): { isValid: boolean; similarity: number; message: string } {
  const similarity = diceCoefficient(normalizeTitle(title1), normalizeTitle(title2));
  const isValid = similarity >= threshold;

  return {
    isValid,
    similarity,
    message: isValid
      ? `Provider match "${title2}" is similar enough to "${title1}" (dice=${similarity.toFixed(2)})`
      : `Provider match "${title2}" too dissimilar to "${title1}" (dice=${similarity.toFixed(2)})`,
  };
}

/**
 * Check if a chapter title is valid content (based on isValidChapterTitle from chapter-title-patterns.ts)
 */
export function isValidChapterTitle(title: string): { isValid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Reject empty or single-char titles
  if (title.length < 2) {
    reasons.push('Title too short (length < 2)');
  }
  // Reject pure numbers (volume counts from sidebars)
  if (/^\d+$/.test(title)) {
    reasons.push('Title is pure number (likely volume count)');
  }
  // Reject ISBN patterns like "1-59116-754-9" or "4865540543"
  if (/^\d[\d-]{7,}$/.test(title)) {
    reasons.push('Title matches ISBN pattern');
  }
  // Reject date-like patterns "2020-01-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(title)) {
    reasons.push('Title matches date pattern');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

/**
 * Check for off-by-one issue in chapter-to-volume map
 */
export function fixOffByOneChapterVolumeMap(
  chapterVolumeMap: Record<number, number>
): { fixedMap: Record<number, number>; issues: string[]; adjustments: { chapter: number; oldVolume?: number; newVolume: number }[] } {
  const chapterNums = Object.keys(chapterVolumeMap).map(Number).sort((a, b) => a - b);
  const issues: string[] = [];
  const adjustments: { chapter: number; oldVolume?: number; newVolume: number }[] = [];

  if (chapterNums.length === 0 || chapterNums[0] !== 0) {
    return { fixedMap: chapterVolumeMap, issues, adjustments };
  }

  // First chapter is 0, shift all chapters up by 1
  issues.push('Chapter numbers start at 0 (off-by-one detected)');
  const adjusted: Record<number, number> = {};
  for (const [chNumStr, volNum] of Object.entries(chapterVolumeMap)) {
    const oldChNum = Number(chNumStr);
    const newChNum = oldChNum + 1;
    adjusted[newChNum] = volNum;
    adjustments.push({
      chapter: newChNum,
      oldVolume: volNum,
      newVolume: volNum,
    });
  }
  return { fixedMap: adjusted, issues, adjustments };
}

/**
 * Check for missing chapters in sequence
 */
export function findMissingChapters(chapterNums: number[]): number[] {
  if (chapterNums.length === 0) return [];
  const expectedMin = chapterNums[0] as number;
  const expectedMax = chapterNums[chapterNums.length - 1] as number;
  const missingChapters: number[] = [];

  for (let i = expectedMin; i <= expectedMax; i++) {
    if (!chapterNums.includes(i)) {
      missingChapters.push(i);
    }
  }
  return missingChapters;
}

/**
 * Check volume assignment consistency
 */
export function checkVolumeConsistency(
  chapterVolumeMap: Record<number, number>
): { issues: string[]; volumeAssignments: Map<number, number[]> } {
  const issues: string[] = [];
  const volumeAssignments = new Map<number, number[]>();

  // Build volume assignments map
  for (const [chNumStr, volNum] of Object.entries(chapterVolumeMap)) {
    const chNum = Number(chNumStr);
    if (!volumeAssignments.has(volNum)) {
      volumeAssignments.set(volNum, []);
    }
    const assignments = volumeAssignments.get(volNum);
    if (assignments) {
      assignments.push(chNum);
    }
  }

  // Check for overlapping volume assignments (non-sequential chapters in same volume)
  for (const [volNum, chapters] of volumeAssignments.entries()) {
    if (chapters.length === 0) continue;
    chapters.sort((a, b) => a - b);
    const minChapter = chapters[0] as number;
    const maxChapter = chapters[chapters.length - 1] as number;
    const expectedCount = maxChapter - minChapter + 1;
    if (chapters.length !== expectedCount) {
      issues.push(`Volume ${volNum} has non-sequential chapters: ${chapters.join(', ')}`);
    }
  }

  return { issues, volumeAssignments };
}

/**
 * Validate and fix chapter-to-volume map (based on validateAndFixChapterVolumeMap from phase-wikipedia-fallback.ts)
 */
export function validateAndFixChapterVolumeMap(
  chapterVolumeMap: Record<number, number>
): {
  isValid: boolean;
  fixedMap: Record<number, number>;
  issues: string[];
  adjustments: { chapter: number; oldVolume?: number; newVolume: number }[];
} {
  const chapterNums = Object.keys(chapterVolumeMap).map(Number).sort((a, b) => a - b);
  const issues: string[] = [];

  if (chapterNums.length === 0) {
    return {
      isValid: true,
      fixedMap: chapterVolumeMap,
      issues: ['Empty map'],
      adjustments: [],
    };
  }

  // Check for off-by-one issue
  const offByOneResult = fixOffByOneChapterVolumeMap(chapterVolumeMap);
  const finalMap = offByOneResult.fixedMap;
  issues.push(...offByOneResult.issues);

  // Check for missing chapters in sequence
  const missingChapters = findMissingChapters(chapterNums);
  if (missingChapters.length > 0) {
    issues.push(`Missing chapters in sequence: ${missingChapters.join(', ')}`);
  }

  // Check volume assignment consistency
  const consistencyResult = checkVolumeConsistency(finalMap);
  issues.push(...consistencyResult.issues);

  return {
    isValid: issues.length === 0,
    fixedMap: finalMap,
    issues,
    adjustments: offByOneResult.adjustments,
  };
}

/**
 * Check for unlinked chapters
 */
export function checkUnlinkedChapters(
  unlinkedChapterCount?: number
): {
  warnings: string[];
  issues: {
    type: 'unlinked_chapters';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
} {
  const warnings: string[] = [];
  const issues: {
    type: 'unlinked_chapters';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[] = [];

  if (unlinkedChapterCount && unlinkedChapterCount > 0) {
    const warning = `${unlinkedChapterCount} chapters without volume assignment`;
    warnings.push(warning);
    issues.push({
      type: 'unlinked_chapters',
      description: warning,
      severity: unlinkedChapterCount > 10 ? 'high' : unlinkedChapterCount > 5 ? 'medium' : 'low',
    });
  }

  return { warnings, issues };
}

/**
 * Check for overlapping volume ranges
 */
export function checkOverlappingRanges(
  volumeRanges?: Array<{ number: number; chapterStart: number | null; chapterEnd: number | null }>
): {
  warnings: string[];
  issues: {
    type: 'overlapping_ranges';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
} {
  const warnings: string[] = [];
  const issues: {
    type: 'overlapping_ranges';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[] = [];

  if (!volumeRanges || volumeRanges.length <= 1) {
    return { warnings, issues };
  }

  const overlaps: string[] = [];
  for (let i = 1; i < volumeRanges.length; i++) {
    const prev = volumeRanges[i - 1];
    const curr = volumeRanges[i];
    if (!prev || !curr) continue;
    if (curr.chapterStart !== null && prev.chapterEnd !== null && curr.chapterStart <= prev.chapterEnd) {
      overlaps.push(`Vol${prev.number}(${prev.chapterStart}-${prev.chapterEnd}) / Vol${curr.number}(${curr.chapterStart}-${curr.chapterEnd})`);
    }
  }

  if (overlaps.length > 0) {
    const warning = `Overlapping volume ranges: ${overlaps.join(', ')}`;
    warnings.push(warning);
    issues.push({
      type: 'overlapping_ranges',
      description: warning,
      severity: 'high',
    });
  }

  return { warnings, issues };
}

/**
 * Perform data quality validation (based on auditEnrichmentResult from fandom-volume-helpers.ts)
 */
export function validateDataQuality(
  data: {
    unlinkedChapterCount?: number;
    volumeRanges?: Array<{ number: number; chapterStart: number | null; chapterEnd: number | null }>;
  }
): {
  isValid: boolean;
  warnings: string[];
  issues: {
    type: 'unlinked_chapters' | 'overlapping_ranges';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
} {
  const unlinkedResult = checkUnlinkedChapters(data.unlinkedChapterCount);
  const overlappingResult = checkOverlappingRanges(data.volumeRanges);

  const warnings = [...unlinkedResult.warnings, ...overlappingResult.warnings];
  const issues = [...unlinkedResult.issues, ...overlappingResult.issues];

  return {
    isValid: issues.length === 0,
    warnings,
    issues,
  };
}