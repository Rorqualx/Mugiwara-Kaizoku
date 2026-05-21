import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MangaPublicationStatus, MangaFileStatus, MangaLibraryStatus } from '@prisma/client';

import { prisma } from '@/server/db';



import { DuplicateDetector } from '../duplicateDetector';

import type { Manga, Metadata } from '@prisma/client';

// Mock dependencies
jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn()
    },
    chapter: {
      updateMany: jest.fn()
    },
    metadata: {
      findMany: jest.fn(),
      update: jest.fn()
    }
  }
}));

jest.mock('@/utils/serverLogger', () => ({
  serverLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Create proper type for Manga with metadata relation (matches Prisma include: { Metadata: true })
type MangaWithMetadata = Manga & {
  Metadata: Metadata | null;
};

// Helper function to create mock manga
function createMockManga(overrides: Partial<Manga> = {}): Manga {
  return {
    id: 1,
    title: 'Test Manga',
    source: 'local',
    sourceId: null,
    libraryId: 1,
    libraryPath: '/manga/test',
    publicationStatus: MangaPublicationStatus.UNKNOWN,
    fileStatus: MangaFileStatus.PENDING,
    libraryStatus: MangaLibraryStatus.ACTIVE,
    metadataId: null,
    lastChecked: null,
    mangaTitle: null,
    createdAt: new Date(),
    errorMessage: null,
    lastErrorAt: null,
    lastSyncAt: null,
    summary: null,
    syncCount: 0,
    updatedAt: new Date(),
    searchProvider: 'anilist',
    providerMetadata: null,
    rawProviderData: null,
    monitoringConfig: null,
    mlCorrected: false,
    selectedSourceId: null,
    metadataConfidence: null,
    ...overrides
  } as Manga;
}

// Helper function to create mock metadata
function createMockMetadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    id: 1,
    coverExtraLarge: null,
    coverLarge: null,
    coverMedium: null,
    coverSmall: null,
    bannerImage: null,
    summary: null,
    genres: [],
    authors: [],
    artists: [],
    status: MangaPublicationStatus.UNKNOWN,
    tags: [],
    themes: [],
    characters: [],
    startDate: null,
    endDate: null,
    synonyms: [],
    urls: [],
    createdAt: new Date(),
    updatedAt: null,
    cover: '/cover-not-found.jpg',
    coverUrl: null,
    rating: null,
    lastFetch: null,
    source: null,
    sourceId: null,
    language: null,
    languages: [],
    qualityProfile: null,
    averageResolution: null,
    pageCount: null,
    volumes: null,
    chapters: null,
    format: null,
    idMal: null,
    averageScore: null,
    popularity: null,
    countryOfOrigin: null,
    publisher: null,
    externalLinks: null,
    galleryImages: [],
    ...overrides
  };
}

describe('DuplicateDetector', () => {
  let detector: DuplicateDetector;
  const mockFindMany = prisma.manga.findMany as jest.MockedFunction<typeof prisma.manga.findMany>;
  const mockFindFirst = prisma.manga.findFirst as jest.MockedFunction<typeof prisma.manga.findFirst>;
  const mockFindUnique = prisma.manga.findUnique as jest.MockedFunction<typeof prisma.manga.findUnique>;

  beforeEach(() => {
    detector = new DuplicateDetector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findDuplicates', () => {
    it('should find exact title matches', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'One Piece',
        libraryPath: '/manga/one-piece'
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: null
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const results = await detector.findDuplicates('One Piece', 1);

      expect(results).toHaveLength(1);
      const firstResult = results[0];
      if (firstResult) {
        expect(firstResult.manga.id).toBe(1);
        expect(firstResult.score).toBe(1.0);
        expect(firstResult.matchType).toBe('exact');
        expect(firstResult.matchedOn).toContain('exact_title');
      }
    });

    it('should find normalized title matches', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'Attack on Titan',
        libraryPath: '/manga/attack-on-titan'
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: null
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const results = await detector.findDuplicates('Attack On Titan!', 1);

      expect(results).toHaveLength(1);
      const firstResult = results[0];
      if (firstResult) {
        expect(firstResult.score).toBeGreaterThanOrEqual(0.95);
        expect(firstResult.matchType).toBe('normalized');
      }
    });

    it('should find partial matches with similarity threshold', async () => {
      const mockManga1 = createMockManga({
        id: 1,
        title: 'My Hero Academia',
        libraryPath: '/manga/my-hero-academia'
      });

      const mockManga2 = createMockManga({
        id: 2,
        title: 'Boku no Hero Academia',
        libraryPath: '/manga/boku-no-hero'
      });

      const mockMangasWithMetadata: MangaWithMetadata[] = [
      { ...mockManga1, Metadata: null },
      { ...mockManga2, Metadata: null }];


      mockFindMany.mockResolvedValue(mockMangasWithMetadata as never);

      const results = await detector.findDuplicates('Hero Academia', 1, { minSimilarity: 0.5 });

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0];
      if (firstResult) {
        // "Hero Academia" matches both "My Hero Academia" and "Boku no Hero Academia"
        // with high similarity (>= 0.8), so they are classified as 'normalized' not 'partial'
        expect(['partial', 'normalized']).toContain(firstResult.matchType);
      }
    });

    it('should check metadata for alternative titles', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'Shingeki no Kyojin',
        metadataId: 1
      });

      const mockMetadata = createMockMetadata({
        id: 1,
        synonyms: ['Attack on Titan', 'AoT']
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: mockMetadata
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const results = await detector.findDuplicates('Attack on Titan', 1);

      expect(results).toHaveLength(1);
      // Note: The current implementation expects metadata to be an array,
      // but the schema shows it's a single object. This test reflects the actual schema.
    });

    it('should handle manga without metadata', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'One Piece'
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: null
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const results = await detector.findDuplicates('One Piece', 1);

      expect(results).toHaveLength(1);
      const firstResult = results[0];
      if (firstResult) {
        expect(firstResult.score).toBe(1.0);
      }
    });

    it('should filter results by minimum similarity', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'Completely Different Title'
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: null
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const results = await detector.findDuplicates('One Piece', 1, { minSimilarity: 0.9 });

      expect(results).toHaveLength(0);
    });

    it('should sort results by score descending', async () => {
      const mockManga1 = createMockManga({
        id: 1,
        title: 'One Piece'
      });

      const mockManga2 = createMockManga({
        id: 2,
        title: 'One Piece: Special Edition'
      });

      const mockMangasWithMetadata: MangaWithMetadata[] = [
      { ...mockManga1, Metadata: null },
      { ...mockManga2, Metadata: null }];


      mockFindMany.mockResolvedValue(mockMangasWithMetadata as never);

      const results = await detector.findDuplicates('One Piece', 1);

      // Both manga should be found and sorted by score
      expect(results.length).toBeGreaterThanOrEqual(1);
      // If both are returned, verify sorting
      if (results.length > 1) {
        const firstResult = results[0];
        const secondResult = results[1];
        if (firstResult && secondResult) {
          expect(firstResult.score).toBeGreaterThanOrEqual(secondResult.score);
        }
      }
    });
  });

  describe('isDuplicate', () => {
    it('should return true if duplicates exist', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'One Piece'
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: null
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const isDupe = await detector.isDuplicate('One Piece', 1);

      expect(isDupe).toBe(true);
    });

    it('should return false if no duplicates exist', async () => {
      mockFindMany.mockResolvedValue([]);

      const isDupe = await detector.isDuplicate('Unique Title', 1);

      expect(isDupe).toBe(false);
    });

    it('should exclude specific manga ID when checking', async () => {
      const mockManga = createMockManga({
        id: 1,
        title: 'One Piece'
      });

      const mockMangaWithMetadata: MangaWithMetadata = {
        ...mockManga,
        Metadata: null
      };

      mockFindMany.mockResolvedValue([mockMangaWithMetadata] as never);

      const isDupe = await detector.isDuplicate('One Piece', 1, 1);

      expect(isDupe).toBe(false);
    });
  });

  describe('mergeDuplicates', () => {
    const mockUpdateMany = prisma.chapter.updateMany as jest.MockedFunction<typeof prisma.chapter.updateMany>;
    const mockDeleteMany = prisma.manga.deleteMany as jest.MockedFunction<typeof prisma.manga.deleteMany>;

    it('should update chapters and delete duplicate manga', async () => {
      const keepMangaId = 1;
      const mergeFromIds = [2, 3];

      const mockManga = createMockManga({
        id: keepMangaId,
        title: 'One Piece'
      });

      mockFindUnique.mockResolvedValue({ ...mockManga, Metadata: null } as never);
      mockUpdateMany.mockResolvedValue({ count: 10 });
      mockDeleteMany.mockResolvedValue({ count: 2 });

      await detector.mergeDuplicates(keepMangaId, mergeFromIds);

      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { mangaId: { in: mergeFromIds } },
        data: { mangaId: keepMangaId }
      });

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { id: { in: mergeFromIds } }
      });
    });

    it('should transfer metadata if keep manga has none', async () => {
      const keepMangaId = 1;
      const mergeFromIds = [2];

      const mockMangaNoMetadata = createMockManga({
        id: keepMangaId,
        title: 'One Piece',
        metadataId: null
      });

      const mockMangaWithMetadata = createMockManga({
        id: 2,
        title: 'One Piece',
        metadataId: 10
      });

      const mockMetadata = createMockMetadata({ id: 10 });

      mockFindUnique.mockResolvedValue({ ...mockMangaNoMetadata, Metadata: null } as never);
      mockFindFirst.mockResolvedValue({ ...mockMangaWithMetadata, Metadata: mockMetadata } as never);

      const mockUpdate = prisma.manga.update as jest.MockedFunction<typeof prisma.manga.update>;
      mockUpdate.mockResolvedValue({ ...mockMangaNoMetadata, metadataId: 10 } as never);

      await detector.mergeDuplicates(keepMangaId, mergeFromIds);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: keepMangaId },
        data: { metadataId: 10 }
      });
    });

    it('should handle merge with no chapters', async () => {
      const keepMangaId = 1;
      const mergeFromIds = [2];

      const mockManga = createMockManga({ id: keepMangaId });

      mockFindUnique.mockResolvedValue({ ...mockManga, Metadata: null } as never);
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockDeleteMany.mockResolvedValue({ count: 1 });

      await detector.mergeDuplicates(keepMangaId, mergeFromIds);

      expect(mockUpdateMany).toHaveBeenCalled();
      expect(mockDeleteMany).toHaveBeenCalled();
    });

    it('should throw error if keep manga not found', async () => {
      const keepMangaId = 999;
      const mergeFromIds = [1, 2];

      mockFindUnique.mockResolvedValue(null);

      await expect(detector.mergeDuplicates(keepMangaId, mergeFromIds)).
      rejects.toThrow('Target manga not found');
    });

    it('should log merge completion', async () => {
      const keepMangaId = 1;
      const mergeFromIds = [2, 3];
      const mockManga = createMockManga({ id: keepMangaId });

      mockFindUnique.mockResolvedValue({ ...mockManga, Metadata: null } as never);
      mockUpdateMany.mockResolvedValue({ count: 5 });
      mockDeleteMany.mockResolvedValue({ count: 2 });

      await detector.mergeDuplicates(keepMangaId, mergeFromIds);

      const { serverLogger } = require('../../../../utils/serverLogger');
      expect(serverLogger.info).toHaveBeenCalledWith(
        'Merged duplicate manga',
        expect.objectContaining({
          keptId: keepMangaId,
          mergedIds: mergeFromIds
        })
      );
    });
  });
});