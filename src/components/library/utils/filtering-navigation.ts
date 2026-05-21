/**
 * Navigation Helpers Module
 *
 * Handles alphabet navigation and data attribute generation.
 *
 * Extracted from: filtering.ts (lines 270-281)
 */

// ============================================================================
// Navigation Helper Function
// ============================================================================

/**
 * Get data attributes for alphabet navigation
 */
export function getAlphabetDataLetter(title: string): string {
  if (!title) return '#';

  const firstChar = title[0];
  if (firstChar === undefined) return '#';

  const upperChar = firstChar.toUpperCase();
  if (/[A-Z]/.test(upperChar)) {
    return upperChar;
  }

  return '#'; // For numbers and special characters
}