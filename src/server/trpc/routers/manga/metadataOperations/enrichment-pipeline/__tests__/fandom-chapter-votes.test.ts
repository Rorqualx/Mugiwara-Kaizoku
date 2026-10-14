/**
 * @jest-environment node
 *
 * Per-chapter votes from Fandom's chapter list, and split-release chapters in
 * consensus ranges. Fixtures are the live provider data of 2026-10-14:
 * MangaDex `/manga/{id}/aggregate` and the Fandom list page as the adaptive
 * parser reads it.
 *
 * Bugs protected:
 * - Yofukashi no Uta: MangaDex tags volume 2 with chapter 9 only and has no
 *   10-22, Fandom (and Wikipedia) list 9-18 / 19-29. Fandom spoke only as a
 *   range, so the per-chapter vote heard MangaDex alone: volume 2 = 9-9 and
 *   chapters 10-18 sat in no range.
 * - Why Does Nobody Remember Me in this World: chapters 27-30 are published
 *   in parts (27.1, 27.2 ...). Read as bonus extras, volume 6 became 25-26 and
 *   volume 7 31-31.
 */
import { describe, expect, it } from '@jest/globals';

import { crossValidateVolumeRanges } from '../phase-volume-cross-validation';
import { resolveVolumeManifest } from '../phase-volume-cross-validation/membership-consensus';
import { collectVolumeRangeProposals } from '../phase-volume-cross-validation/proposal-collectors';
import { toFandomVolumeInputs } from '../pipeline-orchestrator/volume-inputs';

type MdVolume = { volumeNumber: number; chapterStart: number; chapterEnd: number; chapterCount: number; chapters: number[] };

function md(volumeNumber: number, chapters: number[]): MdVolume {
  return { volumeNumber, chapterStart: Math.min(...chapters), chapterEnd: Math.max(...chapters), chapterCount: chapters.length, chapters };
}

function seq(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// MangaDex aggregate, Yofukashi no Uta (259dfd8a-f06a-4825-8fa6-a2dcd7274230), volumes 1-5.
const yofukashiMd: MdVolume[] = [
  md(1, seq(1, 8)), md(2, [9]), md(3, seq(23, 29)),
  md(4, [30, 31, 32, 33, 34, 35, 35.5, 36, 37, 38, 39]), md(5, seq(40, 49)),
];

// Fandom "Chapters and Volumes" (call-of-the-night.fandom.com), volumes 1-5.
const yofukashiFandomRanges = [[1, 1, 8], [2, 9, 18], [3, 19, 29], [4, 30, 39], [5, 40, 49]] as const;
const yofukashiFandomChapters = [
  ...seq(1, 8).map(number => ({ number, volume: 1 })),
  ...seq(9, 18).map(number => ({ number, volume: 2 })),
  ...seq(19, 29).map(number => ({ number, volume: 3 })),
  ...[30, 31, 32, 33, 34, 35, 35.5, 36, 37, 38, 39].map(number => ({ number, volume: 4 })),
  ...seq(40, 49).map(number => ({ number, volume: 5 })),
];

describe('Fandom chapter list as per-chapter votes', () => {
  it('attaches the chapters Fandom files under each volume, inside its range only', () => {
    const rows = toFandomVolumeInputs(
      [{ number: 2, chapterStart: 9, chapterEnd: 18 }, { number: 7 }],
      [...yofukashiFandomChapters, { number: 150, volume: 2 }, { number: 61, volume: 7 }],
    );
    expect(rows[0]?.chapters).toEqual(seq(9, 18));
    // A lumped tag outside the range, and a volume without a range, add nothing.
    expect(rows[1]).toEqual({ number: 7 });
  });

  it('gives Yofukashi no Uta volume 2 = 9-18 and volume 3 = 19-29 where MangaDex alone gave 9-9 and 23-29', () => {
    const fandom = toFandomVolumeInputs(
      yofukashiFandomRanges.map(([number, chapterStart, chapterEnd]) => ({ number, chapterStart, chapterEnd })),
      yofukashiFandomChapters,
    );
    const ranges = crossValidateVolumeRanges(collectVolumeRangeProposals([], [], fandom, yofukashiMd), 200, 20);
    const byVol = new Map(ranges.map(r => [r.volumeNumber, [r.chapterStart, r.chapterEnd]]));
    expect(byVol.get(1)).toEqual([1, 8]);
    expect(byVol.get(2)).toEqual([9, 18]);
    expect(byVol.get(3)).toEqual([19, 29]);
    expect(byVol.get(4)).toEqual([30, 39]);
    expect(ranges.find(r => r.volumeNumber === 2)?.sources).toEqual(expect.arrayContaining(['mangadex', 'fandom']));
  });
});

describe('split-release chapters in consensus ranges', () => {
  // MangaDex aggregate, Naze Boku no Sekai o Daremo Oboeteinai no ka? (91503d4c-...), volumes 5-9.
  const proposals = collectVolumeRangeProposals([], [], [], [
    md(5, [21, 22, 23, 24]),
    md(6, [25, 25.1, 25.2, 26, 27.1, 27.2, 28.1, 28.2]),
    md(7, [29.1, 29.2, 30.1, 30.2, 30.3, 31]),
    md(8, [32, 33, 34, 35, 35.5, 36.1]),
    md(9, [36.2, 37, 38, 38.5, 39]),
  ]);

  it('reaches a chapter a volume holds only in parts (volume 6 = 25-28, volume 7 = 29-31)', () => {
    const { volumes } = resolveVolumeManifest(proposals);
    expect(volumes['6']?.range).toEqual([25, 28]);
    expect(volumes['7']?.range).toEqual([29, 31]);
  });

  it('keeps a lone decimal an extra: 35.5 and the 36.1 / 36.2 split do not move volume 8 or 9', () => {
    const { volumes } = resolveVolumeManifest(proposals);
    expect(volumes['8']?.range).toEqual([32, 35]);
    // 35.5 folds into 35 (MangaDex lists 35 too); 36.1 stays an extra.
    expect(volumes['8']?.bonus).toEqual([36.1]);
    expect(volumes['9']?.range).toEqual([37, 39]);
  });
});
