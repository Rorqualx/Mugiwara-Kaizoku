/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { describe, it, expect } from '@jest/globals';

import { findRangeSubpages } from '@/server/services/fandom/adaptive/orchestrator/range-subpages';
import { parseVolumeBands } from '@/server/services/fandom/adaptive/volume-band-parser';
import { withVolumeDetails } from '@/server/services/fandom/adaptive/volume-band-parser/volume-details';
import { parsePageAdaptive } from '@/server/services/metadata/utils/fandom-table-parser';

// Why this exists: tabbed Fandom list pages render every volume into one
// shared table (cover-art tabs row, then chapter row). The old parsers gave
// every volume all chapters (Call of the Night 4,040 rows for 202 chapters,
// thrown away by the collapsed-volume guard), slid by one chapter (Demon
// Slayer volume 1 = 2-8) or by one volume (Spy x Family), or found no volumes
// (Blue Lock). Fixtures are the live pages, stripped to their structure.
// Expected ranges were checked against Wikipedia's chapter lists.

const BASE = 'https://example.fandom.com';
const FIXTURES = join(__dirname, 'fixtures', 'tabbed-list-pages');

function page(name: string): string {
  return gunzipSync(readFileSync(join(FIXTURES, `${name}.html.gz`))).toString('utf8');
}

/** volume -> [first, last] whole chapter, from a parse. */
function ranges(name: string): Map<number, [number, number]> {
  const result = parseVolumeBands(page(name), BASE);
  expect(result.success).toBe(true);
  const byVolume = new Map<number, number[]>();
  for (const ch of result.chapters) {
    if (ch.volume === undefined) continue;
    byVolume.set(ch.volume, [...(byVolume.get(ch.volume) ?? []), ch.number]);
  }
  return new Map([...byVolume].map(([v, ns]) => {
    const whole = ns.filter(n => Number.isInteger(n));
    return [v, [Math.min(...whole), Math.max(...whole)]];
  }));
}

function noChapterTwice(name: string): void {
  const numbers = parseVolumeBands(page(name), BASE).chapters.map(c => c.number);
  expect(new Set(numbers).size).toBe(numbers.length);
}

type RangeCase = [name: string, volumeCount: number, expected: Record<number, [number, number]>];

describe('parseVolumeBands', () => {
  it.each<RangeCase>([
    ['call-of-the-night', 20, { 1: [1, 8], 2: [9, 18], 20: [190, 200] }],
    ['dr-stone', 26, { 1: [1, 7], 2: [8, 16], 25: [215, 223], 26: [224, 232] }],
    ['demon-slayer', 23, { 1: [1, 7], 2: [8, 16], 3: [17, 25], 22: [188, 196], 23: [197, 205] }],
    ['frieren', 15, { 1: [1, 7], 2: [8, 17], 3: [18, 27], 15: [138, 147] }],
    ['my-hero-academia', 42, { 1: [1, 7], 2: [8, 17], 41: [411, 422] }],
    ['spy-x-family', 17, { 1: [1, 5], 2: [6, 11], 3: [12, 17], 4: [18, 23] }],
    ['blue-lock', 40, { 1: [1, 4], 2: [5, 13], 40: [347, 354] }],
    ['dandadan', 25, { 1: [1, 5], 25: [211, 219] }],
    ['kingdom', 10, { 1: [1, 8], 10: [97, 107] }],
    ['kingdom-volume-11-20', 10, { 11: [108, 118], 20: [207, 217] }],
  ])('%s: %i volumes with their real ranges', (name, volumeCount, expected) => {
    const got = ranges(name);
    expect(got.size).toBe(volumeCount);
    for (const [volume, range] of Object.entries(expected)) {
      expect([Number(volume), got.get(Number(volume))]).toEqual([Number(volume), range]);
    }
    noChapterTwice(name);
  });

  it('keeps My Hero Academia\'s bonus chapter 6.5 in volume 3', () => {
    const ch = parseVolumeBands(page('my-hero-academia'), BASE).chapters.find(c => c.number === 6.5);
    expect(ch?.volume).toBe(3);
  });

  it('takes the title from the rest of the line when the link is only "Chapter N"', () => {
    const title = (name: string, n: number): string | undefined =>
      parseVolumeBands(page(name), BASE).chapters.find(c => c.number === n)?.title;
    expect(title('call-of-the-night', 2)).toBe('A Pretty Big Mosquito');
    expect(title('kingdom', 2)).toBe('Map');
    expect(title('frieren', 2)).toBe('The Priest\'s Lie');
  });

  it('leaves out the light novel / spin-off tab whose volumes restart at 1', () => {
    expect(parseVolumeBands(page('demon-slayer'), BASE).droppedTabs).toEqual(['Light Novels/Spinoffs']);
    expect(parseVolumeBands(page('spy-x-family'), BASE).droppedTabs).toEqual(['Light Novels/Spin-Offs']);
  });

  it('keeps chapters not yet in a volume, with no volume', () => {
    const chapters = parseVolumeBands(page('dandadan'), BASE).chapters;
    const tail = chapters.filter(c => c.number >= 220);
    expect(tail.length).toBe(29);
    expect(tail.every(c => c.volume === undefined)).toBe(true);
  });

  // "Kimetsu no Yaiba (Manga)": volumes are a cover gallery and the chapters
  // appear only in the navigation box ("Volume 1:" cell, then "1 · 2 · … 7").
  // The static parser read it as 24 volumes with a phantom volume 0 and every
  // volume one chapter off.
  it.each<RangeCase>([
    ['demon-slayer-manga-navbox', 23, { 1: [1, 7], 2: [8, 16], 3: [17, 25], 22: [188, 196], 23: [197, 205] }],
    ['dandadan-manga-navbox', 25, { 1: [1, 5], 2: [6, 14], 25: [211, 219] }],
  ])('%s: reads %i volumes from navigation-box rows', (name, volumeCount, expected) => {
    const got = ranges(name);
    expect(got.size).toBe(volumeCount);
    for (const [volume, range] of Object.entries(expected)) {
      expect([Number(volume), got.get(Number(volume))]).toEqual([Number(volume), range]);
    }
    noChapterTwice(name);
  });

  it('keeps the navigation box\'s "not yet in a volume" chapters, with no volume', () => {
    const tail = parseVolumeBands(page('dandadan-manga-navbox'), BASE).chapters.filter(c => c.volume === undefined);
    expect(tail[0]?.number).toBe(220);
    expect(tail.every(c => c.number >= 220)).toBe(true);
  });

  it('rejects a navigation box that files a chapter inside the volume above (Dr. STONE puts 15 in volume 3)', () => {
    const result = parseVolumeBands(page('dr-stone-manga-navbox'), BASE);
    expect(result.success).toBe(false);
    expect(result.rejected).toMatch(/only 0 volumes/);
  });

  it('rejects a page whose bands overlap, so the other parsers run', () => {
    const result = parseVolumeBands(page('hunter-x-hunter'), BASE);
    expect(result.success).toBe(false);
    expect(result.rejected).toMatch(/two volumes/);
  });
});

describe('findRangeSubpages', () => {
  const kingdomUrl = 'https://kingdom.fandom.com/wiki/Volumes_and_Chapters';

  it('finds Kingdom\'s volume-range pages in link order', () => {
    const urls = findRangeSubpages(page('kingdom'), kingdomUrl, new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    expect(urls[0]).toBe('https://kingdom.fandom.com/wiki/Volumes_and_Chapters/Volume_11-20');
    expect(urls).toHaveLength(8);
  });

  it('skips a range whose volumes are all parsed already', () => {
    const known = new Set(Array.from({ length: 20 }, (_, i) => i + 1));
    const urls = findRangeSubpages(page('kingdom'), kingdomUrl, known);
    expect(urls[0]).toBe('https://kingdom.fandom.com/wiki/Volumes_and_Chapters/Volume_21-30');
  });

  it('never follows a sibling page that is another series', () => {
    const html = '<div class="mw-parser-output"><a href="/wiki/Chapters_and_Volumes/Vigilantes">Vigilantes</a>'
      + '<a href="/wiki/Chapters_and_Volumes/Volume_51_to_100">51-100</a>'
      + '<a href="/wiki/List_of_Chapters/Volume_1-10">elsewhere</a></div>';
    expect(findRangeSubpages(html, 'https://x.fandom.com/wiki/Chapters_and_Volumes', new Set())).toEqual([
      'https://x.fandom.com/wiki/Chapters_and_Volumes/Volume_51_to_100',
    ]);
  });
});

describe('withVolumeDetails', () => {
  function detailed(name: string): ReturnType<typeof withVolumeDetails> {
    const html = page(name);
    const bands = parseVolumeBands(html, BASE);
    return withVolumeDetails(bands, parsePageAdaptive(bands.scopedHtml ?? html, undefined, undefined, BASE));
  }

  it('keeps the volume titles the table parser reads (Sakamoto Days 22 = Tenkyu vs. Shin)', () => {
    // Without them a refresh wiped the titles stored for volumes 22-28.
    const volumes = detailed('sakamoto-days');
    expect(volumes.find(v => v.number === 22)?.title).toBe('Tenkyu vs. Shin');
    expect(volumes.filter(v => v.title).length).toBe(28);
  });

  it('takes covers and dates, never the spin-off novels\' titles (SPY x FAMILY)', () => {
    const volumes = detailed('spy-x-family');
    expect(volumes.filter(v => v.title)).toEqual([]);
    expect(volumes.filter(v => v.releaseDate).length).toBe(17);
  });
});
