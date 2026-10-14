/**
 * @jest-environment node
 *
 * Volume manifests read from Wikipedia's `Graphic novel list` wikitext.
 *
 * Why this exists: the HTML extractors misfiled chapters on these real pages.
 *  - Battle Angel Alita: "List of Battle Angel Alita chapters" also lists Last
 *    Order, Mars Chronicle and Panzer Kunst Chronicle; read whole it gave 90
 *    volumes and 123 chapters, the cross-series gate discarded the article and
 *    ComicVine's counted 6-per-volume ranges stood alone.
 *  - Erased / Frieren: two-column chapter lists came back one volume late.
 *  - Attack on Titan: Before the Fall: Numbered-list volumes had no chapters.
 * Fixtures are the pages' wikitext as fetched 2026-10-14.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import { describe, expect, it } from '@jest/globals';

import { cleanVolumesWithChapters, selectGraphicNovelManifest, type GraphicNovelManifest } from '@/server/services/wikipedia/graphic-novel-list/manifest';
import { parseGraphicNovelTables } from '@/server/services/wikipedia/graphic-novel-list/wikitext-parser';

const FIXTURES = join(__dirname, 'fixtures', 'graphic-novel-list');

function wikitext(name: string): string {
  return gunzipSync(readFileSync(join(FIXTURES, `${name}.wikitext.gz`))).toString('utf8');
}

function manifest(name: string, ...names: string[]): GraphicNovelManifest | null {
  return selectGraphicNovelManifest(parseGraphicNovelTables(wikitext(name)), names);
}

/** "1:1-6" per volume with chapters. */
function ranges(m: GraphicNovelManifest | null): string[] {
  return (m?.volumes ?? []).filter(v => v.chapters.length > 0)
    .map(v => `${v.number}:${v.chapters[0]?.number ?? 0}-${v.chapters[v.chapters.length - 1]?.number ?? 0}`);
}

describe('Graphic novel list manifests from real pages', () => {
  it('Battle Angel Alita: the original series\' Japanese table only, flagged as a shared page', () => {
    const m = manifest('battle-angel-alita-list', 'Battle Angel Alita');
    expect(ranges(m)).toEqual(['1:1-6', '2:7-11', '3:12-17', '4:18-22', '5:23-29', '6:30-35', '7:36-41', '8:42-47', '9:48-51']);
    expect(m?.sharedPage).toBe(true);
    expect(m?.volumes[8]?.unnumbered).toEqual(['Final Fight "Conquest"', 'Epilogue']);
    expect(m?.volumes[8]?.trailingUnnumbered).toBe(2);
    expect(m?.volumes[0]?.chapters[0]).toEqual({ number: 1, title: 'Rusty Angel' });
  });

  it('Battle Angel Alita: Last Order reads its own section', () => {
    const m = manifest('battle-angel-alita-list', 'Battle Angel Alita: Last Order');
    expect(m?.headings).toContain('Battle Angel Alita: Last Order');
    expect(m?.volumes).toHaveLength(19);
  });

  it('Erased: two-column chapter lists stay with their own volume; the side-story volume has no numbered chapters', () => {
    const m = manifest('erased-article', 'Erased', 'Erased (manga)');
    expect(ranges(m)).toEqual(['1:1-6', '2:7-12', '3:13-18', '4:19-24', '5:25-30', '6:31-35', '7:36-40', '8:41-44']);
    expect(m?.volumes[8]?.chapters).toEqual([]);
    expect(m?.sharedPage).toBe(false);
  });

  it('Attack on Titan: Before the Fall: Numbered list start= gives the numbers; bonus stories stay unnumbered', () => {
    const m = manifest('aot-before-the-fall-article', 'Attack on Titan: Before the Fall');
    expect(ranges(m)).toEqual([
      '1:1-3', '2:4-7', '3:8-10', '4:11-13', '5:14-17', '6:18-20', '7:21-24', '8:25-28', '9:29-32',
      '10:33-36', '11:37-40', '12:41-44', '13:45-48', '14:49-52', '15:53-56', '16:57-60', '17:61-64',
    ]);
    expect(m?.volumes[0]?.unnumbered).toEqual(['"Trailer"']);
  });

  it('Frieren: every volume keeps its own two-column chapter list', () => {
    expect(ranges(manifest('frieren-list', 'Frieren'))).toEqual([
      '1:1-7', '2:8-17', '3:18-27', '4:28-37', '5:38-47', '6:48-57', '7:58-67', '8:68-77',
      '9:78-87', '10:88-97', '11:98-107', '12:108-117', '13:118-127', '14:128-137', '15:138-147',
    ]);
  });

  it('Tokyo Ghoul:re takes its own table, not the parent series above it', () => {
    const re = manifest('tokyo-ghoul-list', 'Tokyo Ghoul:re');
    expect(re?.headings).toEqual(['Tokyo Ghoul:re']);
    expect(ranges(re).slice(0, 4)).toEqual(['1:1-9', '2:10-20', '3:21-31', '4:32-41']);
    const parent = manifest('tokyo-ghoul-list', 'Tokyo Ghoul');
    expect(parent?.headings).toEqual(['Tokyo Ghoul']);
    expect(parent?.sharedPage).toBe(true);
  });

  it('Dr. Stone: a list that skips chapter 202 and repeats 206 is not trusted', () => {
    expect(manifest('dr-stone-list', 'Dr. Stone')).toBeNull();
  });
});

describe('cleanVolumesWithChapters', () => {
  const vol = (number: number, chapters: number[]): { number: number; chapters: Array<{ number: number }>; unnumbered: string[] } =>
    ({ number, chapters: chapters.map(n => ({ number: n })), unnumbered: [] });

  it('accepts trailing volumes without chapters (an ongoing series) and decimal extras anywhere', () => {
    expect(cleanVolumesWithChapters([vol(1, [1, 2]), vol(2, [3, 2.5, 4]), vol(3, [5]), vol(4, [])])).toHaveLength(3);
  });

  it('rejects overlap, gaps, volumes out of order, and chapters after a chapterless volume', () => {
    expect(cleanVolumesWithChapters([vol(1, [1, 2]), vol(2, [2, 3]), vol(3, [4])])).toBeNull();
    expect(cleanVolumesWithChapters([vol(1, [1, 2]), vol(2, [4, 5]), vol(3, [6])])).toBeNull();
    expect(cleanVolumesWithChapters([vol(2, [1, 2]), vol(1, [3]), vol(3, [4])])).toBeNull();
    expect(cleanVolumesWithChapters([vol(1, [1]), vol(2, [2]), vol(3, []), vol(4, [3])])).toBeNull();
  });

  it('needs three volumes with chapters', () => {
    expect(cleanVolumesWithChapters([vol(1, [1]), vol(2, [2])])).toBeNull();
  });
});

describe('parseGraphicNovelTables', () => {
  it('reads labelled numbers, ignores sub-items and a number glued to a word ("4D Science")', () => {
    const text = [
      '== Volumes ==', '{{Graphic novel list/header}}',
      '{{Graphic novel list', '| VolumeNumber = 1', '| ChapterListCol1 =', '* Log:001 "Orphans"', '* Bonus: 4D Science',
      '** 1D. "Future Message"', '| ChapterListCol2 =', '* 02. {{Nihongo|"Two"|二|Ni}}', '}}',
      '{{Graphic novel list/footer}}',
    ].join('\n');
    const [table] = parseGraphicNovelTables(text);
    expect(table?.volumes[0]?.chapters).toEqual([{ number: 1, title: 'Orphans' }, { number: 2, title: 'Two' }]);
    expect(table?.volumes[0]?.unnumbered).toEqual(['Bonus: 4D Science']);
  });
});
