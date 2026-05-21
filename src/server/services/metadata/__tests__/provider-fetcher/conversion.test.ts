/**
 * Conversion Tests for ProviderFetchingService
 *
 * Tests for data conversion and mapping functions (status, format, tags).
 *
 * Extracted from: provider-fetcher.test.ts (lines 240-496)
 */

import {
  createTestContext,
  expectSuccessWithData,
  MangaFormat,
  MangaPublicationStatus,
  mockManga,
  mockSearchResult,
  setupMockProvider,
} from './test-utils';

import type { SearchResult } from './test-utils';

describe('ProviderFetchingService - Conversions', () => {
  let service: ReturnType<typeof createTestContext>['service'];
  let mockProviderMatcher: ReturnType<typeof createTestContext>['mockProviderMatcher'];

  beforeEach(() => {
    jest.clearAllMocks();
    const context = createTestContext();
    service = context.service;
    mockProviderMatcher = context.mockProviderMatcher;
  });

  describe('convertToUnifiedMetadata', () => {
    it('should convert SearchResult to PartialUnifiedMetadata', async () => {
      setupMockProvider(mockProviderMatcher, 'anilist', mockSearchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['title']).toBe('One Piece');
        expect(data['description']).toBe('Pirate adventure manga');
        expect(data['coverImage']).toBe('https://example.com/cover.jpg');
        expect(data['genres']).toEqual(['Action', 'Adventure']);
        expect(data.chapterCount).toBe(1089);
        expect(data.volumeCount).toBe(106);
        expect(data['year']).toBe(1997);
        expect(data.primarySource).toBe('anilist');
        expect(data.providerMetadata).toBeDefined();
        expect(data.providerMetadata?.[0]?.provider).toBe('anilist');
      });
    });

    it('should handle missing optional fields', async () => {
      const minimalSearchResult: SearchResult = {
        id: '13',
        title: 'Test Manga',
        provider: 'anilist',
      };

      setupMockProvider(mockProviderMatcher, 'anilist', minimalSearchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['title']).toBe('Test Manga');
        expect(data['description']).toBeUndefined();
        expect(data['genres']).toBeUndefined();
      });
    });

    it('should extract externalIds correctly', async () => {
      setupMockProvider(mockProviderMatcher, 'anilist', mockSearchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.externalIds).toBeDefined();
        expect(data.externalIds?.malId).toBe(13);
      });
    });
  });

  describe('mapStatus', () => {
    const statusMappings: Array<[string, MangaPublicationStatus]> = [
      ['ONGOING', MangaPublicationStatus.ONGOING],
      ['RELEASING', MangaPublicationStatus.ONGOING],
      ['PUBLISHING', MangaPublicationStatus.ONGOING],
      ['COMPLETED', MangaPublicationStatus.COMPLETED],
      ['FINISHED', MangaPublicationStatus.COMPLETED],
      ['CANCELLED', MangaPublicationStatus.CANCELLED],
      ['CANCELED', MangaPublicationStatus.CANCELLED],
      ['HIATUS', MangaPublicationStatus.HIATUS],
      ['ON_HIATUS', MangaPublicationStatus.HIATUS],
      ['NOT_YET_RELEASED', MangaPublicationStatus.NOT_YET_RELEASED],
      ['NOT_YET_PUBLISHED', MangaPublicationStatus.NOT_YET_RELEASED],
      ['UNKNOWN_STATUS', MangaPublicationStatus.UNKNOWN],
    ];

    statusMappings.forEach(([input, expected]) => {
      it(`should map "${input}" to ${expected}`, async () => {
        const searchResult = {
          ...mockSearchResult,
          status: input,
        };

        setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

        const result = await service.fetchFromProvider('anilist', mockManga);

        expectSuccessWithData(result, (data) => {
          expect(data['status']).toBe(expected);
        });
      });
    });

    it('should handle undefined status', async () => {
      const { status: _status, ...searchResultWithoutStatus } = mockSearchResult;
      const searchResult = searchResultWithoutStatus;

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['status']).toBeUndefined();
      });
    });
  });

  describe('mapFormat', () => {
    const formatMappings: Array<[string, MangaFormat | undefined]> = [
      ['MANGA', MangaFormat.MANGA],
      ['MANHWA', MangaFormat.MANHWA],
      ['MANHUA', MangaFormat.MANHUA],
      ['NOVEL', MangaFormat.NOVEL],
      ['LIGHT_NOVEL', MangaFormat.NOVEL],
      ['ONE_SHOT', MangaFormat.ONE_SHOT],
      ['ONESHOT', MangaFormat.ONE_SHOT],
      ['UNKNOWN_FORMAT', undefined],
    ];

    formatMappings.forEach(([input, expected]) => {
      it(`should map "${input}" to ${expected || 'undefined'}`, async () => {
        const searchResult = {
          ...mockSearchResult,
          format: input,
        };

        setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

        const result = await service.fetchFromProvider('anilist', mockManga);

        expectSuccessWithData(result, (data) => {
          expect(data.format).toBe(expected);
        });
      });
    });
  });

  describe('convertTags', () => {
    it('should convert string array tags', async () => {
      const searchResult = {
        ...mockSearchResult,
        tags: ['Action', 'Adventure', 'Shounen'],
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.tags).toEqual([
          { name: 'Action' },
          { name: 'Adventure' },
          { name: 'Shounen' },
        ]);
      });
    });

    it('should convert object array tags with rank', async () => {
      const searchResult = {
        ...mockSearchResult,
        tags: [
          { name: 'Action', rank: 90 },
          { name: 'Adventure', rank: 85 },
        ],
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.tags).toEqual([
          { name: 'Action', rank: 90 },
          { name: 'Adventure', rank: 85 },
        ]);
      });
    });

    it('should handle empty tags array', async () => {
      const searchResult = {
        ...mockSearchResult,
        tags: [],
      };

      setupMockProvider(mockProviderMatcher, 'anilist', searchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.tags).toBeUndefined();
      });
    });
  });
});
