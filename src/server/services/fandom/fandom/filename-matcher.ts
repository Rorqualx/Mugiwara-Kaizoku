/**
 * Fandom Filename Matcher Service
 *
 * Matches parsed filename data to Fandom volumes using
 * volume numbers, chapter titles, and fuzzy title matching.
 *
 * @module server/services/fandom/fandom/filename-matcher
 */

import {
  calculateTitleScore,
  calculateVolumeScore,
  calculateChapterScore,
  parseChapterRange,
  getVolumeNumber,
  getVolumeTitle,
  getVolumeTitles,
  buildMatchResult,
} from '@/server/services/matching/base-filename-matcher';
import type {
  FilenameMatchRequest,
  FilenameMatchResult,
  MatchedVolume,
  VolumeForMatching,
  ChapterForMatching,
  FilenameMatcherOptions,
} from '@/server/services/matching/types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

// Re-export types for convenience
export type { FilenameMatchRequest, FilenameMatchResult };

/**
 * Fandom volume data with chapters
 */
export interface FandomVolumeData extends VolumeForMatching {
  chapters?: ChapterForMatching[];
}

/**
 * Options for the Fandom filename matcher
 */
export interface FandomMatcherOptions extends FilenameMatcherOptions {
  /** Weight for volume number matching (default: 0.40) */
  volumeWeight?: number | undefined;
  /** Weight for title matching (default: 0.35) */
  titleWeight?: number | undefined;
  /** Weight for chapter matching (default: 0.25) */
  chapterWeight?: number | undefined;
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
const DEFAULT_AUTO_MATCH_THRESHOLD = 0.85;

/** Fandom-specific scoring weights */
const DEFAULT_WEIGHTS = {
  volume: 0.40,
  title: 0.35,
  chapter: 0.25,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate best title match score across all title variations
 */
function calculateBestTitleScore(
  fileTitle: string,
  volume: VolumeForMatching
): number {
  const titles = getVolumeTitles(volume);

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
 * Calculate chapter match score using chapter titles
 */
function calculateChapterTitleScore(
  fileTitle: string,
  chapters: ChapterForMatching[] | undefined
): number {
  if (!chapters || chapters.length === 0) {
    return 0.5; // Neutral if no chapters
  }

  let bestScore = 0;
  for (const chapter of chapters) {
    // Check main title
    if (chapter.title) {
      const score = calculateTitleScore(fileTitle, chapter.title);
      if (score > bestScore) {
        bestScore = score;
      }
    }

    // Check alternative titles
    if (chapter.alternativeTitles) {
      for (const altTitle of chapter.alternativeTitles) {
        const score = calculateTitleScore(fileTitle, altTitle);
        if (score > bestScore) {
          bestScore = score;
        }
      }
    }
  }

  return bestScore;
}

/**
 * Get chapter range from a Fandom volume
 */
function getChapterRange(volume: FandomVolumeData): { start: number | undefined; end: number | undefined } {
  // Try chapterRange string first
  if (volume.chapterRange) {
    return parseChapterRange(volume.chapterRange);
  }

  // Infer from chapters array
  if (volume.chapters && volume.chapters.length > 0) {
    const chapterNumbers = volume.chapters
      .map(ch => {
        const num = ch.number ?? ch.chapterNumber;
        return typeof num === 'string' ? parseFloat(num) : num;
      })
      .filter((n): n is number => n !== undefined && !isNaN(n))
      .sort((a, b) => a - b);

    if (chapterNumbers.length > 0) {
      return {
        start: chapterNumbers[0],
        end: chapterNumbers[chapterNumbers.length - 1],
      };
    }
  }

  return { start: undefined, end: undefined };
}

/**
 * Calculate overall match confidence for Fandom
 * Weighted combination: Volume# (40%) + Title (35%) + Chapter (25%)
 */
function calculateFandomConfidence(
  breakdown: {
    volumeMatch: number;
    titleMatch: number;
    chapterMatch?: number;
  },
  weights: typeof DEFAULT_WEIGHTS
): number {
  let total = breakdown.volumeMatch * weights.volume +
              breakdown.titleMatch * weights.title;

  if (breakdown.chapterMatch !== undefined) {
    total += breakdown.chapterMatch * weights.chapter;
  } else {
    // Redistribute chapter weight to title if no chapter info
    total += breakdown.titleMatch * weights.chapter;
  }

  return total;
}

// ============================================================================
// Main Matcher Class
// ============================================================================

/**
 * Fandom Filename Matcher
 *
 * Matches parsed filename data to Fandom volumes using
 * volume numbers, chapter titles, and fuzzy title matching.
 */
export class FandomFilenameMatcher {
  private autoMatchThreshold: number;
  private weights: typeof DEFAULT_WEIGHTS;

  constructor(options: FandomMatcherOptions = {}) {
    this.autoMatchThreshold = options.autoMatchThreshold ?? DEFAULT_AUTO_MATCH_THRESHOLD;
    this.weights = {
      volume: options.volumeWeight ?? DEFAULT_WEIGHTS.volume,
      title: options.titleWeight ?? DEFAULT_WEIGHTS.title,
      chapter: options.chapterWeight ?? DEFAULT_WEIGHTS.chapter,
    };
  }

  /**
   * Match files to Fandom volumes
   *
   * @param files - Array of parsed filename data
   * @param volumes - Array of Fandom volume data
   * @returns Array of match results
   */
  matchFilesToVolumes(
    files: FilenameMatchRequest[],
    volumes: FandomVolumeData[]
  ): FilenameMatchResult[] {
    logger.info(`[FandomFilenameMatcher] Matching ${files.length} files to ${volumes.length} volumes`);

    const results: FilenameMatchResult[] = [];

    for (const file of files) {
      const matchResult = this.matchFileToVolumes(file, volumes);
      results.push(matchResult);
    }

    const autoMatched = results.filter(r => r.bestMatch !== undefined).length;
    logger.info(
      `[FandomFilenameMatcher] Complete: ${autoMatched}/${results.length} files auto-matched`
    );

    return results;
  }

  /**
   * Match a single file against a list of volumes
   */
  private matchFileToVolumes(
    file: FilenameMatchRequest,
    volumes: FandomVolumeData[]
  ): FilenameMatchResult {
    if (volumes.length === 0) {
      return {
        file,
        matches: [],
        confidence: 0,
      };
    }

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
      if (file.chapter !== undefined) {
        chapterMatch = calculateChapterScore(file.chapter, chapterRange.start, chapterRange.end);
      } else {
        // Try matching file title against chapter titles
        const chapterTitleScore = calculateChapterTitleScore(file.title, volume.chapters);
        if (chapterTitleScore > 0.5) {
          chapterMatch = chapterTitleScore;
        }
      }

      // Build score breakdown - only include chapterMatch if defined
      const scoreBreakdown: {
        volumeMatch: number;
        titleMatch: number;
        chapterMatch?: number;
      } = {
        volumeMatch,
        titleMatch,
      };

      if (chapterMatch !== undefined) {
        scoreBreakdown.chapterMatch = chapterMatch;
      }

      const confidence = calculateFandomConfidence(scoreBreakdown, this.weights);

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
   * Match files to chapters directly (flat chapter array)
   *
   * @param files - Array of parsed filename data
   * @param chapters - Array of Fandom chapter data
   * @returns Map of chapter number to matched file
   */
  // eslint-disable-next-line complexity -- Two-pass matching algorithm: exact chapter numbers then fuzzy title matching with scoring
  matchFilesToChapters(
    files: FilenameMatchRequest[],
    chapters: ChapterForMatching[]
  ): Map<number, FilenameMatchRequest> {
    logger.info(`[FandomFilenameMatcher] Matching ${files.length} files to ${chapters.length} chapters`);

    const chapterToFile = new Map<number, FilenameMatchRequest>();
    const usedFiles = new Set<string>();

    // First pass: exact chapter number matches
    for (const file of files) {
      if (file.chapter === undefined) continue;

      const chapter = chapters.find(ch => {
        const chNum = ch.number ?? ch.chapterNumber;
        const num = typeof chNum === 'string' ? parseFloat(chNum) : chNum;
        return num === file.chapter;
      });

      if (chapter) {
        const chNum = chapter.number ?? chapter.chapterNumber;
        const num = typeof chNum === 'string' ? parseFloat(chNum) : chNum;
        if (num !== undefined) {
          chapterToFile.set(num, file);
          usedFiles.add(file.filename);
        }
      }
    }

    // Second pass: title matching for remaining files
    for (const file of files) {
      if (usedFiles.has(file.filename)) continue;

      let bestMatch: { chapter: ChapterForMatching; score: number } | undefined;

      for (const chapter of chapters) {
        const chNum = chapter.number ?? chapter.chapterNumber;
        const num = typeof chNum === 'string' ? parseFloat(chNum) : chNum;

        // Skip already matched chapters
        if (num !== undefined && chapterToFile.has(num)) continue;

        // Calculate title similarity
        let score = 0;
        if (chapter.title) {
          score = Math.max(score, calculateTitleScore(file.title, chapter.title));
        }
        if (chapter.alternativeTitles) {
          for (const altTitle of chapter.alternativeTitles) {
            score = Math.max(score, calculateTitleScore(file.title, altTitle));
          }
        }

        if (score >= this.autoMatchThreshold && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { chapter, score };
        }
      }

      if (bestMatch) {
        const chNum = bestMatch.chapter.number ?? bestMatch.chapter.chapterNumber;
        const num = typeof chNum === 'string' ? parseFloat(chNum) : chNum;
        if (num !== undefined) {
          chapterToFile.set(num, file);
          usedFiles.add(file.filename);
        }
      }
    }

    logger.info(`[FandomFilenameMatcher] Matched ${chapterToFile.size} chapters to files`);
    return chapterToFile;
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
