/**
 * Unit tests for MetadataPersistenceService - Error Handling
 *
 * Tests error scenarios with proper type safety for metadata persistence.
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { isError } from '@/utils/async-result';

import { MetadataPersistenceService } from '../metadata-persister';

import {
  createMockManga,
  createMockMetadata,
  createMockTransactionClient,
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

describe('MetadataPersistenceService - Error Handling', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  describe('error handling', () => {
    it('should handle failure to fetch final updated manga', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique
        .mockResolvedValueOnce(mockManga)
        .mockResolvedValueOnce(null);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100 });
      mockTx.metadata.create.mockResolvedValue({ id: 100 });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Failed to fetch updated manga');
      }
    });

    it('should handle transaction failures gracefully', async () => {
      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Database error: connection lost')
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Failed to persist metadata');
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Database error');
      }
    });

    it('should handle metadata creation failures', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.metadata.create.mockRejectedValue(new Error('Failed to create metadata'));

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isError(result)).toBe(true);
    });

    it('should handle metadata update failures', async () => {
      const existingMetadata = createMockMetadata({
        status: 'ONGOING' as MangaPublicationStatus
      });

      const mockManga = createMockManga({
        metadataId: 100
      });
      const mockMangaWithMetadata = { ...mockManga, Metadata: existingMetadata };

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Updated'
      };

      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockMangaWithMetadata);
      mockTx.metadata.update.mockRejectedValue(new Error('Failed to update metadata'));

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isError(result)).toBe(true);
    });
  });
});
