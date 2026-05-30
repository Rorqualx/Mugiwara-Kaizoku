/**
 * @jest-environment node
 *
 * Integration tests for MetadataPersistenceService
 * Tests database persistence, transactions, and type-safe data conversion
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';

import { MetadataPersistenceService } from '../metadata-persister';

import type { Manga, Metadata, Prisma } from '@prisma/client';

// Type for metadata create arguments
interface CreateMetadataArgs {
  data: Partial<Metadata>;
}

// Mock Prisma
jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    metadata: {
      create: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

describe('MetadataPersistenceService Integration Tests', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    service = new MetadataPersistenceService();
    jest.clearAllMocks();

    // Default: Transaction executes callback immediately
    (prisma.$transaction as jest.Mock).mockImplementation(
      <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => callback(prisma as unknown as Prisma.TransactionClient)
    );
  });

  describe('Basic Persistence', () => {
    it('should create new metadata when none exists', async () => {
      const mockManga: Manga = {
        id: 1,
        title: 'One Piece',
        source: 'anilist',
        libraryId: 1,
        metadataId: null,
        lastChecked: null,
        libraryPath: '/library/one-piece',
        mangaTitle: 'One Piece',
        createdAt: new Date(),
        errorMessage: null,
        lastErrorAt: null,
        lastSyncAt: null,
        summary: null,
        syncCount: 0,
        updatedAt: new Date(),
        searchProvider: 'anilist',
        providerMetadata: null,
        monitoringConfig: null,
        metadataConfidence: null,
        mlCorrected: false,
        selectedSourceId: null,
        rawProviderData: null,
        sourceId: 'anilist-30013',
        fileStatus: 'PENDING',
        libraryStatus: 'ACTIVE',
        publicationStatus: 'ONGOING',
        suwayomiPluginConfig: null,
        mediaType: 'MANGA'
      };

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'One Piece',
        description: 'The story of Monkey D. Luffy',
        genres: ['Action', 'Adventure'],
        authors: ['Eiichiro Oda'],
        status: 'ONGOING',
        primarySource: 'anilist',
        metadataQuality: {
          completeness: 0.9,
          accuracy: 0.95,
          freshness: 0.9,
          sources: 1,
          overall: 0.92
        }
      };

      const mockCreatedMetadata: Metadata = {
        id: 100,
        coverExtraLarge: null,
        coverLarge: null,
        coverMedium: null,
        summary: 'The story of Monkey D. Luffy',
        genres: ['Action', 'Adventure'],
        authors: ['Eiichiro Oda'],
        tags: [],
        themes: [],
        startDate: null,
        endDate: null,
        synonyms: [],
        urls: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        cover: '/cover-not-found.jpg',
        lastFetch: new Date(),
        source: 'anilist',
        sourceId: null,
        volumes: null,
        chapters: null,
        artists: [],
        averageScore: null,
        bannerImage: null,
        countryOfOrigin: null,
        externalLinks: null,
        format: null,
        idMal: null,
        popularity: null,
        rating: null,
        publishers: [],
        contentRating: null,
        publicationDemographic: null,
        status: 'ONGOING',
        galleryImages: [],
        fieldAlternatives: null
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.metadata.create as jest.Mock).mockResolvedValue(mockCreatedMetadata);
      (prisma.manga.update as jest.Mock).mockResolvedValue({
        ...mockManga,
        metadataId: 100
      });

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: { title: 'anilist', description: 'anilist' }
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.created).toBe(true);
        expect(result.data.manga.id).toBe(1);
      }

      expect(prisma.metadata.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          summary: 'The story of Monkey D. Luffy',
          genres: ['Action', 'Adventure'],
          authors: ['Eiichiro Oda'],
          status: 'ONGOING'
        }) as unknown
      });
    });

    it('should update existing metadata', async () => {
      const existingMetadata: Metadata = {
        id: 100,
        coverExtraLarge: null,
        coverLarge: null,
        coverMedium: null,
        summary: 'Old summary',
        genres: ['Action'],
        authors: ['Eiichiro Oda'],
        tags: [],
        themes: [],
        startDate: null,
        endDate: null,
        synonyms: [],
        urls: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        cover: '/old-cover.jpg',
        lastFetch: new Date('2024-01-01'),
        source: 'mangadex',
        sourceId: null,
        volumes: null,
        chapters: 1050,
        artists: [],
        averageScore: null,
        bannerImage: null,
        countryOfOrigin: null,
        externalLinks: null,
        format: null,
        idMal: null,
        popularity: null,
        rating: null,
        publishers: [],
        contentRating: null,
        publicationDemographic: null,
        status: 'ONGOING',
        galleryImages: [],
        fieldAlternatives: null
      };

      const mockManga: Manga = {
        id: 1,
        title: 'One Piece',
        source: 'anilist',
        libraryId: 1,
        metadataId: 100,
        lastChecked: null,
        libraryPath: '/library/one-piece',
        mangaTitle: 'One Piece',
        createdAt: new Date(),
        errorMessage: null,
        lastErrorAt: null,
        lastSyncAt: null,
        summary: null,
        syncCount: 0,
        updatedAt: new Date(),
        searchProvider: 'anilist',
        providerMetadata: null,
        monitoringConfig: null,
        metadataConfidence: null,
        mlCorrected: false,
        selectedSourceId: null,
        rawProviderData: null,
        sourceId: 'anilist-30013',
        fileStatus: 'PENDING',
        libraryStatus: 'ACTIVE',
        publicationStatus: 'ONGOING',
        suwayomiPluginConfig: null,
        mediaType: 'MANGA'
      };

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'One Piece',
        description: 'Updated summary',
        chapterCount: 1100,
        primarySource: 'anilist',
        metadataQuality: {
          completeness: 0.5,
          accuracy: 0.95,
          freshness: 0.95,
          sources: 1,
          overall: 0.8
        }
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
        ...mockManga,
        Metadata: existingMetadata
      });
      (prisma.metadata.update as jest.Mock).mockResolvedValue({
        ...existingMetadata,
        summary: 'Updated summary',
        chapters: 1100
      });

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.created).toBe(false);
      }

      expect(prisma.metadata.update).toHaveBeenCalledWith({
        where: { id: 100 },
        data: expect.objectContaining({
          summary: 'Updated summary',
          chapters: 1100,
          // Existing values preserved
          genres: ['Action'],
          authors: ['Eiichiro Oda']
        }) as unknown
      });
    });
  });

  describe('Error Handling', () => {
    it('should return error when manga not found', async () => {
      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.persistMetadata({
        mangaId: 999,
        metadata: {
          title: 'Non-existent',
          primarySource: 'anilist',
          metadataQuality: {
            completeness: 0.5,
            accuracy: 0.95,
            freshness: 0.95,
            sources: 1,
            overall: 0.8
          }
        },
        metadataProvenance: {}
      });

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Manga with ID 999 not found');
      }
    });

    it('should handle database errors gracefully', async () => {
      const mockManga: Manga = {
        id: 1,
        title: 'One Piece',
        source: 'anilist',
        libraryId: 1,
        metadataId: null,
        lastChecked: null,
        libraryPath: '/library/one-piece',
        mangaTitle: 'One Piece',
        createdAt: new Date(),
        errorMessage: null,
        lastErrorAt: null,
        lastSyncAt: null,
        summary: null,
        syncCount: 0,
        updatedAt: new Date(),
        searchProvider: 'anilist',
        providerMetadata: null,
        monitoringConfig: null,
        metadataConfidence: null,
        mlCorrected: false,
        selectedSourceId: null,
        rawProviderData: null,
        sourceId: 'anilist-30013',
        fileStatus: 'PENDING',
        libraryStatus: 'ACTIVE',
        publicationStatus: 'ONGOING',
        suwayomiPluginConfig: null,
        mediaType: 'MANGA'
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Connection timeout'));

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: {
          title: 'One Piece',
          primarySource: 'anilist',
          metadataQuality: {
            completeness: 0.5,
            accuracy: 0.95,
            freshness: 0.95,
            sources: 1,
            overall: 0.8
          }
        },
        metadataProvenance: {}
      });

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Connection timeout');
      }
    });
  });

  describe('Transaction Handling', () => {
    it('should use database transaction', async () => {
      const mockManga: Manga = {
        id: 1,
        title: 'One Piece',
        source: 'anilist',
        libraryId: 1,
        metadataId: null,
        lastChecked: null,
        libraryPath: '/library/one-piece',
        mangaTitle: 'One Piece',
        createdAt: new Date(),
        errorMessage: null,
        lastErrorAt: null,
        lastSyncAt: null,
        summary: null,
        syncCount: 0,
        updatedAt: new Date(),
        searchProvider: 'anilist',
        providerMetadata: null,
        monitoringConfig: null,
        metadataConfidence: null,
        mlCorrected: false,
        selectedSourceId: null,
        rawProviderData: null,
        sourceId: 'anilist-30013',
        fileStatus: 'PENDING',
        libraryStatus: 'ACTIVE',
        publicationStatus: 'ONGOING',
        suwayomiPluginConfig: null,
        mediaType: 'MANGA'
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.metadata.create as jest.Mock).mockResolvedValue({
        id: 100
      } as Metadata);
      (prisma.manga.update as jest.Mock).mockResolvedValue({
        ...mockManga,
        metadataId: 100
      });

      await service.persistMetadata({
        mangaId: 1,
        metadata: {
          title: 'One Piece',
          primarySource: 'anilist',
          metadataQuality: {
            completeness: 0.5,
            accuracy: 0.95,
            freshness: 0.95,
            sources: 1,
            overall: 0.8
          }
        },
        metadataProvenance: {}
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Type-Safe Data Conversion', () => {
    it('should convert UnifiedMangaMetadata to Prisma Metadata format', async () => {
      const mockManga: Manga = {
        id: 1,
        title: 'One Piece',
        source: 'anilist',
        libraryId: 1,
        metadataId: null,
        lastChecked: null,
        libraryPath: '/library/one-piece',
        mangaTitle: 'One Piece',
        createdAt: new Date(),
        errorMessage: null,
        lastErrorAt: null,
        lastSyncAt: null,
        summary: null,
        syncCount: 0,
        updatedAt: new Date(),
        searchProvider: 'anilist',
        providerMetadata: null,
        monitoringConfig: null,
        metadataConfidence: null,
        mlCorrected: false,
        selectedSourceId: null,
        rawProviderData: null,
        sourceId: 'anilist-30013',
        fileStatus: 'PENDING',
        libraryStatus: 'ACTIVE',
        publicationStatus: 'ONGOING',
        suwayomiPluginConfig: null,
        mediaType: 'MANGA'
      };

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'One Piece',
        alternativeTitles: ['ワンピース'],
        description: 'Description',
        genres: ['Action', 'Adventure'],
        authors: ['Eiichiro Oda'],
        artists: ['Eiichiro Oda'],
        status: 'ONGOING',
        chapterCount: 1100,
        volumeCount: 106,
        primarySource: 'anilist',
        metadataQuality: {
          completeness: 0.9,
          accuracy: 0.95,
          freshness: 0.9,
          sources: 1,
          overall: 0.92
        }
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.metadata.create as jest.Mock).mockImplementation((args: CreateMetadataArgs) => {
        return Promise.resolve({
          id: 100,
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date()
        } as Metadata);
      });
      (prisma.manga.update as jest.Mock).mockResolvedValue({
        ...mockManga,
        metadataId: 100
      });

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(prisma.metadata.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          summary: 'Description', // description → summary
          genres: ['Action', 'Adventure'],
          authors: ['Eiichiro Oda'],
          artists: ['Eiichiro Oda'],
          synonyms: ['ワンピース'], // alternativeTitles → synonyms
          status: 'ONGOING',
          chapters: 1100,
          volumes: 106
        }) as unknown
      });
    });
  });

  describe('Performance', () => {
    it('should persist metadata in under 100ms', async () => {
      const mockManga: Manga = {
        id: 1,
        title: 'One Piece',
        source: 'anilist',
        libraryId: 1,
        metadataId: null,
        lastChecked: null,
        libraryPath: '/library/one-piece',
        mangaTitle: 'One Piece',
        createdAt: new Date(),
        errorMessage: null,
        lastErrorAt: null,
        lastSyncAt: null,
        summary: null,
        syncCount: 0,
        updatedAt: new Date(),
        searchProvider: 'anilist',
        providerMetadata: null,
        monitoringConfig: null,
        metadataConfidence: null,
        mlCorrected: false,
        selectedSourceId: null,
        rawProviderData: null,
        sourceId: 'anilist-30013',
        fileStatus: 'PENDING',
        libraryStatus: 'ACTIVE',
        publicationStatus: 'ONGOING',
        suwayomiPluginConfig: null,
        mediaType: 'MANGA'
      };

      (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
      (prisma.metadata.create as jest.Mock).mockResolvedValue({ id: 100 } as Metadata);
      (prisma.manga.update as jest.Mock).mockResolvedValue({
        ...mockManga,
        metadataId: 100,
        metadata: { id: 100 } as Metadata
      });

      const startTime = performance.now();

      await service.persistMetadata({
        mangaId: 1,
        metadata: {
          title: 'One Piece',
          primarySource: 'anilist',
          metadataQuality: {
            completeness: 0.5,
            accuracy: 0.95,
            freshness: 0.95,
            sources: 1,
            overall: 0.8
          }
        },
        metadataProvenance: {}
      });

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});
