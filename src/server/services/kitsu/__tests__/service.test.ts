/**
 * @jest-environment node
 */
import { kitsuService } from '../service';

import type { KitsuManga } from '../types';

const mockManga = (id: string, title: string): KitsuManga => ({
  id,
  type: 'manga',
  attributes: {
    slug: title.toLowerCase().replace(/\s+/g, '-'),
    synopsis: 'A long-running shonen manga.',
    description: 'A long-running shonen manga.',
    canonicalTitle: title,
    titles: { en: title, en_jp: title, ja_jp: '' },
    abbreviatedTitles: null,
    startDate: '1997-07-22',
    endDate: null,
    ageRating: 'PG',
    ageRatingGuide: 'Teens 13 or older',
    subtype: 'manga',
    status: 'current',
    posterImage: { original: 'https://example.com/poster.jpg' },
    coverImage: null,
    chapterCount: 1100,
    volumeCount: 105,
    serialization: 'Weekly Shounen Jump',
    averageRating: '88.5',
    userCount: 50000,
    favoritesCount: 12000,
    popularityRank: 5,
    ratingRank: 10,
  },
});

const mockSearchResponse = (data: KitsuManga[]): { data: KitsuManga[]; meta: { count: number } } => ({
  data,
  meta: { count: data.length },
});

describe('KitsuService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchManga', () => {
    it('returns array of matches on successful response', async () => {
      const data = [mockManga('1', 'One Piece')];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse(data)),
      });

      const results = await kitsuService.searchManga('one piece', 5);

      expect(results).toHaveLength(1);
      expect(results[0]?.attributes.canonicalTitle).toBe('One Piece');
    });

    it('returns empty array on HTTP error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: () => Promise.resolve('service unavailable'),
      });

      const results = await kitsuService.searchManga('foo', 5);

      expect(results).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

      const results = await kitsuService.searchManga('foo', 5);

      expect(results).toEqual([]);
    });
  });

  describe('getMangaDetails', () => {
    it('returns manga details on success', async () => {
      const data = mockManga('42', 'Vagabond');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data }),
      });

      const result = await kitsuService.getMangaDetails('42');

      expect(result?.id).toBe('42');
      expect(result?.attributes.canonicalTitle).toBe('Vagabond');
    });

    it('returns null on error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('not found'),
      });

      const result = await kitsuService.getMangaDetails('999');

      expect(result).toBeNull();
    });
  });
});
