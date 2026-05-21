/**
 * Base Filename Matcher Utilities
 *
 * Shared utilities for filename matching across all providers.
 * Extracted from ComicVineFilenameMatcher for reuse.
 *
 * @module server/services/matching/base-filename-matcher
 */

import type {
  FilenameMatchRequest,
  FilenameMatchResult,
  MatchedVolume,
  ScoreBreakdown,
  ScoringWeights,
  VolumeForMatching,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** Words to strip from titles for normalization */
const STOP_WORDS = [
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for',
  'annual', 'one-shot', 'hardcover', 'omnibus', 'tpb',
  'deluxe', 'edition', 'collection', 'complete', 'vol', 'volume',
  'manga', 'comic', 'comics',
];

/** Regex for cleaning titles */
const PUNCTUATION_REGEX = /[^\w\s]/g;
const WHITESPACE_REGEX = /\s+/g;

/** Default configuration */
const DEFAULT_AUTO_MATCH_THRESHOLD = 0.85;

// ============================================================================
// Title Normalization
// ============================================================================

/**
 * Normalize a title for comparison
 * - Lowercase
 * - Remove punctuation
 * - Remove stop words
 * - Collapse whitespace
 */
export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase();

  // Normalize Unicode characters
  normalized = normalized.normalize('NFKC');

  // Remove punctuation
  normalized = normalized.replace(PUNCTUATION_REGEX, ' ');

  // Remove stop words
  const words = normalized.split(WHITESPACE_REGEX);
  const filteredWords = words.filter(word =>
    word.length > 0 && !STOP_WORDS.includes(word)
  );

  // Collapse whitespace and trim
  return filteredWords.join(' ').trim();
}

// ============================================================================
// Distance Algorithms
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    const firstRow = matrix[0];
    if (firstRow) {
      firstRow[j] = j;
    }
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const row = matrix[i];
      const prevRow = matrix[i - 1];
      if (!row || !prevRow) continue;

      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        row[j] = prevRow[j - 1] ?? 0;
      } else {
        row[j] = Math.min(
          (prevRow[j - 1] ?? 0) + 1, // substitution
          (prevRow[j] ?? 0) + 1,     // deletion
          (row[j - 1] ?? 0) + 1      // insertion
        );
      }
    }
  }

  const lastRow = matrix[b.length];
  return lastRow ? (lastRow[a.length] ?? 0) : 0;
}

// ============================================================================
// Similarity Calculations
// ============================================================================

/**
 * Calculate title similarity score (0-1)
 */
export function calculateTitleScore(fileTitle: string, volumeTitle: string): number {
  const normalizedFile = normalizeTitle(fileTitle);
  const normalizedVolume = normalizeTitle(volumeTitle);

  // Empty string check
  if (!normalizedFile.length || !normalizedVolume.length) return 0;

  // Exact match
  if (normalizedFile === normalizedVolume) {
    return 1.0;
  }

  // Check if one contains the other
  if (normalizedFile.includes(normalizedVolume) || normalizedVolume.includes(normalizedFile)) {
    return 0.9;
  }

  // Levenshtein similarity
  const maxLen = Math.max(normalizedFile.length, normalizedVolume.length);
  if (maxLen === 0) return 0;

  const distance = levenshteinDistance(normalizedFile, normalizedVolume);
  const similarity = 1 - (distance / maxLen);

  return Math.max(0, similarity);
}

/**
 * Calculate Jaccard similarity based on word sets
 */
export function calculateJaccardSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeTitle(str1);
  const norm2 = normalizeTitle(str2);

  const words1 = new Set(norm1.split(' ').filter(w => w.length > 0));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 0));

  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate year match score (0-1)
 * Exact match or ±1 year tolerance
 */
export function calculateYearScore(
  fileYear: number | undefined,
  volumeYear: number | undefined
): number {
  // Both missing - neutral (no bonus or penalty)
  if (fileYear === undefined && volumeYear === undefined) {
    return 0.5;
  }

  // One missing - slight uncertainty
  if (fileYear === undefined || volumeYear === undefined) {
    return 0.3;
  }

  // Exact match
  if (fileYear === volumeYear) {
    return 1.0;
  }

  // Within ±1 year tolerance
  if (Math.abs(fileYear - volumeYear) === 1) {
    return 0.8;
  }

  // Within ±2 years
  if (Math.abs(fileYear - volumeYear) <= 2) {
    return 0.5;
  }

  // Too far off
  return 0;
}

/**
 * Calculate volume number match score (0-1)
 */
export function calculateVolumeScore(
  fileVolume: number | undefined,
  volumeNumber: number | undefined
): number {
  // Both missing - neutral
  if (fileVolume === undefined && volumeNumber === undefined) {
    return 0.5;
  }

  // One missing - slight uncertainty
  if (fileVolume === undefined || volumeNumber === undefined) {
    return 0.3;
  }

  // Exact match
  if (fileVolume === volumeNumber) {
    return 1.0;
  }

  // Mismatch
  return 0;
}

/**
 * Calculate chapter number match score (0-1)
 */
export function calculateChapterScore(
  fileChapter: number | undefined,
  volumeChapterStart: number | undefined,
  volumeChapterEnd: number | undefined
): number {
  // File has no chapter - neutral
  if (fileChapter === undefined) {
    return 0.5;
  }

  // Volume has chapter range
  if (volumeChapterStart !== undefined && volumeChapterEnd !== undefined) {
    if (fileChapter >= volumeChapterStart && fileChapter <= volumeChapterEnd) {
      return 1.0;
    }
    return 0;
  }

  // Volume has only start chapter
  if (volumeChapterStart !== undefined) {
    if (fileChapter === volumeChapterStart) {
      return 1.0;
    }
    return 0;
  }

  // No chapter info on volume
  return 0.5;
}

// ============================================================================
// Filename Parsing
// ============================================================================

/**
 * Extract volume number from filename
 * Handles patterns like: v01, Vol 1, Volume 01, vol.1, etc.
 */
export function extractVolumeNumber(filename: string): number | null {
  const nameWithoutExt = filename.replace(/\.(cbz|cbr|cbt|cb7|zip|pdf|epub)$/i, '');

  // Try various volume patterns (in order of specificity)
  const patterns = [
    /\bv(?:ol(?:ume)?\.?)?\s*(\d+)\b/i,      // v01, vol.1, volume 1
    /\bvolume\s+(\d+)\b/i,                    // volume 1
    /\bvol\s+(\d+)\b/i,                       // vol 1
    /[[({]v(\d+)[\]})]/i,                      // [v01] or (v01)
    /\s-\s*v?(\d{1,3})(?:\s|$|-|\[|\()/i,    // - 01, - v01
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0 && num < 1000) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract chapter number from filename
 */
export function extractChapterNumber(filename: string): number | null {
  const nameWithoutExt = filename.replace(/\.(cbz|cbr|cbt|cb7|zip|pdf|epub)$/i, '');

  const patterns = [
    /\bc(?:h(?:ap(?:ter)?)?\.?)?\s*(\d+(?:\.\d+)?)\b/i,  // c01, ch.1, chapter 1, c1.5
    /[[({]c(\d+(?:\.\d+)?)[\]})]/i,                         // [c01] or (c01)
    /\s-\s*c?(\d+(?:\.\d+)?)(?:\s|$|-|\[|\()/i,           // - 01, - c01
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match?.[1]) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num >= 0 && num < 10000) {
        return num;
      }
    }
  }

  return null;
}

/**
 * Extract year from filename
 * Handles patterns like: (2020), [2020], 2020
 */
export function extractYearFromFilename(filename: string): number | null {
  const patterns = [
    /[[({](\d{4})[\]})]/,             // [2020] or (2020)
    /\b(19\d{2}|20\d{2})\b/,         // 1990-2099
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      const year = parseInt(match[1], 10);
      if (year >= 1900 && year <= 2100) {
        return year;
      }
    }
  }

  return null;
}

/**
 * Extract title from filename (removes volume/chapter/year info)
 */
export function extractTitleFromFilename(filename: string): string {
  let title = filename;

  // Remove file extension
  title = title.replace(/\.(cbz|cbr|cbt|cb7|zip|pdf|epub)$/i, '');

  // Remove volume patterns
  title = title.replace(/\bv(?:ol(?:ume)?\.?)?\s*\d+\b/gi, '');

  // Remove chapter patterns
  title = title.replace(/\bc(?:h(?:ap(?:ter)?)?\.?)?\s*\d+(?:\.\d+)?\b/gi, '');

  // Remove year patterns
  title = title.replace(/[[(]\d{4}[\])]/g, '');

  // Remove group tags in brackets
  title = title.replace(/[[({][^[\]()]+[\]})]/g, '');

  // Remove common separators at start/end
  title = title.replace(/^[\s\-_.]+|[\s\-_.]+$/g, '');

  // Collapse multiple spaces
  title = title.replace(/\s+/g, ' ').trim();

  return title;
}

/**
 * Parse a filename into a FilenameMatchRequest
 */
export function parseFilename(filename: string): FilenameMatchRequest {
  return {
    filename,
    title: extractTitleFromFilename(filename),
    volume: extractVolumeNumber(filename) ?? undefined,
    chapter: extractChapterNumber(filename) ?? undefined,
    year: extractYearFromFilename(filename) ?? undefined,
  };
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate overall match confidence using weighted scores
 */
export function calculateConfidence(
  breakdown: ScoreBreakdown,
  weights: ScoringWeights
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  // Title weight
  weightedSum += breakdown.titleMatch * weights.title;
  totalWeight += weights.title;

  // Volume weight
  weightedSum += breakdown.volumeMatch * weights.volume;
  totalWeight += weights.volume;

  // Chapter weight (optional)
  if (breakdown.chapterMatch !== undefined && weights.chapter !== undefined) {
    weightedSum += breakdown.chapterMatch * weights.chapter;
    totalWeight += weights.chapter;
  }

  // Year weight (optional)
  if (breakdown.yearMatch !== undefined && weights.year !== undefined) {
    weightedSum += breakdown.yearMatch * weights.year;
    totalWeight += weights.year;
  }

  // ISBN weight (optional)
  if (breakdown.isbnMatch !== undefined && weights.isbn !== undefined) {
    weightedSum += breakdown.isbnMatch * weights.isbn;
    totalWeight += weights.isbn;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

// ============================================================================
// Volume Matching Utilities
// ============================================================================

/**
 * Get volume number from a VolumeForMatching object
 */
export function getVolumeNumber(volume: VolumeForMatching): number | undefined {
  return volume.volumeNumber ?? volume.number;
}

/**
 * Get volume title from a VolumeForMatching object
 */
export function getVolumeTitle(volume: VolumeForMatching): string {
  return volume.title ?? volume.name ?? volume.englishTitle ?? '';
}

/**
 * Get all title variations for a volume
 */
export function getVolumeTitles(volume: VolumeForMatching): string[] {
  const titles: string[] = [];

  if (volume.title) titles.push(volume.title);
  if (volume.name) titles.push(volume.name);
  if (volume.englishTitle) titles.push(volume.englishTitle);
  if (volume.japaneseTitle) titles.push(volume.japaneseTitle);
  if (volume.alternativeTitles) titles.push(...volume.alternativeTitles);

  return titles.filter(t => t.length > 0);
}

/**
 * Parse chapter range from string (e.g., "1-10")
 */
export function parseChapterRange(range: string | undefined): {
  start: number | undefined;
  end: number | undefined;
} {
  if (!range) return { start: undefined, end: undefined };

  const match = range.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (match) {
    return {
      start: parseInt(match[1] ?? '0', 10),
      end: parseInt(match[2] ?? '0', 10),
    };
  }

  // Single chapter
  const singleMatch = range.match(/^(\d+)$/);
  if (singleMatch) {
    const num = parseInt(singleMatch[1] ?? '0', 10);
    return { start: num, end: num };
  }

  return { start: undefined, end: undefined };
}

/**
 * Extract year from a date string or volume
 */
export function extractYearFromVolume(volume: VolumeForMatching): number | undefined {
  if (volume.year) return volume.year;

  if (volume.releaseDate) {
    const match = volume.releaseDate.match(/\b(19\d{2}|20\d{2})\b/);
    if (match) {
      return parseInt(match[1] ?? '0', 10);
    }
  }

  return undefined;
}

// ============================================================================
// Result Building
// ============================================================================

/**
 * Create a FilenameMatchResult from matches
 */
export function buildMatchResult(
  file: FilenameMatchRequest,
  matches: MatchedVolume[],
  threshold: number = DEFAULT_AUTO_MATCH_THRESHOLD
): FilenameMatchResult {
  // Sort by confidence descending
  const sortedMatches = [...matches].sort((a, b) => b.confidence - a.confidence);

  const topMatch = sortedMatches[0];
  const bestMatch = topMatch && topMatch.confidence >= threshold
    ? topMatch
    : undefined;

  return {
    file,
    matches: sortedMatches,
    bestMatch,
    confidence: topMatch?.confidence ?? 0,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for specified milliseconds (for rate limiting)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Group files by normalized title to reduce API calls
 */
export function groupFilesByTitle(
  files: FilenameMatchRequest[]
): Map<string, FilenameMatchRequest[]> {
  const filesByTitle = new Map<string, FilenameMatchRequest[]>();

  for (const file of files) {
    const normalizedTitle = normalizeTitle(file.title);
    const existing = filesByTitle.get(normalizedTitle) ?? [];
    existing.push(file);
    filesByTitle.set(normalizedTitle, existing);
  }

  return filesByTitle;
}
