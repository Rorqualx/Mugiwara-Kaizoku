/**
 * @jest-environment node
 *
 * Hardening plan 3.1 D: the Wikipedia chapter list is padded with placeholders
 * up to another provider's count. The fetch must report what the article
 * itself yielded so the padding is never mistaken for a second opinion.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

import type { WikipediaChapter, WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';

jest.mock('@/server/db', () => ({ prisma: {} }));
jest.mock('@/server/services/metadata/parse-failure-logger', () => ({ logParseFailure: jest.fn() }));

const findBestMatch = jest.fn<(title: string) => Promise<WikipediaMangaData | null>>();
jest.mock('@/server/services/wikipedia/wikipedia/service', () => ({
  wikipediaService: { findBestMatch: (title: string): Promise<WikipediaMangaData | null> => findBestMatch(title) },
}));
jest.mock('@/server/services/wikipedia/wikipedia/manga-extractor', () => ({
  adaptiveExtract: (): Promise<{ success: boolean; data: null }> => Promise.resolve({ success: false, data: null }),
}));

import {
  fetchWikipediaData,
  fetchWikipediaDataWithExtraction,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wikipedia-fallback/data-fetching';

function article(chapterCount: number, over: Partial<WikipediaMangaData> = {}): WikipediaMangaData {
  const chapterList: WikipediaChapter[] = Array.from({ length: chapterCount }, (_, i) => ({ number: i + 1, title: `Real ${i + 1}` }));
  return { title: 'Series', chapterList, volumeList: [], ...over } as WikipediaMangaData;
}

const isPlaceholder = (ch: WikipediaChapter): boolean => /^Chapter \d+$/u.test(ch.title ?? '');

describe('fetchWikipediaDataWithExtraction', () => {
  beforeEach(() => {
    findBestMatch.mockReset();
  });

  it('gap-fill: pads the list to the hint but reports only the extracted chapters', async () => {
    findBestMatch.mockResolvedValue(article(100));
    const fetched = await fetchWikipediaDataWithExtraction('Series', { mangaupdatesChapters: 139 });
    expect(fetched?.data.chapterList).toHaveLength(139);
    expect(fetched?.extractedChapterList).toHaveLength(100);
    expect(fetched?.extractedChapterList.some(isPlaceholder)).toBe(false);
  });

  it('floor-fill (<30% extracted): keeps the real rows apart from the placeholders', async () => {
    findBestMatch.mockResolvedValue(article(10));
    const fetched = await fetchWikipediaDataWithExtraction('Series', { mangaupdatesChapters: 139 });
    expect(fetched?.data.chapterList).toHaveLength(139);
    expect(fetched?.extractedChapterList.map(ch => ch.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('no hint and no infobox count: nothing is padded', async () => {
    findBestMatch.mockResolvedValue(article(42));
    const fetched = await fetchWikipediaDataWithExtraction('Series');
    expect(fetched?.data.chapterList).toHaveLength(42);
    expect(fetched?.extractedChapterList).toHaveLength(42);
  });

  it('pads to the same number as before the MangaUpdates hint was relabelled', async () => {
    // Priority is unchanged: infobox, AniList, MangaUpdates, MangaDex.
    findBestMatch.mockResolvedValue(article(100));
    const viaMu = await fetchWikipediaData('Series', { mangaupdatesChapters: 139, mangadexChapters: 150 });
    expect(viaMu?.chapterList).toHaveLength(139);

    findBestMatch.mockResolvedValue(article(100));
    const viaAniList = await fetchWikipediaData('Series', { anilistChapters: 120, mangaupdatesChapters: 139 });
    expect(viaAniList?.chapterList).toHaveLength(120);
  });

  it('never numbers a placeholder past the target, even when the list has gaps', async () => {
    // 1,172 rows reaching chapter 1194 (22 numbers missing), target 1195 —
    // the One Piece shape. The old fill numbered 22 placeholders 1195..1216.
    const missing = new Set(Array.from({ length: 22 }, (_, i) => 50 + i * 40));
    const gappy = article(1194);
    gappy.chapterList = (gappy.chapterList ?? []).filter(ch => !missing.has(ch.number as number));
    expect(gappy.chapterList).toHaveLength(1172);
    findBestMatch.mockResolvedValue(gappy);

    const fetched = await fetchWikipediaDataWithExtraction('Series', { mangaupdatesChapters: 1195 });
    const numbers = (fetched?.data.chapterList ?? []).map(ch => Number(ch.number));
    expect(Math.max(...numbers)).toBe(1195);
    expect(fetched?.data.chapterList?.filter(isPlaceholder).map(ch => ch.number)).toEqual([1195]);
  });

  it('does not pad towards a total that was computed from the list itself', async () => {
    // The best-match finder reports "highest number + 1"; as a target that
    // invents one chapter past the latest real one.
    findBestMatch.mockResolvedValue(article(1194, { chapters: 1195 }));
    const fetched = await fetchWikipediaDataWithExtraction('Series');
    expect(fetched?.data.chapterList).toHaveLength(1194);
    expect(fetched?.data.chapterList?.some(isPlaceholder)).toBe(false);

    // A stated total that is the article's own figure is still honoured.
    findBestMatch.mockResolvedValue(article(100, { chapters: 139 }));
    expect((await fetchWikipediaData('Series'))?.chapterList).toHaveLength(139);
  });

  it('adds nothing when the list already reaches the target number', async () => {
    const gappy = article(120);
    gappy.chapterList = (gappy.chapterList ?? []).filter(ch => (ch.number as number) % 10 !== 0 || ch.number === 120);
    findBestMatch.mockResolvedValue(gappy);
    const fetched = await fetchWikipediaDataWithExtraction('Series', { mangaupdatesChapters: 120 });
    expect(fetched?.data.chapterList?.some(isPlaceholder)).toBe(false);
  });

  it('reports a stated total, but not one computed from the list', async () => {
    findBestMatch.mockResolvedValue(article(100, { chapters: 139 }));
    expect((await fetchWikipediaDataWithExtraction('Series'))?.declaredChapterCount).toBe(139);

    // Length, highest number, and the best-match finder's "highest + 1".
    for (const computed of [100, 101]) {
      findBestMatch.mockResolvedValue(article(100, { chapters: computed }));
      // eslint-disable-next-line no-await-in-loop -- sequential by design: one mock per call
      expect((await fetchWikipediaDataWithExtraction('Series'))?.declaredChapterCount).toBeNull();
    }
    findBestMatch.mockResolvedValue(article(100));
    expect((await fetchWikipediaDataWithExtraction('Series'))?.declaredChapterCount).toBeNull();
  });

  it('returns null when Wikipedia has nothing', async () => {
    findBestMatch.mockResolvedValue(null);
    expect(await fetchWikipediaDataWithExtraction('Series')).toBeNull();
  });
});
