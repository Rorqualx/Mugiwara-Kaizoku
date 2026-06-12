/**
 * Shared chapter-number extraction primitives (audit #3).
 *
 * Eight parser sites historically each owned their own numeric handling and
 * drifted apart on decimals, leading zeros, "Volume 0" prequel notation and
 * bounds — parseInt truncated "Chapter 1.5" to 1, "Chapter 0-1" collapsed to
 * chapter 0, etc. (fixed piecemeal in a5bb2abac). The pattern SETS stay
 * domain-tuned per site (archive filenames vs wiki page titles vs ComicVine
 * prose — see file-scanner.ts, category-chapter-discovery.ts,
 * naming-convention-detector.ts, comicvine/constants.ts,
 * wikipedia-extractor/chapter-extraction.ts), but matched tokens funnel
 * through these helpers so the numeric semantics can never diverge again.
 *
 * @module server/parsers/chapter-number-extractor
 */

/**
 * Regex source for a chapter-number token: integer or decimal ("42",
 * "100.5", "001"). Embed in site-specific patterns via `new RegExp`.
 */
export const CHAPTER_NUM_SRC = String.raw`\d+(?:\.\d+)?`;

/**
 * Regex source for "Volume 0" prequel notation ("0-1", "000-2"); the single
 * capture group is the minor part (map with parsePrequelMinor → 0.1, 0.2…).
 */
export const PREQUEL_MINOR_SRC = String.raw`0+-(\d+)`;

/**
 * Upper bound for plausible chapter/volume numbers. Real-world chapter
 * counts top out around 1,100 (One Piece); anything five-digit-plus is a
 * year, an ID, or garbage — and 100000+ collides with the synthetic
 * volume-file index convention in the chapter table.
 */
const MAX_PLAUSIBLE_NUMBER = 10_000;

/**
 * Normalize a matched chapter-number token to a number.
 *
 * parseFloat semantics (decimals and leading zeros survive: "042.5" → 42.5),
 * plus validation that every legacy call site skipped: non-finite, negative,
 * and implausibly large tokens return null instead of poisoning the row.
 */
export function parseChapterToken(token: string): number | null {
  const value = parseFloat(token);
  if (!Number.isFinite(value) || value < 0 || value >= MAX_PLAUSIBLE_NUMBER) {
    return null;
  }
  return value;
}

/**
 * Map the minor part of prequel notation to its decimal chapter number:
 * "1" → 0.1, "2" → 0.2 (JJK Volume 0 style "Chapter 0-1" … "Chapter 0-4").
 */
export function parsePrequelMinor(minor: string): number | null {
  return parseChapterToken(`0.${minor}`);
}

/**
 * Normalize a matched volume-number token. Volumes are integers — half
 * volumes don't exist as a release convention — so the fractional part of a
 * decimal token is truncated (parseInt semantics), with the same bounds
 * validation as parseChapterToken.
 */
export function parseVolumeToken(token: string): number | null {
  const value = parseInt(token, 10);
  if (!Number.isFinite(value) || value < 0 || value >= MAX_PLAUSIBLE_NUMBER) {
    return null;
  }
  return value;
}

/**
 * Prequel patterns checked before everything else — "Chapter 0-1" would
 * otherwise be claimed by the plain "Chapter N" branch as chapter 0.
 */
const PREQUEL_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`chapter\s*${PREQUEL_MINOR_SRC}`, 'i'), // Chapter 0-1 → 0.1
  new RegExp(String.raw`^${PREQUEL_MINOR_SRC}(?:\.|$|\s)`), // 000-1, 000-1. → 0.1
  new RegExp(String.raw`\b${PREQUEL_MINOR_SRC}\b`), // 000-1 anywhere
];

/** "NN. Title" (Erased style); the number itself may be a decimal ("1.5. Title"). */
const DOT_FORMAT_PATTERN = new RegExp(String.raw`^(${CHAPTER_NUM_SRC})\.\s`);

/** "Chapter N" / "Chapter N.5" marker anywhere in the text. */
const CHAPTER_MARKER_PATTERN = new RegExp(String.raw`Chapter\s+(${CHAPTER_NUM_SRC})`, 'i');

/** Bare leading number fallback. */
const LEADING_NUMBER_PATTERN = new RegExp(String.raw`^(${CHAPTER_NUM_SRC})`);

/**
 * Canonical chapter-number extraction for prose-ish text (link text, list
 * items, page titles without a known site-specific convention).
 *
 * Order: prequel "Chapter 0-N"/"000-N" → "NN. Title" dot format →
 * "Chapter N" marker → bare leading number. First match wins.
 */
export function extractChapterNumberFromText(text: string): number | null {
  for (const pattern of PREQUEL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return parsePrequelMinor(match[1]);
  }

  const dotMatch = text.match(DOT_FORMAT_PATTERN);
  if (dotMatch?.[1]) return parseChapterToken(dotMatch[1]);

  const chapterMatch = text.match(CHAPTER_MARKER_PATTERN);
  if (chapterMatch?.[1]) return parseChapterToken(chapterMatch[1]);

  const leadingMatch = text.match(LEADING_NUMBER_PATTERN);
  if (leadingMatch?.[1]) return parseChapterToken(leadingMatch[1]);

  return null;
}
