/**
 * List-Based Chapter Parser
 *
 * Parses chapters from structured lists (ul/ol) on ComicVine pages.
 * Extracted from: scrapingService.ts (lines 209-392)
 *
 * @module list-parser
 */

import { logger } from '@/utils/logger';

import { LIST_SELECTORS } from './constants';
import { romanToArabic } from './utils';

import type { ComicVineChapter } from './types';
import type { CheerioAPI } from 'cheerio';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Clean chapter title by removing common parsing artifacts
 */
function cleanChapterTitle(title: string): string {
  let cleaned = title.trim();

  // Remove leading "Chapter:" that got included in title
  cleaned = cleaned.replace(/^Chapter:\s*/i, '');

  // Remove trailing concatenated words from next chapter (e.g., "Final BattleThe" -> "Final Battle")
  // These happen when HTML whitespace isn't properly handled
  cleaned = cleaned.replace(/([a-z])([A-Z][a-z]+)$/, '$1');

  // Remove trailing "The" or "A" that look like article leftovers
  cleaned = cleaned.replace(/\s+(The|A)$/, '');

  return cleaned.trim();
}

/**
 * Parse a single list item text into a chapter object
 * Complexity reduced by extracting from main parsing loop
 */
// eslint-disable-next-line complexity -- Chapter text parsing with multiple format handlers (Roman numerals, special chapters, volume patterns)
function parseListItemText(text: string): ComicVineChapter | null {
  // Check for special chapters first (Chapter 0, Prologue, etc.)
  const chapter0 = parseChapter0(text);
  if (chapter0) return chapter0;

  // Check for "Chapter" prefix with Roman numerals
  const chapterRomanMatch = text.match(/^Chapter\s+([IVXLCDM]+)[:\s]+(.+)/i);
  if (chapterRomanMatch?.[1] && chapterRomanMatch[2]) {
    return parseRomanChapter(chapterRomanMatch[1], chapterRomanMatch[2]);
  }

  // Check for "Chapter" prefix with Arabic numbers
  const chapterArabicMatch = text.match(/^Chapter\s+(\d+)[:\s]+(.+)/i);
  if (chapterArabicMatch?.[1] && chapterArabicMatch[2]) {
    const [, num, title] = chapterArabicMatch;
    const cleanedTitle = cleanChapterTitle(title);

    // Handle "Evil" bonus chapters (Dorohedoro uses these as omake)
    if (cleanedTitle.toLowerCase() === 'evil') {
      logger.info(`[ComicVine Scraper] Found Evil bonus chapter: ${num}`);
      return { number: `${num}-bonus`, title: cleanedTitle, prefix: 'Chapter', isSpecial: true };
    }

    logger.info(`[ComicVine Scraper] Found chapter from list: ${num}: ${cleanedTitle}`);
    return { number: num, title: cleanedTitle, prefix: 'Chapter' };
  }

  // Check for "Spell" pattern with Arabic numbers (Dorohedoro uses "Spell 1: Caiman", etc.)
  const spellMatch = text.match(/^Spell\s+(\d+)[:\s]+(.+)/i);
  if (spellMatch?.[1] && spellMatch[2]) {
    const [, num, title] = spellMatch;
    const cleanedTitle = cleanChapterTitle(title);

    // Handle "Evil" bonus chapters in Spell format (Dorohedoro bonus chapters)
    if (cleanedTitle.toLowerCase() === 'evil') {
      logger.info(`[ComicVine Scraper] Found Spell Evil bonus chapter: ${num}`);
      return { number: `${num}-bonus`, title: cleanedTitle, prefix: 'Spell', isSpecial: true };
    }

    logger.info(`[ComicVine Scraper] Found Spell chapter from list: ${num}: ${cleanedTitle}`);
    return { number: num, title: cleanedTitle, prefix: 'Spell' };
  }

  // Check for "Spell" pattern with Roman numerals (e.g., "Spell CLXVI: Final Battle")
  const spellRomanMatch = text.match(/^Spell\s+([IVXLCDM]+)[:\s]+(.+)/i);
  if (spellRomanMatch?.[1] && spellRomanMatch[2]) {
    const romanNumeral = spellRomanMatch[1].toUpperCase();
    const chapterNumber = String(romanToArabic(romanNumeral));
    const cleanedTitle = cleanChapterTitle(spellRomanMatch[2]);

    // Handle "Evil" bonus chapters
    if (cleanedTitle.toLowerCase() === 'evil') {
      logger.info(`[ComicVine Scraper] Found Spell Evil bonus chapter: ${chapterNumber}`);
      return { number: `${chapterNumber}-bonus`, title: cleanedTitle, prefix: 'Spell', romanNumeral, isSpecial: true };
    }

    logger.info(`[ComicVine Scraper] Found Spell chapter from list: ${chapterNumber} (${romanNumeral}): ${cleanedTitle}`);
    return { number: chapterNumber, title: cleanedTitle, prefix: 'Spell', romanNumeral };
  }

  // Check for "Extra Evil" pattern (Dorohedoro uses this as bonus at end of volumes)
  const extraEvilMatch = text.match(/^Extra\s+Evil$/i);
  if (extraEvilMatch) {
    logger.info('[ComicVine Scraper] Found Extra Evil bonus chapter');
    return { number: 'extra-evil', title: 'Evil', prefix: 'Extra', isSpecial: true };
  }

  // Check for Final Chapter
  const finalChapter = parseFinalChapter(text);
  if (finalChapter) return finalChapter;

  // Check for Epilogue chapters
  const epilogueMatch =
    text.match(/^Epilogue(?:\s+(\d+))?[:\s]+(.+)/i) ??
    text.match(/^(?:Afterword|Aftermath|Extra Chapter|Bonus Chapter)(?:\s+(\d+))?[:\s]+(.+)/i);
  if (epilogueMatch) {
    return parseEpilogueChapter(epilogueMatch);
  }

  // Check for side stories or special chapters
  const specialChapter = parseSpecialChapter(text);
  if (specialChapter) return specialChapter;

  // Try plain Roman numeral pattern
  const romanMatch = text.match(/^([IVXLCDM]+)[:\s]+(.+)/i);
  if (romanMatch?.[1] && romanMatch[2]) {
    return parseRomanChapter(romanMatch[1], romanMatch[2]);
  }

  // Try generic "labeled chapter" pattern (Number/Tale/No./Page/Episode/Story/Section)
  const labeled = parseLabeledChapter(text);
  if (labeled) return labeled;

  // Try regular number pattern
  return parseNumberedChapter(text);
}

/**
 * Parse a "labeled chapter" line where different manga use different prefixes:
 *   Naruto:       "Number 1: Uzumaki Naruto!"
 *   Dragon Ball:  "Tale 001. Bloomers and the Monkey King"
 *   My Hero Aca:  "No. 1: Izuku Midoriya: Origin"
 *   Black Clover: "Page 1: The Boy's Vow"
 *   (Generic):    "Episode 1:" / "Story 1:" / "Section 1:"
 *
 * Strips leading zeros from the number ("001" → "1") so spinoff/reprint
 * volumes don't trip the bare-number parser.
 */
function parseLabeledChapter(text: string): ComicVineChapter | null {
  const match = text.match(/^(?:Number|Tale|No\.?|Episode|Story|Section|Page)\s+(\d+)\s*[.:\s]\s*(.+)/i);
  if (!match?.[1] || !match[2]) return null;
  const num = String(parseInt(match[1], 10));
  const cleanedTitle = cleanChapterTitle(match[2]);
  logger.info(`[ComicVine Scraper] Found chapter from list: ${num}: ${cleanedTitle}`);
  return { number: num, title: cleanedTitle };
}

/**
 * Parse Chapter 0 patterns including Volume 0 prequel format (Chapter 0-1, 000-1, etc.)
 */
function parseChapter0(text: string): ComicVineChapter | null {
  // Special handling for Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1, 0.2, etc.
  // Must be checked FIRST since "Chapter 0-1" would otherwise match "Chapter 0"
  const zeroChapterPatterns = [
    /^Chapter\s*0+-(\d+)[:\s]+(.+)/i,   // Chapter 0-1: Title → 0.1
    /^0+-(\d+)[:\s]+(.+)/i,             // 000-1: Title → 0.1
    /^Chapter\s*0+-(\d+)$/i,            // Chapter 0-1 (no title) → 0.1
    /^0+-(\d+)$/i,                       // 000-1 (no title) → 0.1
  ];
  for (const pattern of zeroChapterPatterns) {
    const zeroMatch = text.match(pattern);
    if (zeroMatch?.[1]) {
      const subChapter = zeroMatch[1];
      const title = zeroMatch[2]?.trim() ?? `Chapter 0-${subChapter}`;
      const chapterNumber = `0.${subChapter}`;
      logger.info(`[ComicVine Scraper] Found Chapter 0-${subChapter} from list: ${title}`);
      return { number: chapterNumber, title };
    }
  }

  // Standard Chapter 0 patterns
  const match =
    text.match(/^Chapter\s+0[:\s]+(.+)/i) ??
    text.match(/^(?:Prologue|Chapter Zero|Ch\.?\s*0)[:\s]+(.+)/i);

  if (match?.[1]) {
    const title = match[1];
    logger.info(`[ComicVine Scraper] Found Chapter 0 from list: ${title.trim()}`);
    return { number: '0', title: title.trim() };
  }
  return null;
}

/**
 * Parse Final Chapter patterns
 */
function parseFinalChapter(text: string): ComicVineChapter | null {
  // Handle "The Final Chapter: Title" pattern (e.g., "The Final Chapter: All-Star Sayonara")
  const theFinalMatch = text.match(/^The\s+Final\s+Chapter[:\s]+(.+)/i);
  if (theFinalMatch?.[1]) {
    const cleanedTitle = cleanChapterTitle(theFinalMatch[1]);
    logger.info(`[ComicVine Scraper] Found The Final Chapter from list: ${cleanedTitle}`);
    return { number: 'final', title: cleanedTitle, prefix: 'Chapter', isFinalChapter: true };
  }

  // Handle "Final Chapter: Title" or similar patterns
  const match = text.match(/^(?:Final Chapter|Last Chapter|Ultimate Chapter|Final)[:\s]+(.+)/i);
  if (match?.[1]) {
    const cleanedTitle = cleanChapterTitle(match[1]);
    logger.info(`[ComicVine Scraper] Found Final Chapter from list: ${cleanedTitle}`);
    return { number: 'final', title: cleanedTitle, prefix: 'Chapter', isFinalChapter: true };
  }
  return null;
}

/**
 * Parse Special Chapter patterns
 */
function parseSpecialChapter(text: string): ComicVineChapter | null {
  // Handle "Special Chapter: Title" pattern (e.g., "Special Chapter: The Lizard Head and the Magic Whistle")
  const specialChapterMatch = text.match(/^Special\s+Chapter[:\s]+(.+)/i);
  if (specialChapterMatch?.[1]) {
    const title = specialChapterMatch[1].trim();
    logger.info(`[ComicVine Scraper] Found Special Chapter from list: ${title}`);
    return {
      number: 'special',
      title,
      prefix: 'Special',
      isSpecial: true,
    };
  }

  // Handle other special patterns (Side Story, Extra, Omake, Bonus)
  const match = text.match(/^(?:Side Story|Extra|Omake|Bonus)(?:\s+(\d+))?[:\s]+(.+)/i);
  if (match) {
    const [, num, title] = match;
    const specialNumber = num ?? 'special';
    logger.info(`[ComicVine Scraper] Found Special Chapter from list: ${title?.trim()}`);
    return {
      number: `special-${specialNumber}`,
      title: title?.trim() ?? 'Special Chapter',
      prefix: 'Special',
      isSpecial: true,
    };
  }
  return null;
}

/**
 * Parse numbered chapter patterns
 */
function parseNumberedChapter(text: string): ComicVineChapter | null {
  const match = text.match(/^(\d+)[:\s]+(.+)/);
  if (match?.[1] && match[2]) {
    const [, num, title] = match;
    const trimmedTitle = title.trim();

    // Handle "Evil" bonus chapters (Dorohedoro uses these as omake at end of volumes)
    // These should be treated as special chapters, not main chapters
    if (trimmedTitle.toLowerCase() === 'evil') {
      logger.info(`[ComicVine Scraper] Found Evil bonus chapter: ${num}`);
      return { number: `${num}-bonus`, title: trimmedTitle, isSpecial: true };
    }

    logger.info(`[ComicVine Scraper] Found chapter from list: ${num}: ${trimmedTitle}`);
    return { number: num, title: trimmedTitle };
  }
  return null;
}

/**
 * Parse chapter with Roman numeral
 */
function parseRomanChapter(romanNum: string, title: string): ComicVineChapter {
  const romanNumeral = romanNum.toUpperCase();
  let chapterNumber = String(romanToArabic(romanNumeral));
  const cleanedTitle = cleanChapterTitle(title);

  // Fix known ComicVine data error: Fire Force Volume 33 Chapter 295 mislabeled as 315
  if (chapterNumber === '315' && cleanedTitle.includes('Here To Save The Day')) {
    logger.warn(`[ComicVine Scraper] Correcting mislabeled chapter: 315 -> 295 for "${cleanedTitle}"`);
    chapterNumber = '295';
  }

  // Handle "Evil" bonus chapters
  if (cleanedTitle.toLowerCase() === 'evil') {
    logger.info(`[ComicVine Scraper] Found Evil bonus chapter: ${chapterNumber}`);
    return { number: `${chapterNumber}-bonus`, title: cleanedTitle, prefix: 'Chapter', romanNumeral, isSpecial: true };
  }

  logger.info(`[ComicVine Scraper] Found chapter from list: ${chapterNumber} (${romanNumeral}): ${cleanedTitle}`);
  return { number: chapterNumber, title: cleanedTitle, prefix: 'Chapter', romanNumeral };
}

/**
 * Parse epilogue chapter from match result
 */
function parseEpilogueChapter(match: RegExpMatchArray): ComicVineChapter {
  const [fullMatch, epilogueNum, titleWithNum, titleWithoutNum] = match;
  const title = (titleWithNum ?? titleWithoutNum ?? fullMatch.split(':')[1]?.trim()) ?? 'Epilogue';
  const epilogueNumber = epilogueNum ? parseInt(epilogueNum) : 1;

  logger.info(`[ComicVine Scraper] Found Epilogue ${epilogueNumber} from list: ${title.trim()}`);

  return {
    number: `epilogue-${epilogueNumber}`,
    title: title.trim(),
    isEpilogue: true,
    epilogueNumber,
  };
}

/**
 * Parse chapters from a "Chapter Titles" section
 */
function parseChapterTitlesSection($: CheerioAPI): ComicVineChapter[] {
  const chapters: ComicVineChapter[] = [];

  // Try multiple heading selectors for chapter sections
  const headingSelectors = [
    'h2:contains("Chapter Titles")',
    'h2:contains("Chapters")',
    'h3:contains("Chapter Titles")',
    'h3:contains("Chapters")',
    'h2:contains("Chapter List")',
    'h2:contains("Episodes")',
    'h2:contains("Contents")',
  ];

  let section = $();
  for (const selector of headingSelectors) {
    section = $(selector).first();
    if (section.length > 0) break;
  }
  if (section.length === 0) return chapters;

  logger.info(`[ComicVine Scraper] Found chapter section: "${section.text().trim()}"`);
  const chapterList = section.nextAll('ul, ol').first();
  if (chapterList.length === 0) return chapters;

  const listItems = chapterList.find('li');
  logger.info(`[ComicVine Scraper] Found ${listItems.length} chapters in Chapter Titles list`);

  listItems.each((_, element) => {
    const chapter = parseListItemText($(element).text().trim());
    if (chapter) chapters.push(chapter);
  });

  return chapters;
}

/**
 * Parse chapters from generic list selectors
 */
function parseFromListSelectors($: CheerioAPI): ComicVineChapter[] {
  const chapters: ComicVineChapter[] = [];

  for (const selector of LIST_SELECTORS) {
    const elements = $(selector);
    if (elements.length === 0) continue;

    logger.info(`[ComicVine Scraper] Found ${elements.length} items with selector: ${selector}`);
    elements.each((_, element) => {
      const chapter = parseListItemText($(element).text().trim());
      if (chapter) chapters.push(chapter);
    });

     
    if (chapters.length > 0) break;
  }

  return chapters;
}

/**
 * Parse chapters from structured lists (ul/ol elements)
 *
 * @param $ - Cheerio instance loaded with the page HTML
 * @returns Array of chapters found in list structures
 */
export function parseChaptersFromLists($: CheerioAPI): ComicVineChapter[] {
  // Method 1: Look for explicit "Chapter Titles" section
  const fromSection = parseChapterTitlesSection($);
  if (fromSection.length > 0) return fromSection;

  // Method 2: Fall back to generic list selectors
  return parseFromListSelectors($);
}

/**
 * Iter 16: Parse chapters directly from a ComicVine issue's `description`
 * field returned by the REST API. The API description for many series
 * (One Piece, Naruto, Berserk, Black Clover, JoJo Phantom Blood, ...)
 * already contains an embedded `<h2>Chapter Titles</h2><ul><li>...</li></ul>`
 * fragment. Loading it via cheerio + reusing parseChaptersFromLists lets
 * the runner skip the entire FlareSolverr/Cloudflare bypass path for those
 * series — fast, reliable, no rate limits.
 *
 * Returns [] if the description is empty or has no chapter markup.
 */
export function parseChaptersFromIssueDescription(
  description: string | null | undefined,
  cheerioLoad: (html: string) => CheerioAPI,
): ComicVineChapter[] {
  if (!description || description.length === 0) return [];
  if (!description.includes('Chapter Titles') && !description.includes('<ul')) return [];
  try {
    const $ = cheerioLoad(`<html><body>${description}</body></html>`);
    return parseChaptersFromLists($);
  } catch {
    return [];
  }
}
