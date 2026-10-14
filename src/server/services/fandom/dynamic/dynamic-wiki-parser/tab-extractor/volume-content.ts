/**
 * Dynamic Wiki Parser - Volume Content
 *
 * Reads one volume's chapters, cover, ISBN and release date out of a block of
 * page content (a volume-labelled tab panel, or the rows under a volume
 * heading). Used by the labelled-tab and heading fallbacks, which run only
 * when the page has no volume bands.
 *
 * @module dynamic-wiki-parser/tab-extractor/volume-content
 */

import { extractImageUrl } from '../utils';

import type { ChapterData, VolumeData } from '../types';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

const CHAPTER_LINK = 'a[href*="Chapter"], a[href*="chapter"]';
const CHAPTER_HREF = /\/wiki\/Chapter[_ ](\d+(?:\.\d+)?)(?:$|[#?])/i;
const TEXT_NUMBER = /^\s*(?:Ch(?:apter)?\.?\s*)?(\d+(?:\.\d+)?)\b/i;
/** "Chapter 12", "Chapter 12 -", "12." at the start of a title. */
/** "April 13, 2021" — a month name, so "Volume 1May 1, 2020" in run-together cell text reads as May 1. */
const RELEASE_DATE = /(?<![A-Za-z])((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/;
const TITLE_PREFIX =/^\s*(?:Chapter\s*)?\d+(?:\.\d+)?\s*[.:\-–—|]?\s*/i;

/** Chapter number from a chapter link: the page name first, then the link text. */
function chapterNumber(href: string, text: string): string | null {
  const fromHref = CHAPTER_HREF.exec(href)?.[1];
  if (fromHref !== undefined) return fromHref;
  // "/wiki/Chapters_and_Volumes/Volume_11-20" is a list page, not a chapter.
  if (/Chapters/i.test(href)) return null;
  return TEXT_NUMBER.exec(text)?.[1] ?? null;
}

/**
 * The chapter's own title. A list item reading "Chapter 1 - Call of the Night"
 * gives "Call of the Night"; a bare "Chapter 1" falls back to "Chapter 1".
 */
function chapterTitle($link: Cheerio<AnyNode>, number: string): string {
  const linkText = $link.text().replace(/\s+/g, ' ').trim();
  const $own = $link.closest('li, td').clone();
  $own.find('ul, ol').remove();
  // Only an item naming this one chapter carries its title beside the link.
  const text = $own.find(CHAPTER_LINK).length === 1 ? $own.text() : linkText;
  const title = text.replace(/\s+/g, ' ').trim().replace(TITLE_PREFIX, '').replace(/^["“]|["”]$/g, '').trim();
  if (title && title.length <= 200 && !/^Chapter\s*\d/i.test(title)) return title;
  return linkText || `Chapter ${number}`;
}

/** Appends the chapters linked inside `$scope` that the volume does not hold yet. */
export function collectChapterLinks(
  $: CheerioAPI,
  $scope: Cheerio<AnyNode>,
  volumeNumber: number,
  chapters: ChapterData[],
): void {
  $scope.find(CHAPTER_LINK).each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href') ?? '';
    const number = chapterNumber(href, $link.text());
    if (number === null || chapters.some(c => c.number === number)) return;
    const chapter: ChapterData = { number, title: chapterTitle($link, number), volume: volumeNumber };
    if (href) chapter.url = href;
    chapters.push(chapter);
  });
}

export type VolumeDetails = Pick<VolumeData, 'coverImage' | 'isbn' | 'releaseDate'>;

/** Cover, ISBN and release date found in a block of volume content. */
export function volumeDetails($content: Cheerio<AnyNode>): VolumeDetails {
  const details: VolumeDetails = {};
  const coverImg = $content.find('img').first();
  const cover = coverImg.length > 0 ? extractImageUrl(coverImg) : undefined;
  if (cover !== undefined) details.coverImage = cover;
  const text = $content.text();
  const isbn = /ISBN[:\s]*([\d-]+)/i.exec(text)?.[1];
  if (isbn !== undefined) details.isbn = isbn;
  const date = RELEASE_DATE.exec(text)?.[1];
  if (date !== undefined) details.releaseDate = date;
  return details;
}

/**
 * Extract one volume from a content section. Returns null when the section
 * links no chapters.
 */
export function extractVolumeDataFromContent(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  volumeNumber: number,
  title: string,
): VolumeData | null {
  const chapters: ChapterData[] = [];
  collectChapterLinks($, $content, volumeNumber, chapters);
  if (chapters.length === 0) return null;
  return { number: volumeNumber, title: title || `Volume ${volumeNumber}`, chapters, ...volumeDetails($content) };
}
