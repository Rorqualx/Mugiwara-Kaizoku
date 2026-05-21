/**
 * Numbered Chapters Pattern Parser
 *
 * Parses chapters from Wikipedia HTML content when chapters use standard numbering.
 * Pattern: "1. Title", "2. Title", etc. (chapters starting from 1)
 * This is the default/fallback pattern for most manga chapter listings.
 *
 * Used by: Chainsaw Man, Jujutsu Kaisen, and most manga with standard numbering
 */

import { extractDateString, containsWikipediaArtifacts, extractISBN } from '@/server/services/shared/parsing-utils';
import { DEFAULT_PARSER_CONFIG } from '@/server/services/wikipedia/parser-config';
import type { ChapterListFormatHints, ChapterMatch, PageStructureHints, WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { cleanChapterTitle } from '@/server/services/wikipedia/wikipedia/utils';
import { logger } from '@/utils/logger';

// Use configurable values
const { patterns: patternConfig } = DEFAULT_PARSER_CONFIG;

/**
 * Volume information structure
 */
interface VolumeInfo {
  start: number;
  end: number;
  date?: string;
  isbn?: string;
}

/**
 * Parse numbered chapters from HTML content
 *
 * Handles numbered chapters with quotes using standard volume distribution.
 * This is the default parser for most manga chapter listings.
 *
 * @param html - HTML content containing chapter data
 * @param allChapterMatches - Matched chapter patterns from HTML
 * @param totalVolumes - Total number of volumes detected
 * @returns Array of parsed chapters
 */
export function parseNumberedChaptersPattern(
  html: string,
  allChapterMatches: ChapterMatch[],
  totalVolumes: number,
  hints?: ChapterListFormatHints,
  pageHints?: PageStructureHints
): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];

  logger.info(`[WIKIPEDIA] Parsing numbered chapters pattern`);

  // Extract volume information (page hints provide detected volume prefix)
  const volumeInfo = extractVolumeInfo(html, allChapterMatches.length, totalVolumes, hints, pageHints);

  for (let i = 0; i < allChapterMatches.length; i++) {
    const match = allChapterMatches[i];
    if (!match) continue;

    const chapter = parseChapterMatch(match, i, volumeInfo, totalVolumes);
    if (chapter) {
      chapters.push(chapter);
    }
  }

  return chapters;
}

/**
 * Parse a single chapter match into a WikipediaChapter
 *
 * @param match - Chapter match containing chapter data
 * @param index - Chapter index in the array
 * @param volumeInfo - Map of volume information
 * @param totalVolumes - Total number of volumes
 * @returns Parsed chapter or null if invalid
 */
function parseChapterMatch(
  match: ChapterMatch,
  index: number,
  volumeInfo: Map<number, VolumeInfo>,
  totalVolumes: number
): WikipediaChapter | null {
  const matchType = match.chapterNumber;
  const matchTitle = match.chapterTitle;
  if (!matchType || !matchTitle) return null;

  const { chapterNum, chapterIdentifier } = extractChapterIdentifier(matchType);
  const cleanedTitle = cleanChapterTitle(matchTitle);

  if (isArtifactTitle(cleanedTitle)) {
    return null;
  }

  const currentVolume = findVolumeForChapter(index, volumeInfo);
  const volData = volumeInfo.get(currentVolume);

  const chapterOptions: BuildChapterOptions = {
    chapterNum,
    chapterIdentifier,
    cleanedTitle,
    volumeNumber: currentVolume,
    totalVolumes
  };

  if (volData !== undefined) {
    chapterOptions.volData = volData;
  }

  return buildChapter(chapterOptions);
}

/**
 * Extract chapter identifier from match type
 *
 * @param matchType - Matched chapter type string
 * @returns Chapter number and identifier
 */
function extractChapterIdentifier(matchType: string): {
  chapterNum: number;
  chapterIdentifier: string | number;
} {
  const isSpecialChapter = matchType.match(
    /^(Epilogue|Prologue|Introduction|Intro|Final Chapter|Special|Extra)/i
  );

  if (isSpecialChapter) {
    return {
      chapterNum: NaN,
      chapterIdentifier: matchType
    };
  }

  const chapterNum = parseFloat(matchType);
  return {
    chapterNum,
    chapterIdentifier: chapterNum
  };
}

/**
 * Check if a title is an artifact and should be skipped
 *
 * Uses shared utility for consistent artifact detection.
 *
 * @param title - Cleaned chapter title
 * @returns True if title is an artifact
 */
function isArtifactTitle(title: string): boolean {
  return title.length < 2 || containsWikipediaArtifacts(title);
}

/**
 * Find which volume a chapter belongs to based on index
 *
 * @param index - Chapter index
 * @param volumeInfo - Map of volume information
 * @returns Volume number for the chapter
 */
function findVolumeForChapter(
  index: number,
  volumeInfo: Map<number, VolumeInfo>
): number {
  if (volumeInfo.size === 0) return 1;

  for (const [volNum, info] of volumeInfo.entries()) {
    if (index >= info.start && index < info.end) {
      return volNum;
    }
  }

  return 1;
}

/**
 * Options for building a chapter object
 */
interface BuildChapterOptions {
  chapterNum: number;
  chapterIdentifier: string | number;
  cleanedTitle: string;
  volumeNumber: number;
  totalVolumes: number;
  volData?: VolumeInfo;
}

/**
 * Build a WikipediaChapter object
 *
 * @param options - Chapter building options
 * @returns Complete WikipediaChapter object
 */
function buildChapter(options: BuildChapterOptions): WikipediaChapter {
  const {
    chapterNum,
    chapterIdentifier,
    cleanedTitle,
    volumeNumber,
    totalVolumes,
    volData
  } = options;

  const chapter: WikipediaChapter = {
    number: isNaN(chapterNum) ? chapterIdentifier : chapterNum,
    title: cleanedTitle || (typeof chapterIdentifier === 'number' ? `Chapter ${chapterIdentifier}` : chapterIdentifier)
  };

  if (totalVolumes > 0) {
    chapter.volumeNumber = volumeNumber;
  }

  if (volData?.date) {
    chapter.releaseDate = volData.date;
  }

  return chapter;
}

/**
 * Count chapters in ordered list format within a volume section
 *
 * Handles both <ol start="N"><li>"Title"</li> and bare <ol><li>"Title"</li> formats.
 * Bare <ol> is used by AoT Vol 1, while start="N" is used by JJK, Tokyo Revengers, etc.
 *
 * @param volumeHtml - HTML content of a volume section
 * @returns Number of chapters found in ol lists, or 0 if none
 */
function countOlListChapters(volumeHtml: string, hints?: ChapterListFormatHints): number {
  // Match both <ol start="N"> and bare <ol> (excludes reference lists)
  // Group 1: start number (undefined for bare <ol>), Group 2: list content
  const olPattern = /<ol(?:\s+start="(\d+)")?(?:\s[^>]*)?>(?!<li[^>]*>\s*<sup)([\s\S]*?)<\/ol>/gi;
  const olMatches = [...volumeHtml.matchAll(olPattern)];
  let count = 0;
  for (const olMatch of olMatches) {
    const fullTag = olMatch[0].slice(0, olMatch[0].indexOf('>') + 1);
    if (fullTag.includes('class="references"') || fullTag.includes('class="reflist"')) continue;
    const listContent = olMatch[2] ?? '';

    if (olMatch[1] !== undefined) {
      // <ol start="N"> — strong chapter signal, count all <li> items
      const liMatches = [...listContent.matchAll(/<li>/gi)];
      count += liMatches.length;
    } else if (hints) {
      // WITH HINTS: page-level decision for bare <ol>
      if (hints.hasOlStartLists && !hints.hasBareOlWithQuotedTitles) {
        // Page uses <ol start="N"> as primary format → bare <ol> is TOC/nav, skip
        continue;
      }
      if (hints.hasBareOlWithQuotedTitles) {
        // Page has genuine bare <ol> chapters → count only quoted items
        const quotedLiPattern = /<li>[^<]*?[\u0022\u201C\u201D][^\u0022\u201C\u201D<]+[\u0022\u201C\u201D]/gi;
        count += [...listContent.matchAll(quotedLiPattern)].length;
      }
      // hasBareOlWithoutQuotedTitles only → skip (not chapter content)
    } else {
      // WITHOUT HINTS (backward compat): existing inline logic
      const quotedLiPattern = /<li>[^<]*?[\u0022\u201C\u201D][^\u0022\u201C\u201D<]+[\u0022\u201C\u201D]/gi;
      count += [...listContent.matchAll(quotedLiPattern)].length;
    }
  }
  return count;
}

/** Find the position of the next volume marker after the given volume number */
function findNextVolumeMarkerPos(
  html: string,
  afterVolNum: number,
  totalVolumes: number,
  prefix: string,
): number {
  for (let nextVol = afterVolNum + 1; nextVol <= totalVolumes + 1; nextVol++) {
    const nextPattern = new RegExp(`id="${prefix}${nextVol}"`, 'i');
    const nextMatch = html.match(nextPattern);
    if (nextMatch?.index) return nextMatch.index;
  }
  return html.length;
}

/** Extract the full HTML section for a volume (from its marker to the next volume's marker) */
function extractFullVolumeSection(
  html: string,
  volNum: number,
  totalVolumes: number,
  prefix: string,
): string | null {
  const startPattern = new RegExp(`id="${prefix}${volNum}"`, 'i');
  const startMatch = html.match(startPattern);
  if (!startMatch?.index) return null;

  const endPos = findNextVolumeMarkerPos(html, volNum, totalVolumes, prefix);
  return html.slice(startMatch.index, endPos);
}

/** Count chapters in a volume section using ol-list, numbered, and bare list patterns */
function countChaptersInSection(sectionHtml: string, hints?: ChapterListFormatHints): number {
  // Priority 1: <ol> or <ol start="N"><li> format (Tokyo Revengers, JJK, AoT)
  const olCount = countOlListChapters(sectionHtml, hints);
  if (olCount > 0) return olCount;

  // Priority 2: "N. Title" numbered pattern
  const numberedChapters = [...sectionHtml.matchAll(/(\d{1,5})\.\s*"([^"]+)"/g)];
  if (numberedChapters.length > 0) return numberedChapters.length;

  // Priority 3: bare <li> with quoted titles (fallback)
  // Matches: <li>ISBN "Title" or <li>"Title" (supports curly quotes)
  const bareListChapters = [...sectionHtml.matchAll(/<li>[^<]*["\u201C][^"\u201D]+["\u201D]/gi)];
  if (bareListChapters.length > 0) return bareListChapters.length;

  return 0;
}

/** Build VolumeInfo with optional date and ISBN */
function buildVolumeInfo(start: number, end: number, sectionHtml: string): VolumeInfo {
  const volInfo: VolumeInfo = { start, end };
  const dateVal = extractDateString(sectionHtml);
  const isbnResult = extractISBN(sectionHtml);
  const isbnVal = isbnResult?.isbn13 ?? isbnResult?.isbn10;
  if (dateVal) volInfo.date = dateVal;
  if (isbnVal) volInfo.isbn = isbnVal;
  return volInfo;
}

/**
 * Extract volume information from HTML
 *
 * Builds a map of volume numbers to their chapter ranges and metadata.
 * Uses shared utilities for date and ISBN extraction.
 *
 * @param html - HTML content containing volume data
 * @param totalChapters - Total number of chapters
 * @param totalVolumes - Total number of volumes
 * @returns Map of volume numbers to volume information
 */
function extractVolumeInfo(
  html: string,
  totalChapters: number,
  totalVolumes: number,
  hints?: ChapterListFormatHints,
  pageHints?: PageStructureHints
): Map<number, VolumeInfo> {
  const volumeInfo = new Map<number, VolumeInfo>();

  if (totalVolumes === 0) {
    return volumeInfo;
  }

  logger.info(`[WIKIPEDIA] Found ${totalVolumes} volume markers`);

  // Use detected prefix instead of hardcoded config (fixes id="Volume_N" pages)
  const prefix = pageHints?.volumeIdPrefix ?? patternConfig.volumeIdPrefix;

  // Calculate approximate chapters per volume (fallback)
  const chaptersPerVolume = Math.ceil(totalChapters / totalVolumes);

  // Assign chapters to volumes using full section extraction
  let chapterIndex = 0;

  for (let volNum = 1; volNum <= totalVolumes; volNum++) {
    const startIdx = chapterIndex;
    const endIdx = Math.min(chapterIndex + chaptersPerVolume, totalChapters);

    // Extract full volume section (from marker to next volume marker)
    const fullSection = extractFullVolumeSection(html, volNum, totalVolumes, prefix);
    const chapterCount = fullSection ? countChaptersInSection(fullSection, hints) : 0;

    if (fullSection && chapterCount > 0) {
      volumeInfo.set(volNum, buildVolumeInfo(startIdx, startIdx + chapterCount, fullSection));
      chapterIndex += chapterCount;
    } else if (fullSection) {
      volumeInfo.set(volNum, buildVolumeInfo(startIdx, endIdx, fullSection));
      chapterIndex = endIdx;
    } else {
      volumeInfo.set(volNum, { start: startIdx, end: endIdx });
      chapterIndex = endIdx;
    }
  }

  return volumeInfo;
}

