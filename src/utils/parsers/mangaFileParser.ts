/**
 * Simple manga file parser for extracting metadata from filenames
 * Replaces the removed converter utilities with direct Prisma-compatible implementation
 */

import * as path from 'path';

import {
  isKnownPublisher,
  isValidGroupName,
} from '@/server/parsers/patterns/publisher-patterns';

export interface ParsedMangaInfo {
  original: string;
  title: string;
  cleanTitle: string;
  volume?: number;
  volumeEnd?: number;
  chapter?: number;
  chapterEnd?: number;
  group?: string;
  publisher?: string;
  language?: string;
  year?: number;
  yearEnd?: number;
  tags?: string[];
}

// Known file extensions to strip from filenames (case-insensitive)
const FILE_EXTENSION_RE = /\.(cbz|cbr|pdf|zip|rar|7z|tar|gz|epub|mobi|azw3?|mp3|m4a|m4b|flac|opus)$/i;

// Regex patterns - using hex escapes \x7b for open brace, \x7d for close brace
// Volume patterns - handles "Vol 01", "Vols. 01 - 16", "v01-05", "Kanzenban 06"
const VOLUME_RANGE_RE = /[Vv](?:ol(?:ume)?s?)?[-.\s]*(\d+)(?:v\d+)?\s*[-–]\s*(\d+(?:\.\d+)?)(?:v\d+)?/;
const VOLUME_SINGLE_RE = /[Vv](?:ol(?:ume)?)?[-.\s]*(\d+(?:\.\d+)?)(?:v\d+)?/;
const KANZENBAN_RE = /[Kk]anzenban\s*(\d+)/;
// Volume bare trailing: "One Piece 1" or "Tokyo Revengers 1 (2018)" → Volume 1 (small numbers 1-99)
const VOLUME_BARE_TRAILING_RE = /\s(\d{1,2})(?=\s*(?:\(\d{4}\))?(?:\s*\[[^\]]*\])?\s*$)/;
// Chapter pattern - handles "Chapter 1", "Ch. 1", "C01", "Chapter_1", "Chapter-1"
const CHAPTER_EXPLICIT_RE = /(?:^|[^a-zA-Z])[Cc](?:h(?:apter)?)?[-._\s]*(\d+(?:\.\d+)?)/;
const CHAPTER_COMPILATION_RE = /(\d\d\d?\d?)-(\d\d\d?\d?)(?:\.\d+)?\s+as\s+v/i;
const CHAPTER_STANDALONE_RANGE_RE = /(?<![Vv\d])(\d\d\d?\d?)-(\d\d\d?\d?(?:\.\d+)?)\s*[([]\d\d\d\d/;
const CHAPTER_STANDALONE_RE = /\s(\d\d\d\d?)(?=\s*[([]|$)/;
// Chapter range at end: "Title 001-030" or "Title 1-240 (Digital)"
const CHAPTER_END_RANGE_RE = /\s(\d{1,4})-(\d{1,4})(?=\s*[([](?!\d{4})|\s*$)/;
// Single chapter at end: "Flying Witch 89" (2 digits, not 4-digit year)
const CHAPTER_END_SINGLE_RE = /\s(\d{1,3})(?=\s*[([]|\s*$)/;
// Year patterns - supports (), [], {} brackets and bare year before metadata
const YEAR_RANGE_RE = /[([{](\d\d\d\d)[-–](\d\d\d\d)[)\]}]/;
const YEAR_SINGLE_RE = /[([{](\d\d\d\d)[)\]}]/;
const YEAR_BARE_RE = /\s(19\d\d|20\d\d)(?=\s*[([])/;
const PUBLISHER_END_RE = /\[([^\]]+)\]\s*$/;
const ALL_BRACKETS_RE = /\[([^\]]+)\]/g;
const ALL_PARENS_RE = /\(([^)]+)\)/g;
const END_PAREN_RE = /\(([^)]+)\)\s*(?:\[[^\]]*\]\s*)*$/;
const END_BRACKET_RE = /\[([^\]]+)\]\s*$/;
const START_BRACKET_RE = /^\[([^\]]+)\]/;
const YEAR_PATTERN_FOR_CLEANUP = /\s*[([]\d\d\d\d.*$/;

function isValidYear(year: number): boolean {
  return year >= 1900 && year <= 2099;
}

interface VolumeResult { volume?: number; volumeEnd?: number; matchStr?: string }
interface ChapterResult { chapter?: number; chapterEnd?: number; matchStr?: string }
interface YearResult { year?: number; yearEnd?: number; matchStr?: string }
interface GroupResult { group?: string; publisher?: string; matchStr?: string; pubMatchStr?: string }

interface VolumeResultExtended extends VolumeResult {
  isBareTrailing?: boolean;
}

function extractVolume(name: string, hasExplicitChapter: boolean = false): VolumeResultExtended {
  const rangeMatch = name.match(VOLUME_RANGE_RE);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    return { volume: parseInt(rangeMatch[1], 10), volumeEnd: parseInt(rangeMatch[2], 10), matchStr: rangeMatch[0] };
  }
  const singleMatch = name.match(VOLUME_SINGLE_RE);
  if (singleMatch?.[1]) {
    return { volume: parseInt(singleMatch[1], 10), matchStr: singleMatch[0] };
  }
  // Try Japanese edition formats (Kanzenban = complete edition)
  const kanzenbanMatch = name.match(KANZENBAN_RE);
  if (kanzenbanMatch?.[1]) {
    return { volume: parseInt(kanzenbanMatch[1], 10), matchStr: kanzenbanMatch[0] };
  }
  // Bare trailing number as volume (only if no explicit chapter keyword found)
  // This handles "One Piece 1" → Volume 1
  if (!hasExplicitChapter) {
    const bareMatch = name.match(VOLUME_BARE_TRAILING_RE);
    if (bareMatch?.[1]) {
      return { volume: parseInt(bareMatch[1], 10), matchStr: bareMatch[0].trim(), isBareTrailing: true };
    }
  }
  return {};
}

function tryExplicitChapter(name: string): ChapterResult | null {
  const m = name.match(CHAPTER_EXPLICIT_RE);
  if (!m?.[1]) return null;
  return { chapter: parseFloat(m[1]), matchStr: m[0] };
}

function tryCompilationChapter(name: string): ChapterResult | null {
  const m = name.match(CHAPTER_COMPILATION_RE);
  if (!m?.[1] || !m[2]) return null;
  return { chapter: parseInt(m[1], 10), chapterEnd: parseInt(m[2], 10), matchStr: m[0] };
}

function tryStandaloneRangeChapter(name: string): ChapterResult | null {
  const m = name.match(CHAPTER_STANDALONE_RANGE_RE);
  if (!m?.[1] || !m[2]) return null;
  const chapterEnd = Math.floor(parseFloat(m[2]));
  const matchStr = m[0].replace(YEAR_PATTERN_FOR_CLEANUP, '');
  return { chapter: parseInt(m[1], 10), chapterEnd, matchStr };
}

function tryStandaloneChapter(name: string): ChapterResult | null {
  const m = name.match(CHAPTER_STANDALONE_RE);
  if (!m?.[1]) return null;
  return { chapter: parseInt(m[1], 10), matchStr: m[0].trim() };
}

function tryEndRangeChapter(name: string): ChapterResult | null {
  const m = name.match(CHAPTER_END_RANGE_RE);
  if (!m?.[1] || !m[2]) return null;
  // Avoid matching year ranges or audiobook counts
  const start = parseInt(m[1], 10);
  const end = parseInt(m[2], 10);
  if (start >= 1900 && start <= 2100) return null; // Looks like a year
  if (end < start) return null; // Invalid range
  return { chapter: start, chapterEnd: end, matchStr: m[0].trim() };
}

function tryEndSingleChapter(name: string): ChapterResult | null {
  const m = name.match(CHAPTER_END_SINGLE_RE);
  if (!m?.[1]) return null;
  const ch = parseInt(m[1], 10);
  // Avoid matching years or very small numbers that might be parts
  if (ch >= 1900 && ch <= 2100) return null;
  return { chapter: ch, matchStr: m[0].trim() };
}

// Note: extractChapter replaced by extractChapterWithContext in parse() for context-aware extraction

function tryYearRange(name: string): YearResult | null {
  const m = name.match(YEAR_RANGE_RE);
  if (!m?.[1] || !m[2]) return null;
  const y1 = parseInt(m[1], 10);
  const y2 = parseInt(m[2], 10);
  if (!isValidYear(y1) || !isValidYear(y2)) return null;
  return { year: y1, yearEnd: y2, matchStr: m[0] };
}

function trySingleYear(name: string): YearResult | null {
  const m = name.match(YEAR_SINGLE_RE);
  if (!m?.[1]) return null;
  const y = parseInt(m[1], 10);
  if (!isValidYear(y)) return null;
  return { year: y, matchStr: m[0] };
}

function tryBareYear(name: string): YearResult | null {
  const m = name.match(YEAR_BARE_RE);
  if (!m?.[1]) return null;
  const y = parseInt(m[1], 10);
  if (!isValidYear(y)) return null;
  return { year: y, matchStr: m[0].trim() };
}

function extractYear(name: string): YearResult {
  return tryYearRange(name) ?? trySingleYear(name) ?? tryBareYear(name) ?? {};
}

function getBracketContent(bracket: string): string {
  return bracket.slice(1, -1);
}

function tryEndPublisher(name: string): GroupResult | null {
  const m = name.match(PUBLISHER_END_RE);
  if (!m?.[1]) return null;
  if (!isKnownPublisher(m[1])) return null;
  return { publisher: m[1], matchStr: m[0] };
}

function tryAnyPublisher(name: string): GroupResult | null {
  const brackets = name.match(ALL_BRACKETS_RE);
  if (!brackets) return null;
  // First try exact match
  const pubBracket = brackets.find(b => isKnownPublisher(getBracketContent(b)));
  if (pubBracket) {
    return { publisher: getBracketContent(pubBracket), matchStr: pubBracket };
  }
  // Then try first item in comma-separated list: [Vertical, GroupA, GroupB]
  for (const b of brackets) {
    const content = getBracketContent(b);
    const parts = content.split(/\s*,\s*/);
    const firstPart = parts[0];
    if (parts.length > 1 && firstPart && isKnownPublisher(firstPart)) {
      return { publisher: firstPart, matchStr: b };
    }
  }
  return null;
}

function getParenContent(paren: string): string {
  return paren.slice(1, -1);
}

function tryAnyParenPublisher(name: string): GroupResult | null {
  const parens = name.match(ALL_PARENS_RE);
  if (!parens) return null;
  const pubParen = parens.find(p => isKnownPublisher(getParenContent(p)));
  if (!pubParen) return null;
  return { publisher: getParenContent(pubParen), matchStr: pubParen };
}

function tryEndParenGroup(name: string): GroupResult | null {
  const m = name.match(END_PAREN_RE);
  if (!m?.[1]) return null;
  if (isKnownPublisher(m[1])) return null; // Publishers handled separately
  if (!isValidGroupName(m[1])) return null;
  return { group: m[1], matchStr: m[0] };
}

function tryStartBracketGroup(name: string): GroupResult | null {
  const m = name.match(START_BRACKET_RE);
  if (!m?.[1]) return null;
  if (isKnownPublisher(m[1])) return null;
  return { group: m[1], matchStr: m[0] };
}

function tryEndBracketGroup(name: string): GroupResult | null {
  const m = name.match(END_BRACKET_RE);
  if (!m?.[1]) return null;
  if (isKnownPublisher(m[1])) return null;
  if (!isValidGroupName(m[1])) return null;
  return { group: m[1], matchStr: m[0] };
}

function extractGroup(name: string): GroupResult {
  // First try to find publisher (brackets first, then parens)
  const pubResult = tryEndPublisher(name) ?? tryAnyPublisher(name) ?? tryAnyParenPublisher(name);

  // Then try to find group
  const grpResult = tryEndParenGroup(name) ?? tryEndBracketGroup(name) ?? tryStartBracketGroup(name);

  // If we found both, combine them (but avoid same bracket)
  if (pubResult?.publisher && grpResult?.group && pubResult.matchStr !== grpResult.matchStr) {
    const result: GroupResult = {
      publisher: pubResult.publisher,
      group: grpResult.group,
    };
    if (grpResult.matchStr) result.matchStr = grpResult.matchStr;
    if (pubResult.matchStr) result.pubMatchStr = pubResult.matchStr;
    return result;
  }

  // Return whichever we found
  return pubResult ?? grpResult ?? {};
}

function removePatterns(text: string, patterns: (string | undefined)[]): string {
  return patterns.reduce<string>((acc, p) => (p ? acc.replace(p, '').trim() : acc), text);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
}

function removePublisherBracket(text: string, publisher: string): string {
  const pattern = '\\[' + escapeRegex(publisher) + '\\]';
  return text.replace(new RegExp(pattern, 'gi'), '').trim();
}

function removeMetadataTerms(text: string): string {
  return text
    .replace(/\s*\(Digital(?:-Compilation)?\)/gi, '')
    .replace(/\s*\[JPEG-XL\]/gi, '')
    .replace(/\s*\[Completed?\]/gi, '')
    .replace(/\s*\(c2c\)/gi, '')
    .replace(/\s*\(Audiobook\)/gi, '')
    .replace(/^\s*[-–]\s*/, '')
    .replace(/\s*[-–]\s*$/, '')
    .replace(/[,.:;]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanExtractedTitle(title: string, patterns: (string | undefined)[], publisher?: string): string {
  let cleaned = removePatterns(title, patterns);
  if (publisher) cleaned = removePublisherBracket(cleaned, publisher);
  cleaned = removeMetadataTerms(cleaned);
  return cleaned;
}

// Generic structural words that show up as a per-file `cleanTitle` when filenames
// lack a series prefix (e.g. `Volume 01.cbz` strips to "Volume"). Never a real
// series title — must be filtered out before consensus voting in
// extractConsistentTitle, otherwise the wizard picks "Volumes" as the title for
// /<Series>/Volumes/ layouts. Also blocks the historical 'Unknown' sentinel that
// cleanExtractedTitle used to emit.
const PLACEHOLDER_TITLE_RE = /^(?:volume|volumes|chapter|chapters|tome|tomes|part|parts|book|books|unknown)$/i;

// eslint-disable-next-line max-params -- Result builder receives pre-extracted parse components (volume, chapter, year, group) for assembly
function buildResult(
  basename: string,
  title: string,
  vol: VolumeResult,
  ch: ChapterResult,
  yr: YearResult,
  grp: GroupResult
): ParsedMangaInfo {
  const result: ParsedMangaInfo = { original: basename, title, cleanTitle: title };
  if (vol.volume !== undefined) result.volume = vol.volume;
  if (vol.volumeEnd !== undefined) result.volumeEnd = vol.volumeEnd;
  if (ch.chapter !== undefined) result.chapter = ch.chapter;
  if (ch.chapterEnd !== undefined) result.chapterEnd = ch.chapterEnd;
  if (grp.group !== undefined) result.group = grp.group;
  if (grp.publisher !== undefined) result.publisher = grp.publisher;
  if (yr.year !== undefined) result.year = yr.year;
  if (yr.yearEnd !== undefined) result.yearEnd = yr.yearEnd;
  return result;
}

function updateTitleCount(counts: Map<string, number>, title: string): void {
  // Clean leading/trailing underscores and whitespace
  const cleaned = title.replace(/^[_\s]+|[_\s]+$/g, '').trim();
  if (cleaned.length < 2) return; // Skip very short titles
  if (PLACEHOLDER_TITLE_RE.test(cleaned)) return; // Skip generic structural words
  counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
}

function findMostCommonTitle(titleCounts: Map<string, number>, totalFiles: number): string | null {
  if (titleCounts.size === 0) return null;

  let mostCommon: string | null = null;
  let maxCount = 0;

  for (const [title, count] of titleCounts) {
    if (count <= maxCount) continue;
    mostCommon = title;
    maxCount = count;
  }

  // Heuristics to detect when titles are likely chapter titles, not series titles:
  // 1. If most common appears in less than 50% of files and we have many unique titles
  // 2. If most common appears only once or twice and we have multiple files
  const uniqueTitleRatio = titleCounts.size / totalFiles;
  const mostCommonRatio = maxCount / totalFiles;

  // High title variance (>50% unique) suggests chapter titles
  if (uniqueTitleRatio > 0.5 && mostCommonRatio < 0.5) {
    return null;
  }

  // Very low occurrence of most common title with many files suggests chapter titles
  if (maxCount <= 2 && totalFiles > 5) {
    return null;
  }

  return mostCommon;
}

/** Check if name contains explicit chapter keyword (Ch, Chapter, C followed by number) */
function hasExplicitChapterKeyword(name: string): boolean {
  return CHAPTER_EXPLICIT_RE.test(name);
}

/** Extract chapter, skipping bare trailing number if volume already detected it */
function extractChapterWithContext(name: string, volumeIsBareTrailing: boolean): ChapterResult {
  // Explicit chapter keyword always wins
  const explicit = tryExplicitChapter(name);
  if (explicit) return explicit;

  // Try other chapter patterns (compilation, standalone range, etc.)
  const compilation = tryCompilationChapter(name);
  if (compilation) return compilation;

  const standaloneRange = tryStandaloneRangeChapter(name);
  if (standaloneRange) return standaloneRange;

  const standalone = tryStandaloneChapter(name);
  if (standalone) return standalone;

  const endRange = tryEndRangeChapter(name);
  if (endRange) return endRange;

  // Skip bare trailing single chapter if volume already detected from same position
  if (!volumeIsBareTrailing) {
    const endSingle = tryEndSingleChapter(name);
    if (endSingle) return endSingle;
  }

  return {};
}

export class MangaFileParser {
  /** Parse a filename to extract manga metadata */
  static parse(filename: string): ParsedMangaInfo {
    const basename = path.basename(filename);
    const name = basename.replace(FILE_EXTENSION_RE, '');

    // Check for explicit chapter keyword first
    const hasExplicitChapter = hasExplicitChapterKeyword(name);

    // Extract volume (bare trailing only if no explicit chapter keyword)
    const vol = extractVolume(name, hasExplicitChapter);

    // Extract chapter (skip bare trailing if volume used it)
    const ch = extractChapterWithContext(name, vol.isBareTrailing === true);

    const yr = extractYear(name);
    const grp = extractGroup(name);

    const title = cleanExtractedTitle(name, [grp.matchStr, grp.pubMatchStr, ch.matchStr, vol.matchStr, yr.matchStr], grp.publisher);
    return buildResult(basename, title, vol, ch, yr, grp);
  }

  /** Extract consistent title from multiple parsed files */
  static extractConsistentTitle(parsedFiles: ParsedMangaInfo[]): string | null {
    if (parsedFiles.length === 0) return null;

    const titleCounts = new Map<string, number>();
    for (const file of parsedFiles) {
      updateTitleCount(titleCounts, file.cleanTitle);
    }

    return findMostCommonTitle(titleCounts, parsedFiles.length);
  }
}
