/**
 * Unit tests for MetadataPersistenceService - Field Mapping
 *
 * Tests field mapping and data transformation with proper type safety.
 */

import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { isObject } from '@/utils/type-guards';

import { MetadataPersistenceService } from '../metadata-persister';

import {
  createMockManga,
  createMockTransactionClient,
  extractData,
  type CapturedMetadataData,
  type TestMetadataData,
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

describe('MetadataPersistenceService - Field Mapping', () => {
  let service: MetadataPersistenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MetadataPersistenceService();
  });

  describe('buildMetadataUpdateData - field mapping', () => {
    it('should map all fields correctly with new values', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Full description',
        genres: ['Action', 'Adventure', 'Fantasy'],
        authors: ['Author 1', 'Author 2'],
        artists: ['Artist 1'],
        tags: [{ name: 'Magic' }, { name: 'Swords' }],
        coverImage: '/cover.jpg',
        bannerImage: '/banner.jpg',
        alternativeTitles: ['Alt Title 1', 'Alt Title 2'],
        externalLinks: [{ url: 'http://example.com' }],
        startDate: '2020-01-01',
        endDate: '2023-12-31',
        chapterCount: 150,
        volumeCount: 15,
        externalIds: { malId: 54321 },
        averageScore: 92,
        popularity: 75000,
        countryOfOrigin: 'JP',
        publisher: 'Amazing Publisher',
        format: 'MANGA' as unknown as 'MANGA',
        status: 'FINISHED' as MangaPublicationStatus
      };

      let capturedMetadataData: CapturedMetadataData | undefined;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: { data: CapturedMetadataData }) => {
        capturedMetadataData = data.data;
        return Promise.resolve({ id: 100, ...data.data });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      expect(capturedMetadataData?.summary).toBe('Full description');
      expect(capturedMetadataData?.genres).toEqual(['Action', 'Adventure', 'Fantasy']);
      expect(capturedMetadataData?.authors).toEqual(['Author 1', 'Author 2']);
      expect(capturedMetadataData?.artists).toEqual(['Artist 1']);
      expect(capturedMetadataData?.tags).toEqual(['Magic', 'Swords']);
      expect(capturedMetadataData?.synonyms).toEqual(['Alt Title 1', 'Alt Title 2']);
      expect(capturedMetadataData?.urls).toEqual(['http://example.com']);
      expect(capturedMetadataData?.chapters).toBe(150);
      expect(capturedMetadataData?.volumes).toBe(15);
      expect(capturedMetadataData?.idMal).toBe(54321);
      expect(capturedMetadataData?.averageScore).toBe(92);
      expect(capturedMetadataData?.popularity).toBe(75000);
      expect(capturedMetadataData?.countryOfOrigin).toBe('JP');
      expect(capturedMetadataData?.['publishers']).toEqual(['Amazing Publisher']);
      expect(capturedMetadataData?.bannerImage).toBe('/banner.jpg');
      expect(capturedMetadataData?.format).toBe('MANGA');
      expect(capturedMetadataData?.status).toBe('FINISHED');
    });

    it('should convert date strings to Date objects', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test',
        startDate: '2020-06-15',
        endDate: '2023-08-20'
      };

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      const metadata = capturedMetadataData as TestMetadataData;
      expect(metadata.startDate).toBeInstanceOf(Date);
      expect(metadata.endDate).toBeInstanceOf(Date);
      expect(metadata.startDate?.toISOString()).toContain('2020-06-15');
      expect(metadata.endDate?.toISOString()).toContain('2023-08-20');
    });

    it('should handle empty arrays correctly', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test',
        genres: [],
        authors: [],
        artists: [],
        tags: []
      };

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      const metadata = capturedMetadataData as TestMetadataData;
      expect(metadata['genres']).toEqual([]);
      expect(metadata['authors']).toEqual([]);
      expect(metadata['artists']).toEqual([]);
      expect(metadata['tags']).toEqual([]);
    });

    it('should handle tags as objects and extract names', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test',
        tags: [
          { name: 'Action', category: 'Genre' },
          { name: 'School', category: 'Theme' }
        ]
      };

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      const metadata = capturedMetadataData as TestMetadataData;
      expect(metadata['tags']).toEqual(['Action', 'School']);
    });

    it('should extract URLs from externalLinks array', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test',
        externalLinks: [
          { url: 'http://example.com/manga1' },
          { url: 'http://example.com/manga2' }
        ]
      };

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      const metadata = capturedMetadataData as TestMetadataData;
      expect(metadata['urls']).toEqual([
        'http://example.com/manga1',
        'http://example.com/manga2'
      ]);
    });

    it('should default status to UNKNOWN when not provided', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
        // No status provided
      };

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      const metadata = capturedMetadataData as TestMetadataData;
      expect(metadata['status']).toBe('UNKNOWN');
    });

    it('should always update lastFetch timestamp', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
      };

      const beforeTest = new Date();

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      const afterTest = new Date();
      const metadata = capturedMetadataData as TestMetadataData & { lastFetch: Date };
      expect(metadata.lastFetch).toBeInstanceOf(Date);
      expect(metadata.lastFetch.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(metadata.lastFetch.getTime()).toBeLessThanOrEqual(afterTest.getTime());
    });

    it('should comply with exactOptionalPropertyTypes by conditionally adding fields', async () => {
      const mockManga = createMockManga();

      const unifiedMetadata: UnifiedMangaMetadata = {
        title: 'Test Manga',
        description: 'Test'
        // No optional fields provided
      };

      let capturedMetadataData: unknown;
      const mockTx = createMockTransactionClient();
      mockTx.manga.findUnique.mockResolvedValue(mockManga);
      mockTx.manga.update.mockResolvedValue({ ...mockManga, metadataId: 100, metadata: {} });
      mockTx.metadata.create.mockImplementation((data: unknown) => {
        const extracted = extractData(data);
        capturedMetadataData = extracted;
        return Promise.resolve({ id: 100, ...(isObject(extracted) ? extracted : {}) });
      });

      (prisma.$transaction as jest.Mock).mockImplementation(
        async <T>(callback: (tx: MockTransactionClient) => Promise<T>): Promise<T> => callback(mockTx)
      );

      await service.persistMetadata({
        mangaId: 1,
        metadata: unifiedMetadata,
        metadataProvenance: {}
      });

      // Optional fields should not be in the object if undefined
      const metadata = capturedMetadataData as TestMetadataData;
      expect('coverExtraLarge' in metadata).toBe(false);
      expect('coverLarge' in metadata).toBe(false);
      expect('coverMedium' in metadata).toBe(false);
      expect('coverSmall' in metadata).toBe(false);
      expect('startDate' in metadata).toBe(false);
      expect('endDate' in metadata).toBe(false);
      expect('chapters' in metadata).toBe(false);
      expect('volumes' in metadata).toBe(false);
      expect('bannerImage' in metadata).toBe(false);
      expect('format' in metadata).toBe(false);
      expect('idMal' in metadata).toBe(false);
    });
  });
});
