/**
 * Label Word Filtering for Entity Labelers
 *
 * Filters out common label/field indicator words that should never be
 * labeled as content values.
 */

/**
 * Common label/field indicator words that should never be labeled as content.
 * These are words that appear as field labels in infoboxes, not actual values.
 */
const LABEL_WORDS_BLOCKLIST = new Set([
  // Japanese language indicators
  'kanji',
  'rōmaji',
  'romaji',
  'hiragana',
  'katakana',
  'japanese',
  'english',
  // Field labels
  'title',
  'name',
  'information',
  'info',
  'details',
  'data',
  // Common infobox labels
  'author',
  'artist',
  'writer',
  'illustrator',
  'status',
  'genre',
  'genres',
  'publisher',
  'magazine',
  'format',
  'demographic',
  'release',
  'date',
  'released',
  'published',
  'volume',
  'volumes',
  'chapter',
  'chapters',
  'pages',
]);

/**
 * Check if a value is just a label word that shouldn't be labeled as content
 */
export function isLabelWord(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return LABEL_WORDS_BLOCKLIST.has(normalized);
}

/**
 * Check if a value contains only label words (for multi-word values)
 */
export function containsOnlyLabelWords(value: string | undefined): boolean {
  if (!value) return true;
  const words = value.trim().toLowerCase().split(/\s+/);
  return words.every((word) => LABEL_WORDS_BLOCKLIST.has(word));
}

/**
 * Patterns that indicate navigation/welcome messages, not actual summaries.
 */
export const SUMMARY_INVALID_PATTERNS = [
  /^browse\s+all\b/i,
  /\bwiki\.?\s*$/i,
  /^welcome\s+to\s+(the\s+)?\w+\s+wiki/i,
  /^this\s+(category|page)\s+(contains|lists|shows)/i,
  /^(click|tap)\s+(here|below)/i,
  /^(view|see|read)\s+(all|more)\b/i,
  /\bcategory\s*:\s*/i,
  /^pages\s+in\s+category/i,
  /^the\s+following\s+\d+\s+pages/i,
];

/**
 * Check if summary text is valid (not a navigation/welcome message).
 */
export function isValidSummaryText(summary: string): boolean {
  if (!summary || summary.length < 80) return false;
  for (const pattern of SUMMARY_INVALID_PATTERNS) {
    if (pattern.test(summary)) return false;
  }
  return true;
}

/**
 * Common label prefixes that appear at the start of extracted values.
 * These should be stripped from the value before labeling.
 */
const LABEL_PREFIXES = [
  /^chapter\s+\d+\s*[:\-–—]\s*/i, // "Chapter 18: " or "Chapter 18 - "
  /^volume\s+\d+\s*[:\-–—]\s*/i,  // "Volume 3: " or "Volume 3 - "
  /^title\s+/i,
  /^name\s+/i,
  /^kanji\s+/i,
  /^romaji\s+/i,
  /^rōmaji\s+/i,
  /^japanese\s+/i,
  /^english\s+/i,
  /^information\s+/i,
];

/**
 * Strip common label prefixes from a value.
 * E.g., "Title England, 1013" → "England, 1013"
 */
export function stripLabelPrefix(value: string | undefined): string | undefined {
  if (!value) return value;
  let result = value.trim();
  for (const prefix of LABEL_PREFIXES) {
    result = result.replace(prefix, '');
  }
  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
