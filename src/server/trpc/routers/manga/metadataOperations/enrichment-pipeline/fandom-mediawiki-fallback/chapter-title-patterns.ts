/**
 * Chapter Title Pattern Extractors
 *
 * Registry of all regex patterns for extracting chapter titles from Fandom HTML.
 * Each extractor returns a Record<number, string> mapping chapter number to title.
 * All extractors run and results are merged with first-match-wins per chapter number.
 *
 * Pattern priority (higher = wins ties):
 *   1. Padded dot patterns (A, B, D) - most specific, e.g. "001. <a><b>Title</b></a>"
 *   2. Unpadded dot patterns (C, E) - e.g. "1. <a><b>Title</b></a>"
 *   3. Number-inside-link (F) - e.g. "<a>1. Title</a>"
 *   4. Quoted titles (G) - e.g. '1. "<a>Title</a>"'
 *   5. Title-attribute links (H) - e.g. '<a title="Chapter 1">Title</a>'
 *   6. Dash-separated (I) - e.g. "<a>1 - Title</a>"
 *   7. Chapter-prefix inside link (J) - e.g. "<a>Chapter 1: Title</a>"
 *   8. Chapter-prefix no title (K) - e.g. "<a>Chapter 1</a>"
 *   9. Ordered lists (OL) - e.g. '<ol start="1"><li><a>Title</a></li>'
 *  10. Unordered lists (L) - e.g. "<ul><li><a>Title</a></li>"
 */

import { cleanChapterTitle } from './title-post-processing';

interface PatternResult {
  titles: Record<number, string>;
  count: number;
  isPadded: boolean;
}

type PatternExtractor = (html: string) => PatternResult;

/** Check if a title looks like real chapter content (not ISBN, volume count, etc.) */
function isValidChapterTitle(title: string): boolean {
  // Reject empty or single-char titles
  if (title.length < 2) return false;
  // Reject pure numbers (volume counts from sidebars)
  if (/^\d+$/.test(title)) return false;
  // Reject ISBN patterns like "1-59116-754-9" or "4865540543"
  if (/^\d[\d-]{7,}$/.test(title)) return false;
  // Reject date-like patterns "2020-01-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(title)) return false;
  return true;
}

/** Run a regex pattern against HTML, extracting chapter numbers and titles */
function runRegexPattern(
  html: string,
  pattern: RegExp,
  numGroup: number,
  titleGroup: number | number[],
  isPadded: boolean,
): PatternResult {
  const titles: Record<number, string> = {};
  let match;
  const titleGroups = Array.isArray(titleGroup) ? titleGroup : [titleGroup];
  while ((match = pattern.exec(html)) !== null) {
    const num = parseFloat(match[numGroup] ?? '');
    let rawTitle: string | undefined;
    for (const tg of titleGroups) {
      if (match[tg]?.trim()) {
        rawTitle = match[tg].trim();
        break;
      }
    }
    if (!isNaN(num) && rawTitle && !titles[num]) {
      const cleaned = cleanChapterTitle(rawTitle);
      if (isValidChapterTitle(cleaned)) {
        titles[num] = cleaned;
      }
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded };
}

// --- Pattern A: Padded "001. <a><b>Title</b></a>" ---
// Capture group accepts integer "001" or decimal "001.5" (Round 5: non-standard chapter numbers).
const extractPatternA: PatternExtractor = (html) =>
  runRegexPattern(html, /(\d{2,4}(?:\.\d+)?)\.\s*<a[^>]*><b>([^<]+)<\/b><\/a>/g, 1, 2, true);

// --- Pattern B: Padded "001. <b><a>Title</a></b>" ---
const extractPatternB: PatternExtractor = (html) =>
  runRegexPattern(html, /(\d{2,4}(?:\.\d+)?)\.\s*<b><a[^>]*>([^<]+)<\/a><\/b>/g, 1, 2, true);

// --- Pattern D: Padded "001. <a>Title</a>" (no bold) ---
const extractPatternD: PatternExtractor = (html) =>
  runRegexPattern(html, /(\d{2,4}(?:\.\d+)?)\.\s*<a[^>]*>([^<]+)<\/a>/g, 1, 2, true);

// --- Pattern C: Unpadded "N. <a><b>Title</b></a>" or "N. <b><a>Title</a></b>" ---
const extractPatternC: PatternExtractor = (html) =>
  runRegexPattern(
    html,
    /(\d{1,4}(?:\.\d+)?)\.\s*(?:<a[^>]*><b>([^<]+)<\/b><\/a>|<b><a[^>]*>([^<]+)<\/a><\/b>)/g,
    1, [2, 3], false,
  );

// --- Pattern E: Unpadded "N. <a>Title</a>" (no bold) ---
const extractPatternE: PatternExtractor = (html) =>
  runRegexPattern(html, /(\d{1,4}(?:\.\d+)?)\.\s*<a[^>]*>([^<]+)<\/a>/g, 1, 2, false);

// --- Pattern F: Number inside link "<a>N. Title</a>" ---
const extractPatternF: PatternExtractor = (html) =>
  runRegexPattern(html, /<a[^>]*>(\d{1,4}(?:\.\d+)?)\.\s*([^<]+)<\/a>/g, 1, 2, false);

// --- Pattern G: Quoted title 'N. "<a>Title</a>"' (e.g., Naruto) ---
const extractPatternG: PatternExtractor = (html) =>
  runRegexPattern(
    html,
    /(\d{1,4}(?:\.\d+)?)\.\s*"<a[^>]*>(?:<b>)?([^<]+)(?:<\/b>)?<\/a>"/g,
    1, 2, false,
  );

// --- Pattern H: Title attribute '<a title="Chapter N">Title</a>' ---
const extractPatternH: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  const pattern = /<a[^>]*title="(?:Chapter|Ch\.?)\s*(\d+(?:\.\d+)?)[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const num = parseFloat(match[1] ?? '');
    const rawTitle = match[2]?.trim();
    if (!isNaN(num) && rawTitle && !titles[num]) {
      // Skip if the link text is just "Chapter N" (no real title)
      if (!/^(?:Chapter|Ch\.?)\s*\d+(?:\.\d+)?$/i.test(rawTitle)) {
        titles[num] = cleanChapterTitle(rawTitle);
      }
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Pattern I: Dash-separated "<a>N - Title</a>" (e.g., JoJo SBR) ---
const extractPatternI: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  const pattern = /<a[^>]*>(\d{1,4}(?:\.\d+)?)\s*[-\u2013\u2014]\s*([^<]+)<\/a>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const num = parseFloat(match[1] ?? '');
    const rawTitle = match[2]?.trim();
    if (!isNaN(num) && rawTitle && !titles[num]) {
      const cleaned = cleanChapterTitle(rawTitle);
      if (isValidChapterTitle(cleaned)) {
        titles[num] = cleaned;
      }
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Pattern J: Chapter prefix "<a>Chapter N: Title</a>" ---
const extractPatternJ: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  const pattern = /<a[^>]*>(?:Chapter|Ch\.?)\s*(\d{1,4}(?:\.\d+)?)[:\s]+([^<]+)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const num = parseFloat(match[1] ?? '');
    const rawTitle = match[2]?.trim();
    if (!isNaN(num) && rawTitle && !titles[num]) {
      titles[num] = cleanChapterTitle(rawTitle);
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Pattern K: Chapter prefix, no title "<a>Chapter N</a>" ---
const extractPatternK: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  const pattern = /<a[^>]*>(?:Chapter|Ch\.?)\s*(\d{1,4}(?:\.\d+)?)\s*<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const num = parseFloat(match[1] ?? '');
    if (!isNaN(num) && !titles[num]) {
      titles[num] = `Chapter ${num}`;
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Ordered Lists: <ol start="N"><li><a>Title</a></li> ---
// When a page has multiple sets of <ol> elements (e.g., per-volume inside <td>
// AND arc/season groupings standalone), prefer those inside <td> cells.
// This prevents arc/season <ol> from injecting wrong titles (e.g., AoT).
const extractOrderedLists: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  // Capture the full attribute string in group 1, content in group 2.
  // Previous regex /<ol[^>]*(?:start="(\d+)")?[^>]*>/ had a bug where the
  // first greedy [^>]* consumed the start= attribute before the capture group.
  const olPattern = /<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi;

  // Collect all <ol> elements with table-cell context
  const allOls: Array<{ start: number; content: string; inTd: boolean }> = [];
  let olMatch;
  while ((olMatch = olPattern.exec(html)) !== null) {
    const attrs = olMatch[1] ?? '';
    const startAttr = attrs.match(/start="(\d+)"/);
    const startNum = startAttr?.[1] ? Number(startAttr[1]) : 1;
    const content = olMatch[2] ?? '';
    // Check if this <ol> is inside a <td> by examining the preceding HTML.
    // Look for the nearest <td or </td> before this match — if <td is closer
    // (or </td> is absent), the <ol> is nested inside a table cell.
    const lookback = html.substring(Math.max(0, olMatch.index - 500), olMatch.index);
    const lastTdOpen = lookback.lastIndexOf('<td');
    const lastTdClose = lookback.lastIndexOf('</td>');
    const inTd = lastTdOpen >= 0 && lastTdOpen > lastTdClose;
    allOls.push({ start: startNum, content, inTd });
  }

  // If both inside-td and outside-td <ol> exist, only use inside-td ones.
  // Per-volume <ol> (inside <td>) are authoritative; standalone arc/season <ol>
  // have different chapter boundaries that cause misassignment.
  const hasTdOls = allOls.some(ol => ol.inTd);
  const hasNonTdOls = allOls.some(ol => !ol.inTd);
  const olsToProcess = (hasTdOls && hasNonTdOls) ? allOls.filter(ol => ol.inTd) : allOls;

  for (const ol of olsToProcess) {
    const liPattern = /<li[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g;
    let liMatch;
    let idx = 0;
    while ((liMatch = liPattern.exec(ol.content)) !== null) {
      const chNum = ol.start + idx;
      const rawTitle = liMatch[1]?.trim();
      if (rawTitle && !titles[chNum]) {
        titles[chNum] = cleanChapterTitle(rawTitle);
      }
      idx++;
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Pattern L: Unordered Lists <ul><li><a>Title</a></li> ---
// Only used when other patterns haven't found the chapter — these are
// typically wikitable + UL/LI structures where chapter numbers come from context.
/**
 * Run a regex (with capture groups [num, title]) against `content` and merge
 * non-duplicate matches into `titles`. Used by extractUnorderedLists for its
 * 3 sibling patterns. Mutates `titles` in place to avoid copying.
 */
/* eslint-disable no-param-reassign -- intentional in-place merge into the caller's accumulator */
function extractMatchesInto(
  titles: Record<number, string>,
  content: string,
  pattern: RegExp,
): void {
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const num = parseFloat(match[1] ?? '');
    const rawTitle = match[2]?.trim();
    if (!isNaN(num) && rawTitle && !titles[num]) {
      titles[num] = cleanChapterTitle(rawTitle);
    }
  }
}
/* eslint-enable no-param-reassign */

const extractUnorderedLists: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  // Look for UL blocks within volume sections. We need volume context to derive chapter numbers.
  // First pass: find all <ul> blocks and extract linked titles with any chapter-number hint.
  // In wikitable layouts, chapter numbers are often in the link title attribute or text.
  const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let ulMatch;
  while ((ulMatch = ulPattern.exec(html)) !== null) {
    const ulContent = ulMatch[1];
    if (!ulContent) continue;
    // <li><a title="Chapter 1">Title</a></li> (also handles <span> wrapper, ~57 pages)
    extractMatchesInto(titles, ulContent,
      /<li[^>]*>\s*(?:<span[^>]*>\s*)?<a[^>]*title="(?:Chapter|Ch\.?)\s*(\d+(?:\.\d+)?)[^"]*"[^>]*>([^<]+)<\/a>/gi);
    // <li><a>N. Title</a></li> or <li><span><a>N. Title</a></span>
    extractMatchesInto(titles, ulContent,
      /<li[^>]*>\s*(?:<span[^>]*>\s*)?<a[^>]*>(\d{1,4}(?:\.\d+)?)\.\s*([^<]+)<\/a>/g);
    // <li><a>Chapter N: Title</a></li> or with <span> wrapper
    extractMatchesInto(titles, ulContent,
      /<li[^>]*>\s*(?:<span[^>]*>\s*)?<a[^>]*>(?:Chapter|Ch\.?)\s*(\d{1,4}(?:\.\d+)?)[:\s]+([^<]+)<\/a>/gi);
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Pattern M: Table row "<td>N</td>...<td><a>Title</a></td>" (11.8% of wikis) ---
// Matches wikitable rows where the chapter number is in one cell and title in a later cell
const extractTableRowPattern: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  // Match table rows where a cell contains just a number, and a later cell has a linked title
  // Pattern: <td>N</td> ... <td><a>Title</a></td> (within same <tr>)
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const rowContent = trMatch[1];
    if (!rowContent) continue;
    // Find a cell with just a number (chapter number)
    const numCellMatch = /<td[^>]*>\s*#?(\d{1,4}(?:\.\d+)?)\s*<\/td>/i.exec(rowContent);
    if (!numCellMatch) continue;
    const num = parseFloat(numCellMatch[1] ?? '');
    if (isNaN(num) || titles[num]) continue;
    // Find a cell with a linked title (after the number cell)
    const afterNum = rowContent.substring(numCellMatch.index + numCellMatch[0].length);
    const titleCellMatch = /<td[^>]*>\s*(?:<[^>]*>\s*)*<a[^>]*>([^<]+)<\/a>/i.exec(afterNum);
    if (titleCellMatch?.[1]) {
      const cleaned = cleanChapterTitle(titleCellMatch[1].trim());
      if (isValidChapterTitle(cleaned)) {
        titles[num] = cleaned;
      }
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

// --- Pattern N: Hash-prefixed number "#N" in table cell (9.4% of wikis) ---
// Matches: <td>#1</td>...<td><a>Title</a></td>
const extractHashPrefixPattern: PatternExtractor = (html) => {
  const titles: Record<number, string> = {};
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trPattern.exec(html)) !== null) {
    const rowContent = trMatch[1];
    if (!rowContent) continue;
    const numCellMatch = /<td[^>]*>\s*#(\d{1,4}(?:\.\d+)?)\s*<\/td>/i.exec(rowContent);
    if (!numCellMatch) continue;
    const num = parseFloat(numCellMatch[1] ?? '');
    if (isNaN(num) || titles[num]) continue;
    const afterNum = rowContent.substring(numCellMatch.index + numCellMatch[0].length);
    const titleCellMatch = /<td[^>]*>\s*(?:<[^>]*>\s*)*<a[^>]*>([^<]+)<\/a>/i.exec(afterNum);
    if (titleCellMatch?.[1]) {
      const cleaned = cleanChapterTitle(titleCellMatch[1].trim());
      if (isValidChapterTitle(cleaned)) {
        titles[num] = cleaned;
      }
    }
  }
  return { titles, count: Object.keys(titles).length, isPadded: false };
};

/**
 * Ordered registry of pattern extractors, from highest to lowest priority.
 * Earlier patterns win ties when merging results.
 */
const PATTERN_REGISTRY: Array<{ name: string; extractor: PatternExtractor }> = [
  { name: 'A_padded_bold_link', extractor: extractPatternA },
  { name: 'B_padded_bold_wrap', extractor: extractPatternB },
  { name: 'D_padded_plain_link', extractor: extractPatternD },
  { name: 'C_unpadded_bold', extractor: extractPatternC },
  { name: 'E_unpadded_plain', extractor: extractPatternE },
  { name: 'F_number_in_link', extractor: extractPatternF },
  { name: 'G_quoted_title', extractor: extractPatternG },
  { name: 'H_title_attribute', extractor: extractPatternH },
  { name: 'I_dash_separated', extractor: extractPatternI },
  { name: 'J_chapter_prefix', extractor: extractPatternJ },
  { name: 'K_chapter_no_title', extractor: extractPatternK },
  { name: 'OL_ordered_list', extractor: extractOrderedLists },
  { name: 'L_unordered_list', extractor: extractUnorderedLists },
  { name: 'M_table_row', extractor: extractTableRowPattern },
  { name: 'N_hash_prefix', extractor: extractHashPrefixPattern },
];

export interface ExtractAllResult {
  titleMap: Record<number, string>;
  usedPadded: boolean;
  patternHits: Record<string, number>;
}

/**
 * Run ALL pattern extractors against the HTML and merge results.
 * Higher-priority patterns (earlier in the registry) win ties for the same chapter number.
 * Returns the merged title map, whether padded patterns dominated, and hit counts per pattern.
 */
export function extractAllChapterTitles(html: string): ExtractAllResult {
  const titleMap: Record<number, string> = {};
  const patternHits: Record<string, number> = {};
  let paddedCount = 0;
  let unpaddedCount = 0;

  for (const { name, extractor } of PATTERN_REGISTRY) {
    const result = extractor(html);
    if (result.count === 0) continue;

    patternHits[name] = result.count;
    let newEntries = 0;

    for (const [k, v] of Object.entries(result.titles)) {
      const num = parseFloat(k);
      if (!titleMap[num]) {
        titleMap[num] = v;
        newEntries++;
        if (result.isPadded) paddedCount++;
        else unpaddedCount++;
      }
    }

    if (newEntries > 0) {
      patternHits[`${name}_new`] = newEntries;
    }
  }

  const usedPadded = paddedCount > unpaddedCount;

  return { titleMap, usedPadded, patternHits };
}
