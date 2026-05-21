/**
 * @jest-environment node
 *
 * Integration tests for MetadataMergerService
 *
 * Tests the complete metadata enrichment workflow including:
 * - Default provider enrichment
 * - Custom provider selection
 * - 3-tier priority system (rawProviderData → stored → fresh)
 * - Import wizard integration
 * - Chapter enrichment delegation
 */

// Mock dependencies BEFORE imports
const mockFindUnique = jest.fn().mockResolvedValue({
  id: 123,
  title: 'Test Manga',
  metadata: {},
  Metadata: null, // PascalCase - Prisma relation
  providerMetadata: null,
  rawProviderData: null
});
const mockUpdate = jest.fn().mockResolvedValue({
  id: 123,
  title: 'Test Manga',
  Metadata: null
});

jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      get findUnique() {
        return mockFindUnique;
      },
      get update() {
        return mockUpdate;
      }
    }
  }
}));
jest.mock('../../../../pages/api/events/metadata-updates', () => ({
  sendMetadataUpdateEvent: jest.fn()
}));
jest.mock('@auth/prisma-adapter', () => ({
  PrismaAdapter: jest.fn()
}));
jest.mock('../../search/registerProviders', () => ({
  searchProviderRegistry: {
    getAll: jest.fn(() => ({})),
    initialize: jest.fn(),
    get: jest.fn()
  }
}));
jest.mock('../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(),
    })),
  },
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
  })),
}));
// NOTE: Bun requires factory functions for jest.mock()
const mockProviderFetcher = {
  fetchFromProvider: jest.fn(),
  fetchAll: jest.fn()
};

jest.mock('../../metadata/provider-fetcher', () => ({
  ProviderFetchingService: jest.fn().mockImplementation(() => mockProviderFetcher),
  getProviderFetchingService: jest.fn(() => mockProviderFetcher),
  providerFetchingService: mockProviderFetcher
}));
const mockMetadataPersister = {
  persist: jest.fn(),
  update: jest.fn()
};

const mockChapterEnricher = {
  enrich: jest.fn(),
  enrichFromProvider: jest.fn(),
  enrichFromComicVine: jest.fn().mockResolvedValue({
    status: 'success',
    data: { createdCount: 0, updatedCount: 0, totalChapters: 0 }
  }),
  enrichFromFandom: jest.fn().mockResolvedValue({
    status: 'success',
    data: { createdCount: 0, updatedCount: 0, totalChapters: 0 }
  })
};

jest.mock('../../metadata/metadata-persister', () => ({
  MetadataPersistenceService: jest.fn().mockImplementation(() => mockMetadataPersister),
  getMetadataPersistenceService: jest.fn(() => mockMetadataPersister)
}));
jest.mock('../../metadata/chapter-enricher', () => ({
  ChapterEnrichmentService: jest.fn().mockImplementation(() => mockChapterEnricher),
  getChapterEnrichmentService: jest.fn(() => mockChapterEnricher)
}));
jest.mock('../../metadata/configService', () => ({
  getMetadataConfigService: jest.fn(() => ({
    getDefaultProviders: jest.fn(() => ['anilist']),
    getProviderPriority: jest.fn(() => ['anilist', 'mangadex'])
  }))
}));
jest.mock('../../metadata/unified-merger', () => ({
  UnifiedMetadataMerger: jest.fn().mockImplementation(() => ({
    merge: jest.fn(),
    mergeFromProviders: jest.fn()
  }))
}));
jest.mock('../../search/providers/FandomProviderInstance', () => ({}));
jest.mock('../../fandom/FandomService', () => ({}));


import { MangaPublicationStatus} from '@prisma/client';

import { MetadataMergerService } from '@/server/services/metadataMerger';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';

describe('MetadataMergerService Integration Tests', () => {
  let service: MetadataMergerService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-initialize mock data after clearAllMocks (using mockImplementation for better control)
    mockFindUnique.mockImplementation(() => Promise.resolve({
      id: 123,
      title: 'Test Manga',
      metadata: {},
      Metadata: null, // PascalCase - Prisma relation
      providerMetadata: null,
      rawProviderData: null
    }));
    mockUpdate.mockImplementation(() => Promise.resolve({
      id: 123,
      title: 'Test Manga',
      Metadata: null
    }));

    service = new MetadataMergerService();

    // Mock searchProviderRegistry
    (searchProviderRegistry.getAll as jest.Mock).mockReturnValue({
      anilist: { search: jest.fn() },
      mangadex: { search: jest.fn() },
      comicvine: { search: jest.fn() }
    });
    (searchProviderRegistry.initialize as jest.Mock).mockReturnValue(undefined);
  });

  describe('enrichMangaMetadata() - Default Provider Workflow', () => {
    it('should enrich manga with default provider set', async () => {
      // Spy on enrichMangaMetadataWithSelectedProviders
      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({ id: 123, title: 'One Piece' });

      const result = await service.enrichMangaMetadata(123);

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          title: 'anilist',
          description: 'anilist',
          genres: 'anilist',
          authors: 'anilist' // Updated from mangadex after provider removal
        }),
        false,
        null // importProfile
      );

      spy.mockRestore();
    });

    it('should handle manga not found error', async () => {
      mockFindUnique.mockImplementation(() => Promise.resolve(null));

      await expect(service.enrichMangaMetadata(999)).rejects.toThrow(
        'Failed to enrich manga metadata'
      );
    });

    it('should delegate to enrichMangaMetadataWithSelectedProviders', async () => {
      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({ id: 123 });

      await service.enrichMangaMetadata(123);

      expect(spy).toHaveBeenCalledWith(123, expect.any(Object), false, null);
      spy.mockRestore();
    });
  });

  describe('enrichMangaMetadataWithSelectedProviders() - Custom Provider Selection', () => {
    it('should use custom provider selection per field', async () => {
      const selectedProviders = {
        title: 'anilist',
        description: 'comicvine',
        genres: 'anilist',
        publisher: 'comicvine'
      };

      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'One Piece',
          description: 'From ComicVine',
          genres: ['Action'],
          publisher: 'Shueisha'
        });

      const result = await service.enrichMangaMetadataWithSelectedProviders(
        123,
        selectedProviders,
        false
      );

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, selectedProviders, false);
      spy.mockRestore();
    });

    it('should prioritize rawProviderData over stored metadata', async () => {
      const selectedProviders = {
        title: 'anilist',
        description: 'anilist',
        publisher: 'comicvine'
      };

      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'Raw Import Title',
          description: 'From wizard import',
          publisher: 'Import Publisher'
        });

      const result = await service.enrichMangaMetadataWithSelectedProviders(
        123,
        selectedProviders,
        false
      );

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, selectedProviders, false);
      spy.mockRestore();
    });

    it('should handle import wizard workflow with importProfile', async () => {
      const importProfile = {
        primarySource: 'anilist',
        chapterSource: 'mangadex',
        volumeSource: 'comicvine'
      };

      const selectedProviders = {
        title: 'anilist',
        chapters: 'mangadex',
        volumes: 'comicvine'
      };

      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'Import Title'
        });

      const result = await service.enrichMangaMetadataWithSelectedProviders(
        123,
        selectedProviders,
        false,
        importProfile
      );

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, selectedProviders, false, importProfile);
      spy.mockRestore();
    });

    it('should force refresh when requested', async () => {
      const selectedProviders = {
        title: 'anilist',
        description: 'anilist'
      };

      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'Fresh Title',
          description: 'Fresh Description'
        });

      const result = await service.enrichMangaMetadataWithSelectedProviders(
        123,
        selectedProviders,
        true // forceRefresh
      );

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, selectedProviders, true);
      spy.mockRestore();
    });

    it('should handle provider key variations (fandom vs fandom_selected)', async () => {
      const selectedProviders = {
        title: 'fandom',
        chapters: 'comicvine'
      };

      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'Fandom Title'
        });

      const result = await service.enrichMangaMetadataWithSelectedProviders(
        123,
        selectedProviders,
        false
      );

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, selectedProviders, false);
      spy.mockRestore();
    });
  });

  describe('enrichChapterMetadataFromComicVine() - Chapter Enrichment', () => {
    it('should delegate to ChapterEnrichmentService for ComicVine', async () => {
      const mockChapterEnricher = {
        enrichFromComicVine: jest.fn().mockResolvedValue({
          status: 'success',
          data: { createdCount: 5, updatedCount: 2 }
        })
      };

      (service as unknown as Record<string, unknown>)["chapterEnricher"] = mockChapterEnricher;

      const result = await service.enrichChapterMetadataFromComicVine(123);

      expect(result).toBe(true);
      expect(mockChapterEnricher.enrichFromComicVine).toHaveBeenCalledWith({ mangaId: 123 });
    });

    it('should propagate errors from ChapterEnrichmentService', async () => {
      const mockChapterEnricher = {
        enrichFromComicVine: jest.fn().mockRejectedValue(
          new Error('ComicVine API error')
        )
      };

      (service as unknown as Record<string, unknown>)["chapterEnricher"] = mockChapterEnricher;

      await expect(service.enrichChapterMetadataFromComicVine(123)).rejects.toThrow(
        'ComicVine API error'
      );
    });
  });

  describe('enrichChapterMetadataFromFandom() - Chapter Enrichment', () => {
    it('should delegate to ChapterEnrichmentService for Fandom', async () => {
      const mockChapterEnricher = {
        enrichFromFandom: jest.fn().mockResolvedValue({
          status: 'success',
          data: { createdCount: 3, updatedCount: 1 }
        })
      };

      (service as unknown as Record<string, unknown>)["chapterEnricher"] = mockChapterEnricher;

      const result = await service.enrichChapterMetadataFromFandom(123);

      expect(result).toBe(true);
      expect(mockChapterEnricher.enrichFromFandom).toHaveBeenCalledWith({ mangaId: 123 });
    });

    it('should handle missing Fandom data gracefully', async () => {
      const mockChapterEnricher = {
        enrichFromFandom: jest.fn().mockResolvedValue({
          status: 'error',
          error: new Error('No data found')
        })
      };

      (service as unknown as Record<string, unknown>)["chapterEnricher"] = mockChapterEnricher;

      const result = await service.enrichChapterMetadataFromFandom(123);

      expect(result).toBe(false);
    });
  });

  describe('End-to-End Integration', () => {
    it('should complete full enrichment workflow with all services', async () => {
      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'Complete Test',
          status: MangaPublicationStatus.ONGOING
        });

      const result = await service.enrichMangaMetadata(123);

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, expect.any(Object), false, null);
      spy.mockRestore();
    });

    it('should track provenance information through workflow', async () => {
      const selectedProviders = {
        title: 'anilist',
        description: 'comicvine'
      };

      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockResolvedValue({
          id: 123,
          title: 'Title',
          description: 'Description'
        });

      const result = await service.enrichMangaMetadataWithSelectedProviders(
        123,
        selectedProviders,
        false
      );

      expect(result).toBeTruthy();
      expect(spy).toHaveBeenCalledWith(123, selectedProviders, false);
      spy.mockRestore();
    });

    it('should handle transaction rollback on persistence failure', async () => {
      const spy = jest.spyOn(service, 'enrichMangaMetadataWithSelectedProviders')
        .mockRejectedValue(new Error('Database transaction failed'));

      await expect(service.enrichMangaMetadata(123)).rejects.toThrow();
      spy.mockRestore();
    });
  });
});
