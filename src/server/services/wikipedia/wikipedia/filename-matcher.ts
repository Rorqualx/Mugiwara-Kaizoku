/**
 * Wikipedia Filename Matcher Service
 *
 * Matches parsed filename data to Wikipedia volumes using
 * volume numbers, multi-language titles, ISBN, and chapter ranges.
 *
 * @module server/services/wikipedia/wikipedia/filename-matcher
 */

import {
  calculateTitleScore,
  calculateVolumeScore,
  calculateChapterScore,
  parseChapterRange,
  getVolumeNumber,
  getVolumeTitle,
  buildMatchResult,
} from '@/server/services/matching/base-filename-matcher';
import type {
  FilenameMatchRequest,
  FilenameMatchResult,
  MatchedVolume,
  VolumeForMatching,
  FilenameMatcherOptions,
} from '@/server/services/matching/types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

// Re-export types for convenience
export type { FilenameMatchRequest, FilenameMatchResult };

/**
 * Wikipedia volume data with extended fields
 */
export interface WikipediaVolumeData extends VolumeForMatching {
  /** ISBN-10 identifier */
  isbn?: string;
  /** ISBN-13 identifier */
  isbn13?: string;
}

/**
 * Options for the Wikipedia filename matcher
 */
export interface WikipediaMatcherOptions extends FilenameMatcherOptions {
  /** Weight for volume number matching (default: 0.40) */
  volumeWeight?: number | undefined;
  /** Weight for title matching (default: 0.30) */
  titleWeight?: number | undefined;
  /** Weight for chapter range matching (default: 0.20) */
  chapterRangeWeight?: number | undefined;
  /** Weight for ISBN matching (default: 0.10) */
  isbnWeight?: number | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
const DEFAULT_AUTO_MATCH_THRESHOLD = 0.85;

/** Wikipedia-specific scoring weights */
const DEFAULT_WEIGHTS = {
  volume: 0.40,
  title: 0.30,
  chapterRange: 0.20,
  isbn: 0.10,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate best title match score across all title variations
 * Wikipedia volumes have English, Japanese, and alternative titles
 */
function calculateBestTitleScore(
  fileTitle: string,
  volume: WikipediaVolumeData
): number {
  const titles: string[] = [];

  if (volume.title) titles.push(volume.title);
  if (volume.name) titles.push(volume.name);
  if (volume.englishTitle) titles.push(volume.englishTitle);
  if (volume.japaneseTitle) titles.push(volume.japaneseTitle);
  if (volume.alternativeTitles) titles.push(...volume.alternativeTitles);

  if (titles.length === 0) {
    return 0;
  }

  let bestScore = 0;
  for (const title of titles) {
    const score = calculateTitleScore(fileTitle, title);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

/**
 * Extract ISBN from filename
 * Handles patterns like: ISBN-1234567890, ISBN 978-1234567890, [978-1-23-456789-0]
 */
function extractIsbnFromFilename(filename: string): string | null {
  // Remove dashes and spaces from ISBN patterns
  const patterns = [
    /ISBN[-\s]?([\d-X]{10,17})/i,           // ISBN-1234567890 or ISBN 978-1234567890
    /\b(978[\d-]{10,14})\b/,                 // 978-prefix ISBN-13
    /\b([\dX]{10})\b/,                       // 10-digit ISBN
    /\[([\d-]{13,17})\]/,                    // [978-1-23-456789-0]
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      // Normalize ISBN by removing dashes
      const isbn = match[1].replace(/-/g, '');
      // Validate length (10 or 13 digits)
      if (isbn.length === 10 || isbn.length === 13) {
        return isbn;
      }
    }
  }

  return null;
}

/**
 * Calculate ISBN match score
 */
function calculateIsbnScore(
  fileIsbn: string | null,
  volume: WikipediaVolumeData
): number {
  // No ISBN in filename - neutral
  if (!fileIsbn) {
    return 0.5;
  }

  // Normalize volume ISBNs
  const volumeIsbn10 = volume.isbn?.replace(/-/g, '');
  const volumeIsbn13 = volume.isbn13?.replace(/-/g, '');

  // No ISBN on volume - slight uncertainty
  if (!volumeIsbn10 && !volumeIsbn13) {
    return 0.3;
  }

  // Exact match
  if (fileIsbn === volumeIsbn10 || fileIsbn === volumeIsbn13) {
    return 1.0;
  }

  // ISBN-10 to ISBN-13 conversion check
  if (fileIsbn.length === 13 && volumeIsbn10) {
    // ISBN-13 starts with 978 + first 9 digits of ISBN-10
    const converted = '978' + volumeIsbn10.substring(0, 9);
    if (fileIsbn.startsWith(converted)) {
      return 0.9; // High confidence for conversion match
    }
  }

  if (fileIsbn.length === 10 && volumeIsbn13) {
    // Check if ISBN-13 without prefix matches
    const isbn13Core = volumeIsbn13.substring(3, 12);
    if (fileIsbn.substring(0, 9) === isbn13Core) {
      return 0.9;
    }
  }

  // No match
  return 0;
}

/**
 * Get chapter range from Wikipedia volume
 */
function getChapterRange(volume: WikipediaVolumeData): { start: number | undefined; end: number | undefined } {
  if (volume.chapterRange) {
    return parseChapterRange(volume.chapterRange);
  }
  return { start: undefined, end: undefined };
}

/**
 * Calculate overall match confidence for Wikipedia
 * Weighted combination: Volume# (40%) + Title (30%) + ChapterRange (20%) + ISBN (10%)
 */
function calculateWikipediaConfidence(
  breakdown: {
    volumeMatch: number;
    titleMatch: number;
    chapterMatch?: number;
    isbnMatch?: number;
  },
  weights: typeof DEFAULT_WEIGHTS
): number {
  let total = breakdown.volumeMatch * weights.volume +
              breakdown.titleMatch * weights.title;

  // Add chapter range score if available
  if (breakdown.chapterMatch !== undefined) {
    total += breakdown.chapterMatch * weights.chapterRange;
  } else {
    // Redistribute to title if no chapter info
    total += breakdown.titleMatch * weights.chapterRange;
  }

  // Add ISBN score if available
  if (breakdown.isbnMatch !== undefined) {
    total += breakdown.isbnMatch * weights.isbn;
  } else {
    // Redistribute to volume if no ISBN
    total += breakdown.volumeMatch * weights.isbn;
  }

  return total;
}

// ============================================================================
// Main Matcher Class
// ============================================================================

/**
 * Wikipedia Filename Matcher
 *
 * Matches parsed filename data to Wikipedia volumes using
 * volume numbers, multi-language titles, ISBN, and chapter ranges.
 */
export class WikipediaFilenameMatcher {
  private autoMatchThreshold: number;
  private weights: typeof DEFAULT_WEIGHTS;

  constructor(options: WikipediaMatcherOptions = {}) {
    this.autoMatchThreshold = options.autoMatchThreshold ?? DEFAULT_AUTO_MATCH_THRESHOLD;
    this.weights = {
      volume: options.volumeWeight ?? DEFAULT_WEIGHTS.volume,
      title: options.titleWeight ?? DEFAULT_WEIGHTS.title,
      chapterRange: options.chapterRangeWeight ?? DEFAULT_WEIGHTS.chapterRange,
      isbn: options.isbnWeight ?? DEFAULT_WEIGHTS.isbn,
    };
  }

  /**
   * Match files to Wikipedia volumes
   *
   * @param files - Array of parsed filename data
   * @param volumes - Array of Wikipedia volume data
   * @returns Array of match results
   */
  matchFilesToVolumes(
    files: FilenameMatchRequest[],
    volumes: WikipediaVolumeData[]
  ): FilenameMatchResult[] {
    logger.info(`[WikipediaFilenameMatcher] Matching ${files.length} files to ${volumes.length} volumes`);

    const results: FilenameMatchResult[] = [];

    for (const file of files) {
      const matchResult = this.matchFileToVolumes(file, volumes);
      results.push(matchResult);
    }

    const autoMatched = results.filter(r => r.bestMatch !== undefined).length;
    logger.info(
      `[WikipediaFilenameMatcher] Complete: ${autoMatched}/${results.length} files auto-matched`
    );

    return results;
  }

  /**
   * Match a single file against a list of volumes
   */
  private matchFileToVolumes(
    file: FilenameMatchRequest,
    volumes: WikipediaVolumeData[]
  ): FilenameMatchResult {
    if (volumes.length === 0) {
      return {
        file,
        matches: [],
        confidence: 0,
      };
    }

    // Extract ISBN from filename if present
    const fileIsbn = extractIsbnFromFilename(file.filename);

    // Score each volume
    const matches: MatchedVolume[] = volumes.map(volume => {
      const volumeNumber = getVolumeNumber(volume);
      const volumeTitle = getVolumeTitle(volume);
      const chapterRange = getChapterRange(volume);

      // Calculate individual scores
      const volumeMatch = calculateVolumeScore(file.volume, volumeNumber);
      const titleMatch = calculateBestTitleScore(file.title, volume);

      // Chapter score: check if file chapter is in volume's chapter range
      let chapterMatch: number | undefined;
      if (file.chapter !== undefined && (chapterRange.start !== undefined || chapterRange.end !== undefined)) {
        chapterMatch = calculateChapterScore(file.chapter, chapterRange.start, chapterRange.end);
      }

      // ISBN score
      let isbnMatch: number | undefined;
      if (fileIsbn || volume.isbn || volume.isbn13) {
        isbnMatch = calculateIsbnScore(fileIsbn, volume);
      }

      // Build score breakdown - only include optional fields if defined
      const scoreBreakdown: {
        volumeMatch: number;
        titleMatch: number;
        chapterMatch?: number;
        isbnMatch?: number;
      } = {
        volumeMatch,
        titleMatch,
      };

      if (chapterMatch !== undefined) {
        scoreBreakdown.chapterMatch = chapterMatch;
      }
      if (isbnMatch !== undefined) {
        scoreBreakdown.isbnMatch = isbnMatch;
      }

      const confidence = calculateWikipediaConfidence(scoreBreakdown, this.weights);

      return {
        volumeNumber: volumeNumber ?? 0,
        title: volumeTitle,
        confidence,
        scoreBreakdown,
      };
    });

    return buildMatchResult(file, matches, this.autoMatchThreshold);
  }

  /**
   * Update the auto-match threshold
   */
  setThreshold(threshold: number): void {
    this.autoMatchThreshold = threshold;
  }

  /**
   * Update the scoring weights
   */
  setWeights(weights: Partial<typeof DEFAULT_WEIGHTS>): void {
    this.weights = { ...this.weights, ...weights };
  }
}
