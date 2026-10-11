/** @jest-environment node */
/**
 * Manga detail cache boundary. `Chapter.size` is a BigInt column and the cache
 * layers store JSON, which cannot hold a BigInt: the row is converted to a
 * number on the way in and back to a bigint on the way out, so a cache hit
 * returns the same shape as a database read.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUnified = {
  get: jest.fn<(key: string, namespace?: string) => Promise<unknown>>(),
  set: jest.fn<(key: string, value: unknown, options?: unknown) => Promise<boolean>>(),
};
const mockHot = {
  getHot: jest.fn<(type: string, key: string) => Promise<unknown>>(),
  setHot: jest.fn<(type: string, key: string, value: unknown, options?: unknown) => Promise<void>>(),
};
jest.mock('@/server/cache/UnifiedCacheProvider', () => ({ cacheProvider: mockUnified }));
jest.mock('@/server/cache/HotDataCacheProvider', () => ({ hotCacheProvider: mockHot }));
jest.mock('@/server/cache/cache-adapter', () => ({ cache: { clear: jest.fn() } }));

import {
  checkMangaCache,
  fromCachedManga,
  storeMangaInCache,
  toCachedManga,
  type CachedManga,
} from '@/server/trpc/routers/manga/crud-operations/get-manga-cache';

import type { MangaWithRelations } from '@/server/trpc/routers/manga/shared';

/** One Piece's whole-volume row: above the int4 maximum of 2,147,483,647. */
const BIG = BigInt(2_558_355_943);

function manga(sizes: bigint[]): MangaWithRelations {
  const base: Pick<MangaWithRelations, 'id' | 'title'> = { id: 81, title: 'One Piece' };
  const chapters = sizes.map((size, i) => ({ id: i + 1, index: i + 1, mangaId: 81, title: `Chapter ${i + 1}`, size }));
  // Only the fields the cache boundary touches are populated.
  return { ...base, Chapter: chapters } as MangaWithRelations;
}

describe('toCachedManga / fromCachedManga', () => {
  it('a raw row cannot be serialised, the cached form can', () => {
    const row = manga([BIG, BigInt(0)]);
    expect(() => JSON.stringify(row)).toThrow(/BigInt/);

    const json = JSON.stringify(toCachedManga(row));
    expect(JSON.parse(json)).toMatchObject({ id: 81, Chapter: [{ id: 1, size: 2_558_355_943 }, { id: 2, size: 0 }] });
  });

  it('round-trips a size above 2^31 through JSON without loss', () => {
    const cached = JSON.parse(JSON.stringify(toCachedManga(manga([BIG])))) as CachedManga;
    const restored = fromCachedManga(cached);
    expect(restored.Chapter[0]?.size).toBe(BIG);
    expect(typeof restored.Chapter[0]?.size).toBe('bigint');
  });

  it('falls back to 0 for a cached size that is not a whole number', () => {
    const cached = JSON.parse('{"id":81,"Chapter":[{"id":1,"size":null},{"id":2,"size":1.5},{"id":3}]}') as CachedManga;
    expect(fromCachedManga(cached).Chapter.map(c => c.size)).toEqual([BigInt(0), BigInt(0), BigInt(0)]);
  });
});

describe('storeMangaInCache / checkMangaCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnified.set.mockResolvedValue(true);
    mockHot.setHot.mockResolvedValue(undefined);
    mockHot.getHot.mockResolvedValue(null);
    mockUnified.get.mockResolvedValue(null);
  });

  it('hands both cache layers a value JSON.stringify accepts', async () => {
    await storeMangaInCache(81, 'manga:81:limit:0', manga([BIG]));
    for (const value of [mockUnified.set.mock.calls[0]?.[1], mockHot.setHot.mock.calls[0]?.[2]]) {
      expect(JSON.parse(JSON.stringify(value))).toMatchObject({ Chapter: [{ size: 2_558_355_943 }] });
    }
  });

  it('returns bigint sizes on a hot-cache hit and on a regular-cache hit', async () => {
    const stored = JSON.parse(JSON.stringify(toCachedManga(manga([BIG])))) as CachedManga;

    mockHot.getHot.mockResolvedValueOnce(stored);
    expect((await checkMangaCache(81, 'k'))?.Chapter[0]?.size).toBe(BIG);

    mockUnified.get.mockResolvedValueOnce(stored);
    expect((await checkMangaCache(81, 'k'))?.Chapter[0]?.size).toBe(BIG);
    // Promotion to the hot layer keeps the JSON-safe form.
    expect(() => JSON.stringify(mockHot.setHot.mock.calls[0]?.[2])).not.toThrow();
  });

  it('returns null on a miss', async () => {
    expect(await checkMangaCache(81, 'k')).toBeNull();
  });
});
