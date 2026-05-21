/**
 * @jest-environment node
 *
 * ProwlarrMangaSearch — in-process search-result cache
 *
 * Verifies that repeated calls with the same query inside the TTL window
 * dedupe to one upstream call, and that distinct queries each go through.
 * The bug case: findAlternativeReleases iterates chapters × synonyms and
 * issues the same `query` string many times — without caching, each one
 * hits Prowlarr; with caching, only the first does.
 */

import { ProwlarrMangaSearch, clearProwlarrSearchCache } from '@/server/services/prowlarr/mangaSearch';
import { createSuccessResult } from '@/utils/async-result';

describe('ProwlarrMangaSearch search cache', () => {
  let service: ProwlarrMangaSearch;
  let uncachedSpy: jest.SpyInstance;

  beforeEach(() => {
    clearProwlarrSearchCache();
    service = new ProwlarrMangaSearch({} as never);
    uncachedSpy = jest
      .spyOn(service, 'searchMangaUncached')
      .mockResolvedValue(
        createSuccessResult({ results: [], queryFailures: [], totalQueries: 1 }),
      );
  });

  afterEach(() => {
    uncachedSpy.mockRestore();
  });

  it('dedupes repeated calls with the same query', async () => {
    await service.searchManga('Asshou');
    await service.searchManga('Asshou');
    await service.searchManga('Asshou');
    expect(uncachedSpy).toHaveBeenCalledTimes(1);
  });

  it('runs a fresh search when the query string differs', async () => {
    await service.searchManga('Asshou');
    await service.searchManga('Asshou chapter');
    await service.searchManga('Asshou ch');
    expect(uncachedSpy).toHaveBeenCalledTimes(3);
  });

  it('treats distinct options as cache misses', async () => {
    await service.searchManga('Asshou');
    await service.searchManga('Asshou', { categories: [7000] });
    await service.searchManga('Asshou', { categories: [7000], limit: 50 });
    expect(uncachedSpy).toHaveBeenCalledTimes(3);
  });

  it('treats identical options as cache hits', async () => {
    await service.searchManga('Asshou', { categories: [7000], limit: 50 });
    await service.searchManga('Asshou', { categories: [7000], limit: 50 });
    expect(uncachedSpy).toHaveBeenCalledTimes(1);
  });

  it('reproduces findAlternativeReleases-style fan-out savings', async () => {
    // alternatives-finder.ts builds queries like:
    //   "Asshou chapter ${N}" / "Asshou ch${N}" / "Asshou ${N}" / synonyms × N
    // After optimizeSearchQuery + extractBaseMangaTitle strip "Chapter X",
    // these collapse to the same handful of distinct strings. The cache
    // should hit on every duplicate within one run.
    const distinct = ['Asshou chapter', 'Asshou ch', 'Asshou', 'chapter'];
    for (const q of distinct) {
      // Each distinct string appears 9 times (one per chapter in volume 1).
      for (let i = 0; i < 9; i++) {
        // eslint-disable-next-line no-await-in-loop -- sequential to test cache state
        await service.searchManga(q);
      }
    }
    expect(uncachedSpy).toHaveBeenCalledTimes(distinct.length);
  });
});
