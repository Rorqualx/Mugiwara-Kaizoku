/**
 * Text Utility Functions
 *
 * Text processing utilities for pattern matching.
 */

/**
 * Clean and normalize text for pattern matching
 *
 * Normalizes whitespace, quotes, and dashes to improve
 * pattern matching consistency across different text sources.
 *
 * @param text - Text to clean
 * @returns Cleaned and normalized text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .trim();
}
