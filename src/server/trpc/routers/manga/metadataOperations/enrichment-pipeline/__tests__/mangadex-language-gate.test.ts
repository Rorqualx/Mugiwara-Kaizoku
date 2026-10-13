/**
 * @jest-environment node
 *
 * MangaDex chapter numbers become chapter rows only when the preferred
 * language (or another provider, or the series' integer range) supports them.
 * Demon Slayer's main MangaDex entry lists 7.5, 25.1 … 205.2, 205.5 only as
 * Arabic / Portuguese / Spanish uploads; a refresh created ~39 file-less
 * decimal rows from them.
 */
jest.mock('@/utils/logger', () => {
  const log = { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
  return { logger: { ...log, child: jest.fn(() => log) } };
});

import { buildEnrichmentResult } from '../phase-provider-fetch/enrichment-result-builder';
import { restrictToPreferredLanguage } from '../phase-provider-fetch/mangadex-language-filter';

import type { BuildEnrichmentParams } from '../phase-provider-fetch/enrichment-result-builder';
import type { ChapterDataItem } from '../types';

const NONE = new Set<number>();

function md(number: number, inPreferredLanguage: boolean): ChapterDataItem {
  return { number, pages: 20, inPreferredLanguage };
}

/** Demon Slayer's shape: English has 1..4 and 4.5; everything else is other-language only. */
function demonSlayerList(): ChapterDataItem[] {
  const list: ChapterDataItem[] = [md(1, true), md(2, true), md(3, true), md(4, true), md(4.5, true)];
  for (let n = 5; n <= 205; n++) list.push(md(n, false));
  list.push(md(7.5, false), md(25.1, false), md(205.2, false), md(205.5, false), md(206, false));
  return list.sort((a, b) => a.number - b.number);
}

function numbers(items: ChapterDataItem[]): number[] {
  return items.map(i => i.number);
}

describe('restrictToPreferredLanguage', () => {
  it('drops a decimal that only other-language uploads provide', () => {
    const { kept, dropped } = restrictToPreferredLanguage(demonSlayerList(), { seriesChapterCount: 205, corroboratedNumbers: NONE });
    expect(dropped).toEqual(expect.arrayContaining([7.5, 25.1, 205.2, 205.5]));
    expect(numbers(kept)).not.toContain(25.1);
  });

  it('keeps a decimal that has an upload in the preferred language', () => {
    const { kept } = restrictToPreferredLanguage(demonSlayerList(), { seriesChapterCount: 205, corroboratedNumbers: NONE });
    expect(numbers(kept)).toContain(4.5);
  });

  it('keeps every integer within the series count as a placeholder even with no preferred-language upload', () => {
    const { kept } = restrictToPreferredLanguage(demonSlayerList(), { seriesChapterCount: 205, corroboratedNumbers: NONE });
    const integers = numbers(kept).filter(n => Number.isInteger(n));
    expect(integers).toEqual(Array.from({ length: 205 }, (_, i) => i + 1));
  });

  it('drops an integer above the series count that only other-language uploads provide', () => {
    const { kept, dropped } = restrictToPreferredLanguage(demonSlayerList(), { seriesChapterCount: 205, corroboratedNumbers: NONE });
    expect(numbers(kept)).not.toContain(206);
    expect(dropped).toContain(206);
  });

  it('keeps an other-language-only number another provider (ComicVine) lists', () => {
    const { kept } = restrictToPreferredLanguage(demonSlayerList(), { seriesChapterCount: 205, corroboratedNumbers: new Set([205.5]) });
    expect(numbers(kept)).toContain(205.5);
  });

  it('keeps other-language integers up to the highest preferred-language chapter when that exceeds the count', () => {
    const list = [md(1, true), md(50, true), md(30, false), md(30.5, false)];
    const { kept } = restrictToPreferredLanguage(list, { seriesChapterCount: 20, corroboratedNumbers: NONE });
    expect(numbers(kept)).toEqual([1, 50, 30]);
  });

  it('keeps every other-language integer when the series count is unknown (ongoing) but still drops other-language-only decimals', () => {
    const list = [md(1, true), md(2, true), md(3, false), md(300, false), md(2.5, false)];
    const { kept, dropped } = restrictToPreferredLanguage(list, { seriesChapterCount: 0, corroboratedNumbers: NONE });
    expect(numbers(kept)).toEqual([1, 2, 3, 300]);
    expect(dropped).toEqual([2.5]);
  });

  it('falls back to the whole list when the title has no preferred-language upload and no other provider knows its chapters', () => {
    const list = [md(1, false), md(1.5, false), md(2, false)];
    const result = restrictToPreferredLanguage(list, { seriesChapterCount: 0, corroboratedNumbers: NONE });
    expect(result.fellBack).toBe(true);
    expect(numbers(result.kept)).toEqual([1, 1.5, 2]);
    expect(result.dropped).toEqual([]);
  });

  it('still gates a title with no preferred-language upload when another provider knows its count (licensed series)', () => {
    // Demon Slayer's main entry: zero English chapters in the feed.
    const list = [md(1, false), md(2, false), md(2.5, false), md(3, false), md(4, false)];
    const result = restrictToPreferredLanguage(list, { seriesChapterCount: 3, corroboratedNumbers: NONE });
    expect(result.fellBack).toBe(false);
    expect(numbers(result.kept)).toEqual([1, 2, 3]);
    expect(result.dropped).toEqual([2.5, 4]);
  });

  it('keeps an item whose language is unknown', () => {
    const list: ChapterDataItem[] = [md(1, true), { number: 1.5, pages: 10 }];
    const { kept } = restrictToPreferredLanguage(list, { seriesChapterCount: 1, corroboratedNumbers: NONE });
    expect(numbers(kept)).toEqual([1, 1.5]);
  });

  it('reports no fallback for an empty list', () => {
    expect(restrictToPreferredLanguage([], { seriesChapterCount: 0, corroboratedNumbers: NONE }).fellBack).toBe(false);
  });
});

describe('granular chapter list built from MangaDex', () => {
  function build(chapterList: ChapterDataItem[], aniListChapters: number | undefined): number[] {
    const anilist = aniListChapters === undefined
      ? null
      : { id: 87216, details: { title: { romaji: 'Kimetsu no Yaiba' }, chapters: aniListChapters } } as unknown as BuildEnrichmentParams['anilist'];
    const result = buildEnrichmentResult({
      mangaId: 88,
      title: 'Kimetsu no Yaiba',
      anilist,
      mangadex: {
        mangaId: '789642f8-ca89-4e4e-8f7b-eee4d17ea08b', status: 'completed',
        lastVolume: undefined, lastChapter: undefined, description: undefined, chapterList,
      },
      comicvine: null, mangaupdates: null, mal: null, kitsu: null,
    });
    const manga = (result.enrichedData as { manga: { chapters: Array<{ chapterNumber: string }> } }).manga;
    return manga.chapters.map(c => parseFloat(c.chapterNumber));
  }

  it('never seeds a chapter row from a number only other-language uploads provide', () => {
    const chapters = build(demonSlayerList(), 205);
    expect(chapters.filter(n => !Number.isInteger(n))).toEqual([4.5]);
    expect(Math.max(...chapters)).toBe(205);
    expect(chapters.filter(n => Number.isInteger(n))).toHaveLength(205);
  });

  it('seeds a Spanish-preferred title from its own uploads when the preference is Spanish', () => {
    // The flag is computed against the configured language, so a Spanish
    // preference marks the Spanish uploads preferred and the English ones not.
    const list = [md(1, true), md(1.5, true), md(2, false), md(2.5, false)];
    expect(build(list, 2)).toEqual([1, 1.5, 2]);
  });
});
