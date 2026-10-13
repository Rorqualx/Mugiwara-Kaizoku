/**
 * @jest-environment node
 *
 * ComicVine volume ranges at the boundary between two volumes. Descriptions are
 * excerpts of the real ComicVine issue descriptions (fetched 2026-10-13).
 */
import { describe, it, expect } from '@jest/globals';

import type { ComicVineIssue } from '@/server/services/comicvine/service';

import { mapComicVineIssuesToVolumes } from '../phase-provider-fetch/comicvine-volume-mapper';

const issue = (n: number, lines: string[]): ComicVineIssue =>
  ({ id: 1000 + n, issue_number: String(n), name: `Volume ${n}`, description: `<p>Blurb.</p><h2>Chapter Titles</h2><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>` }) as unknown as ComicVineIssue;

const ranges = (issues: ComicVineIssue[]): Array<[unknown, unknown, unknown]> =>
  mapComicVineIssuesToVolumes(issues).map(v => [v['volumeNumber'], v['startChapter'], v['endChapter']]);

const zLines = (from: number, to: number): string[] => Array.from({ length: to - from + 1 }, (_, i) => `Z=${from + i}: Title ${from + i}`);

describe('ComicVine volume mapper — boundary chapters', () => {
  it('reads Dr. STONE\'s "Z=N:" chapter numbers instead of counting lines (bug: volume 3 = 16-24 next to volume 2 = 8-15)', () => {
    const out = ranges([
      issue(1, zLines(1, 7)),
      issue(2, [...zLines(8, 11), 'Z=12: Epilogue of Prologue (End of Part 0)', ...zLines(13, 16)]),
      issue(3, ['Z=17: Nasty Looks', 'Z=18: Sorcery Showdown', 'Side Story: Chrome vs. Senku! Arithme-Battle!!', ...zLines(19, 25)]),
      issue(4, zLines(26, 34)),
    ]);
    expect(out).toEqual([['1', '1', '7'], ['2', '8', '16'], ['3', '17', '25'], ['4', '26', '34']]);
  });

  it('reads "Z=215 Long, Long Road" without a colon as chapter 215', () => {
    expect(ranges([issue(25, ['Z=215 Long, Long Road', ...zLines(216, 222), 'Z=223 0'])])).toEqual([['25', '215', '223']]);
  });

  it('does not stretch a volume over a trailing negative-numbered prequel chapter (bug: Bleach volume 15 = 124-131, sharing 131 with volume 16)', () => {
    const v15 = [124, 125, 126, 127, 128, 129, 130].map(n => `Chapter ${n}: Title ${n}`).concat('Chapter -17: Prelude for the Straying Stars');
    const v16 = Array.from({ length: 9 }, (_, i) => `Chapter ${131 + i}: Title ${131 + i}`);
    expect(ranges([issue(15, v15), issue(16, v16)])).toEqual([['15', '124', '130'], ['16', '131', '139']]);
  });

  it('ends a volume at its last whole chapter when a decimal extra follows it (bug: Bleach volume 10 ending 88.5 became 80-89)', () => {
    const v10 = Array.from({ length: 9 }, (_, i) => `Chapter ${80 + i}: Title ${80 + i}`).concat('Chapter 88.5: KARAKURA SUPERHEROES');
    expect(ranges([issue(10, v10)])).toEqual([['10', '80', '88']]);
  });

  it('gives a volume with no description no range instead of a nine-chapter guess (bug: Dr. STONE volume 27 = 233-241 in a series ending at 236)', () => {
    const empty = (n: number): ComicVineIssue => ({ id: 1000 + n, issue_number: String(n), name: `Volume ${n}` }) as unknown as ComicVineIssue;
    const out = ranges([issue(25, zLines(215, 223)), empty(26), empty(27)]);
    expect(out).toEqual([['25', '215', '223'], ['26', undefined, undefined], ['27', undefined, undefined]]);
  });
});
