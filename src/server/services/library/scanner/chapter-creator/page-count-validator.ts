/**
 * Page Count Validation Module
 *
 * Validates volume file page counts against chapter metadata.
 * Calculates chapter boundaries when page counts match within tolerance.
 *
 * @module server/services/library/scanner/chapter-creator/page-count-validator
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Chapter data for validation */
export interface ChapterForValidation {
  number: number;
  pageCount?: number;
  title?: string;
}

/** Result of volume page count validation */
export interface PageCountValidationResult {
  /** Whether validation passed (within tolerance) */
  isValid: boolean;
  /** Sum of chapter page counts from metadata */
  expectedPages: number;
  /** Counted pages from actual file */
  actualPages: number;
  /** Absolute difference between expected and actual */
  difference: number;
  /** Allowed tolerance (10% or 3 pages, whichever is larger) */
  tolerance: number;
  /** Confidence score (0-1) based on match quality */
  confidence: number;
  /** Chapter boundaries if validation passed */
  chapterBoundaries: ChapterBoundary[] | undefined;
  /** Validation message */
  message: string;
}

/** Chapter start/end page boundaries within a volume */
export interface ChapterBoundary {
  /** Chapter number */
  chapterNumber: number;
  /** Start page (1-indexed) */
  startPage: number;
  /** End page (inclusive) */
  endPage: number;
  /** Number of pages in this chapter */
  pageCount: number;
  /** Chapter title (if available) */
  title: string | undefined;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Calculate chapter boundaries from page counts
 *
 * Given a list of chapters with page counts, calculates the cumulative
 * start/end page for each chapter within a volume file.
 *
 * @param chapters - Chapters with page counts, sorted by number
 * @returns Array of chapter boundaries
 */
export function calculateChapterBoundaries(
  chapters: ChapterForValidation[]
): ChapterBoundary[] {
  const boundaries: ChapterBoundary[] = [];
  let currentPage = 1;

  // Sort by chapter number
  const sorted = [...chapters]
    .filter((ch) => ch.pageCount !== undefined && ch.pageCount > 0)
    .sort((a, b) => a.number - b.number);

  for (const chapter of sorted) {
    const pageCount = chapter.pageCount ?? 0;
    if (pageCount <= 0) continue;

    boundaries.push({
      chapterNumber: chapter.number,
      startPage: currentPage,
      endPage: currentPage + pageCount - 1,
      pageCount,
      title: chapter.title
    });

    currentPage += pageCount;
  }

  return boundaries;
}

/**
 * Validate volume page count against chapter metadata
 *
 * Compares the actual page count from a volume file to the sum of
 * chapter page counts from metadata. Returns validation result with
 * confidence score and chapter boundaries if valid.
 *
 * @param actualFilePages - Number of pages counted from the file
 * @param chapters - Chapters with page counts from metadata
 * @returns Validation result with boundaries if valid
 */
export function validateVolumePageCount(
  actualFilePages: number,
  chapters: ChapterForValidation[]
): PageCountValidationResult {
  // Filter chapters with valid page counts
  const chaptersWithPages = chapters.filter(
    (ch) => ch.pageCount !== undefined && ch.pageCount > 0
  );

  // Handle missing page count data
  if (chaptersWithPages.length === 0) {
    return {
      isValid: false,
      expectedPages: 0,
      actualPages: actualFilePages,
      difference: actualFilePages,
      tolerance: 0,
      confidence: 0,
      chapterBoundaries: undefined,
      message: 'No chapter page count metadata available'
    };
  }

  // Check if we have enough coverage
  const coverage = chaptersWithPages.length / chapters.length;
  if (coverage < 0.5) {
    logger.info('Insufficient page count metadata for validation', {
      chaptersWithPages: chaptersWithPages.length,
      totalChapters: chapters.length,
      coverage: Math.round(coverage * 100)
    });
    return {
      isValid: false,
      expectedPages: 0,
      actualPages: actualFilePages,
      difference: actualFilePages,
      tolerance: 0,
      confidence: 0,
      chapterBoundaries: undefined,
      message: `Only ${Math.round(coverage * 100)}% of chapters have page count metadata`
    };
  }

  // Calculate expected pages
  const expectedPages = chaptersWithPages.reduce(
    (sum, ch) => sum + (ch.pageCount ?? 0),
    0
  );

  const difference = Math.abs(expectedPages - actualFilePages);
  // Tolerance: 10% or 3 pages, whichever is larger
  const tolerance = Math.max(Math.round(expectedPages * 0.1), 3);
  const isValid = difference <= tolerance;

  // Calculate confidence score (0-1)
  let confidence: number;
  if (difference === 0) {
    confidence = 1.0;
  } else if (isValid) {
    // Scale confidence based on how close we are to exact match
    confidence = 1 - difference / expectedPages;
  } else {
    // Outside tolerance - confidence based on how far off we are
    confidence = Math.max(0, 1 - difference / expectedPages);
  }

  // Generate message based on result
  let message: string;
  const percentDiff = expectedPages > 0 ? (difference / expectedPages) * 100 : 0;

  if (difference === 0) {
    message = 'Exact page count match';
  } else if (isValid) {
    message = `Page count within tolerance (${difference} pages, ${percentDiff.toFixed(1)}% difference)`;
  } else if (percentDiff <= 25) {
    message = `Page count mismatch but close (${difference} pages, ${percentDiff.toFixed(1)}% difference)`;
  } else {
    message = `Significant page count mismatch (${difference} pages, ${percentDiff.toFixed(1)}% difference)`;
  }

  // Calculate boundaries only if validation passed
  const chapterBoundaries = isValid
    ? calculateChapterBoundaries(chaptersWithPages)
    : undefined;

  logger.info('Volume page count validation result', {
    expectedPages,
    actualPages: actualFilePages,
    difference,
    tolerance,
    isValid,
    confidence: Math.round(confidence * 100),
    chaptersValidated: chaptersWithPages.length
  });

  return {
    isValid,
    expectedPages,
    actualPages: actualFilePages,
    difference,
    tolerance,
    confidence,
    chapterBoundaries,
    message
  };
}

/**
 * Determine action based on page count mismatch severity
 *
 * @param validation - Validation result
 * @returns Recommended action and message
 */
export function handlePageCountMismatch(
  validation: PageCountValidationResult
): { action: 'proceed' | 'warn' | 'skip'; message: string } {
  if (validation.isValid) {
    return {
      action: 'proceed',
      message: validation.message
    };
  }

  const percentDiff =
    validation.expectedPages > 0
      ? (validation.difference / validation.expectedPages) * 100
      : 100;

  if (percentDiff <= 10) {
    // Small difference - likely cover pages, ads, etc.
    return {
      action: 'proceed',
      message: `Page count differs by ${validation.difference} (${percentDiff.toFixed(1)}%). Proceeding anyway.`
    };
  } else if (percentDiff <= 25) {
    // Moderate difference - warn but allow
    return {
      action: 'warn',
      message: `Page count differs by ${validation.difference} (${percentDiff.toFixed(1)}%). Chapter boundaries may be inaccurate.`
    };
  } else {
    // Large difference - something is wrong, skip boundary detection
    return {
      action: 'warn',
      message: `Significant page count mismatch (${percentDiff.toFixed(1)}%). Chapter boundary detection disabled.`
    };
  }
}
