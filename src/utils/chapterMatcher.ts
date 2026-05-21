/**
 * Chapter Matcher - Smart filename-to-chapter matching utility
 *
 * Provides intelligent matching of file names to chapter data based on:
 * - Chapter numbers
 * - Volume numbers
 * - Sequential patterns
 * - Title keywords
 * - Fuzzy matching with confidence scores
 *
 * @module utils/chapterMatcher
 */

/**
 * Match result with confidence score
 */
export interface ChapterMatch {
  chapterId: number;
  fileName: string;
  filePath: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Chapter data for matching
 */
export interface ChapterData {
  id: number;
  title: string;
  chapterNumber?: number | undefined;
  index: number;
}

/**
 * File information for matching
 */
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: Date;
  extension: string;
}

/**
 * Extract numbers from filename
 * Handles various patterns like:
 * - Chapter 123
 * - Ch.123
 * - c123
 * - 123
 * - Vol 5 Ch 123
 */
export function extractChapterNumber(filename: string): number | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(cbz|cbr|cbt|cb7|zip|pdf|epub)$/i, '');

  // Try various patterns (in order of specificity)
  const patterns = [
    // Vol X Ch Y or Volume X Chapter Y
    /(?:vol(?:ume)?\.?\s*(\d+)\s*)?(?:ch(?:apter)?\.?\s*(\d+(?:\.\d+)?))/i,
    // Ch Y or Chapter Y (without volume)
    /ch(?:apter)?\.?\s*(\d+(?:\.\d+)?)/i,
    // c123 format
    /\bc(\d+(?:\.\d+)?)\b/i,
    // Just a number at the end (least specific)
    /(\d+(?:\.\d+)?)\s*$/
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match) {
      // For volume+chapter pattern, return the chapter number (second group)
      const chapterStr = match[2] ?? match[1];
      if (chapterStr) {
        const num = parseFloat(chapterStr);
        if (!isNaN(num) && num > 0) {
          return num;
        }
      }
    }
  }

  return null;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a score between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Levenshtein distance algorithm
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    if (matrix[0]) {
      matrix[0][j] = j;
    }
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      const prevRow = matrix[i - 1];
      const currRow = matrix[i];
      const prevCell = matrix[i - 1]?.[j - 1];

      if (s2.charAt(i - 1) === s1.charAt(j - 1) && typeof prevCell === 'number' && currRow) {
        currRow[j] = prevCell;
      } else if (currRow && prevRow) {
        const diag = prevRow[j - 1] ?? Infinity;
        const left = currRow[j - 1] ?? Infinity;
        const up = prevRow[j] ?? Infinity;

        currRow[j] = Math.min(diag + 1, left + 1, up + 1);
      }
    }
  }

  const finalRow = matrix[s2.length];
  const distance = finalRow ? finalRow[s1.length] : s1.length;
  const maxLen = Math.max(s1.length, s2.length);

  if (typeof distance !== 'number') {
    return 0;
  }

  return 1 - distance / maxLen;
}

/**
 * Match a single file to chapters
 */
function matchFileToChapter(
  file: FileInfo,
  chapters: ChapterData[]
): ChapterMatch | null {
  const fileChapterNum = extractChapterNumber(file.name);

  // Try exact chapter number match first
  if (fileChapterNum !== null) {
    for (const chapter of chapters) {
      if (chapter.chapterNumber === fileChapterNum) {
        return {
          chapterId: chapter.id,
          fileName: file.name,
          filePath: file.path,
          confidence: 'high',
          reason: `Exact chapter number match (${fileChapterNum})`
        };
      }
    }

    // Try index-based match (for series without chapter numbers)
    // File "Chapter 5" might match chapter at index 4 (0-based)
    const indexToMatch = Math.floor(fileChapterNum) - 1;
    if (indexToMatch >= 0 && indexToMatch < chapters.length) {
      const chapter = chapters.find(ch => ch.index === indexToMatch);
      if (chapter) {
        return {
          chapterId: chapter.id,
          fileName: file.name,
          filePath: file.path,
          confidence: 'medium',
          reason: `Index-based match (chapter ${fileChapterNum} → index ${indexToMatch})`
        };
      }
    }
  }

  // Try fuzzy title matching
  let bestMatch: { chapter: ChapterData; similarity: number } | null = null;
  for (const chapter of chapters) {
    const similarity = calculateSimilarity(file.name, chapter.title);
    if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { chapter, similarity };
    }
  }

  if (bestMatch && bestMatch.similarity > 0.8) {
    return {
      chapterId: bestMatch.chapter.id,
      fileName: file.name,
      filePath: file.path,
      confidence: 'high',
      reason: `Strong title match (${Math.round(bestMatch.similarity * 100)}% similar)`
    };
  }

  if (bestMatch && bestMatch.similarity > 0.6) {
    return {
      chapterId: bestMatch.chapter.id,
      fileName: file.name,
      filePath: file.path,
      confidence: 'low',
      reason: `Fuzzy title match (${Math.round(bestMatch.similarity * 100)}% similar)`
    };
  }

  return null;
}

/**
 * Match multiple files to chapters
 * Returns a map of chapter ID to match result
 */
export function matchFilesToChapters(
  files: FileInfo[],
  chapters: ChapterData[]
): Map<number, ChapterMatch> {
  const matches = new Map<number, ChapterMatch>();

  // Sort files by name for consistent processing
  const sortedFiles = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  for (const file of sortedFiles) {
    const match = matchFileToChapter(file, chapters);
    if (match) {
      // Only add if this chapter hasn't been matched yet
      // (prevents duplicate matches, keeps first match)
      if (!matches.has(match.chapterId)) {
        matches.set(match.chapterId, match);
      }
    }
  }

  return matches;
}

/**
 * Get suggested filename for a chapter
 * Used for auto-fill when user has specified a base directory
 */
export function suggestFilename(chapter: ChapterData): string {
  if (chapter.chapterNumber !== undefined) {
    // Format: "Chapter 123.cbz" or "Chapter 123.5.cbz"
    return `Chapter ${chapter.chapterNumber}.cbz`;
  }

  // Fallback to index-based naming
  return `Chapter ${chapter.index + 1}.cbz`;
}

/**
 * Get match quality statistics
 */
export function getMatchStatistics(matches: Map<number, ChapterMatch>): {
  total: number;
  high: number;
  medium: number;
  low: number;
  percentage: number;
} {
  const matchArray = Array.from(matches.values());

  return {
    total: matchArray.length,
    high: matchArray.filter(m => m.confidence === 'high').length,
    medium: matchArray.filter(m => m.confidence === 'medium').length,
    low: matchArray.filter(m => m.confidence === 'low').length,
    percentage: matchArray.length > 0 ? (matchArray.length / matchArray.length) * 100 : 0
  };
}
