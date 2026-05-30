/**
 * Unit tests for MetadataPersistenceService - Provenance Storage
 *
 * Tests provenance tracking with proper type safety for metadata sources.
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { isSuccess } from '@/utils/async-result';
import { isObject } from '@/utils/type-guards';

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

describe('MetadataPersistenceService - Provenance Storage', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  describe('persistMetadata - provenance storage', () => {
    it('should store metadata provenance in providerMetadata', async () => {
      const mockManga = createMockManga({
        providerMetadata: { existingData: 'preserved' }
      });

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      const provenance = {
        title: 'anilist',
        description: 'comicvine',
        genres: 'anilist'
      };

      let capturedProviderMetadata: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockImplementation((params: unknown) => {
        if (isObject(params) && 'data' in params) {
          const data = params['data'];
          if (isObject(data) && 'providerMetadata' in data) {
            capturedProviderMetadata = data['providerMetadata'];
          }
        }
        return Promise.resolve({ ...mockManga, metadataId: 100, metadata: {} });
      });
      mockTx.metadata.create.mockResolvedValue({ id: 100 });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: provenance
      });

      const providerMeta = capturedProviderMetadata as Record<string, unknown>;
      expect(providerMeta).toBeDefined();
      // Phase 0: persister wraps each provenance entry in ProvenanceEntry
      // shape ({provider}) on persist — forward-compatible with Phase 1.5's
      // confidence + alternatives. In-memory we still pass bare strings.
      expect(providerMeta['metadataProvenance']).toEqual({
        title: { provider: 'anilist' },
        description: { provider: 'comicvine' },
        genres: { provider: 'anilist' },
      });
      expect(providerMeta['existingData']).toBe('preserved');
    });

    it('should handle empty provenance', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      let capturedProviderMetadata: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockImplementation((params: unknown) => {
        if (isObject(params) && 'data' in params) {
          const data = params['data'];
          if (isObject(data) && 'providerMetadata' in data) {
            capturedProviderMetadata = data['providerMetadata'];
          }
        }
        return Promise.resolve({ ...mockManga, metadataId: 100, metadata: {} });
      });
      mockTx.metadata.create.mockResolvedValue({ id: 100 });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      const result = await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(isSuccess(result)).toBe(true);
      const providerMeta = capturedProviderMetadata as Record<string, unknown>;
      expect(providerMeta).toBeDefined();
      expect(providerMeta['metadataProvenance']).toEqual({});
    });
  });
});
