/**
 * Core Tests for ProviderFetchingService
 *
 * Tests for constructor, fetchFromProvider, and fetchFromMultipleProviders methods.
 *
 * Extracted from: provider-fetcher.test.ts (lines 76-238)
 */

import {
  createTestContext,
  expectErrorContaining,
  expectSuccessWithData,
  MangaFormat,
  MangaPublicationStatus,
  mockManga,
  mockSearchResult,
  ProviderMatcherMock,
  searchProviderRegistry,
  setupMockProvider,
} from './test-utils';

import type { FetchInput } from './test-utils';

describe('ProviderFetchingService', () => {
  let service: ReturnType<typeof createTestContext>['service'];
  let mockProviderMatcher: ReturnType<typeof createTestContext>['mockProviderMatcher'];

  beforeEach(() => {
    jest.clearAllMocks();
    const context = createTestContext();
    service = context.service;
    mockProviderMatcher = context.mockProviderMatcher;
  });

  describe('Constructor', () => {
    it('should initialize ProviderMatcher', () => {
      expect(ProviderMatcherMock).toHaveBeenCalled();
    });
  });

  describe('fetchFromProvider', () => {
    it('should successfully fetch metadata from a provider', async () => {
      setupMockProvider(mockProviderMatcher, 'anilist', mockSearchResult);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data['title']).toBe('One Piece');
        expect(data['status']).toBe(MangaPublicationStatus.ONGOING);
        expect(data.format).toBe(MangaFormat.MANGA);
        expect(data.primarySource).toBe('anilist');
      });
    });

    it('should handle provider not found error', async () => {
      (searchProviderRegistry.get as jest.Mock).mockReturnValue(undefined);

      const result = await service.fetchFromProvider('unknown_provider', mockManga);

      expectErrorContaining(result, 'No metadata found');
    });

    it('should handle no match found', async () => {
      setupMockProvider(mockProviderMatcher, 'anilist', mockSearchResult, null);

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectErrorContaining(result, 'No metadata found');
    });

    it('should handle provider fetch errors', async () => {
      mockProviderMatcher.findMatch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.fetchFromProvider('anilist', mockManga);

      expectErrorContaining(result, 'Failed to fetch');
    });

    it('should use existing provider ID when isPrimary is true', async () => {
      const mangaWithMetadata: FetchInput = {
        ...mockManga,
        providerMetadata: { id: 13 },
      };

      const { mockProvider } = setupMockProvider(
        mockProviderMatcher,
        'anilist',
        mockSearchResult
      );

      const result = await service.fetchFromProvider('anilist', mangaWithMetadata, {
        isPrimary: true,
      });

      expectSuccessWithData(result, () => {
        expect(mockProvider.getMetadata).toHaveBeenCalledWith('13', 'One Piece');
      });
    });
  });

  describe('fetchFromMultipleProviders', () => {
    it('should fetch from multiple providers in parallel', async () => {
      const providers = ['anilist', 'fandom', 'comicvine'];

      mockProviderMatcher.findMatch = jest
        .fn()
        .mockResolvedValueOnce('13')
        .mockResolvedValueOnce('one-piece')
        .mockResolvedValueOnce('12345');

      const createMockProvider = (name: string, id: string): { name: string; getMetadata: jest.Mock } => ({
        name,
        getMetadata: jest.fn().mockResolvedValue({
          ...mockSearchResult,
          id,
          provider: name,
        }),
      });

      (searchProviderRegistry.get as jest.Mock).mockImplementation((name: string) => {
        if (name === 'anilist') return createMockProvider('anilist', '13');
        if (name === 'fandom') return createMockProvider('fandom', 'one-piece');
        if (name === 'comicvine') return createMockProvider('comicvine', '12345');
        return undefined;
      });

      const result = await service.fetchFromMultipleProviders(providers, mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.size).toBe(3);
        expect(data.has('anilist')).toBe(true);
        expect(data.has('fandom')).toBe(true);
        expect(data.has('comicvine')).toBe(true);
      });
    });

    it('should handle partial failures gracefully', async () => {
      const providers = ['anilist', 'invalid', 'comicvine'];

      mockProviderMatcher.findMatch = jest
        .fn()
        .mockResolvedValueOnce('13')
        .mockResolvedValueOnce(null) // Invalid provider returns null
        .mockResolvedValueOnce('12345');

      (searchProviderRegistry.get as jest.Mock).mockImplementation((name: string) => {
        if (name === 'anilist')
          return {
            name: 'anilist',
            getMetadata: jest
              .fn()
              .mockResolvedValue({ ...mockSearchResult, provider: 'anilist' }),
          };
        if (name === 'comicvine')
          return {
            name: 'comicvine',
            getMetadata: jest
              .fn()
              .mockResolvedValue({ ...mockSearchResult, provider: 'comicvine' }),
          };
        return undefined;
      });

      const result = await service.fetchFromMultipleProviders(providers, mockManga);

      expectSuccessWithData(result, (data) => {
        expect(data.size).toBe(2);
        expect(data.has('anilist')).toBe(true);
        expect(data.has('comicvine')).toBe(true);
        expect(data.has('invalid')).toBe(false);
      });
    });

    it('should return error if all providers fail', async () => {
      const providers = ['invalid1', 'invalid2'];

      (searchProviderRegistry.get as jest.Mock).mockReturnValue(undefined);

      const result = await service.fetchFromMultipleProviders(providers, mockManga);

      expectErrorContaining(result, 'Failed to fetch metadata from any of the');
    });
  });
});
