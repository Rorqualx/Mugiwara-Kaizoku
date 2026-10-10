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

// ============================================================================
// Wiki list rows (Fandom volume pages and bulleted chapter lists)
// ============================================================================

export interface WikiListChapterOptions {
  /** Accept "Stage.01" / "Stage 1" as a chapter marker (Evangelion). */
  stageMarker?: boolean;
  /**
   * What a number with no marker must look like to count:
   * - `leading`: any number at the start of the text ("12 Title", "5. Title").
   * - `delimited`: an integer followed by a separator, or standing alone
   *   ("5: Title", "001").
   */
  bareNumber: 'leading' | 'delimited';
}

// `\b` matters: without it "March 4, 2016" contains "ch 4" and was read as
// chapter 4.
const WIKI_CHAPTER_MARKER = new RegExp(String.raw`\bchapter\s*(${CHAPTER_NUM_SRC})`, 'i');
const WIKI_CH_MARKER = new RegExp(String.raw`\bch\.?\s*(${CHAPTER_NUM_SRC})`, 'i');
const WIKI_STAGE_MARKER = new RegExp(String.raw`\bstage\.?\s*(${CHAPTER_NUM_SRC})`, 'i');
const WIKI_PREQUEL_MARKER = new RegExp(String.raw`\bchapter\s*${PREQUEL_MINOR_SRC}`, 'i');

const BARE_PREQUEL_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`^${PREQUEL_MINOR_SRC}(?:\.|$|\s)`), // 000-1, 000-1. → 0.1
  new RegExp(String.raw`\b${PREQUEL_MINOR_SRC}\b`), // 000-1 anywhere
];

const BARE_DELIMITED_PATTERNS: readonly RegExp[] = [/^(\d+)[\s:.\-–—]/, /^(\d+)$/];

const MONTH_SRC = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

/**
 * Shapes whose leading number is not a chapter number. Each is anchored on
 * the number a bare-number fallback would pick up, so a real row that merely
 * mentions a date further along ("5. Title (March 4, 2016)") still parses.
 */
const NON_CHAPTER_LEADING_NUMBER: readonly RegExp[] = [
  /^\d[\d,]*\s*(?:pages?|pp?\.)(?![a-z])/i, // "192 pages", "192 pp."
  new RegExp(String.raw`^\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH_SRC}\b\.?,?\s*(?:(?:19|20)\d{2}\b|$)`, 'i'), // "4 March 2016"
  /^(?:19|20)\d{2}[-/.]\d{1,2}(?:[-/.]\d{1,2})?(?!\d)/, // "2016-03-04", "2016/03"
  /^\d{1,2}\/\d{1,2}\/\d{2,4}(?!\d)/, // "3/4/2016"
  /^\d{1,2}\.\d{1,2}\.(?:19|20)\d{2}(?!\d)/, // "04.03.2016"
  /^\d{1,5}[-\u2010-\u2015]\d{1,7}[-\u2010-\u2015]\d{1,7}/, // hyphenated ISBN-10/13 groups
];

/** An ISBN anywhere in the text: its digit groups feed the prequel pattern ("978-0-123…" → 0.123). */
const ISBN_ANYWHERE = /\bISBN\b|\b97[89][-\u2010-\u2015\s]?\d{1,5}[-\u2010-\u2015\s]?\d{2,7}/i;

function explicitWikiChapterNumber(text: string, stageMarker: boolean): number | null {
  const prequel = text.match(WIKI_PREQUEL_MARKER);
  if (prequel?.[1]) return parsePrequelMinor(prequel[1]);
  const markers = stageMarker
    ? [WIKI_CHAPTER_MARKER, WIKI_CH_MARKER, WIKI_STAGE_MARKER]
    : [WIKI_CHAPTER_MARKER, WIKI_CH_MARKER];
  for (const pattern of markers) {
    const match = text.match(pattern);
    if (match?.[1]) return parseChapterToken(match[1]);
  }
  return null;
}

/**
 * Chapter number from one row of a wiki chapter list (list item, link text or
 * table row).
 *
 * An explicit marker — "Chapter 5", "Ch. 12", "Chapter 0-1", optionally
 * "Stage.01" — always wins. Without one the row has to open with a plain
 * number, and rows that open with a date, a page count or an ISBN are refused:
 * volume pages list all three next to the chapters, and they used to come back
 * as chapters 4, 192 and 978.
 */
export function extractWikiListChapterNumber(text: string, options: WikiListChapterOptions): number | null {
  const explicit = explicitWikiChapterNumber(text, options.stageMarker === true);
  if (explicit !== null) return explicit;

  if (ISBN_ANYWHERE.test(text)) return null;
  if (NON_CHAPTER_LEADING_NUMBER.some(pattern => pattern.test(text))) return null;

  for (const pattern of BARE_PREQUEL_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return parsePrequelMinor(match[1]);
  }

  const bare = options.bareNumber === 'leading' ? [LEADING_NUMBER_PATTERN] : BARE_DELIMITED_PATTERNS;
  for (const pattern of bare) {
    const match = text.match(pattern);
    if (match?.[1]) return parseChapterToken(match[1]);
  }
  return null;
}
