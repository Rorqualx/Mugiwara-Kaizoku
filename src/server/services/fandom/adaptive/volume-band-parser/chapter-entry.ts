/**
 * Chapter number and title from one list item of a volume band.
 *
 * @module volume-band-parser/chapter-entry
 */

import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';

const CHAPTER_HREF = /\/wiki\/Chapter_(\d+(?:\.\d+)?)(?:$|#)/;
/** "12. Title", "012: Title", "Chapter 12 - Title". A separator is required so "001 Extra" lines in a nested spin-off list are not read as chapters. */
const LEADING_NUMBER = /^\s*(?:Chapter\s*)?(\d{1,4}(?:\.\d)?)\s*[.:\-–]/i;
/** "[[Chapter 1|1. Cruelty]]": the number is in the link text. */
const LINK_TEXT_NUMBER = /^\s*(\d{1,4})\.\s/;
const TITLE_PREFIX = /^\s*(?:Chapter\s*)?\d{1,4}(?:\.\d)?\s*[.:\-–]?\s*/i;

export interface BandChapter {
  number: number;
  title?: string;
  url?: string;
}

/** The chapter a list item names, or null when it carries no chapter number. */
export function readChapterEntry($li: Cheerio<Element>, baseUrl: string): BandChapter | null {
  const $link = $li.find('a').first();
  const href = $link.attr('href') ?? '';
  const number = numberFrom(href, $li.text(), $link.text());
  if (number === null) return null;

  const chapter: BandChapter = { number };
  const title = ($link.text() || $li.text()).replace(TITLE_PREFIX, '').trim();
  if (title && !/^Chapter\s*\d/i.test(title)) chapter.title = title;
  if (href.startsWith('/wiki/')) chapter.url = `${baseUrl}${href}`;
  return chapter;
}

function numberFrom(href: string, itemText: string, linkText: string): number | null {
  const match = CHAPTER_HREF.exec(href) ?? LEADING_NUMBER.exec(itemText) ?? LINK_TEXT_NUMBER.exec(linkText);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
