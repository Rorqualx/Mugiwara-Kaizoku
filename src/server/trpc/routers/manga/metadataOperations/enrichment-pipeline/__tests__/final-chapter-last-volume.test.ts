/**
 * @jest-environment node
 *
 * Demon Slayer as the providers answer it: AniList and Kitsu count 207, the
 * story ends at 205 (volume 23 of 23), and the two extras are numbered only by
 * MangaDex uploads in other languages — Arabic 205.2, Brazilian Portuguese
 * 205.5 and a Latin-American Spanish "206" titled "Extras del Final". English
 * MangaDex lists no chapter past 4.5 (the series is licensed); Wikipedia lists
 * the extras only as unnumbered "Special chapters"; Fandom lists 0-205.
 *
 * Bugs protected: the Spanish 206 raised the collected-chapter floor above 205,
 * no English list holds an extra, and so 207 was kept and reconciliation made
 * placeholders "Chapter 206" and "Chapter 207" on every refresh.
 */
import {
  collectVolumePlacements,
  lastVolumeEndsAtFinal,
  type VolumePlacement,
} from '../collected-chapter-floor';
import {
  boundByCorroboratedFinal,
  countExtrasAfterFinal,
  preferredLanguageMangaDexChapters,
} from '../corroborated-final-chapter';
import { resolveTrustedFinalChapter } from '../phase-data-assembly';
import {
  applyCorroboratedFinalChapter,
  crossCheckedFinalChapter,
} from '../phase-volume-cross-validation/volume-gate-ceiling';

import type { ChapterDataItem, UnifiedProviderResults } from '../types';

interface Shape {
  status?: string;
  scalar: number;
  volumes: number;
  /** MangaDex lastChapter, Wikipedia's stated highest and MangaUpdates' latest chapter. */
  final: number;
  /** Wikipedia volume list: volume → [first, last] chapter (0 = lists no numbers). */
  wikiVolumes: Record<number, [number, number]>;
  mangadexChapters: ChapterDataItem[];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function results(shape: Shape): UnifiedProviderResults {
  const finished = (shape.status ?? 'COMPLETED') === 'COMPLETED';
  return {
    enrichmentResult: {
      appliedMatch: {
        metadata: { status: shape.status ?? 'COMPLETED', chapters: shape.scalar, volumes: shape.volumes },
        perFieldProvenance: { chapters: 'anilist' },
      },
      enrichedData: {
        manga: { mangadexMeta: { status: finished ? 'completed' : 'ongoing', lastChapter: String(shape.final) } },
      },
    },
    wikipediaResult: {
      data: {
        chapters: shape.final,
        volumeList: Object.entries(shape.wikiVolumes).map(([n, [first, last]]) => ({
          number: Number(n),
          chapters: (first > 0 ? range(first, last) : []).map(number => ({ number })),
        })),
      },
      chapterList: range(1, shape.final).map(number => ({ number })),
    },
    fandomResult: { url: 'x', chapterList: range(0, shape.final).map(number => ({ number })), volumeList: [], parseSuccess: true },
    mangaupdatesResult: { completed: finished, latestChapter: shape.final },
    mangadexAggregate: null,
    mangadexChapterList: shape.mangadexChapters,
  } as unknown as UnifiedProviderResults;
}

function chapters(numbers: number[], volume: number, inPreferredLanguage: boolean, language: string): ChapterDataItem[] {
  return numbers.map(number => ({ number, volume, language, inPreferredLanguage }));
}

function storedChapters(r: UnifiedProviderResults): unknown {
  return (r.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters'];
}

function crossChecked(r: UnifiedProviderResults): number | null {
  const manga = (r.enrichmentResult.enrichedData as Record<string, Record<string, unknown>>)['manga'];
  return crossCheckedFinalChapter(manga);
}

/** Volumes 1-22 of nine chapters each, volume 23 = 197-205. */
const demonSlayerVolumes: Record<number, [number, number]> = {
  ...Object.fromEntries(range(1, 22).map(v => [v, [v * 9 - 8, v * 9]])),
  23: [197, 205],
};

const demonSlayer: Shape = {
  scalar: 207,
  volumes: 23,
  final: 205,
  wikiVolumes: demonSlayerVolumes,
  mangadexChapters: [
    ...chapters([1, 2, 3, 4, 4.5], 1, true, 'en'),
    ...chapters(range(5, 204), 22, false, 'es-la'),
    ...chapters([205, 206], 23, false, 'es-la'),
    ...chapters([205.2], 23, false, 'ar'),
    ...chapters([205.5], 23, false, 'pt-br'),
  ],
};

describe('MangaDex chapter numbers count only in the preferred language', () => {
  it('keeps only chapters that have an upload in the preferred language', () => {
    const numbers = preferredLanguageMangaDexChapters(results(demonSlayer)).map(c => c.number);
    expect(numbers).toEqual([1, 2, 3, 4, 4.5]);
  });

  it('a Latin-American Spanish "206" tagged volume 23 is not a collected chapter', () => {
    const placements = collectVolumePlacements(results(demonSlayer));
    expect(placements.filter(p => p.source === 'mangadex')).toEqual([{ source: 'mangadex', volume: 1, chapter: 4 }]);
    expect(Math.max(...placements.map(p => p.chapter))).toBe(205);
  });

  it('decimal extras uploaded only in other languages (Arabic 205.2, Portuguese 205.5) are not counted as extras', () => {
    expect(countExtrasAfterFinal(results(demonSlayer), 205)).toBe(0);
  });

  it('the same extras uploaded in the preferred language are counted', () => {
    const english = { ...demonSlayer, mangadexChapters: chapters([205, 205.2, 205.5], 23, true, 'en') };
    expect(countExtrasAfterFinal(results(english), 205)).toBe(2);
  });
});

describe('lastVolumeEndsAtFinal', () => {
  const wiki = (volume: number, chapter: number): VolumePlacement => ({ source: 'wikipedia', volume, chapter });

  it('is true when the last volume of a provider volume list ends at the final chapter', () => {
    expect(lastVolumeEndsAtFinal([wiki(22, 196), wiki(23, 205)], 205, 23)).toBe(true);
  });

  it('is false when the last volume holds chapters no provider numbers (Dr. STONE: 232 ends volume 26 of 27)', () => {
    expect(lastVolumeEndsAtFinal([wiki(26, 232), wiki(27, 0)], 232, 27)).toBe(false);
  });

  it('is false when the final volume is not listed yet', () => {
    expect(lastVolumeEndsAtFinal([wiki(21, 187), wiki(22, 196)], 205, 23)).toBe(false);
  });

  it('is false when any provider places a chapter above the final chapter', () => {
    expect(lastVolumeEndsAtFinal([wiki(23, 205), { source: 'comicvine', volume: 23, chapter: 207 }], 205, 23)).toBe(false);
  });

  it('does not take a MangaDex volume tag as the series volume list', () => {
    expect(lastVolumeEndsAtFinal([{ source: 'mangadex', volume: 23, chapter: 205 }], 205, 23)).toBe(false);
  });

  it('without a stated volume count, the last volume is the highest Wikipedia or ComicVine lists', () => {
    expect(lastVolumeEndsAtFinal([wiki(22, 196), wiki(23, 205)], 205, null)).toBe(true);
  });
});

describe('boundByCorroboratedFinal — the last volume ends at the final chapter', () => {
  const agreed = { chapter: 205, sources: ['mangadex', 'wikipedia'] };

  it('lowers a count within slack to the final chapter', () => {
    expect(boundByCorroboratedFinal(207, agreed, [], { collectedFloor: 205, lastVolumeEndsAtFinal: true })).toBe(205);
  });

  it('keeps a count within slack when nothing explains the excess', () => {
    expect(boundByCorroboratedFinal(207, agreed, [], { collectedFloor: 205 })).toBe(207);
  });

  it('never lowers below a collected chapter above the final chapter', () => {
    expect(boundByCorroboratedFinal(207, agreed, [], { collectedFloor: 206, lastVolumeEndsAtFinal: true })).toBe(207);
  });

  it('keeps a scalar that a witness states as its own highest chapter', () => {
    const witnesses = [{ source: 'mangadex', chapter: 205 }, { source: 'mangaupdates', chapter: 207 }];
    expect(boundByCorroboratedFinal(207, agreed, witnesses, { lastVolumeEndsAtFinal: true })).toBe(207);
  });
});

describe('finished series whose count runs past the end of its last volume', () => {
  it('Demon Slayer stores 205 from 207: volume 23 of 23 ends at 205, other-language 206/205.2/205.5 are ignored', () => {
    const r = results(demonSlayer);
    expect(resolveTrustedFinalChapter(r).ceiling).toBe(205);
    expect(applyCorroboratedFinalChapter(r)).toEqual({ from: 207, to: 205, sources: ['mangadex', 'wikipedia', 'mangaupdates'] });
    expect(storedChapters(r)).toBe(205);
  });

  it('marks the corrected final chapter as cross-checked so the merge gives it no epilogue slack', () => {
    const r = results(demonSlayer);
    applyCorroboratedFinalChapter(r);
    expect(crossChecked(r)).toBe(205);
  });

  it('Attack on Titan stores 139 from 141: volume 34 of 34 ends at 139', () => {
    const volumes = { ...Object.fromEntries(range(1, 33).map(v => [v, [v * 4 - 3, v * 4]])), 34: [136, 139] } as Record<number, [number, number]>;
    const r = results({ scalar: 141, volumes: 34, final: 139, wikiVolumes: volumes, mangadexChapters: [] });
    expect(applyCorroboratedFinalChapter(r)).toMatchObject({ from: 141, to: 139 });
    expect(storedChapters(r)).toBe(139);
  });

  it('keeps 207 while the final volume is not listed yet', () => {
    const { 23: _last, ...through22 } = demonSlayerVolumes;
    const r = results({ ...demonSlayer, wikiVolumes: through22 });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect(storedChapters(r)).toBe(207);
    expect(crossChecked(r)).toBeNull();
  });

  it('keeps 207 when the last listed volume ends below the agreed final chapter', () => {
    const r = results({ ...demonSlayer, wikiVolumes: { ...demonSlayerVolumes, 23: [197, 204] } });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect(storedChapters(r)).toBe(207);
  });

  it('leaves an ongoing series alone', () => {
    const r = results({ ...demonSlayer, status: 'ONGOING' });
    expect(resolveTrustedFinalChapter(r).trusted).toBe(false);
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect(storedChapters(r)).toBe(207);
  });
});
