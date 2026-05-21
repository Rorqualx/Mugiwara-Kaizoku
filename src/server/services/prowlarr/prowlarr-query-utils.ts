/**
 * Prowlarr Query Utilities
 *
 * Query optimization, title parsing, and chapter extraction utilities
 * for Prowlarr manga search operations.
 *
 * Extracted from: mangaSearch.ts
 * Fixes: ESLint max-depth violations (lines 445, 451)
 */

import { logger } from '@/utils/logger';

/**
 * Optimizes search query for better Prowlarr results
 *
 * Strategies:
 * 1. Remove common noise: "(manga)", "Chapter X", etc.
 * 2. Generate query variations ONLY for short/generic titles
 *
 * Performance: For titles longer than 15 chars, only use base query
 * to avoid unnecessary API calls (3x → 1x reduction)
 *
 * @param query - Raw search query
 * @returns Array of optimized search queries to try
 */
export function optimizeSearchQuery(query: string): string[] {
  const queries: string[] = [];

  // If the query contains volume info (from Quick Download volume search),
  // keep it as-is — stripping it would defeat the purpose
  const hasVolumeInfo = /\bv\d{2}\b|\bVol(?:ume)?\s+\d+/i.test(query);
  if (hasVolumeInfo) {
    const cleaned = query.replace(/[^\w\s.-]/g, ' ').replace(/\s+/g, ' ').trim();
    queries.push(cleaned);
    return queries;
  }

  // Clean the base query — remove chapter numbers but keep title intact
  const cleanQuery = query
    .replace(/\(manga\)/gi, '')           // Remove "(manga)"
    .replace(/\(series\)/gi, '')          // Remove "(series)"
    .replace(/Chapter\s+\d+/gi, '')       // Remove "Chapter X"
    .replace(/Ch\.?\s+\d+/gi, '')         // Remove "Ch. X"
    .replace(/\s+\([^)]+\)/g, '')         // Remove any other parenthetical info
    .replace(/[^\w\s]/g, ' ')             // Remove special chars
    .replace(/\s+/g, ' ')                 // Normalize whitespace
    .trim();

  // Add the cleaned base query
  if (cleanQuery) {
    queries.push(cleanQuery);

    // Only add "manga" variant for short/generic titles (< 15 chars)
    if (cleanQuery.length < 15) {
      queries.push(`${cleanQuery} manga`);
      logger.debug(`Multi-query optimization: "${cleanQuery}" is short (${cleanQuery.length} chars), adding "manga" variant`);
    } else {
      logger.debug(`Multi-query optimization: "${cleanQuery}" is long (${cleanQuery.length} chars), skipping extra variants`);
    }
  }

  // Remove duplicates
  return Array.from(new Set(queries)).filter(q => q.length > 0);
}

/**
 * Extracts base manga title for matching
 *
 * Normalizes title by removing common noise and special characters.
 *
 * @param query - Raw query string
 * @returns Normalized lowercase title
 */
export function extractBaseMangaTitle(query: string): string {
  return query
    .replace(/\(manga\)/gi, '')
    .replace(/\(series\)/gi, '')
    .replace(/Chapter\s+\d+/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Detects if a release title represents a complete pack/collection
 *
 * Checks for patterns like:
 * - Explicit keywords: "complete", "full", "all", "collection"
 * - Large volume ranges: "v01-30", "vol 1-20" (10+ volumes)
 * - Large chapter ranges: "1-300", "ch 1-100" (50+ chapters)
 *
 * @param title - Release title to check
 * @returns True if title indicates a complete pack or significant collection
 */
export function isCompletePack(title: string): boolean {
  // Pattern 1: Explicit keywords
  if (/complete|full|all|collection/i.test(title)) {
    return true;
  }

  // Pattern 2: Large volume ranges (10+ volumes indicates significant collection)
  const volumeRange = title.match(/v(?:ol(?:ume)?\.?)?\s*(\d+)\s*-\s*(\d+)/i);
  if (volumeRange) {
    const start = parseInt(volumeRange[1] ?? '0', 10);
    const end = parseInt(volumeRange[2] ?? '0', 10);
    if (end - start + 1 >= 10) {  // 10+ volumes is likely a complete or near-complete series
      return true;
    }
  }

  // Pattern 3: Large chapter ranges (50+ chapters indicates likely complete or near-complete)
  const chapterRange = title.match(/(?:ch(?:apter)?\.?\s*)?(\d+)\s*-\s*(\d+)/i);
  if (chapterRange) {
    const start = parseInt(chapterRange[1] ?? '0', 10);
    const end = parseInt(chapterRange[2] ?? '0', 10);
    if (end - start + 1 >= 50) {  // 50+ chapters is likely a complete collection
      return true;
    }
  }

  return false;
}

/**
 * Parses chapter numbers from release titles
 *
 * REFACTORED: Reduced nesting depth from 5 to 3 using helper functions.
 * Fixes ESLint max-depth violations at original lines 445, 451.
 *
 * @param title - Release title to parse
 * @returns Array of chapter numbers found in title
 */
export function parseChaptersFromTitle(title: string): number[] {
  try {
    const patterns = [
      /Vol(?:ume)?\.?\s*(\d+)(?:\s*-\s*(\d+))?/gi,
      /Ch(?:apter)?s?\.?\s*(\d+)(?:\s*-\s*(\d+))?/gi,
      /Ep(?:isode)?s?\.?\s*(\d+)(?:\s*-\s*(\d+))?/gi,
      /\b(\d+)\s*-\s*(\d+)\b/g
    ];

    const chapters = new Set<number>();

    // REFACTORED: Extract matches using helper (reduces nesting)
    for (const pattern of patterns) {
      const matches = extractPatternMatches(title, pattern);
      matches.forEach(({ start, end, isVolume }) => {
        addChapterRange(chapters, start, end, isVolume);
      });
    }

    // Check for complete keywords
    if (/complete|full|all/i.test(title)) {
      return [];
    }

    return Array.from(chapters).sort((a, b) => a - b);
  } catch (_error: unknown) {
    logger.warn(`Failed to parse chapters from title: ${title}`);
    return [];
  }
}

// ============================================================================
// Helper Functions (Reduce Nesting Depth)
// ============================================================================

/**
 * Extracts all pattern matches from title
 *
 * Helper function to reduce nesting in parseChaptersFromTitle.
 * Fixes max-depth violation at original line 445.
 *
 * @param title - Release title
 * @param pattern - RegExp pattern to match
 * @returns Array of match results with start, end, and volume flag
 */
function extractPatternMatches(
  title: string,
  pattern: RegExp
): Array<{ start: number; end: number; isVolume: boolean }> {
  const matches: Array<{ start: number; end: number; isVolume: boolean }> = [];
  let match;

  while ((match = pattern.exec(title)) !== null) {
    const startStr = match[1];
    if (startStr === undefined) continue;

    const start = parseInt(startStr, 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    const isVolume = pattern.source.includes('Vol');

    matches.push({ start, end, isVolume });
  }

  return matches;
}

/**
 * Adds chapter range to set
 *
 * Helper function to reduce nesting in parseChaptersFromTitle.
 * Handles volume-to-chapter conversion.
 *
 * @param chapters - Set to add chapters to
 * @param start - Start number
 * @param end - End number
 * @param isVolume - Whether numbers represent volumes (convert to chapters)
 */
function addChapterRange(
  chapters: Set<number>,
  start: number,
  end: number,
  isVolume: boolean
): void {
  if (isVolume) {
    // Volume to chapter conversion (estimate 10 chapters per volume)
    const startChapter = (start - 1) * 10 + 1;
    const endChapter = end * 10;
    addRange(chapters, startChapter, endChapter);
  } else {
    // Direct chapter range
    addRange(chapters, start, end);
  }
}

/**
 * Adds numeric range to set
 *
 * Helper function to eliminate nested loop (fixes max-depth).
 * Previously nested at depth 5, now isolated at depth 1.
 *
 * @param set - Set to add numbers to
 * @param start - Start of range (inclusive)
 * @param end - End of range (inclusive)
 */
function addRange(set: Set<number>, start: number, end: number): void {
  for (let i = start; i <= end; i++) {
    set.add(i);
  }
}
