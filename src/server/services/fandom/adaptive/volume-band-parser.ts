/**
 * Volume Band Parser for Fandom list pages
 *
 * Reads a rendered "Chapters and Volumes" page in document order: a volume
 * marker opens a band and the chapter list items after it belong to that
 * volume until the next marker, the end of the marker's table, or a section
 * heading. This is the shape every tabbed list page renders to (Call of the
 * Night, My Hero Academia, Dr. STONE, Demon Slayer, Spy x Family, Blue Lock):
 * one shared table where a volume's cover-art tabber row is followed by its
 * chapter row. The older parsers either took the whole table for every volume
 * (each volume claimed all 200 chapters) or paired rows by position and slid
 * one chapter or one volume off.
 *
 * Works on rendered HTML, not wikitext: My Hero Academia and Frieren build
 * their chapter lists with DPL queries, so only the HTML has the numbers.
 *
 * @module volume-band-parser
 */

import { load } from 'cheerio';
import { isTag } from 'domhandler';

import type { ChapterData, VolumeData } from '@/server/services/metadata/utils/fandom-table-parser/fandom-types';
import { logger } from '@/utils/logger';

import { readChapterEntry, type BandChapter } from './volume-band-parser/chapter-entry';
import { walkNavRows } from './volume-band-parser/nav-rows';
import { scopeTabbers } from './volume-band-parser/tabber-scope';
import { rejectReason } from './volume-band-parser/validate';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

const log = logger.child('VolumeBandParser');

const VOLUME_ID = /^Volume_(\d+)$/;
const VOLUME_HEADING = /^\s*Volume\s+(\d+)\b/i;
const VOLUME_CELL = /^Volume\s+(\d+)$/i;
const VOLUME_HREF = /\/wiki\/Volume_(\d+)$/;
/** A marker cell holding a lone volume link is short ("12", "Volume 12"). */
const MAX_LINK_CELL_TEXT = 40;

export interface VolumeBandResult {
  volumes: VolumeData[];
  chapters: ChapterData[];
  success: boolean;
  /** Why the parse was rejected, when it was. */
  rejected?: string;
  /** Labels of side-series tabs that were left out. */
  droppedTabs: string[];
  /** The page with side-series tabs removed, for reading volume details. */
  scopedHtml?: string;
}

/** Cheap check: does the page have per-volume markers the band walk can use? */
export function isVolumeBandStructure(html: string): boolean {
  return /id="Volume_\d+"|href="\/wiki\/Volume_\d+"|>\s*Volume\s+\d+\s*</.test(html);
}

/** Parses a rendered list page into volumes and their chapters. */
export function parseVolumeBands(html: string, baseUrl: string): VolumeBandResult {
  const $ = load(html);
  const droppedTabs = scopeTabbers($);
  let { bands, unassigned } = walkBands($, baseUrl);
  let rejected = rejectReason(numbersOf(bands));
  if (rejected) {
    // No list items to read: the page may still list each volume's chapters
    // as navigation-box rows (Demon Slayer's "Kimetsu no Yaiba (Manga)").
    const nav = walkNavRows($, baseUrl, $cell => numberOf(cellMarker($cell)));
    const navRejected = nav.bands.size > 0 ? rejectReason(numbersOf(nav.bands), true) : rejected;
    if (navRejected === null) {
      ({ bands, unassigned } = nav);
      rejected = null;
      log.debug('Volume bands read from navigation rows', { volumes: nav.bands.size });
    }
  }
  if (rejected) {
    log.debug('Volume bands rejected', { rejected });
    return { volumes: [], chapters: [], success: false, rejected, droppedTabs };
  }

  const volumes: VolumeData[] = [];
  const chapters: ChapterData[] = [];
  for (const [volume, entries] of [...bands].sort((a, b) => a[0] - b[0])) {
    if (entries.length === 0) continue;
    volumes.push({ number: volume });
    for (const entry of entries) chapters.push({ ...entry, volume });
  }
  const inVolumes = new Set(chapters.map(c => c.number));
  for (const entry of unassigned) if (!inVolumes.has(entry.number)) chapters.push({ ...entry });
  if (droppedTabs.length > 0) log.info('Left out side-series tabs', { droppedTabs });
  // Volume details read from the page with only the side-series tabs gone:
  // the cover tabs hold each volume's cover.
  const $details = load(html);
  scopeTabbers($details, true);
  return { volumes, chapters, success: true, droppedTabs, scopedHtml: $details.html() };
}

interface WalkResult {
  bands: Map<number, BandChapter[]>;
  /** Numbered chapters after the volumes that no volume holds yet. */
  unassigned: BandChapter[];
}

/** Walks the page in order, collecting each volume's chapters. */
function walkBands($: CheerioAPI, baseUrl: string): WalkResult {
  const bands = new Map<number, BandChapter[]>();
  const unassigned: BandChapter[] = [];
  let current: number | null = null;
  let container: Element | null = null;

  const $output = $('.mw-parser-output');
  const elements = ($output.length > 0 ? $output.first().find('*') : $('*')).toArray().filter(isTag);
  elements.forEach(el => {
    const $el = $(el);
    const tag = el.tagName.toLowerCase();
    const marker = volumeMarker($el, tag);
    if (marker !== null) {
      current = marker;
      container = $el.closest('table').toArray().find(isTag) ?? null;
      if (!bands.has(marker)) bands.set(marker, []);
      return;
    }
    // A section heading outside a table ends the band: the "not yet in a
    // volume" list after the last volume must not join that volume.
    if (/^h[2-4]$/.test(tag) && $el.closest('table').length === 0) {
      current = null;
      container = null;
      return;
    }
    if (tag !== 'li' || bands.size === 0) return;
    if (current !== null && container !== null && !$el.parents().toArray().includes(container)) {
      current = null;
      container = null;
    }
    if (current === null) {
      // Chapters out but not yet collected (Dandadan 220-249) keep their title, with no volume.
      if ($el.closest('.navbox').length > 0) return;
      const loose = readChapterEntry($el, baseUrl);
      if (loose && !unassigned.some(c => c.number === loose.number)) unassigned.push(loose);
      return;
    }
    const chapter = readChapterEntry($el, baseUrl);
    const band = bands.get(current);
    // Within a volume a chapter is listed once (title link plus a nested
    // sub-list may repeat it); across volumes a repeat is left for validation.
    if (chapter && band && !band.some(c => c.number === chapter.number)) band.push(chapter);
  });
  return { bands, unassigned };
}

/** The volume number an element marks, or null when it is not a marker. */
function volumeMarker($el: Cheerio<Element>, tag: string): number | null {
  const match =
    VOLUME_ID.exec($el.attr('id') ?? '') ??
    (/^h[2-5]$/.test(tag) ? VOLUME_HEADING.exec($el.text()) : null) ??
    (tag === 'td' || tag === 'th' ? cellMarker($el) : null);
  return numberOf(match);
}

/** The positive whole volume number a marker match captured. */
function numberOf(match: RegExpExecArray | null): number | null {
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function numbersOf(bands: Map<number, BandChapter[]>): Map<number, number[]> {
  return new Map([...bands].map(([volume, chapters]) => [volume, chapters.map(c => c.number)]));
}

/** "Volume 12" as a whole cell (Kingdom), or a short cell whose first link is the volume page (Demon Slayer, Dandadan). */
function cellMarker($cell: Cheerio<Element>): RegExpExecArray | null {
  const text = $cell.text().trim();
  const whole = VOLUME_CELL.exec(text);
  if (whole) return whole;
  if (text.length > MAX_LINK_CELL_TEXT || $cell.find('li').length > 0) return null;
  return VOLUME_HREF.exec($cell.find('a').first().attr('href') ?? '');
}
