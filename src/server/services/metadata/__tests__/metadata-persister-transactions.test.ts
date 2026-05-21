/**
 * Unit tests for MetadataPersistenceService - Transaction Handling
 *
 * Tests transaction behavior with proper type safety including
 * atomic updates, rollbacks, and error handling.
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { isError } from '@/utils/async-result';

import { MetadataPersistenceService } from '../metadata-persister';

import {
  createMockManga,
  createMockTransactionClient,
  type MockTransactionClient
} from './test-utils';

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

describe('MetadataPersistenceService - Transaction Handling', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  describe('persistMetadata - transaction handling', () => {
    it('should use transactions for atomic updates', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockResolvedValue({ id: 100 });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should rollback transaction on error', async () => {
      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Transaction failed')
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Failed to persist metadata');
      }
    });

    it('should handle manga not found error', async () => {
      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 999,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error instanceof Error ? result.error.message : String(result.error)).toContain('Manga with ID 999 not found');
      }
    });
  });
});
