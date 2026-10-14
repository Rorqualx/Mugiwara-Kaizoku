/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { describe, it, expect } from '@jest/globals';

import { findRangeSubpages } from '@/server/services/fandom/adaptive/orchestrator/range-subpages';
import { parseVolumeBands } from '@/server/services/fandom/adaptive/volume-band-parser';

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
