/**
 * Shared Parsing Utilities
 *
 * Common parsing functions used across multiple providers (Wikipedia, Fandom, etc.)
 * Consolidates ISBN extraction, date parsing, and text validation.
 */

/**
 * ISBN extraction result
 */
export interface ISBNResult {
  isbn10?: string | undefined;
  isbn13?: string | undefined;
  raw: string;
}

/**
 * Comprehensive ISBN pattern that handles multiple formats:
 * - ISBN-10: 10 digits with optional X checksum (e.g., 4-08-873621-5)
 * - ISBN-13: 13 digits starting with 978 or 979 (e.g., 978-4-08-873621-5)
 * - With or without hyphens
 * - With or without "ISBN" prefix
 */
const ISBN_PATTERNS = [
  // ISBN-13 with 978/979 prefix (most common)
  /(?:ISBN[:\s-]*)?(?<isbn13>97[89][-\s]?\d[-\s]?\d{2}[-\s]?\d{6}[-\s]?\d)/gi,
  // ISBN-13 compact format
  /(?:ISBN[:\s-]*)?(?<isbn13>97[89]\d{10})/gi,
  // ISBN-10 with hyphens (Japanese format: 4-xx-xxxxxx-x)
  /(?:ISBN[:\s-]*)?(?<isbn10>\d[-\s]?\d{2}[-\s]?\d{6}[-\s]?[\dX])/gi,
  // ISBN-10 compact format
  /(?:ISBN[:\s-]*)?(?<isbn10>\d{9}[\dX])/gi,
  // Generic ISBN with label
  /ISBN[:\s]*([\d-]{10,17})/gi,
];

/**
 * Extract ISBN from text
 *
 * Handles multiple ISBN formats and normalizes the result.
 *
 * @param text - Text containing ISBN
 * @returns ISBNResult or null if no ISBN found
 */
export function extractISBN(text: string): ISBNResult | null {
  if (!text) return null;

  for (const pattern of ISBN_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const match = pattern.exec(text);

    if (match) {
      const raw = match[0];
      const normalized = normalizeISBN(match[1] ?? match[0]);

      if (normalized) {
        return {
          isbn10: normalized.length === 10 ? normalized : undefined,
          isbn13: normalized.length === 13 ? normalized : undefined,
          raw,
        };
      }
    }
  }

  return null;
}

/**
 * Extract all ISBNs from text
 *
 * @param text - Text containing multiple ISBNs
 * @returns Array of ISBNResult
 */
export function extractAllISBNs(text: string): ISBNResult[] {
  if (!text) return [];

  const results: ISBNResult[] = [];
  const seen = new Set<string>();

  for (const pattern of ISBN_PATTERNS) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0];
      const normalized = normalizeISBN(match[1] ?? match[0]);

      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        results.push({
          isbn10: normalized.length === 10 ? normalized : undefined,
          isbn13: normalized.length === 13 ? normalized : undefined,
          raw,
        });
      }
    }
  }

  return results;
}

/**
 * Normalize ISBN by removing hyphens and spaces
 *
 * @param isbn - Raw ISBN string
 * @returns Normalized ISBN or null if invalid
 */
export function normalizeISBN(isbn: string): string | null {
  if (!isbn) return null;

  // Remove hyphens, spaces, and ISBN prefix
  const normalized = isbn
    .replace(/ISBN[:\s-]*/gi, '')
    .replace(/[-\s]/g, '')
    .toUpperCase();

  // Validate length (10 or 13 digits)
  if (normalized.length === 10 || normalized.length === 13) {
    // Basic validation: should be digits (with optional X for ISBN-10 checksum)
    if (/^[\dX]+$/.test(normalized)) {
      return normalized;
    }
  }

  return null;
}

/**
 * Date parsing result
 */
export interface DateResult {
  date: Date;
  raw: string;
  format: string;
}

/**
 * Supported date patterns with their formats
 */
const DATE_PATTERNS: Array<{ pattern: RegExp; format: string }> = [
  // English: "September 23, 2015" or "Sep 23, 2015"
  { pattern: /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, format: 'MMMM D, YYYY' },
  // ISO: "2015-09-23"
  { pattern: /(\d{4})-(\d{2})-(\d{2})/, format: 'YYYY-MM-DD' },
  // European: "23/09/2015" or "23.09.2015"
  { pattern: /(\d{1,2})[./](\d{1,2})[./](\d{4})/, format: 'DD/MM/YYYY' },
  // Japanese: "2015年9月23日"
  { pattern: /(\d{4})年(\d{1,2})月(\d{1,2})日/, format: 'YYYY年M月D日' },
  // Short month: "23 Sep 2015"
  { pattern: /(\d{1,2})\s+(\w+)\s+(\d{4})/, format: 'D MMMM YYYY' },
  // Year-month only: "September 2015" or "2015-09"
  { pattern: /(\w+)\s+(\d{4})/, format: 'MMMM YYYY' },
  { pattern: /(\d{4})-(\d{2})/, format: 'YYYY-MM' },
];

/**
 * Month name to number mapping
 */
const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Parse date from text
 *
 * Handles multiple date formats including English, ISO, European, and Japanese.
 *
 * @param text - Text containing a date
 * @returns DateResult or null if no valid date found
 */
export function parseDate(text: string): DateResult | null {
  if (!text) return null;

  const trimmed = text.trim();

  for (const { pattern, format } of DATE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    try {
      const date = parseDateMatch(match, format);
      if (date && !isNaN(date.getTime())) {
        return { date, raw: match[0], format };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Helper to parse int with default
 */
function parseIntOrDefault(value: string | undefined, defaultVal: number): number {
  return parseInt(value ?? String(defaultVal), 10);
}

/**
 * Helper to get month from name
 */
function getMonthFromName(name: string | undefined): number | undefined {
  return name ? MONTH_NAMES[name.toLowerCase()] : undefined;
}

/**
 * Create date if year is valid
 */
function createDateIfValid(year: number, month: number, day: number): Date | null {
  return year > 0 ? new Date(year, month, day) : null;
}

/**
 * Parse "MMMM D, YYYY" format (e.g., "September 23, 2015")
 */
function parseMonthDayYear(match: RegExpMatchArray): Date | null {
  const month = getMonthFromName(match[1]);
  const day = parseIntOrDefault(match[2], 1);
  const year = parseIntOrDefault(match[3], 0);
  return month !== undefined && year > 0 ? new Date(year, month, day) : null;
}

/**
 * Parse "YYYY-MM-DD" format
 */
function parseIsoDate(match: RegExpMatchArray): Date | null {
  const year = parseIntOrDefault(match[1], 0);
  const month = parseIntOrDefault(match[2], 1) - 1;
  const day = parseIntOrDefault(match[3], 1);
  return createDateIfValid(year, month, day);
}

/**
 * Parse "DD/MM/YYYY" format
 */
function parseDayMonthYear(match: RegExpMatchArray): Date | null {
  const day = parseIntOrDefault(match[1], 1);
  const month = parseIntOrDefault(match[2], 1) - 1;
  const year = parseIntOrDefault(match[3], 0);
  return createDateIfValid(year, month, day);
}

/**
 * Parse "D MMMM YYYY" format (e.g., "23 September 2015")
 */
function parseDayMonthNameYear(match: RegExpMatchArray): Date | null {
  const day = parseIntOrDefault(match[1], 1);
  const month = getMonthFromName(match[2]);
  const year = parseIntOrDefault(match[3], 0);
  return month !== undefined && year > 0 ? new Date(year, month, day) : null;
}

/**
 * Parse "MMMM YYYY" format (e.g., "September 2015")
 */
function parseMonthYear(match: RegExpMatchArray): Date | null {
  const month = getMonthFromName(match[1]);
  const year = parseIntOrDefault(match[2], 0);
  return month !== undefined && year > 0 ? new Date(year, month, 1) : null;
}

/**
 * Parse "YYYY-MM" format
 */
function parseYearMonth(match: RegExpMatchArray): Date | null {
  const year = parseIntOrDefault(match[1], 0);
  const month = parseIntOrDefault(match[2], 1) - 1;
  return createDateIfValid(year, month, 1);
}

/**
 * Format-to-parser lookup table
 */
const DATE_PARSERS: Record<string, (match: RegExpMatchArray) => Date | null> = {
  'MMMM D, YYYY': parseMonthDayYear,
  'YYYY-MM-DD': parseIsoDate,
  'DD/MM/YYYY': parseDayMonthYear,
  'YYYY年M月D日': parseIsoDate, // Same structure as ISO
  'D MMMM YYYY': parseDayMonthNameYear,
  'MMMM YYYY': parseMonthYear,
  'YYYY-MM': parseYearMonth,
};

/**
 * Parse date from regex match based on format
 */
function parseDateMatch(match: RegExpMatchArray, format: string): Date | null {
  const parser = DATE_PARSERS[format];
  return parser ? parser(match) : null;
}

/**
 * Extract date string from text (returns raw string, not parsed)
 *
 * @param text - Text containing a date
 * @returns Date string or null
 */
export function extractDateString(text: string): string | null {
  const result = parseDate(text);
  return result?.raw ?? null;
}

/**
 * Text validation utilities
 */

/**
 * Check if text meets minimum length requirement
 */
export function isValidTextLength(
  text: string,
  minLength: number,
  maxLength?: number
): boolean {
  const length = text.trim().length;
  if (length < minLength) return false;
  if (maxLength !== undefined && length > maxLength) return false;
  return true;
}

/**
 * Check if text looks like a chapter list (not a description)
 * Detects various chapter list formats:
 * - Numbered: "1. Title" or "1. "Title""
 * - Quoted only: "Title" (from <ol> lists where number is structural)
 * - With translations: "Title" (Japanese, Romaji)
 *
 * Supports both straight quotes ("") and curly quotes ("")
 */
export function isChapterListText(text: string): boolean {
  // Pattern 1: Numbered chapter patterns like "1. "Title"" (curly or straight quotes)
  const numberedPatterns = text.match(/\d+\.\s*[""""][^""""]+[""""]/g);
  if ((numberedPatterns?.length ?? 0) > 3) return true;

  // Pattern 2: Quoted titles with translations (JJK style from <ol> lists)
  // Matches "Title" followed by (Japanese, Romaji) - supports both quote types
  const quotedTitlePatterns = text.match(/[""""][^""""]{2,50}[""""]\s*\([^)]+\)/g);
  if ((quotedTitlePatterns?.length ?? 0) > 3) return true;

  // Pattern 3: Multiple lines starting with quoted text (chapter titles)
  const lines = text.split(/\n/).filter(l => l.trim());
  const quotedLines = lines.filter(l => /^\s*[""""][^""""]+[""""]/.test(l.trim()));
  if (quotedLines.length > 3 && quotedLines.length / lines.length > 0.5) return true;

  return false;
}

/**
 * Check if text contains Wikipedia/MediaWiki artifacts to filter out.
 * Catches CSS class names, DOM metadata, wiki link paths, and language tags
 * that parsers may accidentally extract as chapter titles.
 */
// eslint-disable-next-line complexity -- Artifact detection requires many pattern checks
export function containsWikipediaArtifacts(text: string): boolean {
  const lowerText = text.toLowerCase().trim();

  // Known Wikipedia/MediaWiki textual artifacts
  if (
    lowerText.includes('hepburn') ||
    lowerText.includes('ja-latn') ||
    lowerText.includes('transliteration') ||
    lowerText.includes('[edit]') ||
    lowerText.includes('[citation needed]') ||
    lowerText.includes('japanese-language')
  ) return true;

  // MediaWiki CSS classes and DOM metadata
  if (
    lowerText.startsWith('mw-') ||
    lowerText.startsWith('/wiki/') ||
    lowerText.startsWith('#cite') ||
    lowerText.startsWith('infobox')
  ) return true;

  // URL-encoded strings (e.g., "/wiki/Tank%C5%8Dbon")
  if (/%[0-9A-Fa-f]{2}/.test(text)) return true;

  // Generic publishing/wiki terms that aren't chapter titles
  const genericTerms = new Set([
    'tankōbon', 'tankobon', 'manga', 'volume', 'chapter',
    'omnibus', 'paperback', 'hardcover', 'isbn',
  ]);
  if (genericTerms.has(lowerText)) return true;

  // Specific HTML/CSS tokens that appear as single-word "titles"
  const cssTokens = new Set([
    'async', 'noprint', 'nowrap', 'plainlist', 'reflist',
    'navbox', 'sidebar', 'hatnote', 'metadata', 'thumbinner',
    'gallerybox', 'wikitable', 'collapsible', 'autocollapse',
    'row', 'cell', 'thead', 'tbody',
  ]);
  if (cssTokens.has(lowerText)) return true;

  // CSS-class-like pattern: lowercase-hyphenated tokens (e.g., "mw-file-element", "file-description")
  if (/^[a-z]+-[a-z]+(-[a-z]+)*$/.test(lowerText) && lowerText.length < 40) return true;

  // CSS property values and inline styles (e.g., "1em center/12px no-repeat}body:not(...")
  if (/[{};]/.test(text)) return true;
  if (/\.mw-parser-output/.test(text)) return true;
  if (/\bbackground[-:]|font-size:|padding:|margin:|color:|display:|border:/.test(lowerText)) return true;

  // Titles shouldn't contain CSS selectors or media queries
  if (/@media\s/.test(lowerText)) return true;
  if (/\bvar\(--/.test(lowerText)) return true;

  return false;
}

/**
 * Chapter number extraction
 */

/**
 * Extract chapter number from text
 * Supports up to 5 digits (handles manga with 1000+ chapters like One Piece)
 *
 * @param text - Text containing chapter number
 * @returns Chapter number or null
 */
export function extractChapterNumber(text: string): number | null {
  // Match 1-5 digit chapter numbers
  const match = text.match(/^(\d{1,5})/);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Chapter number pattern for regex use
 * Use this instead of hardcoding \d{1,3}
 */
export const CHAPTER_NUMBER_PATTERN = /(\d{1,5})/;

/**
 * Chapter with title pattern
 * Matches: "123. Title" or "123. "Title""
 */
export const CHAPTER_WITH_TITLE_PATTERN = /(\d{1,5})\.\s*[""]?([^""]+)[""]?/g;

/**
 * Section filtering utilities for Wikipedia parsing
 */

/**
 * Anime episode indicators - used to detect anime content that should be filtered out
 */
const ANIME_EPISODE_INDICATORS = [
  'episode',
  'episodes',
  'ep.',
  'eps.',
  'anime adaptation',
  'television series',
  'tv series',
  'broadcast',
  'aired',
  'opening theme',
  'ending theme',
  'season 1',
  'season 2',
  'ova',
  'ona',
  'special episode',
];

/**
 * Sequel series indicators - patterns that indicate a sequel/spinoff series
 */
const SEQUEL_SERIES_INDICATORS = [
  ':re',
  'part ii',
  'part 2',
  'part iii',
  'part 3',
  '2nd series',
  'second series',
  'shippuden',
  'boruto',
  'next generations',
  'gt',
  'super',
  'z',
  'kai',
  'brotherhood',
  'final season',
  'jack', // Tokyo Ghoul: Jack
];

/**
 * Check if a section header indicates anime episode content
 *
 * @param headerText - Section header text to check
 * @returns True if the section is likely anime episode content
 */
export function isAnimeEpisodeSection(headerText: string): boolean {
  if (!headerText) return false;
  const lower = headerText.toLowerCase();

  // Check for explicit anime indicators
  for (const indicator of ANIME_EPISODE_INDICATORS) {
    if (lower.includes(indicator)) {
      return true;
    }
  }

  // Check for episode numbering patterns (Episode 1, Ep. 12, etc.)
  if (/(?:episode|ep\.?)\s*\d+/i.test(headerText)) {
    return true;
  }

  return false;
}

/**
 * Check if a section header indicates a sequel or spinoff series
 *
 * @param headerText - Section header text to check
 * @param mainSeriesTitle - Optional main series title to compare against
 * @returns True if the section is a sequel/spinoff
 */
export function isSequelSeriesSection(
  headerText: string,
  mainSeriesTitle?: string
): boolean {
  if (!headerText) return false;
  const lower = headerText.toLowerCase();

  // Check for explicit sequel indicators
  for (const indicator of SEQUEL_SERIES_INDICATORS) {
    if (lower.includes(indicator)) {
      return true;
    }
  }

  // If we have a main title, check if this section title differs significantly
  if (mainSeriesTitle) {
    const mainLower = mainSeriesTitle.toLowerCase();
    // If the header contains the main title but with additions, it's likely a sequel
    if (lower.includes(mainLower) && lower.length > mainLower.length + 5) {
      return true;
    }
  }

  return false;
}

/**
 * Find where volume numbers reset, indicating a new series.
 * This is more reliable than section header detection for Wikipedia pages.
 *
 * @param html - HTML content
 * @returns Index where second series starts, or html.length if no reset found
 */
function findVolumeResetIndex(html: string): number {
  // Find all volume markers with their positions
  const volumePattern = /id="vol(\d+)"/g;
  const volumes: Array<{ number: number; index: number }> = [];

  let match;
  while ((match = volumePattern.exec(html)) !== null) {
    const volNum = parseInt(match[1] ?? '0', 10);
    volumes.push({ number: volNum, index: match.index });
  }

  // Look for where volume numbers reset to 1 (indicating new series)
  let lastVolume = 0;
  for (const vol of volumes) {
    // If volume goes back to 1 or a low number after we've seen higher volumes,
    // it indicates a new series started
    if (vol.number <= 3 && lastVolume >= 10) {
      return vol.index;
    }
    lastVolume = vol.number;
  }

  return html.length;
}

/**
 * Find section headers that indicate sequel/spinoff content.
 *
 * @param html - HTML content
 * @param seriesTitle - Main series title (optional)
 * @returns Index where sequel section starts, or html.length if none found
 */
function findSequelSectionIndex(html: string, seriesTitle?: string): number {
  // Look for h2/h3 section headers with sequel indicators
  const sectionPattern = /<h[23][^>]*>.*?<span[^>]*class="mw-headline"[^>]*(?:id="([^"]+)")?[^>]*>([^<]+)<\/span>/gi;

  let match;
  while ((match = sectionPattern.exec(html)) !== null) {
    const sectionTitle = match[2] ?? '';

    if (!sectionTitle) continue;

    // Check if this is a sequel section
    if (isSequelSeriesSection(sectionTitle, seriesTitle)) {
      return match.index;
    }
  }

  return html.length;
}

/**
 * Extract the main series section boundaries from HTML content
 *
 * For pages with multiple series (e.g., Tokyo Ghoul + Tokyo Ghoul:re),
 * this identifies where the main series section ends using multiple strategies:
 * 1. Detect section headers for sequel series
 * 2. Detect when volume numbers reset to 1
 *
 * @param html - HTML content
 * @param seriesTitle - Main series title (optional)
 * @returns Object with start and end indices, or null if not applicable
 */
export function findMainSeriesBoundaries(
  html: string,
  seriesTitle?: string
): { startIndex: number; endIndex: number } | null {
  // Strategy 1: Look for section headers indicating sequel series
  const sequelSectionIndex = findSequelSectionIndex(html, seriesTitle);

  // Strategy 2: Look for volume number reset (e.g., vol14 -> vol1)
  const volumeResetIndex = findVolumeResetIndex(html);

  // Use the earlier of the two indicators
  const mainSeriesEndIndex = Math.min(sequelSectionIndex, volumeResetIndex);

  return {
    startIndex: 0,
    endIndex: mainSeriesEndIndex,
  };
}

/**
 * Filter HTML to only include the main manga series content
 *
 * Removes sequel series sections (e.g., Tokyo Ghoul:re from Tokyo Ghoul page)
 * and anime episode sections.
 *
 * @param html - Full HTML content
 * @param seriesTitle - Main series title for context
 * @returns Filtered HTML containing only main series manga content
 */
export function filterToMainSeriesContent(
  html: string,
  seriesTitle?: string
): string {
  const boundaries = findMainSeriesBoundaries(html, seriesTitle);
  if (!boundaries) return html;

  // Return only the main series portion
  return html.substring(boundaries.startIndex, boundaries.endIndex);
}
