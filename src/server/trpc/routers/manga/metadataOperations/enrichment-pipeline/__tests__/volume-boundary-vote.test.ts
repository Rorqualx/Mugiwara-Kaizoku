/**
 * @jest-environment node
 *
 * Volume boundaries in cross-validation: a boundary two sources agree on is
 * not moved by a third, and neighbouring volumes share a whole chapter only
 * when every source reporting both volumes says so.
 */
import { describe, it, expect } from '@jest/globals';

import { crossValidateVolumeRanges, type VolumeRangeProposal } from '../phase-volume-cross-validation';
import { agreedValue } from '../phase-volume-cross-validation/boundary-vote';

type Range = [number, number, number];

const CONFIDENCE: Record<VolumeRangeProposal['source'], number> = { comicvine: 0.7, wikipedia: 0.8, fandom: 0.85, mangadex: 0.9 };

function proposals(ranges: Range[], source: VolumeRangeProposal['source'], confidence = CONFIDENCE[source]): VolumeRangeProposal[] {
  return ranges.map(([volumeNumber, chapterStart, chapterEnd]) => ({
    volumeNumber, chapterStart, chapterEnd, source, confidence,
    extractionMethod: source === 'comicvine' ? 'cumulative' : 'table-parse',
  }));
}

const asRanges = (out: ReturnType<typeof crossValidateVolumeRanges>): Range[] =>
  out.map(r => [r.volumeNumber, r.chapterStart, r.chapterEnd]);

describe('agreedValue', () => {
  it('returns the value two or more proposals share', () => {
    expect(agreedValue([16, 17, 17])).toBe(17);
  });
  it('returns null when nothing is shared or two values tie', () => {
    expect(agreedValue([16, 17])).toBeNull();
    expect(agreedValue([16, 16, 17, 17])).toBeNull();
  });
});

describe('crossValidateVolumeRanges — boundary vote', () => {
  it('keeps the start Wikipedia and MangaDex agree on against ComicVine alone (bug: Dr. STONE volume 3 = 16-25, sharing 16 with volume 2)', () => {
    const wikipedia = proposals([[1, 1, 7], [2, 8, 16], [3, 17, 25], [4, 26, 34], [5, 35, 43]], 'wikipedia');
    const mangadex = proposals([[1, 1, 7], [2, 8, 16], [3, 17, 25], [4, 26, 34], [5, 35, 43]], 'mangadex');
    const comicvine = proposals([[1, 1, 7], [2, 8, 15], [3, 16, 24], [4, 25, 33], [5, 34, 41]], 'comicvine');
    const out = crossValidateVolumeRanges([...comicvine, ...wikipedia, ...mangadex], 232);
    expect(asRanges(out)).toEqual([[1, 1, 7], [2, 8, 16], [3, 17, 25], [4, 26, 34], [5, 35, 43]]);
  });

  it('prefers the pair of sources that agree exactly over an earlier pair two chapters apart', () => {
    const comicvine = proposals([[3, 16, 24]], 'comicvine');
    const wikipedia = proposals([[3, 17, 25]], 'wikipedia');
    const mangadex = proposals([[3, 17, 30]], 'mangadex');
    expect(asRanges(crossValidateVolumeRanges([...comicvine, ...wikipedia, ...mangadex], 232))).toEqual([[3, 17, 25]]);
  });

  it('keeps a chapter in two volumes when the only source reporting both lists it in both (Solo Leveling: chapter 3 split across volumes 1 and 2)', () => {
    const comicvine = proposals([[1, 1, 3], [2, 3, 5], [3, 6, 8]], 'comicvine', 0.95);
    expect(asRanges(crossValidateVolumeRanges(comicvine, 200))).toEqual([[1, 1, 3], [2, 3, 5], [3, 6, 8]]);
  });

  it('separates a shared chapter when another source reporting both volumes gives a clean boundary (bug: Bleach volumes 10/11 both held 89)', () => {
    const comicvine = proposals([[10, 80, 89], [11, 89, 98]], 'comicvine', 0.95);
    const wikipedia = proposals([[10, 80, 88], [11, 89, 98]], 'wikipedia');
    expect(asRanges(crossValidateVolumeRanges([...comicvine, ...wikipedia], 686))).toEqual([[10, 80, 88], [11, 89, 98]]);
  });

  it('does not round a decimal end up into the next volume (Bleach volume 10 ends with chapter 88.5)', () => {
    const comicvine = proposals([[10, 80, 88], [11, 89, 98]], 'comicvine', 0.95);
    const wikipedia = proposals([[10, 80, 88.5], [11, 89, 98]], 'wikipedia');
    const out = asRanges(crossValidateVolumeRanges([...comicvine, ...wikipedia], 686));
    expect(out[0]?.[2]).toBeLessThan(89);
    expect(out[1]).toEqual([11, 89, 98]);
  });

  it('lets the later volume keep its start when no source reports both volumes', () => {
    const comicvine = proposals([[1, 1, 8]], 'comicvine', 0.95);
    const wikipedia = proposals([[2, 8, 16]], 'wikipedia');
    expect(asRanges(crossValidateVolumeRanges([...comicvine, ...wikipedia], 100))).toEqual([[1, 1, 7], [2, 8, 16]]);
  });
});
