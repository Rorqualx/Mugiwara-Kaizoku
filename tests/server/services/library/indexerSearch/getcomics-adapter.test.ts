/**
 * @jest-environment node
 *
 * iter-GC: searchGetComics adapter coverage.
 * Mocks getGetComicsService so we don't hit the network.
 */
import type { GetComicsSearchResult } from '@/server/services/getcomics';

const searchComicsMock = jest.fn();

jest.mock('@/server/services/getcomics', () => ({
  getGetComicsService: () => ({ searchComics: searchComicsMock }),
}));

import { searchGetComics } from '@/server/services/library/indexerSearch/adapters/getcomics-adapter';

function mkHit(overrides: Partial<GetComicsSearchResult> = {}): GetComicsSearchResult {
  return {
    id: 'sample-slug',
    title: 'Sample Comic #1',
    url: 'https://getcomics.org/comic/sample-slug/',
    source: 'getcomics',
    ...overrides,
  };
}

beforeEach(() => {
  searchComicsMock.mockReset();
});

describe('searchGetComics', () => {
  it('returns [] when the service errors', async () => {
    searchComicsMock.mockResolvedValue({ status: 'error', error: new Error('boom') });
    expect(await searchGetComics('Batman')).toEqual([]);
  });

  it('returns [] when search succeeds with 0 hits', async () => {
    searchComicsMock.mockResolvedValue({ status: 'success', data: [] });
    expect(await searchGetComics('Batman')).toEqual([]);
  });

  it('emits one pack-granularity candidate per hit', async () => {
    searchComicsMock.mockResolvedValue({
      status: 'success',
      data: [mkHit({ id: 'a', title: 'A', url: 'https://getcomics.org/comic/a/' }),
             mkHit({ id: 'b', title: 'B', url: 'https://getcomics.org/comic/b/' })],
    });
    const candidates = await searchGetComics('Batman');
    expect(candidates).toHaveLength(2);
    for (const c of candidates) {
      expect(c.source).toBe('getcomics');
      expect(c.granularity).toBe('pack');
      expect(c.coverage.chapters).toEqual([]);
      expect(c.enqueueJobType).toBe('getcomics_download');
    }
  });

  it('orders by position — first hit gets the highest score', async () => {
    searchComicsMock.mockResolvedValue({
      status: 'success',
      data: [mkHit({ id: 'a', title: 'A' }), mkHit({ id: 'b', title: 'B' }),
             mkHit({ id: 'c', title: 'C' })],
    });
    const candidates = await searchGetComics('Batman');
    expect(candidates[0]!.score).toBeGreaterThan(candidates[1]!.score);
    expect(candidates[1]!.score).toBeGreaterThan(candidates[2]!.score);
  });

  it('caps hits at MAX_HITS=8 to bound the candidate pool', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      mkHit({ id: `h${i}`, title: `H${i}`, url: `https://getcomics.org/comic/h${i}/` }),
    );
    searchComicsMock.mockResolvedValue({ status: 'success', data: many });
    const candidates = await searchGetComics('Batman');
    expect(candidates).toHaveLength(8);
  });

  it('carries detail-page URL + metadata into the payload', async () => {
    searchComicsMock.mockResolvedValue({
      status: 'success',
      data: [mkHit({
        id: 'wonder-woman-vol1',
        title: 'Wonder Woman Vol 1',
        url: 'https://getcomics.org/comic/wonder-woman-vol1/',
        year: '2023',
        format: 'CBR',
        size: '420 MB',
      })],
    });
    const [c] = await searchGetComics('Wonder Woman');
    const payload = c!.payload as { detailPageUrl: string; slug: string; year?: string };
    expect(payload.detailPageUrl).toBe('https://getcomics.org/comic/wonder-woman-vol1/');
    expect(payload.slug).toBe('wonder-woman-vol1');
    expect(payload.year).toBe('2023');
  });
});
