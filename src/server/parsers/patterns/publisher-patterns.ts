/**
 * Publisher and Group Pattern Constants
 *
 * Shared constants for identifying publishers and scan groups in manga filenames.
 * Used by MangaFileParser and other parsing utilities for consistent extraction.
 *
 * @module server/parsers/patterns/publisher-patterns
 */

/**
 * Known manga publishers for high-confidence detection
 * Normalized format: lowercase with spaces (hyphens converted to spaces)
 */
export const KNOWN_PUBLISHERS = new Set([
  // English publishers
  'seven seas',
  'seven seas siren',
  'j novel club',
  'yen press',
  'hanashi media',
  'cross infinite world',
  'vertical',
  'yen audio',
  'yenaudio',
  'viz',
  'viz media',
  'kodansha',
  'kodansha comics',
  'dark horse',
  'tokyopop',
  'del rey',
  'square enix',
  'square enix manga',
  'one peace books',
  'tentai books',
  // Japanese publishers
  'shogakukan',
  'shueisha',
  'kadokawa',
  // Audio publishers
  'podium audio',
  'audible',
  // Other
  'fantagraphics',
  'webtoon',
  'copincomics',
]);

/**
 * Terms that should NOT be considered as scan groups
 * These are metadata descriptors, not group names
 */
export const EXCLUDED_GROUP_TERMS = new Set([
  'digital',
  'jpeg-xl',
  'c2c',
  'audiobook',
  'completed',
  'complete',
  'omnibus',
  'premium',
  'hq',
  'web',
  'webrip',
  'scan',
  'ongoing',
]);

/**
 * Regex pattern for excluded group terms
 * Matches metadata terms that look like groups but aren't
 */
export const EXCLUDED_GROUP_PATTERN =
  /^(digital|jpeg-xl|c2c|audiobook|\d\d\d\d(-\d\d\d\d)?|completed?|omnibus|premium|hq|web|webrip|scan|ongoing)$/i;

/**
 * Check if a text string matches a known publisher
 * Normalizes the text before comparison (lowercase, hyphens to spaces)
 *
 * @param text - The text to check
 * @returns True if the text is a known publisher
 */
export function isKnownPublisher(text: string): boolean {
  return KNOWN_PUBLISHERS.has(text.toLowerCase().replace(/-/g, ' '));
}

/**
 * Check if a text string is an excluded group term
 *
 * @param text - The text to check
 * @returns True if the text should not be treated as a group name
 */
export function isExcludedGroupTerm(text: string): boolean {
  return EXCLUDED_GROUP_TERMS.has(text.toLowerCase()) || EXCLUDED_GROUP_PATTERN.test(text);
}

/**
 * Validate if a string could be a valid group name
 * Groups must:
 * - Not be excluded metadata terms
 * - Not be just a year or year range
 * - Contain at least one letter
 * - Be 2-60 characters (allows multi-group entries)
 *
 * @param content - The potential group name
 * @returns True if the content could be a valid group name
 */
export function isValidGroupName(content: string): boolean {
  if (EXCLUDED_GROUP_PATTERN.test(content)) return false;
  if (/^\d\d\d\d(-\d\d\d\d)?$/.test(content)) return false;
  // Must contain at least one letter (allows "1r0n", "Oak-JXL", etc.)
  // Length 2-60 to allow multi-group entries like "Shellshock, 1r0n, DeadMan"
  return /[A-Za-z]/.test(content) && content.length >= 2 && content.length <= 60;
}
