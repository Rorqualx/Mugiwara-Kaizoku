/**
 * Extraction Tests for ProviderFetchingService
 *
 * Tests for data extraction functions and edge cases.
 *
 * Extracted from: provider-fetcher.test.ts (lines 498-838)
 */

import {
  createTestContext,
  expectSuccessWithData,
  isError,
  isSuccess,
  mockManga,
  mockSearchResult,
  searchProviderRegistry,
  setupMockProvider,
} from './test-utils';

import type { FetchInput, SearchResult } from './test-utils';

describe('ProviderFetchingService - Extractions', () => {
  let service: ReturnType<typeof createTestContext>['service'];
  let mockProviderMatcher: ReturnType<typeof createTestContext>['mockProviderMatcher'];

  beforeEach(() => {
    jest.clearAllMocks();
    const context = createTestContext();
    service = context.service;
    mockProviderMatcher = context.mockProviderMatcher;
  });

  describe('extractAuthors', () => {
    it('should extract author from string field', async () => {
      const searchResult = {
        ...mockSearchResult,
        author: 'Eiichiro Oda',
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['authors']).toEqual(['Eiichiro Oda']);
      });
    });

    it('should extract authors from array field', async () => {
      const { author: _author, ...rest } = mockSearchResult;
      const searchResult = {
        ...rest,
        authors: ['Author 1', 'Author 2'],
      } as unknown as SearchResult & { authors: string[] };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['authors']).toEqual(['Author 1', 'Author 2']);
      });
    });

    it('should return undefined when no authors', async () => {
      const { author: _author, ...searchResultWithoutAuthor } = mockSearchResult;
      const searchResult = searchResultWithoutAuthor;
      delete (searchResult as Record<string, unknown>)['authors'];

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['authors']).toBeUndefined();
      });
    });
  });

  describe('extractArtists', () => {
    it('should extract artists from array field', async () => {
      const searchResult = {
        ...mockSearchResult,
        artists: ['Artist 1', 'Artist 2'],
      } as SearchResult & { artists: string[] };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['artists']).toEqual(['Artist 1', 'Artist 2']);
      });
    });

    it('should return undefined when no artists', async () => {
      const searchResult = {
        ...mockSearchResult,
      };
      delete (searchResult as Record<string, unknown>)['artists'];

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['artists']).toBeUndefined();
      });
    });
  });

  describe('extractPublisher', () => {
    it('should extract publisher from string', async () => {
      const searchResult = {
        ...mockSearchResult,
        publisher: 'Shueisha',
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['publisher']).toBe('Shueisha');
      });
    });

    it('should extract publisher from object', async () => {
      const searchResult = {
        ...mockSearchResult,
        publisher: { id: 1, name: 'Shueisha' },
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['publisher']).toBe('Shueisha');
      });
    });

    it('should return undefined when no publisher', async () => {
      const { publisher: _publisher, ...searchResultWithoutPublisher } = mockSearchResult as SearchResult & { publisher?: unknown };
      const searchResult = searchResultWithoutPublisher;

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['publisher']).toBeUndefined();
      });
    });
  });

  describe('extractProviderId', () => {
    it('should extract numeric ID from metadata', async () => {
      const mangaWithMetadata: FetchInput = {
        ...mockManga,
        providerMetadata: { id: 123 },
      };

      const mockProvider = {
        name: 'anilist',
        getMetadata: jest.fn().mockResolvedValue(mockSearchResult),
      };

      (searchProviderRegistry.get as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.fetchFromProvider('anilist', mangaWithMetadata, {
        isPrimary: true,
      });

      expect(isSuccess(result)).toBe(true);
      expect(mockProvider.getMetadata).toHaveBeenCalledWith('123', 'One Piece');
    });

    it('should extract string ID from metadata', async () => {
      const mangaWithMetadata: FetchInput = {
        ...mockManga,
        providerMetadata: { id: 'abc-123' },
      };

      const mockProvider = {
        name: 'mangadex',
        getMetadata: jest.fn().mockResolvedValue(mockSearchResult),
      };

      (searchProviderRegistry.get as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.fetchFromProvider('mangadex', mangaWithMetadata, {
        isPrimary: true,
      });

      expect(isSuccess(result)).toBe(true);
      expect(mockProvider.getMetadata).toHaveBeenCalledWith('abc-123', 'One Piece');
    });

    it('should return null for invalid metadata', async () => {
      const mangaWithInvalidMetadata: FetchInput = {
        ...mockManga,
        providerMetadata: null,
      };

      setupMockProvider(mockProviderMatcher, 'anilist', mockSearchResult);

      const result = await service.fetchFromProvider(
        'anilist',
        mangaWithInvalidMetadata,
        { isPrimary: true }
      );

      expect(isSuccess(result)).toBe(true);
      // Should fall back to title search
      expect(mockProviderMatcher.findMatch).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null chapters and volumes', async () => {
      const searchResult = {
        ...mockSearchResult,
        chapters: null,
        volumes: null,
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.chapterCount).toBeNull();
        expect(data.volumeCount).toBeNull();
      });
    });

    it('should use cover field as fallback for coverImage', async () => {
      const { coverImage: _coverImage, ...searchResultWithoutCover } = mockSearchResult;
      const searchResult = {
        ...searchResultWithoutCover,
        cover: 'https://example.com/fallback-cover.jpg',
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['coverImage']).toBe('https://example.com/fallback-cover.jpg');
      });
    });

    it('should handle provider without getMetadata method', async () => {
      const mockProvider = {
        name: 'invalid',
        search: jest.fn(),
        // No getMetadata method
      };

      (searchProviderRegistry.get as jest.Mock).mockReturnValue(mockProvider);

      const result = await service.fetchFromProvider('invalid', mockManga);

      expect(isError(result)).toBe(true);
    });

    it('should set provider field if missing in SearchResult', async () => {
      const { provider: _provider, ...searchResultWithoutProvider } = mockSearchResult;

      setupMockProvider(mockProviderMatcher, 'anilist', searchResultWithoutProvider);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.primarySource).toBe('anilist');
      });
    });
  });
});
