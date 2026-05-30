/**
 * Unit tests for MetadataPersistenceService - Create Operations
 *
 * Tests metadata creation with proper type safety for new manga entries.
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

describe('MetadataPersistenceService - Create Operations', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  describe('persistMetadata - create new metadata', () => {
    it('should create new metadata when none exists', async () => {
      const mockManga = createMockManga();
      const mockMetadata = createMockMetadata();
      const updatedManga = {
        ...mockManga,
        metadataId: 100,
        Metadata: mockMetadata
      };

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test summary',
        genres: ['Action', 'Adventure'],
        authors: ['Test Author'],
        artists: ['Test Artist'],
        tags: [{ name: 'Shounen' }],
        characters: [{ name: 'Hero' }],
        coverImage: '/test-cover.jpg',
        status: 'FINISHED' as MangaPublicationStatus
      };

      // Mock transaction behavior with type-safe implementation
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique
        .mockResolvedValueOnce(mockManga)
        .mockResolvedValueOnce(updatedManga);
      mockTx.manga.update.mockResolvedValue(updatedManga);
      mockTx.metadata.create.mockResolvedValue(mockMetadata);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: { title: 'anilist', description: 'anilist' }
      });

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.created).toBe(true);
        expect(result.data.manga.Metadata).toBeTruthy();
        expect(result.data.manga.Metadata?.summary).toBe('Test summary');
      }
    });

    it('should handle cover images from covers object', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test description',
        coverImage: '/main-cover.jpg',
        covers: {
          extraLarge: '/xl-cover.jpg',
          large: '/lg-cover.jpg',
          medium: '/md-cover.jpg'
        }
      };

      let capturedMetadataData: CapturedMetadataData | undefined;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, Metadata: {} });
      mockTx.metadata.create.mockImplementation((data: { data: CapturedMetadataData }) => {
        capturedMetadataData = data.data;
        return Promise.resolve({ id: 100, ...data.data });
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
      expect(capturedMetadataData?.cover).toBe('/main-cover.jpg');
      expect(capturedMetadataData?.coverExtraLarge).toBe('/xl-cover.jpg');
      expect(capturedMetadataData?.coverLarge).toBe('/lg-cover.jpg');
      expect(capturedMetadataData?.coverMedium).toBe('/md-cover.jpg');
    });

    it('should use default cover when none provided', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test description'
      };

      let capturedMetadataData: CapturedMetadataData | undefined;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, Metadata: {} });
      mockTx.metadata.create.mockImplementation((data: { data: CapturedMetadataData }) => {
        capturedMetadataData = data.data;
        return Promise.resolve({ id: 100, ...data.data });
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
      expect(capturedMetadataData?.cover).toBe('/cover-not-found.jpg');
    });
  });
});
