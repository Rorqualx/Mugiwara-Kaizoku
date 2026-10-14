/**
 * Volume bands read from navigation-box rows
 *
 * Some series pages carry no chapter list items at all: the volumes are a
 * cover gallery and the chapters appear only in a navigation box, one row per
 * volume — a "Volume 1:" cell, then a cell of bare chapter links
 * ("1 · 2 · 3 …"). Demon Slayer's "Kimetsu no Yaiba (Manga)", Dandadan's and
 * Dr. STONE's "(Manga)" pages and the Jujutsu Kaisen article render this way.
 * Each row is one volume's band; chapter links in other rows of the same box
 * that come after the last volume are chapters not yet collected.
 *
 * Only used when the list-item walk found no valid bands, so a page that
 * already parses from its own list is never changed by its navigation box.
 *
 * @module volume-band-parser/nav-rows
 */

import { isTag } from 'domhandler';

import { readChapterLink, type BandChapter } from './chapter-entry';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

export interface NavRowBands {
  bands: Map<number, BandChapter[]>;
  /** Chapters linked in the same box after the last volume's chapters. */
  unassigned: BandChapter[];
}

/** Chapter links inside an element, each number once, in link order. */
function chapterLinks($: CheerioAPI, $scope: Cheerio<Element>, baseUrl: string): BandChapter[] {
  const out: BandChapter[] = [];
  $scope.find('a[href]').each((_, a) => {
    const chapter = readChapterLink($(a), baseUrl);
    if (chapter && !out.some(c => c.number === chapter.number)) out.push(chapter);
  });
  return out;
}

/**
 * Walks every table row whose cell marks a volume and whose next cell links
 * chapters. `markerOf` is the band parser's volume-cell test.
 */
export function walkNavRows(
  $: CheerioAPI,
  baseUrl: string,
  markerOf: ($cell: Cheerio<Element>) => number | null,
): NavRowBands {
  const bands = new Map<number, BandChapter[]>();
  const tables = new Set<Element>();
  const $output = $('.mw-parser-output');
  const $cells = $output.length > 0 ? $output.first().find('td, th') : $('td, th');

  $cells.each((_, cell) => {
    const $cell = $(cell);
    const volume = markerOf($cell);
    if (volume === null) return;
    const $next = $cell.next('td, th');
    // The marker's own cell may hold nothing but the volume link, and the
    // chapter cell holds no list items (those pages parse through the list walk).
    if ($next.length === 0 || $next.find('li').length > 0) return;
    const chapters = chapterLinks($, $next, baseUrl);
    if (chapters.length === 0) return;
    const band = bands.get(volume) ?? [];
    for (const ch of chapters) if (!band.some(c => c.number === ch.number)) band.push(ch);
    bands.set(volume, band);
    const table = $cell.closest('table').toArray().find(isTag);
    if (table) tables.add(table);
  });

  const banded = new Set([...bands.values()].flat().map(c => c.number));
  const last = banded.size > 0 ? Math.max(...banded) : Infinity;
  const unassigned: BandChapter[] = [];
  for (const table of tables) {
    for (const ch of chapterLinks($, $(table), baseUrl)) {
      if (ch.number > last && !banded.has(ch.number) && !unassigned.some(c => c.number === ch.number)) unassigned.push(ch);
    }
  }
  unassigned.sort((a, b) => a.number - b.number);
  return { bands, unassigned };
}
