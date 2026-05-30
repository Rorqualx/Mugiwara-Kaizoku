/**
 * Unit tests for MetadataPersistenceService - Update Operations
 *
 * Tests metadata update with proper type safety for existing manga entries.
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { isSuccess } from '@/utils/async-result';

import { MetadataPersistenceService } from '../metadata-persister';

import {
  createMockManga,
  createMockMetadata,
  createMockTransactionClient,
  type CapturedMetadataData,
  type MockTransactionClient
} from './test-utils';

import type { MangaPublicationStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@/server/db', () => ({
  prisma: {
    $transaction: jest.fn(),
    manga: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    metadata: {
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    })),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('MetadataPersistenceService - Update Operations', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  describe('persistMetadata - update existing metadata', () => {
    it('should update existing metadata', async () => {
      const existingMetadata = createMockMetadata({
        cover: '/old-cover.jpg',
        summary: 'Old summary',
        genres: ['Drama'],
        authors: ['Old Author'],
        artists: ['Old Artist'],
        status: 'ONGOING' as MangaPublicationStatus,
        chapters: 50,
        volumes: 5
      });

      const mockManga = createMockManga({
        metadataId: 100
      });
      const mockMangaWithMetadata = { ...mockManga, Metadata: existingMetadata };

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'New summary',
        genres: ['Action', 'Adventure'],
        coverImage: '/new-cover.jpg',
        status: 'FINISHED' as MangaPublicationStatus
      };

      const updatedMetadata = {
        ...existingMetadata,
        summary: 'New summary',
        genres: ['Action', 'Adventure'],
        cover: '/new-cover.jpg',
        status: 'FINISHED' as MangaPublicationStatus
      };

      const finalManga = { ...mockManga, Metadata: updatedMetadata };
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique
        .mockResolvedValueOnce(mockMangaWithMetadata)
        .mockResolvedValueOnce(finalManga);
      mockTx.manga.update.mockResolvedValue(finalManga);
      mockTx.metadata.update.mockResolvedValue(updatedMetadata);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: { description: 'anilist' }
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.created).toBe(false);
        expect(result.data.manga.Metadata?.summary).toBe('New summary');
        expect(result.data.manga.Metadata?.genres).toEqual(['Action', 'Adventure']);
      }
    });

    it('should preserve existing values when new metadata is partial', async () => {
      const existingMetadata = createMockMetadata({
        cover: '/existing-cover.jpg',
        summary: 'Existing summary',
        genres: ['Drama', 'Romance'],
        authors: ['Existing Author'],
        artists: ['Existing Artist'],
        tags: ['Tag1', 'Tag2'],
        synonyms: ['Alt Title'],
        urls: ['http://example.com'],
        status: 'ONGOING' as MangaPublicationStatus,
        startDate: new Date('2020-01-01'),
        chapters: 100,
        volumes: 10,
        bannerImage: '/banner.jpg',
        format: 'MANGA',
        idMal: 12345,
        averageScore: 85,
        popularity: 50000,
        countryOfOrigin: 'JP',
        publishers: ['Test Publisher']
      });

      const mockManga = createMockManga({
        metadataId: 100
      });
      const mockMangaWithMetadata = { ...mockManga, Metadata: existingMetadata };

      // Only update description
      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Updated description only'
      };

      let capturedMetadataData: CapturedMetadataData | undefined;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockMangaWithMetadata);
      mockTx.manga.update.mockResolvedValue(mockManga);
      mockTx.metadata.update.mockImplementation((params: { data: CapturedMetadataData }) => {
        capturedMetadataData = params.data;
        return Promise.resolve({ ...existingMetadata, ...params.data });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isSuccess(result)).toBe(true);
      // Should preserve all existing fields
      expect(capturedMetadataData?.genres).toEqual(['Drama', 'Romance']);
      expect(capturedMetadataData?.authors).toEqual(['Existing Author']);
      expect(capturedMetadataData?.artists).toEqual(['Existing Artist']);
      expect(capturedMetadataData?.tags).toEqual(['Tag1', 'Tag2']);
      expect(capturedMetadataData?.chapters).toBe(100);
      expect(capturedMetadataData?.volumes).toBe(10);
      expect(capturedMetadataData?.idMal).toBe(12345);
      expect(capturedMetadataData?.bannerImage).toBe('/banner.jpg');
      // But update summary
      expect(capturedMetadataData?.summary).toBe('Updated description only');
    });
  });
});
