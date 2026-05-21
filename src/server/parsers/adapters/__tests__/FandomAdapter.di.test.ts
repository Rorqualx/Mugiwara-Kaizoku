import { describe, it, expect, jest } from '@jest/globals';

import { FandomAdapter } from '@/server/parsers/adapters/FandomAdapter';
import type { FandomService } from '@/server/services/fandom/FandomService';
import type { FandomMangaData } from '@/server/services/fandom/types';

describe('Fandom Adapter with Dependency Injection', () => {
  it('should extract manga metadata from Fandom wiki using mocked service', async () => {
    // Create a mock FandomService with proper typing
    const mockMangaData: FandomMangaData = {
      title: 'One Piece',
      alternativeTitles: ['ワンピース'],
      genres: ['Action', 'Adventure', 'Comedy'],
      status: 'ongoing',
      author: 'Eiichiro Oda',
      publisher: 'Shueisha',
      magazine: 'Weekly Shōnen Jump',
      published: '1997-07-22',
      totalChapters: 1100,
      volumes: '107',
      coverImage: 'https://example.com/one-piece-cover.jpg',
      synopsis: 'A manga about pirates searching for treasure',
      volumeList: [
        {
          volumeNumber: 1,
          number: 1,
          title: 'Romance Dawn',
          coverImage: 'https://example.com/volume-1.jpg',
          releaseDate: '1997-12-24',
          isbn: '978-4088725093',
          chapters: [
            { number: 1, title: 'Romance Dawn' },
            { number: 2, title: 'That Man' }
          ]
        }
      ]
    };

    const mockFandomService = {
      getMangaInfo: jest.fn<() => Promise<FandomMangaData | null>>().mockResolvedValue(mockMangaData),
      destroy: jest.fn()
    };

    // Create adapter with mocked service - use type assertion for testing
    const adapter = new FandomAdapter({
      fandomService: mockFandomService as unknown as FandomService
    });

    const result = await adapter.extract('One Piece');

    expect(result).toBeDefined();
    expect(result.title).toBe('One Piece');
    expect(result.source.type).toBe('fandom');
    expect(result.alternativeTitles).toContain('ワンピース');
    expect(result.genres).toContain('Action');
    expect(result.author).toEqual(['Eiichiro Oda']);
    expect(result.publisher).toBe('Shueisha');
    expect(result.totalChapters).toBe(1100);
    expect(result.volumes).toBeDefined();
    expect(result.volumes.length).toBeGreaterThan(0);

    // Verify the service was called
    expect(mockFandomService.getMangaInfo).toHaveBeenCalledWith('One Piece');
  });
});
