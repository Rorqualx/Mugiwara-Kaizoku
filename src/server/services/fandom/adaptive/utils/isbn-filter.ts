/**
 * ISBN Detection Utility
 *
 * Detects ISBN fragments that can be misparsed as chapter numbers.
 * ISBN-13 numbers start with 978 or 979, which parsers may extract
 * from table cells containing both chapter data and ISBN references.
 */

/** Returns true if the number matches an ISBN-13 prefix (978, 979) */
export function isIsbnPrefix(num: number): boolean {
  return num === 978 || num === 979;
}

/** Returns true if surrounding text context looks like an ISBN */
export function looksLikeIsbn(text: string): boolean {
  return /\bISBN\b|978[-\s]?\d|979[-\s]?\d|\d[-\s]\d{2}[-\s]\d{4,7}[-\s]\d/i.test(text);
}
