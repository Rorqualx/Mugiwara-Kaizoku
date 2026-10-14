/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { describe, it, expect } from '@jest/globals';

import { parseChapterTables } from '@/server/services/wikipedia/wikipedia/chapter-parser';
import { parseVolumeRowChapters } from '@/server/services/wikipedia/wikipedia/chapter-parser/formats/volume-row-pattern';
import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';

// Why this exists: Wikipedia chapter-list pages ("Graphic novel list" tables)
// list each volume's chapters under its id="volN" row, but the page-wide
// parsers filed chapters by counting through the page. Naruto's Part I page
// went to the zero-indexed parser, which estimated nine chapters per volume
// (volume 4 = 27-35, truly 28-36), and the Part II pages put every chapter in
// volume 1; the boundary vote then moved ComicVine's correct ranges onto
// Wikipedia's. Black Lagoon's "05: \"Title\"" items matched 10 chapters in no
// volume at all. Fixtures are the pages as the parse API renders them
// (fetched 2026-10-14).

const FIXTURES = join(__dirname, 'fixtures', 'graphic-novel-list');

function page(name: string): string {
  return gunzipSync(readFileSync(join(FIXTURES, `${name}.html.gz`))).toString('utf8');
}

/** "vol:first-last" for every volume, in page order. */
function ranges(chapters: WikipediaChapter[]): string[] {
  const byVolume = new Map<number | undefined, number[]>();
  for (const c of chapters) {
    const list = byVolume.get(c.volumeNumber) ?? [];
    list.push(Number(c.number));
    byVolume.set(c.volumeNumber, list);
  }
  return [...byVolume].map(([v, nums]) => `${v ?? '-'}:${Math.min(...nums)}-${Math.max(...nums)}`);
}

describe('parseVolumeRowChapters on real chapter-list pages', () => {
  it('reads Naruto Part I volume by volume (li value numbering, hidden empty items)', () => {
    const chapters = parseVolumeRowChapters(page('naruto-part-1'));
    expect(chapters).not.toBeNull();
    const r = ranges(chapters ?? []);
    expect(r).toHaveLength(27);
    expect(r.slice(0, 5)).toEqual(['1:1-7', '2:8-17', '3:18-27', '4:28-36', '5:37-45']);
    expect(r.slice(19, 22)).toEqual(['20:172-180', '21:181-190', '22:191-199']);
    expect(r[26]).toBe('27:236-244');
    expect(chapters?.[0]).toEqual({ number: 1, title: 'Uzumaki Naruto!', volumeNumber: 1 });
  });

  it('reads a Naruto Part II page with its own volume numbers (28-48)', () => {
    const r = ranges(parseVolumeRowChapters(page('naruto-part-2-vol-28-48')) ?? []);
    expect(r[0]).toBe('28:245-253');
    expect(r).toContain('43:390-402');
    expect(r[r.length - 1]).toBe('48:443-453');
  });

  it('reads Blue Exorcist <ol start=N> lists and does not read "4-koma Special" as chapter 4', () => {
    const r = ranges(parseVolumeRowChapters(page('blue-exorcist')) ?? []);
    expect(r).toHaveLength(34);
    expect(r.slice(0, 6)).toEqual(['1:1-3', '2:4-7', '3:8-11', '4:12-15', '5:16-19', '6:20-23']);
    expect(r.slice(30)).toEqual(['31:146-150', '32:151-156', '33:157-161', '34:162-166']);
  });

  it('reads Black Lagoon "05: …" / "Chapter 117: …" items and stops before the spin-offs\' own volume 1', () => {
    const chapters = parseVolumeRowChapters(page('black-lagoon')) ?? [];
    expect(ranges(chapters)).toEqual([
      '1:0-4', '2:5-12', '3:13-20', '4:21-29', '5:30-37', '6:38-46', '7:47-55',
      '8:56-64', '9:65-76', '10:77-87', '11:88-101', '12:102-109', '13:110-116', '14:117-122',
    ]);
    expect(chapters.find(c => c.number === 5)?.title).toMatch(/^Das Wieder Erstehen Des Adlers/);
  });
});

describe('parseChapterTables uses the volume rows', () => {
  it('gives Naruto Part I the true volumes instead of the zero-indexed estimate', () => {
    const r = ranges(parseChapterTables(page('naruto-part-1')));
    expect(r.slice(2, 4)).toEqual(['3:18-27', '4:28-36']);
  });

  it('gives Black Lagoon chapters their volumes', () => {
    const chapters = parseChapterTables(page('black-lagoon'));
    expect(chapters.every(c => c.volumeNumber !== undefined)).toBe(true);
    expect(chapters).toHaveLength(123);
  });
});

describe('parseVolumeRowChapters declines what it cannot read as volumes', () => {
  const vol = (v: number, items: string): string =>
    `<table><tr><th id="vol${v}">${v}</th></tr><tr><td>${items}</td></tr></table>`;

  it('returns null without volume rows', () => {
    expect(parseVolumeRowChapters('<ol start="3"><li>"A"</li></ol>')).toBeNull();
  });

  it('returns null when only one volume lists chapters', () => {
    expect(parseVolumeRowChapters(vol(1, '<ol><li>"A"</li></ol>') + vol(2, '<p>tba</p>'))).toBeNull();
  });

  it('returns null for per-volume numbering (each volume starting again at 1)', () => {
    const html = vol(1, '<ol><li>"A"</li><li>"B"</li></ol>') + vol(2, '<ol><li>"C"</li><li>"D"</li></ol>');
    expect(parseVolumeRowChapters(html)).toBeNull();
  });

  it('numbers <ol> items from start and value, skipping hidden empty items', () => {
    const html = vol(1, '<ol><li class="mw-empty-elt"></li><li>"A"</li><li>"B"</li></ol>')
      + vol(2, '<ol start="3"><li>"C"</li><li value="5">"E"</li><li>"F"</li></ol>');
    expect((parseVolumeRowChapters(html) ?? []).map(c => [c.number, c.volumeNumber])).toEqual([
      [1, 1], [2, 1], [3, 2], [5, 2], [6, 2],
    ]);
  });
});
