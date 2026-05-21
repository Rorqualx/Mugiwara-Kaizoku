/**
 * Chapter Enrichment Service Tests
 *
 * Comprehensive unit tests for the ChapterEnrichmentService.
 * Tests chapter metadata enrichment from ComicVine and Fandom providers.
 *
 * Uses jest.mock() for module mocking
 */

import axios from 'axios';

import { prisma } from '@/server/db';
import { isSuccess, isError } from '@/utils/async-result';

// Jest mocks
jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn()
    },
    chapter: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    metadata: {
      update: jest.fn()
    },
    config: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn()
    }
  }
}));

jest.mock('../../search/registerProviders', () => ({
  searchProviderRegistry: {
    get: jest.fn()
  }
}));

jest.mock('../utils/fandomTableParser', () => ({
  parseVolumeTables: jest.fn()
}));

jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    create: jest.fn().mockReturnThis()
  },
  get: jest.fn(),
  post: jest.fn(),
  __esModule: true
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../comicvine/modules/fullyProtectedClient', () => ({
  FullyProtectedComicVineClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
    getHealthStatus: jest.fn().mockReturnValue({
      rateLimiter: null,
      velocityDetector: null,
      retryHandler: null,
      cache: null,
      fieldOptimizer: null,
      circuitBreaker: null,
      summary: {
        healthy: true,
        recommendations: []
      }
    })
  }))
}));

jest.mock('../../config/configService', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockResolvedValue('test-api-key')
  }))
}));

// Import after mocks are defined

import { ChapterEnrichmentService } from '../chapter-enricher';

describe('ChapterEnrichmentService', () => {
  let service: ChapterEnrichmentService;
  let mockSearchProviderRegistry: {
    get: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all Prisma mocks with default implementations
    (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.manga.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.manga.update as jest.Mock).mockResolvedValue({});
    (prisma.manga.count as jest.Mock).mockResolvedValue(0);
    (prisma.manga.create as jest.Mock).mockResolvedValue({});
    (prisma.manga.delete as jest.Mock).mockResolvedValue({});

    (prisma.chapter.create as jest.Mock).mockResolvedValue({});
    (prisma.chapter.update as jest.Mock).mockResolvedValue({});
    (prisma.chapter.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.chapter.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.chapter.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    (prisma.metadata.update as jest.Mock).mockResolvedValue({});

    (prisma.config.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.config.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.config.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.config.create as jest.Mock).mockResolvedValue({});
    (prisma.config.update as jest.Mock).mockResolvedValue({});
    (prisma.config.upsert as jest.Mock).mockResolvedValue({});
    (prisma.config.delete as jest.Mock).mockResolvedValue({});

    service = new ChapterEnrichmentService();

    // Mock the search provider registry
    const { searchProviderRegistry } = require('../../search/registerProviders');
    mockSearchProviderRegistry = searchProviderRegistry as {
      get: jest.Mock;
    };
    mockSearchProviderRegistry.get = jest.fn().mockReturnValue({});
  });

  describe('Constructor', () => {
    it('should initialize with logger', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ChapterEnrichmentService);
    });
  });

  describe('enrichFromComicVine', () => {
    const mockManga = {
      id: 123,
      title: 'Test Manga',
      source: 'comicvine',
      providerMetadata: [
        {
          providerId: 'comicvine',
          externalId: '12345',
          metadata: { id: '12345' }
        }
      ],
      metadataId: 1,
      Metadata: null,
      Chapter: [] // ✅ FIXED: Capital C to match Prisma schema
    };

    it('should successfully enrich chapters from ComicVine', async () => {
      const mockIssues = [
        {
          issueNumber: '1',
          title: 'Chapter 1 Title',
          coverImage: 'https://example.com/cover1.jpg',
          description: 'Chapter 1 description',
          pageCount: 20
        },
        {
          issueNumber: '2',
          title: 'Chapter 2 Title',
          coverImage: 'https://example.com/cover2.jpg',
          description: 'Chapter 2 description',
          pageCount: 25
        }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);

      // Mock the ComicVine client
      const { FullyProtectedComicVineClient } = await import('../../comicvine/modules/fullyProtectedClient');
      const mockRequest = jest.fn().mockResolvedValue({
        data: {
          issues: mockIssues
        }
      });
      (FullyProtectedComicVineClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
        getHealthStatus: jest.fn().mockReturnValue({
          rateLimiter: null,
          velocityDetector: null,
          retryHandler: null,
          cache: null,
          fieldOptimizer: null,
          circuitBreaker: null,
          summary: { healthy: true, recommendations: [] }
        })
      }));

      (prisma.chapter.create as jest.Mock).mockResolvedValue({} as never);
      (prisma.metadata.update as jest.Mock).mockResolvedValue({} as never);

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.createdCount).toBe(2);
        expect(result.data.updatedCount).toBe(0);
        expect(result.data.totalChapters).toBe(2);
      }

      expect(prisma.chapter.create).toHaveBeenCalledTimes(2);
      expect(prisma.metadata.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { chapters: 2 }
      });
    });

    it('should update existing chapters with ComicVine data', async () => {
      const mangaWithChapters = {
        ...mockManga,
        Chapter: [ // ✅ FIXED: Capital C to match Prisma schema
          {
            id: 1,
            index: 1,
            title: 'Old Title',
            downloadUrl: null,
            coverImage: null,
            description: null,
            pageCount: null
          }
        ]
      };

      const mockIssues = [
        {
          issueNumber: '1',
          title: 'Updated Chapter Title',
          coverImage: 'https://example.com/new-cover.jpg',
          description: 'Updated description',
          pageCount: 30
        }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mangaWithChapters);

      const { FullyProtectedComicVineClient } = await import('../../comicvine/modules/fullyProtectedClient');
      const mockRequest = jest.fn().mockResolvedValue({
        data: { issues: mockIssues }
      });
      (FullyProtectedComicVineClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
        getHealthStatus: jest.fn().mockReturnValue({
          rateLimiter: null,
          velocityDetector: null,
          retryHandler: null,
          cache: null,
          fieldOptimizer: null,
          circuitBreaker: null,
          summary: { healthy: true, recommendations: [] }
        })
      }));

      (prisma.chapter.update as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.createdCount).toBe(0);
        expect(result.data.updatedCount).toBe(1);
        expect(result.data.totalChapters).toBe(1);
      }

      expect(prisma.chapter.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          title: 'Updated Chapter Title',
          coverImage: 'https://example.com/new-cover.jpg',
          description: 'Updated description',
          pageCount: 30
        })
      });
    });

    it('should return error when manga not found', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.enrichFromComicVine({ mangaId: 999 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('Manga with ID 999 not found');
      }
    });

    it('should skip enrichment for non-ComicVine manga', async () => {
      const nonComicVineManga = {
        ...mockManga,
        source: 'mangadex'
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(nonComicVineManga);

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.createdCount).toBe(0);
        expect(result.data.updatedCount).toBe(0);
        expect(result.data.totalChapters).toBe(0);
      }
    });

    it('should return error when ComicVine volume ID not found', async () => {
      const mangaWithoutVolumeId = {
        ...mockManga,
        providerMetadata: []
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mangaWithoutVolumeId);

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('No ComicVine volume ID found');
      }
    });

    it('should return error when provider registry has no ComicVine provider', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);

      // Mock provider registry to return null
      mockSearchProviderRegistry.get = jest.fn().mockReturnValue(null);

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('ComicVine provider not found in registry');
      }
    });

    it('should handle ComicVine API errors', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);

      const { FullyProtectedComicVineClient } = await import('../../comicvine/modules/fullyProtectedClient');
      const mockRequest = jest.fn().mockRejectedValue(new Error('API request failed'));
      (FullyProtectedComicVineClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
        getHealthStatus: jest.fn().mockReturnValue({
          rateLimiter: null,
          velocityDetector: null,
          retryHandler: null,
          cache: null,
          fieldOptimizer: null,
          circuitBreaker: null,
          summary: { healthy: true, recommendations: [] }
        })
      }));

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        // The service returns "Failed to fetch issues from ComicVine" when the API fails
        expect(result.error.message).toContain('Failed to fetch issues from ComicVine');
      }
    });

    it('should handle empty issues array', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);

      const { FullyProtectedComicVineClient } = await import('../../comicvine/modules/fullyProtectedClient');
      const mockRequest = jest.fn().mockResolvedValue({
        data: { issues: [] }
      });
      (FullyProtectedComicVineClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
        getHealthStatus: jest.fn().mockReturnValue({
          rateLimiter: null,
          velocityDetector: null,
          retryHandler: null,
          cache: null,
          fieldOptimizer: null,
          circuitBreaker: null,
          summary: { healthy: true, recommendations: [] }
        })
      }));

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.createdCount).toBe(0);
        expect(result.data.totalChapters).toBe(0);
      }
    });

    it('should parse chapter numbers correctly from various formats', async () => {
      const mockIssuesWithVariousNumbers = [
        { issueNumber: 1, title: 'Chapter 1' },
        { issueNumber: '2', title: 'Chapter 2' },
        { issueNumber: 'invalid', title: 'Chapter Invalid' }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);

      const { FullyProtectedComicVineClient } = await import('../../comicvine/modules/fullyProtectedClient');
      const mockRequest = jest.fn().mockResolvedValue({
        data: { issues: mockIssuesWithVariousNumbers }
      });
      (FullyProtectedComicVineClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
        getHealthStatus: jest.fn().mockReturnValue({
          rateLimiter: null,
          velocityDetector: null,
          retryHandler: null,
          cache: null,
          fieldOptimizer: null,
          circuitBreaker: null,
          summary: { healthy: true, recommendations: [] }
        })
      }));

      (prisma.chapter.create as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromComicVine({ mangaId: 123 });

      expect(isSuccess(result)).toBe(true);
      expect(prisma.chapter.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('enrichFromFandom', () => {
    const mockManga = {
      id: 456,
      title: 'Test Fandom Manga',
      source: 'fandom',
      metadataId: 2,
      Metadata: { // ✅ FIXED: Capital M to match Prisma schema
        urls: ['https://test.fandom.com/wiki/Test_Manga']
      },
      Chapter: [], // ✅ FIXED: Capital C to match Prisma schema
      providerMetadata: []
    };

    it('should successfully enrich chapters from Fandom', async () => {
      const mockVolumes = [
        {
          number: 1,
          title: 'Volume 1',
          chapters: [
            { number: 1, title: 'Chapter 1' },
            { number: 2, title: 'Chapter 2' }
          ]
        },
        {
          number: 2,
          title: 'Volume 2',
          chapters: [
            { number: 3, title: 'Chapter 3' }
          ]
        }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body>Test HTML</body></html>'
      });

      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      (parseVolumeTables as jest.Mock).mockReturnValue(mockVolumes);

      (prisma.metadata.update as jest.Mock).mockResolvedValue({});
      (prisma.manga.update as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.createdCount).toBe(0); // Fandom enrichment doesn't create chapters
        expect(result.data.totalChapters).toBe(3);
      }

      expect(prisma.metadata.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: {
          volumes: 2,
          chapters: 3
        }
      });
    });

    it('should skip enrichment when chapters already have volume assignments', async () => {
      const mangaWithVolumeAssignments = {
        ...mockManga,
        Chapter: [ // ✅ FIXED: Capital C to match Prisma schema
          { id: 1, index: 1, volume: 1 },
          { id: 2, index: 2, volume: 1 }
        ]
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mangaWithVolumeAssignments);

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.createdCount).toBe(0);
        expect(result.data.totalChapters).toBe(2);
      }

      // Should not call parseVolumeTables
      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      expect(parseVolumeTables).not.toHaveBeenCalled();
    });

    it('should proceed with enrichment when chapters have no volume assignments', async () => {
      const mangaWithoutVolumeAssignments = {
        ...mockManga,
        Chapter: [ // ✅ FIXED: Capital C to match Prisma schema
          { id: 1, index: 1, volume: null },
          { id: 2, index: 2, volume: 0 }
        ]
      };

      const mockVolumes = [
        {
          number: 1,
          title: 'Volume 1',
          chapters: [{ number: 1, title: 'Chapter 1' }]
        }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mangaWithoutVolumeAssignments);
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body>Test HTML</body></html>'
      });

      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      (parseVolumeTables as jest.Mock).mockReturnValue(mockVolumes);

      (prisma.metadata.update as jest.Mock).mockResolvedValue({});
      (prisma.manga.update as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isSuccess(result)).toBe(true);
      expect(parseVolumeTables).toHaveBeenCalled();
    });

    it('should return error when manga not found', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.enrichFromFandom({ mangaId: 999 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('Manga with ID 999 not found');
      }
    });

    it('should return error when no Fandom URL found', async () => {
      const mangaWithoutFandomUrl = {
        ...mockManga,
        Metadata: { // ✅ FIXED: Capital M to match Prisma schema
          urls: ['https://example.com']
        }
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mangaWithoutFandomUrl);

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('No Fandom URL found');
      }
    });

    it('should return error when no volumes parsed', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body>Test HTML</body></html>'
      });

      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      (parseVolumeTables as jest.Mock).mockReturnValue([]);

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('No volumes found in Fandom page');
      }
    });

    it('should handle axios errors', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('Failed to enrich Fandom chapters');
      }
    });

    it('should deduplicate volumes by volume number', async () => {
      const mockVolumesWithDuplicates = [
        { number: 1, title: 'Volume 1', chapters: [] },
        { number: 1, title: 'Volume 1 (duplicate)', chapters: [] },
        { number: 2, title: 'Volume 2', chapters: [] }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body>Test HTML</body></html>'
      });

      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      (parseVolumeTables as jest.Mock).mockReturnValue(mockVolumesWithDuplicates);

      (prisma.metadata.update as jest.Mock).mockResolvedValue({});
      (prisma.manga.update as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isSuccess(result)).toBe(true);

      // Should update metadata with 2 unique volumes, not 3
      expect(prisma.metadata.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: {
          volumes: 2,
          chapters: 0
        }
      });
    });

    it('should update providerMetadata with volume data', async () => {
      const mockVolumes = [
        {
          number: 1,
          title: 'Volume 1',
          chapters: [
            { chapterNumber: 1, title: 'Chapter 1' }
          ]
        }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body>Test HTML</body></html>'
      });

      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      (parseVolumeTables as jest.Mock).mockReturnValue(mockVolumes);

      (prisma.metadata.update as jest.Mock).mockResolvedValue({});
      (prisma.manga.update as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isSuccess(result)).toBe(true);
      expect(prisma.manga.update).toHaveBeenCalledWith({
        where: { id: 456 },
        data: {
          providerMetadata: expect.arrayContaining([
            expect.objectContaining({
              providerId: 'fandom',
              metadata: expect.objectContaining({
                volumeData: expect.any(Array),
                totalVolumes: 1,
                totalChapters: 1
              })
            })
          ])
        }
      });
    });

    it('should handle empty chapter arrays in volumes', async () => {
      const mockVolumes = [
        { number: 1, title: 'Volume 1', chapters: [] },
        { number: 2, title: 'Volume 2', chapters: undefined }
      ];

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body>Test HTML</body></html>'
      });

      const { parseVolumeTables } = await import('../utils/fandomTableParser');
      (parseVolumeTables as jest.Mock).mockReturnValue(mockVolumes);

      (prisma.metadata.update as jest.Mock).mockResolvedValue({});
      (prisma.manga.update as jest.Mock).mockResolvedValue({});

      const result = await service.enrichFromFandom({ mangaId: 456 });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.totalChapters).toBe(0);
      }
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', async () => {
      const { getChapterEnrichmentService, chapterEnrichmentService } = await import('../chapter-enricher');

      const instance1 = getChapterEnrichmentService();
      const instance2 = getChapterEnrichmentService();

      expect(instance1).toBe(instance2);
      expect(chapterEnrichmentService).toBe(instance1);
    });
  });
});
