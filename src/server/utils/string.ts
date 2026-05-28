/**
 * String Utility Functions
 * 
 * This module provides utility functions for string operations,
 * particularly those useful for text processing and comparison
 * in the context of metadata extraction.
 */

/**
 * Calculates the Levenshtein distance between two strings
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Levenshtein distance (lower is more similar)
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    const row = matrix[0];
    if (row) row[j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      const currentRow = matrix[i];
      const prevRow = matrix[i - 1];
      if (!currentRow || !prevRow) continue;

      const deletion = prevRow[j];
      const insertion = currentRow[j - 1];
      const substitution = prevRow[j - 1];
      if (deletion === undefined || insertion === undefined || substitution === undefined) continue;

      currentRow[j] = Math.min(
        deletion + 1,      // deletion
        insertion + 1,      // insertion
        substitution + cost // substitution
      );
    }
  }

  const lastRow = matrix[b.length];
  const result = lastRow?.[a.length];
  return result ?? 0;
}

/**
 * Calculates the similarity between two strings (0-1 scale)
 * 
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score (1 = identical, 0 = completely different)
 */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  
  // Normalize strings for comparison
  const strA = a.toLowerCase().trim();
  const strB = b.toLowerCase().trim();
  
  if (strA === strB) return 1.0;
  
  const maxLength = Math.max(strA.length, strB.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(strA, strB);
  return 1.0 - distance / maxLength;
}

/**
 * Extracts a slug from a string
 * 
 * @param str - Input string
 * @returns Slug (lowercase, spaces replaced with hyphens, non-alphanumeric removed)
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

/**
 * Extracts numbers from a string
 * 
 * @param str - Input string
 * @returns Array of numbers found in the string
 */
export function extractNumbers(str: string): number[] {
  const matches = str.match(/\d+(\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

/**
 * Truncates a string to a maximum length, adding an ellipsis if truncated
 * 
 * @param str - Input string
 * @param maxLength - Maximum allowed length
 * @param suffix - Suffix to add if truncated (default: "...")
 * @returns Truncated string
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/** Normalize a title for comparison: NFKD fold accents, lowercase, strip punctuation/whitespace */
export function normalizeTitle(title: string): string {
  return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Bigram Sørensen–Dice coefficient for fuzzy title similarity (0-1).
 *  Uses multiset intersection so repeated bigrams on either side are only matched
 *  once each. Length guard runs BEFORE the equality short-circuit: normalizeTitle()
 *  reduces any non-latin title to "", and "" === "" would otherwise score a perfect
 *  1.0 — making every foreign-alt-title candidate tie at 1.0 against an empty query. */
export function diceCoefficient(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0;
  if (a === b) return 1;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg);
    if (count !== undefined && count > 0) {
      intersection++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * intersection) / ((a.length - 1) + (b.length - 1));
}