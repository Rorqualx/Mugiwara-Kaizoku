/**
 * Paragraph Link Parser
 *
 * Parses chapter data from wikis that list chapters as links in paragraph elements.
 * Used for wikis like Erased (Boku Machi) where chapters are listed as:
 * <p>
 *   <a href="/wiki/01._Flashback:_May_2006">01. Flashback: May 2006</a><br/>
 *   <a href="/wiki/02._Death_Row_Prisoner:_May_2006">02. Death Row Prisoner: May 2006</a>
 *   ...
 * </p>
 *
 * @module paragraph-link-parser
 */

import { load, type CheerioAPI, type Cheerio } from 'cheerio';

import { extractChapterNumberFromText } from '@/server/parsers/chapter-number-extractor';
import type { ChapterData, VolumeData } from '@/server/services/metadata/utils/fandom-table-parser/fandom-types';
import { logger } from '@/utils/logger';

import type { Element } from 'domhandler';

/**
 * Result from paragraph link parsing
 */
export interface ParagraphLinkParseResult {
  success: boolean;
  volumes: VolumeData[];
  chapters: ChapterData[];
  chapterLinksFound: number;
  volumeSectionsFound: number;
}

/**
 * Extracts chapter number from chapter title/link text.
 * Delegates to the shared extractor (prequel "Chapter 0-N"/"000-N" →
 * "NN. Title" dot format → "Chapter N" → leading number).
 */
function extractChapterNumber(text: string): number | null {
  return extractChapterNumberFromText(text);
}

/**
 * Extracts chapter title from link text, removing the chapter number prefix.
 */
function extractChapterTitle(text: string): string {
  const dotMatch = text.match(/^\d+(?:\.\d+)?\.\s*(.+)/);
  if (dotMatch?.[1]) return dotMatch[1].trim();

  const chapterMatch = text.match(/Chapter\s+\d+(?:\.\d+)?:?\s*(.+)/i);
  if (chapterMatch?.[1]) return chapterMatch[1].trim();

  return text.trim();
}

/**
 * Checks if a link looks like a chapter link.
 */
function isChapterLink(href: string, text: string): boolean {
  if (href.includes('Category:') || href.includes('Special:') || href.includes('#')) {
    return false;
  }

  if (/^\d+\./.test(text) || /Chapter\s+\d+/i.test(text)) return true;
  if (/\/wiki\/\d+\.?_/.test(href) || /Chapter_\d+/i.test(href)) return true;
  if (/Gaiden/i.test(text) || /Gaiden/i.test(href)) return true;

  return false;
}

/**
 * Builds chapter URL from href.
 */
function buildChapterUrl(href: string, baseUrl?: string): string | undefined {
  if (href.startsWith('/wiki/')) {
    return baseUrl ? `${baseUrl}${href}` : href;
  }
  if (href.startsWith('http')) return href;
  return undefined;
}

/**
 * Creates a ChapterData from link information.
 */
function createChapterFromLink(
  href: string,
  text: string,
  volumeNumber?: number,
  baseUrl?: string
): ChapterData | null {
  const number = extractChapterNumber(text);
  if (number === null) return null;

  const chapter: ChapterData = {
    number,
    title: extractChapterTitle(text),
  };

  const url = buildChapterUrl(href, baseUrl);
  if (url) chapter.url = url;
  if (volumeNumber !== undefined) chapter.volume = volumeNumber;

  return chapter;
}

/**
 * Detects volume sections from headers.
 */
function detectVolumeSections(
  $: CheerioAPI
): Array<{ number: number; element: Cheerio<Element>; title?: string; coverImage?: string }> {
  const volumes: Array<{ number: number; element: Cheerio<Element>; title?: string; coverImage?: string }> = [];

  $('h2, h3, h4').each((_, header) => {
    const $header = $(header);
    const text = $header.text().trim();
    const volMatch = text.match(/Vol(?:ume)?\.?\s*(\d+)/i);

    if (!volMatch?.[1]) return;

    const volNum = parseInt(volMatch[1], 10);
    const $nextImg = $header.nextAll('figure, .thumb').first().find('img');
    const coverImage = $nextImg.attr('src') ?? $nextImg.attr('data-src');

    const entry: { number: number; element: Cheerio<Element>; title?: string; coverImage?: string } = {
      number: volNum,
      element: $header,
      title: text,
    };
    if (coverImage) entry.coverImage = coverImage;
    volumes.push(entry);
  });

  return volumes;
}

/**
 * Parses chapter links from a section between two headers.
 */
function parseChapterLinksFromSection(
  $: CheerioAPI,
  startElement: Cheerio<Element>,
  endElement: Cheerio<Element> | null,
  volumeNumber?: number
): ChapterData[] {
  const chapters: ChapterData[] = [];
  let current = startElement.next();

  while (current.length > 0) {
    if (endElement && current.is(endElement)) break;
    if (current.is('h2, h3, h4')) break;

    current.find('a').addBack('a').each((_, link) => {
      const $link = $(link);
      const href = $link.attr('href') ?? '';
      const text = $link.text().trim();

      if (!isChapterLink(href, text)) return;

      const chapter = createChapterFromLink(href, text, volumeNumber);
      if (chapter) chapters.push(chapter);
    });

    current = current.next();
  }

  return chapters;
}

/**
 * Parses chapters from volume sections.
 */
function parseChaptersFromVolumeSections(
  $: CheerioAPI,
  volumeSections: Array<{ number: number; element: Cheerio<Element>; title?: string; coverImage?: string }>
): { volumes: VolumeData[]; chapters: ChapterData[] } {
  const volumes: VolumeData[] = [];
  const chapters: ChapterData[] = [];

  for (let i = 0; i < volumeSections.length; i++) {
    const volSection = volumeSections[i];
    if (!volSection) continue;

    const nextSection = volumeSections[i + 1];
    const sectionChapters = parseChapterLinksFromSection($, volSection.element, nextSection?.element ?? null, volSection.number);

    const vol: VolumeData = { number: volSection.number, chapters: sectionChapters };
    if (volSection.title) vol.title = volSection.title;
    if (volSection.coverImage) vol.coverImage = volSection.coverImage;
    volumes.push(vol);

    chapters.push(...sectionChapters);
  }

  return { volumes, chapters };
}

/**
 * Parses all chapter links from page without volume sections.
 */
function parseAllChapterLinks($: CheerioAPI, baseUrl?: string): ChapterData[] {
  const chapters: ChapterData[] = [];

  $('p a, .mw-parser-output a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    if (!isChapterLink(href, text)) return;

    const chapter = createChapterFromLink(href, text, undefined, baseUrl);
    if (chapter) chapters.push(chapter);
  });

  return chapters;
}

/**
 * Deduplicates and sorts chapters.
 */
function deduplicateAndSortChapters(chapters: ChapterData[]): ChapterData[] {
  const seenNumbers = new Set<number>();
  const unique = chapters.filter((ch) => {
    if (seenNumbers.has(ch.number)) return false;
    seenNumbers.add(ch.number);
    return true;
  });
  return unique.sort((a, b) => a.number - b.number);
}

/**
 * Detects if a page uses paragraph link structure.
 */
export function isParagraphLinkStructure(html: string): boolean {
  const $ = load(html);
  let chapterLinkCount = 0;

  $('p a, .mw-parser-output a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();
    if (isChapterLink(href, text)) chapterLinkCount++;
  });

  return chapterLinkCount >= 10;
}

/**
 * Parses chapter and volume data from paragraph link structure.
 */
export function parseParagraphLinkStructure(html: string, baseUrl?: string): ParagraphLinkParseResult {
  const $ = load(html);
  const volumeSections = detectVolumeSections($);

  let volumes: VolumeData[] = [];
  let chapters: ChapterData[] = [];

  if (volumeSections.length > 0) {
    const result = parseChaptersFromVolumeSections($, volumeSections);
    volumes = result.volumes;
    chapters = result.chapters;
  } else {
    chapters = parseAllChapterLinks($, baseUrl);
  }

  const uniqueChapters = deduplicateAndSortChapters(chapters);

  logger.info(`[paragraph-link-parser] Found ${uniqueChapters.length} chapters, ${volumes.length} volumes`);

  return {
    success: uniqueChapters.length > 0,
    volumes,
    chapters: uniqueChapters,
    chapterLinksFound: uniqueChapters.length,
    volumeSectionsFound: volumes.length,
  };
}

/**
 * Enhanced parser that also extracts gaiden/special chapters.
 */
export function parseParagraphLinkStructureEnhanced(html: string, baseUrl?: string): ParagraphLinkParseResult {
  const baseResult = parseParagraphLinkStructure(html, baseUrl);
  const $ = load(html);
  const gaidenChapters: ChapterData[] = [];
  let gaidenStartNumber = 1000;

  $('a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    if (!/Gaiden/i.test(text) && !/Gaiden/i.test(href)) return;

    const gaidenMatch = text.match(/Gaiden\s*(?:Chapter\s*)?(\d+)/i);
    const gaidenNum = gaidenMatch?.[1] ? parseInt(gaidenMatch[1], 10) : gaidenStartNumber++;

    const exists = baseResult.chapters.some((ch) => ch.url === href || (ch.title?.includes('Gaiden') && ch.number === gaidenNum));
    if (exists) return;

    const gaidenChapter: ChapterData = { number: gaidenNum, title: text };
    const url = buildChapterUrl(href, baseUrl);
    if (url) gaidenChapter.url = url;
    gaidenChapters.push(gaidenChapter);
  });

  const allChapters = [...baseResult.chapters, ...gaidenChapters];

  return { ...baseResult, chapters: allChapters, chapterLinksFound: allChapters.length };
}
