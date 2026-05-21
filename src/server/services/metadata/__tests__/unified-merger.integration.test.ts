/**
 * @jest-environment node
 *
 * Integration tests for UnifiedMetadataMerger
 * Tests complete metadata merging workflows with multiple providers
 */

import { MangaPublicationStatus} from '@prisma/client';

import type { PartialUnifiedMetadata} from '@/types/search.types';



import { UnifiedMetadataMerger, type ProviderPriority } from '../unified-merger';

describe('UnifiedMetadataMerger Integration Tests', () => {
  let merger: UnifiedMetadataMerger;

  beforeEach(() => {
    merger = new UnifiedMetadataMerger();
  });

  describe('Basic Merging', () => {
    it('should merge two provider sources with priority-based selection', () => {
      const anilistData: PartialUnifiedMetadata = {
        title: 'One Piece',
        alternativeTitles: ['ワンピース', 'Wan Pīsu'],
        description: 'AniList description',
        status: MangaPublicationStatus.ONGOING,
        genres: ['Action', 'Adventure', 'Fantasy'],
        authors: ['Eiichiro Oda'],
        artists: ['Eiichiro Oda'],
        coverImage: 'https://anilist.co/cover/large.jpg',
        year: 1997,
        primarySource: 'anilist',
        metadataQuality: {
          completeness: 0.9,
          accuracy: 0.95,
          freshness: 0.9,
          sources: 1,
          overall: 0.92
        }
      };

      const fandomData: PartialUnifiedMetadata = {
        title: 'ONE PIECE',
        alternativeTitles: ['One Piece'],
        description: 'Fandom description - more detailed',
        status: MangaPublicationStatus.ONGOING,
        genres: ['Action', 'Adventure', 'Comedy'],
        authors: ['Oda Eiichiro'],
        artists: ['Oda Eiichiro'],
        coverImage: 'https://fandom.com/cover/large.jpg',
        chapterCount: 1100,
        volumeCount: 106,
        publisher: 'Shueisha',
        primarySource: 'fandom',
        metadataQuality: {
          completeness: 0.85,
          accuracy: 0.9,
          freshness: 0.95,
          sources: 1,
          overall: 0.9
        }
      };

      const result = merger.merge([anilistData, fandomData]);

      // AniList has higher priority (100 vs 85), so its values take precedence
      expect(result.metadata['title']).toBe('One Piece');
      expect(result.metadata['description']).toBe('AniList description');

      // But missing fields should be filled from Fandom
      expect(result.metadata.chapterCount).toBe(1100);
      expect(result.metadata.volumeCount).toBe(106);
      expect(result.metadata['publisher']).toBe('Shueisha');

      // Arrays should be merged and deduplicated
      expect(result.metadata['genres']).toContain('Action');
      expect(result.metadata['genres']).toContain('Adventure');
      expect(result.metadata['genres']).toContain('Fantasy');
      expect(result.metadata['genres']).toContain('Comedy');
      expect((result.metadata['genres'] as string[]).length).toBe(4);

      // Should track conflicts
      expect(result.conflicts.length).toBeGreaterThan(0);
      const titleConflict = result.conflicts.find(c => c.field === 'title');
      expect(titleConflict).toBeDefined();
      expect(titleConflict?.values).toHaveLength(2);

      // Should calculate merged quality
      expect(result.metadata.metadataQuality).toBeDefined();
      expect(result.metadata.metadataQuality?.overall).toBeGreaterThan(0);
    });

    it('should handle single source without conflicts', () => {
      const singleSource: PartialUnifiedMetadata = {
        title: 'Test Manga',
        description: 'Test description',
        status: MangaPublicationStatus.COMPLETED,
        genres: ['Action'],
        authors: ['Test Author'],
        artists: ['Test Artist'],
        primarySource: 'anilist',
        metadataQuality: {
          completeness: 0.8,
          accuracy: 0.9,
          freshness: 0.95,
          sources: 1,
          overall: 0.88
        }
      };

      const result = merger.merge([singleSource]);

      expect(result.metadata['title']).toBe('Test Manga');
      expect(result.conflicts).toHaveLength(0);
      expect(result.metadata.metadataQuality?.overall).toBe(0.88);
    });

    it('should throw error for empty sources array', () => {
      expect(() => merger.merge([])).toThrow('No metadata sources to merge');
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts in overlapping fields', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Attack on Titan',
        year: 2009,
        chapterCount: 139,
        volumeCount: 34,
        publisher: 'Kodansha',
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Shingeki no Kyojin',
        year: 2009,
        chapterCount: 141,
        volumeCount: 34,
        publisher: 'Kodansha Comics',
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      // Should have conflicts for title, chapterCount, and publisher
      expect(result.conflicts.length).toBeGreaterThan(0);

      const titleConflict = result.conflicts.find(c => c.field === 'title');
      expect(titleConflict).toBeDefined();
      expect(titleConflict?.values.map(v => v.value)).toContain('Attack on Titan');
      expect(titleConflict?.values.map(v => v.value)).toContain('Shingeki no Kyojin');

      const chapterConflict = result.conflicts.find(c => c.field === 'chapterCount');
      expect(chapterConflict).toBeDefined();
      expect(chapterConflict?.values.map(v => v.value)).toContain(139);
      expect(chapterConflict?.values.map(v => v.value)).toContain(141);
    });

    it('should prefer non-null values when preferNonNull is true', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test Manga',
        // Omit description and publisher (they will be undefined)
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test Manga',
        description: 'Actual description',
        publisher: 'Test Publisher',
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      expect(result.metadata['description']).toBe('Actual description');
      expect(result.metadata['publisher']).toBe('Test Publisher');
    });
  });

  describe('Array Merging', () => {
    it('should merge and deduplicate genre arrays', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        genres: ['Action', 'Adventure', 'Fantasy'],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        genres: ['Action', 'Comedy', 'Supernatural'],
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      expect((result.metadata['genres'] as string[]).length).toBe(5);
      expect((result.metadata['genres'] as string[])).toContain('Action');
      expect((result.metadata['genres'] as string[])).toContain('Adventure');
      expect((result.metadata['genres'] as string[])).toContain('Fantasy');
      expect((result.metadata['genres'] as string[])).toContain('Comedy');
      expect((result.metadata['genres'] as string[])).toContain('Supernatural');
    });

    it('should merge and deduplicate author/artist arrays', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        authors: ['Eiichiro Oda', 'Author 2'],
        artists: ['Eiichiro Oda'],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        authors: ['Oda Eiichiro', 'Author 3'],
        artists: ['Oda Eiichiro', 'Artist 2'],
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      // Deduplicates by exact case-insensitive match
      // "Eiichiro Oda" !== "Oda Eiichiro" (different names, not deduplicated)
      expect((result.metadata['authors'] as string[]).length).toBe(4); // All authors: Eiichiro Oda, Author 2, Oda Eiichiro, Author 3
      expect((result.metadata['artists'] as string[]).length).toBe(3); // All artists: Eiichiro Oda, Oda Eiichiro, Artist 2
    });

    it('should merge character arrays with ID-based deduplication', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        characters: [
          { id: '1', name: 'Luffy', role: 'MAIN' as const },
          { id: '2', name: 'Zoro', role: 'MAIN' as const }
        ],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        characters: [
          { id: '1', name: 'Monkey D. Luffy', role: 'MAIN' as const },
          { id: '3', name: 'Nami', role: 'MAIN' as const }
        ],
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      // Should have 3 unique characters (ID 1, 2, 3)
      expect(result.metadata.characters).toHaveLength(3);
      const characterIds = result.metadata.characters?.map(c => c.id);
      expect(characterIds).toContain('1');
      expect(characterIds).toContain('2');
      expect(characterIds).toContain('3');
    });

    it('should merge tag arrays preserving highest rank', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        tags: [
          { name: 'Pirate', description: 'Tag 1', rank: 85 },
          { name: 'Adventure', description: 'Tag 2', rank: 90 }
        ],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        tags: [
          { name: 'Pirate', description: 'Tag 1', rank: 95 }, // Higher rank
          { name: 'Treasure', description: 'Tag 3', rank: 80 }
        ],
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      expect(result.metadata.tags).toHaveLength(3);

      // Pirate tag should have the higher rank (95)
      const pirateTag = result.metadata.tags?.find(t => t.name === 'Pirate');
      expect(pirateTag?.rank).toBe(95);

      // All tags should be present
      const tagNames = result.metadata.tags?.map(t => t.name);
      expect(tagNames).toContain('Pirate');
      expect(tagNames).toContain('Adventure');
      expect(tagNames).toContain('Treasure');
    });
  });

  describe('Complex Field Merging', () => {
    it('should merge cover images without overwriting existing values', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        covers: {
          original: 'https://example.com/original.jpg',
          large: 'https://example.com/large.jpg'
        },
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        covers: {
          large: 'https://fandom.com/large.jpg',
          medium: 'https://fandom.com/medium.jpg',
          small: 'https://fandom.com/small.jpg'
        },
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      // Should keep AniList's values and add missing ones from Fandom
      expect(result.metadata.covers?.original).toBe('https://example.com/original.jpg');
      expect(result.metadata.covers?.large).toBe('https://example.com/large.jpg');
      expect(result.metadata.covers?.medium).toBe('https://fandom.com/medium.jpg');
      expect(result.metadata.covers?.small).toBe('https://fandom.com/small.jpg');
    });

    it('should merge external IDs from all sources', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        externalIds: {
          anilistId: 1,
          malId: 13
        },
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        externalIds: {
          fandomId: 'abc123',
          malId: 13
        },
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      expect(result.metadata.externalIds?.anilistId).toBe(1);
      expect(result.metadata.externalIds?.malId).toBe(13);
      expect(result.metadata.externalIds?.["fandomId"]).toBe('abc123');
    });

    it('should merge provider metadata without duplicates', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        providerMetadata: [
          {
            provider: 'anilist',
            data: { id: 'AL123', url: 'https://anilist.co/manga/123' },
            confidence: 0.95,
            lastUpdated: new Date('2025-01-01')
          }
        ],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        providerMetadata: [
          {
            provider: 'fandom',
            data: { id: 'FD456', url: 'https://fandom.com/wiki/456' },
            confidence: 0.90,
            lastUpdated: new Date('2025-01-02')
          }
        ],
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      expect(result.metadata.providerMetadata).toHaveLength(2);
      const providers = result.metadata.providerMetadata?.map(pm => pm.provider);
      expect(providers).toContain('anilist');
      expect(providers).toContain('fandom');
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom provider priorities', () => {
      const customPriorities: ProviderPriority[] = [
        { provider: 'fandom', priority: 100 },
        { provider: 'anilist', priority: 90 }
      ];

      const customMerger = new UnifiedMetadataMerger({
        priorities: customPriorities
      });

      const source1: PartialUnifiedMetadata = {
        title: 'AniList Title',
        description: 'AniList description',
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Fandom Title',
        description: 'Fandom description',
        primarySource: 'fandom'
      };

      const result = customMerger.merge([source1, source2]);

      // Fandom should win with custom priorities
      expect(result.metadata['title']).toBe('Fandom Title');
      expect(result.metadata['description']).toBe('Fandom description');
    });

    it('should handle mergeArrays=false configuration', () => {
      const noMergeMerger = new UnifiedMetadataMerger({
        mergeArrays: false
      });

      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        genres: ['Action', 'Adventure'],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        genres: ['Comedy', 'Drama'],
        primarySource: 'fandom'
      };

      const result = noMergeMerger.merge([source1, source2]);

      // Should keep only first source's genres
      expect(result.metadata['genres']).toEqual(['Action', 'Adventure']);
    });

    it('should handle deduplicateArrays=false configuration', () => {
      const noDedupeMerger = new UnifiedMetadataMerger({
        deduplicateArrays: false
      });

      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        genres: ['Action', 'Adventure'],
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        genres: ['Action', 'Comedy'],
        primarySource: 'fandom'
      };

      const result = noDedupeMerger.merge([source1, source2]);

      // Should have duplicate 'Action'
      expect((result.metadata['genres'] as string[])).toHaveLength(4);
      expect((result.metadata['genres'] as string[]).filter(g => g === 'Action')).toHaveLength(2);
    });
  });

  describe('Manual Field Selection', () => {
    it('should allow manual field selection with mergeWithSelection', () => {
      const anilistData: PartialUnifiedMetadata = {
        title: 'AniList Title',
        description: 'AniList description',
        coverImage: 'https://anilist.co/cover.jpg',
        year: 1997,
        primarySource: 'anilist'
      };

      const fandomData: PartialUnifiedMetadata = {
        title: 'Fandom Title',
        description: 'Fandom description',
        coverImage: 'https://fandom.com/cover.jpg',
        chapterCount: 1100,
        primarySource: 'fandom'
      };

      const sources = new Map([
        ['anilist', anilistData],
        ['fandom', fandomData]
      ]);

      const selection = {
        title: 'fandom',
        description: 'anilist',
        coverImage: 'anilist',
        chapterCount: 'fandom'
      };

      const result = merger.mergeWithSelection(sources, selection);

      // Should use selected provider for each field
      expect(result['title']).toBe('Fandom Title');
      expect(result['description']).toBe('AniList description');
      expect(result['coverImage']).toBe('https://anilist.co/cover.jpg');
      expect(result.chapterCount).toBe(1100);
      // Note: mergeWithSelection only fills fields that exist on merged object
      // year wasn't in selection, so it won't be filled automatically
    });
  });

  describe('Metadata Quality Calculation', () => {
    it('should calculate average quality from multiple sources', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        primarySource: 'anilist',
        metadataQuality: {
          completeness: 0.9,
          accuracy: 0.95,
          freshness: 0.85,
          sources: 1,
          overall: 0.9
        }
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        primarySource: 'fandom',
        metadataQuality: {
          completeness: 0.85,
          accuracy: 0.9,
          freshness: 0.95,
          sources: 1,
          overall: 0.9
        }
      };

      const result = merger.merge([source1, source2]);

      expect(result.metadata.metadataQuality).toBeDefined();
      expect(result.metadata.metadataQuality?.completeness).toBeCloseTo(0.875, 2);
      expect(result.metadata.metadataQuality?.accuracy).toBeCloseTo(0.925, 2);
      expect(result.metadata.metadataQuality?.freshness).toBeCloseTo(0.9, 2);
      expect(result.metadata.metadataQuality?.sources).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle metadata with missing optional fields', () => {
      const source: PartialUnifiedMetadata = {
        title: 'Test',
        // Omit optional fields (description, coverImage, bannerImage)
        primarySource: 'anilist'
      };

      const result = merger.merge([source]);

      expect(result.metadata['title']).toBe('Test');
      // Missing optional string fields default to empty string in completeMetadata
      expect(result.metadata['description']).toBe('');
      expect(result.metadata['coverImage']).toBeUndefined();
    });

    it('should handle metadata with empty arrays', () => {
      const source: PartialUnifiedMetadata = {
        title: 'Test',
        genres: [],
        authors: [],
        tags: [],
        primarySource: 'anilist'
      };

      const result = merger.merge([source]);

      expect(result.metadata['genres']).toEqual([]);
      expect(result.metadata['authors']).toEqual([]);
      expect(result.metadata['tags']).toEqual([]);
    });

    it('should handle merging with undefined primarySource', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test 1',
        description: 'Description 1'
        // No primarySource
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test 2',
        description: 'Description 2',
        primarySource: 'fandom'
      };

      const result = merger.merge([source1, source2]);

      expect(result.metadata['title']).toBeDefined();
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle merging many sources efficiently', () => {
      const sources: PartialUnifiedMetadata[] = Array.from({ length: 10 }, (_, i) => ({
        title: `Source ${i}`,
        description: `Description from provider ${i}`,
        genres: [`Genre${i}`, `Genre${i + 1}`],
        primarySource: `provider${i}`,
        metadataQuality: {
          completeness: 0.8,
          accuracy: 0.9,
          freshness: 0.95,
          sources: 1,
          overall: 0.88
        }
      }));

      const startTime = performance.now();
      const result = merger.merge(sources);
      const endTime = performance.now();

      expect(result.metadata).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
    });

    it('should handle merging large arrays efficiently', () => {
      const source1: PartialUnifiedMetadata = {
        title: 'Test',
        genres: Array.from({ length: 50 }, (_, i) => `Genre${i}`),
        tags: Array.from({ length: 100 }, (_, i) => ({
          name: `Tag${i}`,
          description: `Description ${i}`,
          rank: i
        })),
        primarySource: 'anilist'
      };

      const source2: PartialUnifiedMetadata = {
        title: 'Test',
        genres: Array.from({ length: 50 }, (_, i) => `Genre${i + 25}`),
        tags: Array.from({ length: 100 }, (_, i) => ({
          name: `Tag${i + 50}`,
          description: `Description ${i + 50}`,
          rank: i + 50
        })),
        primarySource: 'fandom'
      };

      const startTime = performance.now();
      const result = merger.merge([source1, source2]);
      const endTime = performance.now();

      expect((result.metadata['genres'] as string[]).length).toBeGreaterThan(50);
      expect((result.metadata['tags'] as Array<{ name: string }>).length).toBeGreaterThan(100);
      expect(endTime - startTime).toBeLessThan(50); // Should complete in < 50ms
    });
  });
});
