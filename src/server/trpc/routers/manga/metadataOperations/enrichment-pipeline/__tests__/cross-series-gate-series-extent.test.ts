/**
 * @jest-environment node
 *
 * Cross-series gate for a series with no AniList chapter count (ongoing): a
 * wiki list whose size matches the series' own providers is kept, instead of
 * being compared with a licensed title's short English MangaDex feed.
 */

import { describe, it, expect } from '@jest/globals';

import {
  decideCrossSeriesGate,
  filterFandomChaptersByCrossSeriesGate,
  mangadexFeedReach,
  seriesExtentEvidence,
  wikiMatchesSeriesExtent,
  wikiVolumeCount,
  type CrossSeriesGateConfig,
} from '../cross-series-gate';

const CFG: CrossSeriesGateConfig = {
  ratio: 2.0, minAniList: 2, minMangaDex: 10, tightRatio: 1.5, absOverflow: 40, tightMinAniList: 30, subSeriesCap: 200,
};

const rows = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const feed = (numbers: number[]): Array<{ number: number }> => numbers.map(number => ({ number }));
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Sakamoto Days' English MangaDex feed: 32 rows, chapters 1-3 and 204-232. */
const sakamotoFeed = feed([...range(1, 3), ...range(204, 232)]);

describe('mangadexFeedReach', () => {
  it('is the highest chapter of a partial feed (32 rows reaching chapter 232)', () => {
    expect(sakamotoFeed).toHaveLength(32);
    expect(mangadexFeedReach(sakamotoFeed)).toBe(232);
  });

  it('ignores a lone stray number far above the rest of the feed (a year)', () => {
    expect(mangadexFeedReach(feed([...range(1, 30), 2019]))).toBe(30);
  });

  it('is 0 for an empty feed', () => {
    expect(mangadexFeedReach([])).toBe(0);
  });
});

describe('seriesExtentEvidence', () => {
  it('takes the highest chapter any provider reports and every known volume count', () => {
    const evidence = seriesExtentEvidence({
      mangadexFeed: sakamotoFeed,
      mangaupdatesLatestChapter: 278,
      kitsu: { chapterCount: undefined, volumeCount: 28 },
      mal: { chapters: null, volumes: null },
      anilistVolumes: null,
    });
    expect(evidence).toEqual({ chapterReach: 278, knownVolumeCounts: [28] });
  });
});

describe('wikiVolumeCount', () => {
  it('is the highest volume number in the volume list or the chapter list', () => {
    expect(wikiVolumeCount([{ number: 1 }, { number: 28 }], [{ volume: 3 }, {}])).toBe(28);
    expect(wikiVolumeCount([], [{ volume: 15 }])).toBe(15);
  });
});

describe('decideCrossSeriesGate — no AniList chapter count', () => {
  it('keeps Sakamoto Days: 278 Fandom chapters in 28 volumes vs a 32-row English MangaDex feed (bug: discarded as ">2x MangaDex (278 vs 32)")', () => {
    const evidence = seriesExtentEvidence({ mangadexFeed: sakamotoFeed, kitsu: { volumeCount: 29 } });
    const decision = decideCrossSeriesGate({ chapterCount: 278, volumeCount: 28 }, { mangadex: 32, anilist: 0 }, CFG, evidence);
    expect(decision.gate).toBe(false);
  });

  it('keeps a list whose volume count is within one of a provider volume count, whatever the chapter reach', () => {
    const evidence = { chapterReach: 0, knownVolumeCounts: [29] };
    expect(decideCrossSeriesGate({ chapterCount: 278, volumeCount: 28 }, { mangadex: 32, anilist: 0 }, CFG, evidence).gate).toBe(false);
  });

  it('keeps a list whose chapter count is within reach of the highest chapter a provider reports (Frieren: 147 vs feed reaching 133)', () => {
    const evidence = { chapterReach: 133, knownVolumeCounts: [] };
    expect(decideCrossSeriesGate({ chapterCount: 147, volumeCount: 0 }, { mangadex: 31, anilist: 0 }, CFG, evidence).gate).toBe(false);
  });

  it('still gates a whole-franchise wiki: 900 chapters in 131 volumes vs a 95-chapter part with 24 volumes', () => {
    const evidence = { chapterReach: 95, knownVolumeCounts: [24] };
    const decision = decideCrossSeriesGate({ chapterCount: 900, volumeCount: 131 }, { mangadex: 95, anilist: 0 }, CFG, evidence);
    expect(decision).toEqual({ gate: true, reason: '>2x MangaDex (900 vs 95)' });
  });

  it('does not count a volume agreement below three volumes', () => {
    expect(wikiMatchesSeriesExtent({ chapterCount: 300, volumeCount: 2 }, { chapterReach: 0, knownVolumeCounts: [2] })).toBeNull();
  });

  it('gates as before when no extent evidence is given — 100 Fandom vs 12 MangaDex', () => {
    expect(decideCrossSeriesGate({ chapterCount: 100, volumeCount: 10 }, { mangadex: 12, anilist: 0 }, CFG).gate).toBe(true);
  });

  it('still gates a sub-series title over the cap when nothing agrees', () => {
    const decision = decideCrossSeriesGate(
      { chapterCount: 250, volumeCount: 60 }, { mangadex: 0, anilist: 0, subSeriesTitle: true }, CFG, { chapterReach: 40, knownVolumeCounts: [5] },
    );
    expect(decision.gate).toBe(true);
  });
});

describe('decideCrossSeriesGate — AniList chapter count present', () => {
  it('lets AniList decide: a 2x overflow is gated even when a provider volume count agrees', () => {
    const decision = decideCrossSeriesGate({ chapterCount: 900, volumeCount: 24 }, { mangadex: 0, anilist: 95 }, CFG, { chapterReach: 95, knownVolumeCounts: [24] });
    expect(decision.gate).toBe(true);
  });
});

describe('filterFandomChaptersByCrossSeriesGate with extent evidence', () => {
  it('keeps Sakamoto Days in the reconciliation step too (bug: the same 2x MangaDex rule ran a second time)', () => {
    const evidence = seriesExtentEvidence({ mangadexFeed: sakamotoFeed, mangaupdatesLatestChapter: 278 });
    const out = filterFandomChaptersByCrossSeriesGate(18, rows(278), { mangadex: 32, anilist: 0 }, CFG, { volumeCount: 28, evidence });
    expect(out).toHaveLength(278);
  });
});
