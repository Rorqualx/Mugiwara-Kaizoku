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
  const title = titleFrom($link.text(), $li.text());
  if (title && !/^Chapter\s*\d/i.test(title)) chapter.title = title;
  if (href.startsWith('/wiki/')) chapter.url = `${baseUrl}${href}`;
  return chapter;
}

/** A trailing Japanese gloss: "Map (地図, Chizu)". */
const JAPANESE_GLOSS = /\s*\([^)]*[\u3040-\u30ff\u4e00-\u9fff][^)]*\)\s*$/;

/**
 * The title from the link text, or, when the link is only "Chapter 2", from
 * the rest of the line ("Chapter 2 - A Pretty Big Mosquito", Call of the
 * Night; "Chapter 2: Map (地図, Chizu)", Kingdom).
 */
function titleFrom(linkText: string, itemText: string): string {
  const fromLink = linkText.replace(TITLE_PREFIX, '').trim();
  const raw = fromLink || itemText.replace(TITLE_PREFIX, '').trim();
  return raw.replace(JAPANESE_GLOSS, '').trim();
}

/**
 * The chapter a bare link names ("1" linking /wiki/Chapter_1 in a navigation
 * box row). Only the link target counts: the text is just the number.
 */
export function readChapterLink($a: Cheerio<Element>, baseUrl: string): BandChapter | null {
  const href = $a.attr('href') ?? '';
  const match = href.startsWith('/wiki/') ? CHAPTER_HREF.exec(href) : null;
  if (!match?.[1]) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0) return null;
  return { number, url: `${baseUrl}${href}` };
}

function numberFrom(href: string, itemText: string, linkText: string): number | null {
  const match = CHAPTER_HREF.exec(href) ?? LEADING_NUMBER.exec(itemText) ?? LINK_TEXT_NUMBER.exec(linkText);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
