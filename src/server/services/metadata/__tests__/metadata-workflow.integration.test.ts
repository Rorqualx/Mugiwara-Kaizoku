/**
 * @jest-environment node
 *
 * End-to-End Metadata Workflow Integration Test
 * Tests the complete metadata flow from providers to database persistence
 */

import { prisma } from '@/server/db';
import type { PartialUnifiedMetadata } from '@/types/search.types';

import { MetadataPersistenceService } from '../metadata-persister';
import { UnifiedMetadataMerger } from '../unified-merger';

import type { Manga, Metadata, MangaPublicationStatus } from '@prisma/client';

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

describe('End-to-End Metadata Workflow Integration Test', () => {
  let merger: UnifiedMetadataMerger;
  let persister: MetadataPersistenceService;

  beforeEach(() => {
    merger = new UnifiedMetadataMerger();
    persister = new MetadataPersistenceService();
    jest.clearAllMocks();

    // Mock transaction execution
    (prisma.$transaction as jest.Mock).mockImplementation((callback: (tx: typeof prisma) => unknown) => {
      return callback(prisma);
    });
  });

  it('should complete end-to-end workflow: providers → merge → persist → database', async () => {
    // ========================================
    // STEP 1: Simulate provider data
    // ========================================

    const anilistData: PartialUnifiedMetadata = {
      title: 'One Piece',
      description: 'Gol D. Roger was known as the "Pirate King," the strongest and most infamous being to have sailed the Grand Line. The capture and execution of Roger by the World Government brought a change throughout the world. His last words before his death revealed the existence of the greatest treasure in the world, One Piece.',
      genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy'],
      authors: ['Eiichiro Oda'],
      status: 'ONGOING',
      chapterCount: 1100,
      releaseYear: 1997,
      coverImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-ulXvn0lzWYE8.jpg',
      primarySource: 'anilist',
      metadataQuality: {
        completeness: 0.9,
        accuracy: 0.98,
        freshness: 0.95,
        sources: 1,
        overall: 0.94
      }
    };

    const comicvineData: PartialUnifiedMetadata = {
      title: 'ONE PIECE',
      alternativeTitles: ['ワンピース', 'Wan Pīsu', 'Op'],
      description: 'Gol D. Roger, a man referred to as the "Pirate King," is set to be executed by the World Government. But just before his demise, he confirms the existence of a great treasure, One Piece, located somewhere within the vast ocean known as the Grand Line.',
      genres: ['Action', 'Adventure', 'Fantasy', 'Shounen'],
      chapterCount: 1105,
      volumeCount: 106,
      tags: [
        { name: 'pirates', rank: 95 },
        { name: 'shounen', rank: 90 }
      ],
      primarySource: 'comicvine',
      metadataQuality: {
        completeness: 0.85,
        accuracy: 0.92,
        freshness: 0.98,
        sources: 1,
        overall: 0.92
      }
    };

    const fandomData: PartialUnifiedMetadata = {
      title: 'One Piece',
      alternativeTitles: ['ワンピース'],
      genres: ['Action', 'Adventure', 'Fantasy', 'Shounen', 'Comedy'],
      authors: ['Eiichiro Oda'],
      artists: ['Eiichiro Oda'],
      volumeCount: 106,
      characters: [
        { name: 'Monkey D. Luffy', role: 'MAIN' },
        { name: 'Roronoa Zoro', role: 'MAIN' },
        { name: 'Nami', role: 'MAIN' }
      ],
      primarySource: 'fandom',
      metadataQuality: {
        completeness: 0.75,
        accuracy: 0.88,
        freshness: 0.85,
        sources: 1,
        overall: 0.83
      }
    };

    // ========================================
    // STEP 2: Merge provider data
    // ========================================

    const mergeResult = merger.merge([anilistData, comicvineData, fandomData]);

    // Verify merge was successful
    expect(mergeResult.metadata['title']).toBe('One Piece');
    expect((mergeResult.metadata['genres'] as string[]).length).toBeGreaterThan(0);
    expect(mergeResult.metadata.chapterCount).toBe(1100); // AniList has priority
    expect(mergeResult.metadata.volumeCount).toBe(106);
    expect((mergeResult.metadata['alternativeTitles'] as string[]).length).toBeGreaterThan(0);
    expect((mergeResult.metadata['characters'] as Array<{ name: string; role: string }>).length).toBeGreaterThan(0);
    expect(mergeResult.conflicts.length).toBeGreaterThan(0); // Should have conflicts

    // ========================================
    // STEP 3: Prepare for persistence
    // ========================================

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

    const mockCreatedMetadata: Metadata = {
      id: 100,
      coverExtraLarge: null,
      coverLarge: null,
      coverMedium: null,
      coverSmall: null,
      summary: (mergeResult.metadata['description'] as string | undefined) ?? '',
      genres: (mergeResult.metadata['genres'] as string[] | undefined) ?? [],
      authors: (mergeResult.metadata['authors'] as string[] | undefined) ?? [],
      tags: mergeResult.metadata.tags?.map(t => t.name) ?? [],
      themes: [],
      startDate: null,
      endDate: null,
      synonyms: (mergeResult.metadata['alternativeTitles'] as string[] | undefined) ?? [],
      urls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      cover: (mergeResult.metadata['coverImage'] as string | undefined) ?? '/cover-not-found.jpg',
      lastFetch: new Date(),
      source: 'anilist',
      sourceId: 'anilist-30013',
      volumes: mergeResult.metadata.volumeCount ?? null,
      chapters: mergeResult.metadata.chapterCount ?? null,
      artists: (mergeResult.metadata['artists'] as string[] | undefined) ?? [],
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
      status: (mergeResult.metadata['status'] ?? 'UNKNOWN') as MangaPublicationStatus,
      galleryImages: [],
      fieldAlternatives: null
    };

    (prisma.manga.findUnique as jest.Mock).mockResolvedValue(mockManga);
    (prisma.metadata.create as jest.Mock).mockResolvedValue(mockCreatedMetadata);
    (prisma.manga.update as jest.Mock).mockResolvedValue({
      ...mockManga,
      metadataId: 100,
      metadata: mockCreatedMetadata
    });

    // ========================================
    // STEP 4: Persist to database
    // ========================================

    const persistResult = await persister.persistMetadata({
      mangaId: 1,
      metadata: mergeResult.metadata,
      metadataProvenance: mergeResult.selections
    });

    // Verify persistence was successful
    expect(persistResult.status).toBe('success');
    if (persistResult.status === 'success') {
      expect(persistResult.data.created).toBe(true);
      expect(persistResult.data.manga).toBeDefined();
      expect(persistResult.data.manga.id).toBe(1);
    }

    // ========================================
    // STEP 5: Verify complete workflow
    // ========================================

    // Verify metadata was created with merged data
    expect(prisma.metadata.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        summary: expect.any(String),
        genres: expect.arrayContaining(['Action', 'Adventure']),
        authors: expect.arrayContaining(['Eiichiro Oda']),
        chapters: 1100,
        volumes: 106,
        synonyms: expect.arrayContaining(['ワンピース']),
      })
    });

    // Verify provenance was tracked
    expect(prisma.manga.update).toHaveBeenCalled();
    const updateCall = (prisma.manga.update as jest.Mock).mock.calls.find(
      (call: unknown[]) => {
        const firstArg = call[0] as { data?: { providerMetadata?: unknown } } | undefined;
        return firstArg?.data?.providerMetadata;
      }
    );
    expect(updateCall).toBeDefined();
  });

  it('should handle workflow with partial provider data', async () => {
    // Only one provider with limited data
    const singleProviderData: PartialUnifiedMetadata = {
      title: 'One Piece',
      description: 'A manga about pirates',
      genres: ['Action', 'Adventure'],
      primarySource: 'anilist',
      metadataQuality: {
        completeness: 0.4,
        accuracy: 0.95,
        freshness: 0.95,
        sources: 1,
        overall: 0.77
      }
    };

    const mergeResult = merger.merge([singleProviderData]);

    expect(mergeResult.metadata['title']).toBe('One Piece');
    expect(mergeResult.conflicts).toHaveLength(0); // No conflicts with single source

    // Persist
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

    const persistResult = await persister.persistMetadata({
      mangaId: 1,
      metadata: mergeResult.metadata,
      metadataProvenance: {}
    });

    expect(persistResult.status).toBe('success');
  });

  it('should handle workflow error scenarios gracefully', async () => {
    // Valid merge
    const providerData: PartialUnifiedMetadata = {
      title: 'One Piece',
      genres: ['Action'],
      primarySource: 'anilist',
      metadataQuality: {
        completeness: 0.5,
        accuracy: 0.95,
        freshness: 0.95,
        sources: 1,
        overall: 0.8
      }
    };

    const mergeResult = merger.merge([providerData]);

    // But persistence fails (manga not found)
    (prisma.manga.findUnique as jest.Mock).mockResolvedValue(null);

    const persistResult = await persister.persistMetadata({
      mangaId: 999,
      metadata: mergeResult.metadata,
      metadataProvenance: {}
    });

    expect(persistResult.status).toBe('error');
    if (persistResult.status === 'error') {
      expect(persistResult.error.message).toContain('Manga with ID 999 not found');
    }
  });

  it('should complete workflow with metadata updates (not creation)', async () => {
    // Existing metadata
    const existingMetadata: Metadata = {
      id: 100,
      coverExtraLarge: null,
      coverLarge: null,
      coverMedium: null,
      coverSmall: null,
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

    // Fresh provider data
    const anilistData: PartialUnifiedMetadata = {
      title: 'One Piece',
      description: 'Updated description from AniList',
      genres: ['Action', 'Adventure', 'Fantasy'],
      chapterCount: 1100,
      primarySource: 'anilist',
      metadataQuality: {
        completeness: 0.7,
        accuracy: 0.98,
        freshness: 0.98,
        sources: 1,
        overall: 0.91
      }
    };

    const mergeResult = merger.merge([anilistData]);

    (prisma.manga.findUnique as jest.Mock).mockResolvedValue({
      ...mockManga,
      Metadata: existingMetadata
    });
    (prisma.metadata.update as jest.Mock).mockResolvedValue({
      ...existingMetadata,
      summary: 'Updated description from AniList',
      genres: ['Action', 'Adventure', 'Fantasy'],
      chapters: 1100
    });

    const persistResult = await persister.persistMetadata({
      mangaId: 1,
      metadata: mergeResult.metadata,
      metadataProvenance: mergeResult.selections
    });

    expect(persistResult.status).toBe('success');
    if (persistResult.status === 'success') {
      expect(persistResult.data.created).toBe(false); // Updated, not created
    }

    // Verify update was called (not create)
    expect(prisma.metadata.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: expect.objectContaining({
        summary: 'Updated description from AniList',
        chapters: 1100,
        // Existing authors preserved
        authors: ['Eiichiro Oda']
      })
    });
  });

  it('should handle workflow with high-conflict merging', () => {
    // Conflicting data from multiple providers
    const provider1: PartialUnifiedMetadata = {
      title: 'One Piece',
      chapterCount: 1100,
      volumeCount: 106,
      primarySource: 'anilist',
      metadataQuality: {
        completeness: 0.7,
        accuracy: 0.95,
        freshness: 0.95,
        sources: 1,
        overall: 0.87
      }
    };

    const provider2: PartialUnifiedMetadata = {
      title: 'ONE PIECE',
      chapterCount: 1105, // Different
      volumeCount: 107, // Different
      primarySource: 'comicvine',
      metadataQuality: {
        completeness: 0.6,
        accuracy: 0.9,
        freshness: 0.98,
        sources: 1,
        overall: 0.83
      }
    };

    const mergeResult = merger.merge([provider1, provider2]);

    // Should have conflicts
    expect(mergeResult.conflicts.length).toBeGreaterThan(0);

    // AniList should win (higher priority)
    expect(mergeResult.metadata.chapterCount).toBe(1100);
    expect(mergeResult.metadata.volumeCount).toBe(106);

    // Verify provenance tracking
    // buildSelections only tracks primary source, not per-field
    expect(mergeResult.selections).toMatchObject({
      primary: 'anilist'
    });
  });
});
