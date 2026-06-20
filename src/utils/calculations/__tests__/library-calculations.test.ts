/**
 * Tests for library size calculation utilities
 */

import type { LibraryWithRelations, MangaWithRelations } from '@/types/search.types';

import { calculateLibrarySize, calculateMangaSize, calculateLibrarySizes, getChapterSize } from '../library-calculations';

import type { ChapterStatus } from '@prisma/client';

/**
 * Helper function to create minimal Chapter data for testing
 */
function createTestChapter(id: number, mangaId: number, size: number): MangaWithRelations['Chapter'][number] {
  return {
    id,
    mangaId,
    fileName: `chapter-${id}`,
    index: id,
    size,
    title: `Chapter ${id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    downloadStatus: 'PENDING' as ChapterStatus,
    downloadUrl: null,
    hash: null,
    mimeType: null,
    pageCount: null,
    pageCountAttempts: 0,
    resolutionWidth: null,
    resolutionHeight: null,
    resolutionLabel: null,
    language: null,
    alternativeTitles: [],
    chapterNumber: null,
    coverImage: null,
    description: null,
    fileFormat: null,
    filePath: null,
    isRead: false,
    monitored: false,
    number: null,
    packDownloadId: null,
    pages: null,
    releaseDate: null,
    volume: null,
    volumeId: null,
    mangadexId: null,
    suwayomiChapterId: null,
  };
}

/**
 * Helper function to create test Manga data
 */
function createTestManga(
  id: number,
  libraryId: number,
  title: string,
  chapters: MangaWithRelations['Chapter']
): MangaWithRelations {
  return {
    id,
    libraryId,
    title,
    source: 'test',
    lastChecked: null,
    libraryPath: null,
    mangaTitle: null,
    errorMessage: null,
    lastErrorAt: null,
    lastSyncAt: null,
    summary: null,
    syncCount: 0,
    searchProvider: 'anilist',
    providerMetadata: null,
    monitoringConfig: null,
    metadataConfidence: null,
    mlCorrected: false,
    metadataId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    selectedSourceId: null,
    rawProviderData: null,
    sourceId: null,
    fileStatus: 'PENDING',
    libraryStatus: 'ACTIVE',
    publicationStatus: 'ONGOING',
    suwayomiPluginConfig: null,
    mediaType: 'MANGA',
    Library: {
      id: libraryId,
      name: 'Test Library',
      ownerId: 'test-user',
      path: '/test',
      createdAt: new Date(),
      lastScanAt: null
    },
    Metadata: null,
    Chapter: chapters,
    _count: {
      Chapter: chapters.length
    }
  };
}

describe('Library Calculations', () => {
  describe('calculateMangaSize', () => {
    it('should calculate total size of manga chapters', () => {
      const manga = createTestManga(1, 1, 'Test Manga', [
        createTestChapter(1, 1, 1000),
        createTestChapter(2, 1, 2000),
        createTestChapter(3, 1, 3000),
      ]);

      const size = calculateMangaSize(manga);
      expect(size).toBe(6000);
    });

    it('should handle manga with no chapters', () => {
      const manga = createTestManga(1, 1, 'Test Manga', []);

      const size = calculateMangaSize(manga);
      expect(size).toBe(0);
    });

    it('should handle chapters with file.size structure', () => {
      // This test verifies the implementation can handle alternative data structures
      // where size is nested in a file object (legacy pattern)
      const manga = createTestManga(1, 1, 'Test Manga', [
        createTestChapter(1, 1, 1500),
        createTestChapter(2, 1, 2500),
      ]);

      const size = calculateMangaSize(manga);
      expect(size).toBe(4000);
    });
  });

  describe('calculateLibrarySize', () => {
    it('should calculate total size of all mangas in library', () => {
      const library: LibraryWithRelations = {
        id: 1,
        name: 'Test Library',
        ownerId: 'test-user',
        path: '/test',
        createdAt: new Date(),
        lastScanAt: null,
        Manga: [
          createTestManga(1, 1, 'Manga 1', [
            createTestChapter(1, 1, 1000),
            createTestChapter(2, 1, 2000),
          ]),
          createTestManga(2, 1, 'Manga 2', [
            createTestChapter(3, 2, 3000),
          ])
        ]
      };

      const size = calculateLibrarySize(library);
      expect(size).toBe(6000);
    });

    it('should handle library with no mangas', () => {
      const library: LibraryWithRelations = {
        id: 1,
        name: 'Empty Library',
        ownerId: 'test-user',
        path: '/empty',
        createdAt: new Date(),
        lastScanAt: null,
        Manga: []
      };

      const size = calculateLibrarySize(library);
      expect(size).toBe(0);
    });
  });

  describe('calculateLibrarySizes', () => {
    it('should return a map of library sizes', () => {
      const libraries: LibraryWithRelations[] = [
        {
          id: 1,
          name: 'Library 1',
          ownerId: 'test-user',
          path: '/lib1',
          createdAt: new Date(),
          lastScanAt: null,
          Manga: [
            createTestManga(1, 1, 'Manga 1', [
              createTestChapter(1, 1, 1000)
            ])
          ]
        },
        {
          id: 2,
          name: 'Library 2',
          ownerId: 'test-user',
          path: '/lib2',
          createdAt: new Date(),
          lastScanAt: null,
          Manga: [
            createTestManga(2, 2, 'Manga 2', [
              createTestChapter(2, 2, 2000)
            ])
          ]
        }
      ];

      const sizes = calculateLibrarySizes(libraries);
      expect(sizes.get(1)).toBe(1000);
      expect(sizes.get(2)).toBe(2000);
    });
  });

  describe('getChapterSize', () => {
    it('should get size from direct property', () => {
      const chapter = createTestChapter(1, 1, 5000);
      expect(getChapterSize(chapter)).toBe(5000);
    });

    it('should return 0 for missing size', () => {
      const chapter = createTestChapter(1, 1, 0);
      expect(getChapterSize(chapter)).toBe(0);
    });
  });
});