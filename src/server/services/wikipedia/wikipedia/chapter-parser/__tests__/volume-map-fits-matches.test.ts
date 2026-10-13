/**
 * @jest-environment node
 *
 * Chapters are filed under volumes by counting through the volume sections in
 * page order. When the chapter pattern matched only part of the list, that
 * count shifts every volume number, so no volume numbers are given at all.
 */
import { volumeMapFitsMatches } from '../formats/numbered-chapters-pattern';
import { parseChapterTables } from '../index';

const li = (label: string, n: number, sep: string): string => `<li>${label} ${n}${sep} "Title ${n}"</li>`;
const volume = (v: number, items: string[]): string =>
  `<table><tr id="vol${v}"><th>${v}</th><td>2021</td></tr><tr><td><ul>${items.join('')}</ul></td></tr></table>`;

describe('volumeMapFitsMatches', () => {
  it('fits when the sections hold about as many chapters as were matched', () => {
    expect(volumeMapFitsMatches(100, 98)).toBe(true);
  });

  it('does not fit when the sections hold far more chapters than were matched (Sakamoto Days: 267 vs 64)', () => {
    expect(volumeMapFitsMatches(267, 64)).toBe(false);
  });
});

describe('parseChapterTables volume numbers', () => {
  it('leaves chapters without volume numbers when only the later "N." rows matched (bug: chapters 215-221 were filed under volume 1)', () => {
    const html = [
      volume(1, [1, 2, 3, 4, 5].map(n => li('Days', n, ':'))),
      volume(2, [6, 7, 8, 9, 10].map(n => li('Days', n, ':'))),
      volume(3, [11, 12, 13].map(n => li('Days', n, '.'))),
    ].join('');
    const chapters = parseChapterTables(html);
    expect(chapters.map(c => c.number)).toEqual([11, 12, 13]);
    expect(chapters.every(c => c.volumeNumber === undefined)).toBe(true);
  });

  it('still files chapters by volume when every row matched', () => {
    const html = [
      volume(1, [1, 2, 3].map(n => `<li>${n}. "Title ${n}"</li>`)),
      volume(2, [4, 5, 6].map(n => `<li>${n}. "Title ${n}"</li>`)),
    ].join('');
    const chapters = parseChapterTables(html);
    expect(chapters.map(c => [c.number, c.volumeNumber])).toEqual([[1, 1], [2, 1], [3, 1], [4, 2], [5, 2], [6, 2]]);
  });
});

describe('parseChapterTables last volume and uncollected chapters', () => {
  const olVolume = (v: number, start: number, n: number): string =>
    `<table><tr id="vol${v}"><th>${v}</th><td>2026</td></tr><tr><td><ol start="${start}">${
      Array.from({ length: n }, (_, i) => `<li>"Title ${start + i}"</li>`).join('')
    }</ol></td></tr></table>`;
  const uncollected = (start: number, n: number): string =>
    `<div class="mw-heading mw-heading2"><h2 id="Chapters_not_yet_in_tankōbon_format">Chapters not yet in tankōbon format</h2></div><ol start="${start}">${
      Array.from({ length: n }, (_, i) => `<li>"Title ${start + i}"</li>`).join('')
    }</ol>`;

  it('ends the last volume at the next section, leaving uncollected chapters without a volume (bug: Dandadan volume 25 read as 214-248 instead of 211-219)', () => {
    const html = olVolume(1, 1, 3) + olVolume(2, 4, 3) + uncollected(7, 4);
    const chapters = parseChapterTables(html);
    expect(chapters.map(c => [c.number, c.volumeNumber])).toEqual([
      [1, 1], [2, 1], [3, 1], [4, 2], [5, 2], [6, 2],
      [7, undefined], [8, undefined], [9, undefined], [10, undefined],
    ]);
  });

  it('keeps later volumes on their own chapters when an earlier item has no readable title (bug: Dandadan volume 10 read as 79-87 instead of 77-85)', () => {
    const v1 = '<table><tr id="vol1"><th>1</th></tr><tr><td><ol start="1"><li>"One"</li><li><span>"</span>\'Two\' Quoted"</li><li>"Three"</li></ol></td></tr></table>';
    const chapters = parseChapterTables(v1 + olVolume(2, 4, 3));
    expect(chapters.map(c => [c.number, c.volumeNumber])).toEqual([[1, 1], [2, 1], [3, 1], [4, 2], [5, 2], [6, 2]]);
  });
});
