/**
 * Chapters read volume by volume from a "Graphic novel list" table.
 *
 * Wikipedia's chapter-list pages render each volume as a header row carrying
 * `id="volN"`, followed by a row holding that volume's chapter list. Reading
 * the list under each header gives every chapter its volume directly. The
 * other parsers file chapters by counting matches through the page, and one
 * missed or extra item shifts every later volume:
 *
 * - Naruto (Part I): each list is `<ol><li class="mw-empty-elt"></li><li value="18">…`.
 *   The page was routed to the zero-indexed parser, which estimated nine
 *   chapters per volume — volume 4 came out 27-35 instead of 28-36 — and the
 *   Part II pages put all of their chapters in volume 1.
 * - Black Lagoon: items are `<ul><li>05: "Title"</li>` with unnumbered omake
 *   items between them, and two spin-offs follow on the same page with their
 *   own volume 1, 2, ….
 *
 * Numbering: an `<ol>` item takes the list's `start` (or 1), the item's
 * `value` renumbers it, and each item after it counts on; hidden empty items
 * (`mw-empty-elt`) take no number. A `<ul>` item is numbered only by a leading
 * number ("05:", "12.", "Chapter 7:"); items without one (omake, extras) are
 * skipped.
 */

import * as cheerio from 'cheerio';

import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { cleanChapterTitle } from '@/server/services/wikipedia/wikipedia/utils';

import { quotedItemTitle } from './list-items';

import type { AnyNode } from 'domhandler';

const VOLUME_ID = /^vol(\d+)$/;
/**
 * "05: ", "12. ", "Chapter 7: ", "Ch. 7 - " at the start of an unordered item.
 * The separator must be followed by a space, so "4-koma Special" (Blue
 * Exorcist's extra under volume 2) is not read as chapter 4.
 */
const LEADING_NUMBER = /^\s*(?:(?:chapter|ch\.?|#|no\.?)\s*)?(\d{1,4}(?:\.\d+)?)\s*(?::|\.|\s[-–—])\s/i;

/** A volume header found on the page, with the chapters listed under it. */
interface VolumeSection {
  volume: number;
  chapters: WikipediaChapter[];
}

type CheerioRoot = cheerio.CheerioAPI;

/** The id-carrying header rows (`id="volN"` on the row or a cell of it), in page order. */
function volumeHeaderRows($: CheerioRoot): Array<{ volume: number; row: AnyNode }> {
  const out: Array<{ volume: number; row: AnyNode }> = [];
  const seen = new Set<AnyNode>();
  $('[id]').each((_, el) => {
    const match = VOLUME_ID.exec($(el).attr('id') ?? '');
    if (!match?.[1]) return;
    const row = $(el).is('tr') ? el : $(el).closest('tr').get(0);
    if (!row || seen.has(row)) return;
    seen.add(row);
    out.push({ volume: parseInt(match[1], 10), row });
  });
  return out;
}

/** Whether a row is itself a volume header. */
function isHeaderRow($: CheerioRoot, row: AnyNode): boolean {
  const $row = $(row);
  if (VOLUME_ID.test($row.attr('id') ?? '')) return true;
  return $row.children('th, td').toArray().some(cell => VOLUME_ID.test($(cell).attr('id') ?? ''));
}

/** Number and title the items of one list. */
function readList($: CheerioRoot, list: AnyNode): WikipediaChapter[] {
  const $list = $(list);
  const ordered = $list.is('ol');
  let next = ordered ? parseInt($list.attr('start') ?? '1', 10) : NaN;
  const chapters: WikipediaChapter[] = [];
  $list.children('li').each((_, li) => {
    const $li = $(li);
    if ($li.hasClass('mw-empty-elt')) return;
    const html = $li.html() ?? '';
    let number: number;
    if (ordered) {
      const value = parseInt($li.attr('value') ?? '', 10);
      number = Number.isNaN(value) ? next : value;
      next = number + 1;
    } else {
      const leading = LEADING_NUMBER.exec($li.clone().children('ul, ol').remove().end().text());
      if (!leading?.[1]) return;
      number = parseFloat(leading[1]);
    }
    if (!(number > 0 || (number === 0 && !ordered))) return;
    const title = quotedItemTitle(html);
    chapters.push({ number, ...(title ? { title: cleanChapterTitle(title) } : {}) });
  });
  return chapters;
}

/** The chapters listed in the rows after a header, up to the next header. */
function sectionChapters($: CheerioRoot, header: AnyNode): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];
  let row = $(header).next('tr').get(0);
  while (row && !isHeaderRow($, row)) {
    const lists = $(row).find('ol, ul').toArray()
      .filter(list => !$(list).hasClass('references') && $(list).parents('li').length === 0);
    for (const list of lists) chapters.push(...readList($, list));
    row = $(row).next('tr').get(0);
  }
  return chapters;
}

/** The first run of increasing volume numbers: a later table restarting at 1 is another series. */
function firstSeriesRun(sections: VolumeSection[]): VolumeSection[] {
  const run: VolumeSection[] = [];
  for (const s of sections) {
    const last = run[run.length - 1];
    if (last && s.volume <= last.volume) break;
    run.push(s);
  }
  return run;
}

/** Each volume's chapters sit after the previous volume's, as print volumes do. */
function inPrintOrder(sections: VolumeSection[]): boolean {
  let previousMax = -Infinity;
  for (const s of sections) {
    if (s.chapters.length === 0) continue;
    const nums = s.chapters.map(c => Number(c.number));
    if (Math.min(...nums) <= previousMax) return false;
    previousMax = Math.max(...nums);
  }
  return true;
}

/**
 * Chapters with their volumes, read from the volume rows; null when the page
 * has no such table, or its lists do not read as one series' volumes in order
 * (fewer than two volumes with chapters, under half of the volumes with
 * chapters, or a volume's chapters not after the previous volume's).
 */
export function parseVolumeRowChapters(html: string): WikipediaChapter[] | null {
  if (!/id="vol\d+"/.test(html)) return null;
  const $ = cheerio.load(html);
  const sections = firstSeriesRun(
    volumeHeaderRows($).map(({ volume, row }) => ({ volume, chapters: sectionChapters($, row) })),
  );
  const filled = sections.filter(s => s.chapters.length > 0);
  if (filled.length < 2 || filled.length * 2 < sections.length || !inPrintOrder(sections)) return null;

  return sections.flatMap(s => s.chapters.map(c => ({ ...c, volumeNumber: s.volume })));
}
