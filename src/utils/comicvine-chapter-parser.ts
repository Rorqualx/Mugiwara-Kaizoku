/**
 * ComicVine Chapter Parser
 *
 * Extracts chapter titles from ComicVine issue descriptions
 * which often contain chapter lists in HTML format.
 *
 * Uses shared patterns from @/server/services/comicvine/constants.ts
 * for consistency with the scraping service.
 */
import { parseChapterToken } from '@/server/parsers/chapter-number-extractor';
import {
  CHAPTER_SECTION_HEADERS,
  DESCRIPTION_CHAPTER_PATTERNS,
  SECTION_TERMINATORS,
} from '@/server/services/comicvine/constants';
import { getErrorMessage } from '@/utils/errors/helpers';

import { logger } from './logging';

export interface ParsedChapter {
  chapterNumber: number;
  title: string;
  originalText: string;
  /**
   * True when the chapter number was parsed from an explicit "Chapter N:"
   * pattern in the description. False when chapterNumber is a synthetic
   * running index assigned by title-only mode or fallback heuristic.
   */
  hasRealNumber: boolean;
}

/**
 * Remove HTML tags and decode entities from HTML string
 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Check if line is a chapter section header
 */
function isChapterSectionHeader(line: string): boolean {
  return CHAPTER_SECTION_HEADERS.some((pattern) => pattern.test(line));
}

/**
 * Check if line is a section terminator
 */
function isSectionTerminator(line: string): boolean {
  return SECTION_TERMINATORS.test(line);
}

/**
 * Normalize full-width characters to ASCII equivalents.
 * Must run BEFORE stripNonEnglishText so CJK detection doesn't catch full-width Latin.
 */
function normalizeFullWidth(title: string): string {
  return title
    .replace(/＆/g, '&')
    .replace(/？/g, '?')
    .replace(/！/g, '!')
    .replace(/：/g, ':')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/／/g, '/')
    .replace(/・/g, '\u00B7');
}

/**
 * Strip trailing Japanese/CJK text from a bilingual title.
 * ComicVine Japanese edition descriptions have bilingual titles like:
 *   "Death&Strawberry デス・アンド・ストロベリー"
 * This extracts just the English portion: "Death&Strawberry"
 */
function stripNonEnglishText(title: string): string {
  // CJK ideographs, hiragana, katakana (not fullwidth Latin which is already normalized)
  const cjkBlock = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/;
  if (!cjkBlock.test(title)) return title;

  // Remove trailing Japanese text: whitespace + 2+ consecutive CJK chars + rest of string
  const latinPart = title.replace(/\s+[\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]{2,}.*$/, '').trim();

  // Only use Latin part if it has meaningful content (3+ chars)
  return latinPart.length >= 3 ? latinPart : title;
}

/**
 * Clean and normalize a title string
 */
function cleanTitle(title: string): string {
  let cleaned = title.replace(/^["']|["']$/g, '').trim();
  // Strip CJK FIRST (while ・ U+30FB is still katakana, keeping consecutive CJK runs intact)
  // Then normalize full-width chars to ASCII (＆→&, ・→·, etc.)
  cleaned = stripNonEnglishText(cleaned);
  cleaned = normalizeFullWidth(cleaned);
  return cleaned;
}

/**
 * Try to parse a chapter with number and title
 */
function tryParseNumberedChapter(line: string, match: RegExpMatchArray): ParsedChapter | null {
  if (match.length === 3 && match[1] && match[2]) {
    const chapterNum = parseChapterToken(match[1]);
    const title = match[2].trim();
    if (chapterNum !== null && title) {
      return {
        chapterNumber: chapterNum,
        title: cleanTitle(title),
        originalText: line,
        hasRealNumber: true,
      };
    }
  }
  return null;
}

/**
 * Try to parse a chapter with only a title (no number)
 */
function tryParseTitleOnlyChapter(
  line: string,
  match: RegExpMatchArray,
  chapterIndex: number,
  inChapterSection: boolean
): ParsedChapter | null {
  if (match.length === 2 && match[1] && inChapterSection) {
    const title = match[1].trim();
    if (title && title.length > 2) {
      return {
        chapterNumber: chapterIndex,
        title: cleanTitle(title),
        originalText: line,
        hasRealNumber: false,
      };
    }
  }
  return null;
}

/**
 * Check if line looks like a chapter title (heuristic).
 *
 * When `insideNamedSection` is true (we're under a "Chapter Titles" header),
 * the filter is relaxed: titles starting with common articles like "The" are
 * allowed because manga chapter titles frequently begin that way
 * (e.g. "The Black Swordsman", "The Golden Age").
 *
 * When false, the stricter filter rejects lines that look like prose sentences
 * starting with common English words.
 */
function looksLikeChapterTitle(line: string, insideNamedSection = false): boolean {
  if (line.length <= 2 || line.length >= 100) return false;
  // Reject lines that look like prose sentences (end with period)
  if (line.endsWith('.')) return false;
  // When inside a named chapter section, allow titles starting with "The" etc.
  if (!insideNamedSection) {
    if (/^(the |this |it |when |where |how |why |what )/i.test(line)) return false;
  }
  return true;
}

/**
 * Try to parse chapter from a line using pattern matching
 */
function tryParseChapterFromLine(
  line: string,
  inChapterSection: boolean,
  chapterIndex: number
): { chapter: ParsedChapter | null; incrementIndex: boolean } {
  for (const pattern of DESCRIPTION_CHAPTER_PATTERNS) {
    const match = line.match(pattern);
    if (!match) continue;

    // Try numbered chapter first
    const numberedChapter = tryParseNumberedChapter(line, match);
    if (numberedChapter) {
      return { chapter: numberedChapter, incrementIndex: false };
    }

    // Try title-only chapter
    const titleOnlyChapter = tryParseTitleOnlyChapter(line, match, chapterIndex, inChapterSection);
    if (titleOnlyChapter) {
      return { chapter: titleOnlyChapter, incrementIndex: true };
    }
  }

  // Fallback: if in chapter section and looks like a title
  // Pass inChapterSection so titles like "The Black Swordsman" are allowed
  // under a recognized "Chapter Titles" header
  if (inChapterSection && looksLikeChapterTitle(line, inChapterSection)) {
    return {
      chapter: {
        chapterNumber: chapterIndex,
        title: cleanTitle(line.trim()),
        originalText: line,
        hasRealNumber: false,
      },
      incrementIndex: true
    };
  }

  return { chapter: null, incrementIndex: false };
}

/**
 * Process a single line for chapter parsing
 * Returns whether to break the loop and the updated chapter index
 */
function processChapterLine(
  line: string,
  inChapterSection: boolean,
  chapterIndex: number,
  chapters: ParsedChapter[]
): { shouldBreak: boolean; newIndex: number } {
  // Stop if we hit another section header
  if (inChapterSection && isSectionTerminator(line)) {
    return { shouldBreak: true, newIndex: chapterIndex };
  }

  // Try to parse chapter from line
  const { chapter, incrementIndex } = tryParseChapterFromLine(line, inChapterSection, chapterIndex);

  if (chapter) {
    chapters.push(chapter);
    return {
      shouldBreak: false,
      newIndex: incrementIndex ? chapterIndex + 1 : chapterIndex
    };
  }

  return { shouldBreak: false, newIndex: chapterIndex };
}

/**
 * Split concatenated chapter entries into separate lines.
 * Handles formats like "1.Death＆Strawberry2.Starter3.Headhittin'"
 * by inserting newlines before "N." number-dot patterns.
 * Also splits "Chapter ListN." headers from the first entry.
 */
function splitConcatenatedChapters(text: string): string {
  // Insert newline before patterns like "2.Title", "10.Title", "123.Title"
  // but NOT after decimal numbers (e.g., "1.5" should not split)
  // Match: non-digit char followed by digit(s) then period then non-digit/non-space
  return text.replace(/([^\d\n])(\d+\.)(?=[^\d\s])/g, '$1\n$2');
}

/**
 * Parse chapter titles from ComicVine issue description HTML
 * ComicVine descriptions often contain chapter lists in formats like:
 * <h2>Chapter Titles</h2><ul><li>Chapter 1: Title</li>...</ul>
 * or
 * <h4>Table of Contents:</h4><ul><li>Chapter Name</li>...</ul>
 */
export function parseChaptersFromDescription(description: string | null | undefined): ParsedChapter[] {
  if (!description) return [];

  const chapters: ParsedChapter[] = [];

  try {
    const textContent = htmlToText(description);

    // Pre-process: split concatenated chapter entries like "1.Title2.Title3.Title"
    // into separate lines by inserting newlines before "N." patterns
    const preprocessed = splitConcatenatedChapters(textContent);

    const lines = preprocessed.split('\n').map((line) => line.trim()).filter((line) => line);

    let inChapterSection = false;
    let chapterIndex = 1;

    for (const line of lines) {
      if (!line) continue;

      // Check if we're entering a chapter section
      if (!inChapterSection && isChapterSectionHeader(line)) {
        inChapterSection = true;
        continue;
      }

      // If we're in a chapter section or looking for chapter patterns
      if (inChapterSection || chapters.length === 0) {
        const result = processChapterLine(line, inChapterSection, chapterIndex, chapters);
        if (result.shouldBreak) break;
        chapterIndex = result.newIndex;
      }
    }

    // If we found chapters, log them
    if (chapters.length > 0) {
      logger.debug(`Parsed ${chapters.length} chapters from ComicVine description`, {
        firstChapter: chapters[0],
        lastChapter: chapters[chapters.length - 1]
      });
    }
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logger.error('Error parsing chapters from ComicVine description', errorMessage);
  }

  return chapters;
}
/**
 * Create chapter titles for a ComicVine issue
 * Uses parsed chapters if available, otherwise generates default titles
 */
export function createChapterTitlesForIssue(issue: unknown, issueNumber: number, expectedChapterCount?: number): string[] {
  const issueData = issue as { description?: string | null; name?: string; title?: string };
  const parsedChapters = parseChaptersFromDescription(issueData.description);
  if (parsedChapters.length > 0) {
    // Use parsed chapter titles
    return parsedChapters.map((ch) => ch.title);
  }
  // Fallback to generating chapter titles based on expected count
  const chapterCount = expectedChapterCount || 6; // Default to 6 chapters per issue
  const titles: string[] = [];
  for (let i = 1; i <= chapterCount; i++) {
    const issueName = issueData.name ?? issueData.title ?? `Issue #${issueNumber}`;
    titles.push(`${issueName} - Chapter ${i}`);
  }
  return titles;
}