/**
 * @jest-environment node
 *
 * Chainsaw Man's ComicVine descriptions number their chapters "[ 17 ] Kill
 * Denji" (volumes 2-12) and "Chapter [165] Everyday Scenery" (volumes 19-21).
 * Read as unnumbered titles, each volume was counted from the previous
 * volume's end, and the counts were stored as ComicVine's ranges (volume 3 =
 * 17-26 overlapping volume 4 = 26-34; volume 19 = 165-174 instead of 165-175).
 */
import { describe, it, expect } from '@jest/globals';

import type { ComicVineIssue } from '@/server/services/comicvine/service';
import {
  dropOverlappingCountedRanges,
  mapComicVineIssuesToVolumes,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/comicvine-volume-mapper';
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';

jest.mock('@/utils/logging', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const list = (items: string[]): string => `<h2>Chapter Titles</h2><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

const VOL_3 = list(['[ 17 ] Kill Denji', '[ 18 ] Chainsaw vs. Eternity', '[ 19 ] Nobel Prize', '[ 20 ] Drinking',
  '[ 21 ] Taste of a Kiss', '[ 22 ] Cola-Flavored Chupa Chups', '[ 23 ] Gunfire', '[ 24 ] Curse', '[ 25 ] Ghost, Snake, Chainsaw']);
const VOL_19 = list(['Chapter [165] Everyday Scenery', 'Chapter [166] Rain, Brothel, Removal', 'Chapter [167] Super Smooch',
  'Chapter [168] Kiss, Love, Sperm', 'Chapter [169] Hands and Adaptation', 'Chapter [170] How to Eat Sushi',
  'Chapter [171] Special Division 5', 'Chapter [172] Bzzz! Boom! Chomp!', 'Chapter [173] Hard of Hearing',
  'Chapter [174] Ayyy, Aging', 'Chapter [175] Both Hands']);

describe('parseChaptersFromDescription — bracketed chapter numbers', () => {
  it('reads "[ 17 ] Kill Denji" as chapter 17 with a real number (bug: numbered 1-9 by position)', () => {
    const parsed = parseChaptersFromDescription(VOL_3);
    expect(parsed.map(c => c.chapterNumber)).toEqual([17, 18, 19, 20, 21, 22, 23, 24, 25]);
    expect(parsed.every(c => c.hasRealNumber)).toBe(true);
    expect(parsed[0]?.title).toBe('Kill Denji');
  });

  it('reads "Chapter [165] Everyday Scenery" as chapter 165', () => {
    const parsed = parseChaptersFromDescription(VOL_19);
    expect(parsed[0]).toMatchObject({ chapterNumber: 165, title: 'Everyday Scenery', hasRealNumber: true });
    expect(parsed.at(-1)?.chapterNumber).toBe(175);
  });
});

describe('mapComicVineIssuesToVolumes — Chainsaw Man volume ranges', () => {
  const issue = (n: number, description: string): ComicVineIssue =>
    ({ id: n, issue_number: String(n), description } as unknown as ComicVineIssue);

  it('takes volume 3 and 19 ranges from their own numbers, not from a running count', () => {
    const volumes = mapComicVineIssuesToVolumes([issue(3, VOL_3), issue(19, VOL_19)]);
    expect(volumes.map(v => [v['startChapter'], v['endChapter'], v['hasExplicitRange']])).toEqual([
      ['17', '25', true],
      ['165', '175', true],
    ]);
  });
});

describe('dropOverlappingCountedRanges — a counted range never overlaps a neighbour under the ComicVine label', () => {
  it('removes a counted volume 3 = 17-26 that runs into volume 4\'s read range 26-34, and keeps its count', () => {
    const volumes: Array<Record<string, unknown>> = [
      { volumeNumber: '2', startChapter: '8', endChapter: '16', hasExplicitRange: true },
      { volumeNumber: '3', startChapter: '17', endChapter: '26', chapterCount: 10 },
      { volumeNumber: '4', startChapter: '26', endChapter: '34', hasExplicitRange: true },
    ];
    dropOverlappingCountedRanges(volumes);
    expect(volumes[1]).toEqual({ volumeNumber: '3', chapterCount: 10 });
    expect(volumes[2]).toMatchObject({ startChapter: '26', endChapter: '34' });
  });

  it('removes a counted range that starts before the previous read range ends', () => {
    const volumes: Array<Record<string, unknown>> = [
      { volumeNumber: '5', startChapter: '35', endChapter: '43', hasExplicitRange: true },
      { volumeNumber: '6', startChapter: '40', endChapter: '48', chapterCount: 9 },
    ];
    dropOverlappingCountedRanges(volumes);
    expect(volumes[1]?.['startChapter']).toBeUndefined();
  });

  it('leaves adjoining counted ranges and read ranges alone', () => {
    const volumes: Array<Record<string, unknown>> = [
      { volumeNumber: '1', startChapter: '1', endChapter: '7', hasExplicitRange: true },
      { volumeNumber: '2', startChapter: '8', endChapter: '16', chapterCount: 9 },
      { volumeNumber: '3', startChapter: '17', endChapter: '25', chapterCount: 9 },
    ];
    const before = JSON.stringify(volumes);
    dropOverlappingCountedRanges(volumes);
    expect(JSON.stringify(volumes)).toBe(before);
  });
});
