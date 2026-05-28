/**
 * @jest-environment node
 *
 * Cross-series chapter gate — guards against a shared/franchise Fandom wiki
 * flooding a spin-off with the parent series' chapter list.
 */

import { describe, it, expect } from '@jest/globals';

import {
  filterFandomChaptersByCrossSeriesGate,
  type CrossSeriesGateConfig,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/cross-series-gate';

const CFG: CrossSeriesGateConfig = {
  ratio: 2.0,
  minAniList: 2,
  minMangaDex: 10,
  tightRatio: 1.5,
  absOverflow: 40,
  tightMinAniList: 30,
};

/** Build a throwaway chapter array of length n. */
const chapters = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('filterFandomChaptersByCrossSeriesGate', () => {
  it('gates "Before the Fall" — 139 Fandom vs 73 AniList (absolute-overflow backstop)', () => {
    // 139 < 73*2 (=146) so the legacy 2x rule misses it; the +66 absolute
    // backstop (>1.5x and +40 over AL) catches the main-series contamination.
    expect(filterFandomChaptersByCrossSeriesGate(464, chapters(139), { mangadex: 0, anilist: 73 }, CFG)).toEqual([]);
  });

  it('passes Twin Star Exorcists — 135 Fandom vs 134 AniList (on-series)', () => {
    const out = filterFandomChaptersByCrossSeriesGate(1, chapters(135), { mangadex: 12, anilist: 134 }, CFG);
    expect(out).toHaveLength(135);
  });

  it('passes a small spin-off within range — 80 Fandom vs 73 AniList', () => {
    // 80 < 73*1.5 (=109.5) → no tight gate; 80 < 146 → no 2x gate.
    const out = filterFandomChaptersByCrossSeriesGate(1, chapters(80), { mangadex: 0, anilist: 73 }, CFG);
    expect(out).toHaveLength(80);
  });

  it('still gates a clear 2x overflow — 200 Fandom vs 73 AniList', () => {
    expect(filterFandomChaptersByCrossSeriesGate(1, chapters(200), { mangadex: 0, anilist: 73 }, CFG)).toEqual([]);
  });

  it('does not fire the tight backstop below the AniList floor — 45 Fandom vs 25 AniList', () => {
    // AL=25 < tightMinAniList(30): tight rule cannot apply. 45 < 25*2 (=50) → pass.
    const out = filterFandomChaptersByCrossSeriesGate(1, chapters(45), { mangadex: 0, anilist: 25 }, CFG);
    expect(out).toHaveLength(45);
  });

  it('falls back to MangaDex when AniList is unavailable — 100 Fandom vs 12 MangaDex', () => {
    expect(filterFandomChaptersByCrossSeriesGate(1, chapters(100), { mangadex: 12, anilist: 0 }, CFG)).toEqual([]);
  });
});
