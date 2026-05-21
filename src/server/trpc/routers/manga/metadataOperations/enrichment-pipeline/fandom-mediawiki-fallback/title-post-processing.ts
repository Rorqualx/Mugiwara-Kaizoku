/**
 * Title Post-Processing
 *
 * Cleans and normalizes chapter titles extracted from Fandom HTML.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#x27;': "'",
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&ndash;': '\u2013',
  '&mdash;': '\u2014',
  '&hellip;': '\u2026',
};

/** Decode common HTML entities in a string */
function decodeHtmlEntities(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITY_MAP)) {
    result = result.replaceAll(entity, char);
  }
  // Decode numeric entities: &#123; or &#x1A;
  result = result.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex as string, 16)));
  return result;
}

/** Strip surrounding quotes from a title */
function stripSurroundingQuotes(text: string): string {
  // Match paired double quotes, smart quotes, or guillemets
  const quotePatterns = [
    /^"(.*)"$/,
    /^\u201C(.*)\u201D$/,
    /^\u00AB(.*)\u00BB$/,
  ];
  for (const pattern of quotePatterns) {
    const m = pattern.exec(text);
    if (m?.[1]) return m[1];
  }
  return text;
}

/** Strip trailing Japanese parentheticals like (日本語, romaji) */
function stripTrailingParenthetical(text: string): string {
  // Match trailing (...) where content contains Japanese chars or is a romaji transliteration
  return text.replace(/\s*\([^)]*[\u3000-\u9FFF\uFF00-\uFFEF][^)]*\)\s*$/, '').trim();
}

/**
 * Strip trailing bonus-type markers like "(Omake)", " - Extra", ", Bonus" so the
 * cleaned title doesn't duplicate the type marker already stored via isBonusTitle().
 * Keep "Omake" / "Extra" / "Bonus" when it's part of the actual title (e.g., starts
 * with it or is immediately followed by more content).
 */
function stripTrailingBonusSuffix(text: string): string {
  // Match trailing " - Omake", " (Omake)", " [Omake]", ", Omake" etc. for Omake/Extra/Bonus/Side Story
  return text.replace(/\s*[-–—,:([]\s*(?:Omake|Extra|Bonus|Side\s+Story)\s*[\])]*$/i, '').trim();
}

/**
 * Clean and normalize a chapter title extracted from HTML.
 * Strips quotes, Japanese parentheticals, bonus-type suffixes, HTML entities,
 * and extra whitespace.
 */
export function cleanChapterTitle(rawTitle: string): string {
  let title = rawTitle.trim();
  title = decodeHtmlEntities(title);
  title = stripSurroundingQuotes(title);
  title = stripTrailingParenthetical(title);
  title = stripTrailingBonusSuffix(title);
  title = title.replace(/\s+/g, ' ').trim();
  return title;
}
