/**
 * @jest-environment node
 *
 * Membership consensus with range-only proposals: a source that gives
 * volume ranges but no per-chapter lists (Fandom's table) still decides the
 * volumes no per-chapter source covers.
 */
import { describe, it, expect } from '@jest/globals';

import { crossValidateVolumeRanges, type VolumeRangeProposal } from '../phase-volume-cross-validation';

type Range = [number, number, number];

const SAKAMOTO: Range[] = [[1, 1, 7], [2, 8, 16], [3, 17, 25], [4, 26, 34], [5, 35, 43], [6, 44, 52], [7, 53, 61], [8, 62, 70], [9, 71, 79], [10, 80, 88], [11, 89, 97], [12, 98, 106], [13, 107, 115], [14, 116, 124], [15, 125, 133], [16, 134, 142], [17, 143, 151], [18, 152, 161], [19, 162, 170], [20, 171, 180], [21, 181, 190], [22, 191, 199], [23, 200, 208], [24, 209, 217], [25, 218, 226], [26, 227, 235], [27, 236, 245], [28, 246, 255]];

const span = (s: number, e: number): number[] => Array.from({ length: e - s + 1 }, (_, i) => s + i);

function proposals(ranges: Range[], source: VolumeRangeProposal['source'], withChapters: boolean): VolumeRangeProposal[] {
  return ranges.map(([volumeNumber, chapterStart, chapterEnd]) => ({
    volumeNumber, chapterStart, chapterEnd, source, confidence: 0.9,
    extractionMethod: withChapters ? 'explicit-range' : 'table-parse',
    ...(withChapters ? { chapters: span(chapterStart, chapterEnd) } : {}),
  }));
}

const asRanges = (out: ReturnType<typeof crossValidateVolumeRanges>): Range[] =>
  out.map(r => [r.volumeNumber, r.chapterStart, r.chapterEnd]);

describe('crossValidateVolumeRanges — range-only volumes in the consensus path', () => {
  it('keeps Fandom ranges for the volumes MangaDex does not tag (bug: Sakamoto Days kept 4 of 28 volumes)', () => {
    const mangadex = proposals([[1, 1, 7], [2, 8, 16], [3, 17, 25], [4, 26, 34]], 'mangadex', true);
    const out = crossValidateVolumeRanges([...mangadex, ...proposals(SAKAMOTO, 'fandom', false)], 278, 29);
    expect(asRanges(out)).toEqual(SAKAMOTO);
  });

  it('replaces a lone per-chapter claim that every other source places elsewhere (MangaDex filing chapter 232 under volume 25)', () => {
    const comicvine = proposals(SAKAMOTO.slice(0, 23), 'comicvine', true);
    const mangadex = proposals([[1, 1, 7], [2, 8, 16], [21, 187, 187], [25, 232, 232]], 'mangadex', true);
    const out = crossValidateVolumeRanges([...comicvine, ...mangadex, ...proposals(SAKAMOTO, 'fandom', false)], 278, 29);
    expect(asRanges(out)).toEqual(SAKAMOTO);
  });

  it('leaves a per-chapter volume alone when a range-only source agrees with part of it', () => {
    const mangadex = proposals([[1, 1, 7], [2, 8, 16], [3, 17, 25]], 'mangadex', true);
    const fandom = proposals([[1, 1, 7], [2, 8, 15], [3, 16, 25]], 'fandom', false);
    expect(asRanges(crossValidateVolumeRanges([...mangadex, ...fandom], 25, 3))).toEqual([[1, 1, 7], [2, 8, 16], [3, 17, 25]]);
  });
});
