/**
 * Dynamic Wiki Parser - Volume Heading Sections
 *
 * Fallback for pages that mark each volume with a heading instead of volume
 * bands. Handles both section headings ("== Volume 3 ==", any of h2-h5) and
 * the headings Fandom list tables put inside a cell (`<td><h4>Volume 3</h4>`),
 * whose chapters sit in the rows that follow.
 *
 * @module dynamic-wiki-parser/tab-extractor/heading-sections
 */

import { collectChapterLinks, volumeDetails, type VolumeDetails } from './volume-content';

import type { VolumeData } from '../types';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

const HEADINGS = 'h2, h3, h4, h5';
/** "Volume 3", "Volume 3: Title" — but not a range heading like "Volume 1-10". */
const VOLUME_HEADING = /^\s*Vol(?:ume)?\.?\s*(\d+)\b(?!\s*(?:[-–—]|to)\s*\d)/i;
/** Dandadan's cell headings read just "3" and link to the volume page. */
const VOLUME_HREF = /\/wiki\/Volume_(\d+)$/;

/** The volume a heading names, or null. */
function headingVolume($heading: Cheerio<AnyNode>): number | null {
  const text = $heading.text().replace(/\[[^\]]*\]/g, '').trim();
  const fromText = VOLUME_HEADING.exec(text)?.[1];
  const fromLink = /^\d+$/.test(text) ? VOLUME_HREF.exec($heading.find('a').first().attr('href') ?? '')?.[1] : undefined;
  const n = Number(fromText ?? fromLink);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Does this element hold a volume heading (so it starts the next section)? */
function startsVolume($: CheerioAPI, $el: Cheerio<AnyNode>): boolean {
  const $headings = $el.is(HEADINGS) ? $el : $el.find(HEADINGS);
  return $headings.toArray().some(h => headingVolume($(h)) !== null);
}

/** The elements that belong to a volume heading. */
function sectionOf($: CheerioAPI, $heading: Cheerio<Element>): Cheerio<AnyNode>[] {
  const $row = $heading.closest('tr');
  if ($heading.closest('td, th').length > 0 && $row.length > 0) {
    // Heading inside a table cell: its own row, then the rows up to the next volume.
    const rows: Cheerio<AnyNode>[] = [$row];
    for (let $next = $row.next('tr'); $next.length > 0 && !startsVolume($, $next); $next = $next.next('tr')) {
      rows.push($next);
    }
    return rows;
  }
  const level = Number(($heading.prop('tagName') ?? 'H2').slice(1));
  const parts: Cheerio<AnyNode>[] = [];
  for (let $next = $heading.next(); $next.length > 0; $next = $next.next()) {
    const tag = ($next.prop('tagName') ?? '').toLowerCase();
    const isPeerHeading = /^h[1-6]$/.test(tag) && Number(tag.slice(1)) <= level;
    if (isPeerHeading || startsVolume($, $next)) break;
    parts.push($next);
  }
  return parts;
}

/** Volumes (with their chapters) found under volume headings within `$root`. */
export function extractVolumesUnderHeadings($: CheerioAPI, $root: Cheerio<AnyNode>): VolumeData[] {
  const volumes: VolumeData[] = [];
  $root.find(HEADINGS).each((_, heading) => {
    const $heading = $(heading);
    const number = headingVolume($heading);
    if (number === null || volumes.some(v => v.number === number)) return;
    const chapters: VolumeData['chapters'] = [];
    const section = sectionOf($, $heading);
    for (const $part of section) collectChapterLinks($, $part, number, chapters);
    if (chapters.length === 0) return;
    // The first part that has a detail (cover, ISBN, date) supplies it.
    const details = section.reduceRight<VolumeDetails>((acc, $part) => ({ ...acc, ...volumeDetails($part) }), {});
    const title = $heading.text().replace(/\[[^\]]*\]/g, '').trim();
    volumes.push({ number, title, chapters, ...details });
  });
  return volumes;
}
