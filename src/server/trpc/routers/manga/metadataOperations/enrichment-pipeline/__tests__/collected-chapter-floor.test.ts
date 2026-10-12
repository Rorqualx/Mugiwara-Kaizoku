/**
 * @jest-environment node
 *
 * The finished-series chapter bound lowers a count (AniList/Kitsu) to the
 * final chapter providers agree on. A chapter printed in a tankobon is real
 * whether or not the feeds number it: Dr. STONE's numbering ends at 232 in
 * volume 26, and volume 27 collects 233-236. These tests guard that the bound
 * never goes below what the providers' volume lists place, and that Bleach
 * (686 is the end of volume 74, the last volume) is still bounded.
 */
import { collectedChapterFloor, collectVolumePlacements, type VolumePlacement } from '../collected-chapter-floor';
import { boundByCorroboratedFinal } from '../corroborated-final-chapter';
import { resolveTrustedFinalChapter } from '../phase-data-assembly';
import { applyCorroboratedFinalChapter } from '../phase-volume-cross-validation/volume-gate-ceiling';

import type { UnifiedProviderResults } from '../types';

interface Shape {
  scalar: number;
  volumes: number;
  /** MangaDex completed lastChapter and MangaUpdates completed latestChapter. */
  feedsFinal: number;
  /** Wikipedia volume list: volume number → chapter numbers as listed. */
  wikiVolumes: Record<number, Array<string | number>>;
  /** ComicVine volume descriptions: volume number → description. */
  comicvine?: Record<number, string>;
  /** MangaDex aggregate: volume number → [first, last]. */
  aggregate?: Record<number, [number, number]>;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function results(shape: Shape): UnifiedProviderResults {
  const cvVolumes = Object.entries(shape.comicvine ?? {}).map(([n, description]) => ({ volumeNumber: n, description }));
  return {
    enrichmentResult: {
      appliedMatch: {
        metadata: { status: 'COMPLETED', chapters: shape.scalar, volumes: shape.volumes },
        perFieldProvenance: { chapters: 'anilist' },
      },
      enrichedData: {
        manga: { mangadexMeta: { status: 'completed', lastChapter: String(shape.feedsFinal) }, volumes: cvVolumes },
      },
    },
    wikipediaResult: {
      data: {
        chapters: shape.feedsFinal,
        volumeList: Object.entries(shape.wikiVolumes).map(([n, chapters]) => ({
          number: Number(n),
          chapters: chapters.map(number => ({ number })),
        })),
      },
      chapterList: range(1, shape.feedsFinal).map(number => ({ number })),
      ownChapterCount: shape.feedsFinal,
    },
    mangaupdatesResult: { completed: true, latestChapter: shape.feedsFinal },
    mangadexAggregate: shape.aggregate === undefined ? null : {
      mangaId: 'x',
      volumes: Object.entries(shape.aggregate).map(([n, [start, end]]) => ({
        volumeNumber: Number(n), chapterStart: start, chapterEnd: end, chapterCount: end - start + 1, chapters: range(start, end),
      })),
    },
  } as unknown as UnifiedProviderResults;
}

/** Dr. STONE as the providers answered: numbering stops at 232 in volume 26; volume 27 lists no numbers. */
const drStone: Shape = {
  scalar: 236,
  volumes: 27,
  feedsFinal: 232,
  wikiVolumes: {
    25: range(215, 222),
    26: [224, 225, 226, 227, 228, 230, 231, 232],
    27: [],
  },
  aggregate: { 22: [188, 196], 23: [197, 205] },
};

/** Bleach: 686 closes volume 74, the last volume; AniList's 706 adds 20 extras that are in no volume. */
const bleach: Shape = {
  scalar: 706,
  volumes: 74,
  feedsFinal: 686,
  wikiVolumes: { 71: range(642, 650), 72: [], 73: [], 74: [] },
  comicvine: { 74: 'Chapter 675. The Midnight Eye\nChapter 685. Death & Strawberry 2\nChapter 686. Death & Strawberry' },
  aggregate: { 39: [336, 336] },
};

describe('collectedChapterFloor', () => {
  it('is the highest chapter any provider places in a numbered volume', () => {
    const placements: VolumePlacement[] = [
      { source: 'wikipedia', volume: 26, chapter: 232 },
      { source: 'comicvine', volume: 27, chapter: 236 },
    ];
    expect(collectedChapterFloor(placements, 232, 27)).toBe(236);
  });

  it('is unbounded when the final chapter sits in a volume before the last one', () => {
    const placements: VolumePlacement[] = [
      { source: 'wikipedia', volume: 26, chapter: 232 },
      { source: 'wikipedia', volume: 27, chapter: 0 },
    ];
    expect(collectedChapterFloor(placements, 232, 27)).toBe(Number.POSITIVE_INFINITY);
  });

  it('a final chapter no provider places is no evidence of later chapters', () => {
    const placements: VolumePlacement[] = [{ source: 'wikipedia', volume: 71, chapter: 650 }];
    expect(collectedChapterFloor(placements, 686, 74)).toBe(650);
  });

  it('without a stated volume count the last volume is the highest Wikipedia or ComicVine lists, not a MangaDex tag', () => {
    const placements: VolumePlacement[] = [
      { source: 'wikipedia', volume: 26, chapter: 232 },
      { source: 'mangadex', volume: 40, chapter: 12 },
    ];
    expect(collectedChapterFloor(placements, 232, null)).toBe(232);
  });
});

describe('boundByCorroboratedFinal with a collected floor', () => {
  const agreed = { chapter: 232, sources: ['mangadex', 'mangaupdates'] };

  it('never bounds below a chapter placed in a volume', () => {
    expect(boundByCorroboratedFinal(240, agreed, [], 236)).toBe(236);
  });

  it('keeps the scalar when the collected floor reaches it', () => {
    expect(boundByCorroboratedFinal(236, agreed, [], 236)).toBe(236);
    expect(boundByCorroboratedFinal(236, agreed, [], Number.POSITIVE_INFINITY)).toBe(236);
  });
});

describe('finished-series chapter bound against collected volumes', () => {
  it('Dr. STONE keeps 236: chapters 233-236 are collected in volume 27 after the final numbered chapter 232', () => {
    const r = results(drStone);
    expect(collectVolumePlacements(r)).toContainEqual({ source: 'wikipedia', volume: 26, chapter: 232 });
    const final = resolveTrustedFinalChapter(r);
    expect(final.corroboratedFinal).toBe(232);
    expect(final.ceiling).toBe(236);
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect((r.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters']).toBe(236);
  });

  it('Bleach still bounds 706 to 686: volume 74, the last volume, ends at 686', () => {
    const r = results(bleach);
    expect(resolveTrustedFinalChapter(r).ceiling).toBe(686);
    expect(applyCorroboratedFinalChapter(r)).toEqual({ from: 706, to: 686, sources: expect.arrayContaining(['mangadex']) });
    expect((r.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters']).toBe(686);
  });

  it('a provider placing a chapter above the agreed final in a volume raises the bound to it', () => {
    const r = results({ ...drStone, scalar: 245, comicvine: { 27: 'Chapter 233. Epilogue\nChapters 234 - 236' } });
    expect(resolveTrustedFinalChapter(r).ceiling).toBe(236);
    expect(applyCorroboratedFinalChapter(r)).toEqual({ from: 245, to: 236, sources: ['comicvine'] });
  });
});
