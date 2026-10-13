/**
 * @jest-environment node
 *
 * A finished series' chapter count may exceed its agreed final chapter by
 * extras numbered after it. Demon Slayer: AniList and Kitsu say 207; the story
 * ends at 205, and MangaDex numbers the two extras 205.1 (Rengoku one-shot)
 * and 205.6 (extended ending) in the preferred language. Keeping 207 created placeholders "Chapter 206"
 * and "Chapter 207" on every refresh. When the listed extras account for the
 * whole excess, the final chapter is stored instead.
 */
import { boundByCorroboratedFinal, countExtrasAfterFinal } from '../corroborated-final-chapter';
import { resolveTrustedFinalChapter } from '../phase-data-assembly';
import { applyCorroboratedFinalChapter } from '../phase-volume-cross-validation/volume-gate-ceiling';

import type { UnifiedProviderResults } from '../types';

interface Shape {
  status?: string;
  scalar: number;
  /** MangaDex lastChapter and MangaUpdates latestChapter (completed when the series is). */
  final: number;
  /** MangaDex chapter list: 1..final plus these. */
  mangadexExtras?: number[];
  /** Fandom chapter list: 1..final plus these. */
  fandomExtras?: number[];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function results(shape: Shape): UnifiedProviderResults {
  const listed = (extras: number[] | undefined): Array<{ number: number; inPreferredLanguage: boolean }> | null =>
    extras === undefined ? null : [...range(1, shape.final), ...extras].map(number => ({ number, inPreferredLanguage: true }));
  const fandom = listed(shape.fandomExtras);
  const finished = (shape.status ?? 'COMPLETED') === 'COMPLETED';
  return {
    enrichmentResult: {
      appliedMatch: {
        metadata: { status: shape.status ?? 'COMPLETED', chapters: shape.scalar },
        perFieldProvenance: { chapters: 'anilist' },
      },
      enrichedData: { manga: { mangadexMeta: { status: finished ? 'completed' : 'ongoing', lastChapter: String(shape.final) } } },
    },
    wikipediaResult: null,
    fandomResult: fandom === null ? null : { url: 'x', chapterList: fandom, volumeList: [], parseSuccess: true },
    mangaupdatesResult: { completed: finished, latestChapter: shape.final },
    mangadexAggregate: null,
    mangadexChapterList: listed(shape.mangadexExtras),
  } as unknown as UnifiedProviderResults;
}

function storedChapters(r: UnifiedProviderResults): unknown {
  return (r.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters'];
}

const demonSlayer: Shape = { scalar: 207, final: 205, mangadexExtras: [205.1, 205.6] };
const attackOnTitan: Shape = { scalar: 141, final: 139, fandomExtras: [139.5, 139.6] };

describe('countExtrasAfterFinal', () => {
  it('counts distinct decimal chapters between the final chapter and the next whole number', () => {
    expect(countExtrasAfterFinal(results(demonSlayer), 205)).toBe(2);
    expect(countExtrasAfterFinal(results({ ...demonSlayer, mangadexExtras: [200.5, 205.1, 205.1, 206] }), 205)).toBe(1);
  });

  it('takes the most one provider lists, not the union, so one extra numbered two ways counts once', () => {
    const r = results({ scalar: 207, final: 205, mangadexExtras: [205.5], fandomExtras: [205.6] });
    expect(countExtrasAfterFinal(r, 205)).toBe(1);
  });
});

describe('boundByCorroboratedFinal — extras within slack', () => {
  const agreed = { chapter: 205, sources: ['mangadex', 'mangaupdates'] };

  it('lowers to the final chapter when the listed extras cover the whole excess', () => {
    expect(boundByCorroboratedFinal(207, agreed, [], { extrasAfterFinal: 2 })).toBe(205);
  });

  it('keeps the scalar when fewer extras are listed than the excess', () => {
    expect(boundByCorroboratedFinal(207, agreed, [], { extrasAfterFinal: 1 })).toBe(207);
  });

  it('never lowers below a collected floor above the final chapter', () => {
    expect(boundByCorroboratedFinal(207, agreed, [], { collectedFloor: 207, extrasAfterFinal: 5 })).toBe(207);
    expect(boundByCorroboratedFinal(207, agreed, [], { collectedFloor: Number.POSITIVE_INFINITY, extrasAfterFinal: 5 })).toBe(207);
  });
});

describe('finished series whose count includes extras after the final chapter', () => {
  it('Demon Slayer (207, final 205, MangaDex lists 205.1 and 205.6) stores 205', () => {
    const r = results(demonSlayer);
    expect(resolveTrustedFinalChapter(r).ceiling).toBe(205);
    expect(applyCorroboratedFinalChapter(r)).toEqual({ from: 207, to: 205, sources: ['mangadex', 'mangaupdates'] });
    expect(storedChapters(r)).toBe(205);
  });

  it('Attack on Titan (141, final 139, Fandom lists two 139.x extras) stores 139', () => {
    const r = results(attackOnTitan);
    expect(applyCorroboratedFinalChapter(r)).toMatchObject({ from: 141, to: 139 });
    expect(storedChapters(r)).toBe(139);
  });

  it('keeps 207 when only one extra is listed against an excess of two', () => {
    const r = results({ ...demonSlayer, mangadexExtras: [205.1] });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect(storedChapters(r)).toBe(207);
  });

  it('keeps 207 when no provider lists any extra', () => {
    const r = results({ ...demonSlayer, mangadexExtras: [] });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect(storedChapters(r)).toBe(207);
  });

  it('leaves an ongoing series alone even with extras listed', () => {
    const r = results({ ...demonSlayer, status: 'ONGOING' });
    expect(resolveTrustedFinalChapter(r).trusted).toBe(false);
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect(storedChapters(r)).toBe(207);
  });
});
