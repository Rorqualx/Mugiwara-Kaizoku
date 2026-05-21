/**
 * Common Zod Schemas Test Suite
 *
 * Tests for all common Zod schemas used for external API validation
 */

import { describe, it, expect } from '@jest/globals';
import {
  RawChapterDataSchema,
  RawVolumeDataSchema,
  RawProviderDataSchema,
  AniListTitleSchema,
  AniListCoverImageSchema,
  AniListMediaSchema,
  AniListPageSchema,
  ComicVinePublisherSchema,
  ComicVineVolumeSchema,
  ComicVineResponseSchema,
  // MangaDex schemas removed - provider deprecated
  MetadataResponseSchema,
  SearchResultSchema,
  PaginatedSearchResultsSchema,
  parseJSON,
  parseJSONWithError,
  validateData,
  createPartialSchema,
} from '@/lib/validation/common-schemas';

// ============================================================================
// Provider Data Schema Tests
// ============================================================================

describe('RawChapterDataSchema', () => {
  it('should validate valid chapter data', () => {
    const valid = {
      number: 1,
      title: 'Chapter 1',
      pages: 20,
      url: 'https://example.com/chapter/1',
      releaseDate: '2023-01-01',
    };

    const result = RawChapterDataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate with optional fields missing', () => {
    const minimal = {};
    const result = RawChapterDataSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject invalid URL', () => {
    const invalid = {
      url: 'not-a-url',
    };

    const result = RawChapterDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('RawVolumeDataSchema', () => {
  it('should validate valid volume data', () => {
    const valid = {
      title: 'Volume 1',
      number: 1,
      chapters: [
        { number: 1, title: 'Chapter 1' },
        { number: 2, title: 'Chapter 2' },
      ],
      coverImage: 'https://example.com/cover.jpg',
    };

    const result = RawVolumeDataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should require title field', () => {
    const invalid = {
      number: 1,
    };

    const result = RawVolumeDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('RawProviderDataSchema', () => {
  it('should validate complete provider data', () => {
    const valid = {
      volumes: [
        { title: 'Volume 1', number: 1 },
        { title: 'Volume 2', number: 2 },
      ],
      totalVolumes: 2,
      totalChapters: 20,
      selectedCover: 'https://example.com/cover.jpg',
      selectedBanner: 'https://example.com/banner.jpg',
      status: 'ONGOING',
      description: 'Test description',
    };

    const result = RawProviderDataSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate with all optional fields missing', () => {
    const minimal = {};
    const result = RawProviderDataSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject invalid cover URL', () => {
    const invalid = {
      selectedCover: 'not-a-url',
    };

    const result = RawProviderDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// AniList Schema Tests
// ============================================================================

describe('AniListTitleSchema', () => {
  it('should validate with all title variants', () => {
    const valid = {
      romaji: 'One Piece',
      english: 'One Piece',
      native: 'ワンピース',
    };

    const result = AniListTitleSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate with only romaji', () => {
    const minimal = {
      romaji: 'One Piece',
    };

    const result = AniListTitleSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject without romaji', () => {
    const invalid = {
      english: 'One Piece',
    };

    const result = AniListTitleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should handle null values', () => {
    const withNull = {
      romaji: 'One Piece',
      english: null,
      native: null,
    };

    const result = AniListTitleSchema.safeParse(withNull);
    expect(result.success).toBe(true);
  });
});

describe('AniListCoverImageSchema', () => {
  it('should validate with all sizes', () => {
    const valid = {
      large: 'https://example.com/large.jpg',
      medium: 'https://example.com/medium.jpg',
      extraLarge: 'https://example.com/xl.jpg',
    };

    const result = AniListCoverImageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate empty object', () => {
    const result = AniListCoverImageSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject invalid URLs', () => {
    const invalid = {
      large: 'not-a-url',
    };

    const result = AniListCoverImageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('AniListMediaSchema', () => {
  it('should validate complete media data', () => {
    const valid = {
      id: 30013,
      title: {
        romaji: 'One Piece',
        english: 'One Piece',
        native: 'ワンピース',
      },
      coverImage: {
        large: 'https://example.com/cover.jpg',
      },
      bannerImage: 'https://example.com/banner.jpg',
      description: 'Test description',
      status: 'RELEASING',
      genres: ['Action', 'Adventure'],
      averageScore: 85,
      startDate: {
        year: 1997,
        month: 7,
        day: 22,
      },
    };

    const result = AniListMediaSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate minimal media data', () => {
    const minimal = {
      id: 1,
      title: {
        romaji: 'Test Manga',
      },
    };

    const result = AniListMediaSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject without id', () => {
    const invalid = {
      title: {
        romaji: 'Test',
      },
    };

    const result = AniListMediaSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('AniListPageSchema', () => {
  it('should validate page with media array', () => {
    const valid = {
      Page: {
        media: [
          {
            id: 1,
            title: { romaji: 'Test 1' },
          },
          {
            id: 2,
            title: { romaji: 'Test 2' },
          },
        ],
        pageInfo: {
          total: 2,
          currentPage: 1,
          lastPage: 1,
          hasNextPage: false,
        },
      },
    };

    const result = AniListPageSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate without pageInfo', () => {
    const minimal = {
      Page: {
        media: [],
      },
    };

    const result = AniListPageSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// ComicVine Schema Tests
// ============================================================================

describe('ComicVinePublisherSchema', () => {
  it('should validate with name', () => {
    const valid = {
      name: 'Marvel Comics',
      id: 31,
    };

    const result = ComicVinePublisherSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should require name', () => {
    const invalid = {
      id: 31,
    };

    const result = ComicVinePublisherSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('ComicVineVolumeSchema', () => {
  it('should validate complete volume', () => {
    const valid = {
      id: 12345,
      name: 'Spider-Man',
      start_year: '1963',
      count_of_issues: 800,
      publisher: {
        name: 'Marvel Comics',
        id: 31,
      },
      description: 'Test description',
      image: {
        thumb_url: 'https://example.com/thumb.jpg',
        original_url: 'https://example.com/original.jpg',
      },
    };

    const result = ComicVineVolumeSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate minimal volume', () => {
    const minimal = {
      id: 1,
      name: 'Test',
    };

    const result = ComicVineVolumeSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe('ComicVineResponseSchema', () => {
  it('should validate API response', () => {
    const valid = {
      status_code: 1,
      error: 'OK',
      results: [
        { id: 1, name: 'Volume 1' },
        { id: 2, name: 'Volume 2' },
      ],
      number_of_total_results: 2,
    };

    const result = ComicVineResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should require status_code and error', () => {
    const invalid = {
      results: [],
    };

    const result = ComicVineResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// MangaDex Schema Tests - REMOVED (provider deprecated)
// ============================================================================

// ============================================================================
// Generic Schema Tests
// ============================================================================

describe('MetadataResponseSchema', () => {
  it('should validate complete metadata', () => {
    const valid = {
      title: 'One Piece',
      description: 'Test description',
      coverImage: 'https://example.com/cover.jpg',
      bannerImage: 'https://example.com/banner.jpg',
      authors: ['Oda Eiichiro'],
      genres: ['Action', 'Adventure'],
      tags: ['Pirates', 'Shonen'],
      status: 'ONGOING',
      year: 1997,
      rating: 8.5,
    };

    const result = MetadataResponseSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate with only title', () => {
    const minimal = {
      title: 'Test',
    };

    const result = MetadataResponseSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('should reject without title', () => {
    const invalid = {
      description: 'Test',
    };

    const result = MetadataResponseSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('SearchResultSchema', () => {
  it('should validate with string id', () => {
    const valid = {
      id: 'abc-123',
      title: 'Test Manga',
      coverImage: 'https://example.com/cover.jpg',
    };

    const result = SearchResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should validate with number id', () => {
    const valid = {
      id: 12345,
      title: 'Test Manga',
    };

    const result = SearchResultSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should require id and title', () => {
    const invalid = {
      coverImage: 'https://example.com/cover.jpg',
    };

    const result = SearchResultSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('PaginatedSearchResultsSchema', () => {
  it('should validate paginated results', () => {
    const valid = {
      results: [
        { id: 1, title: 'Test 1' },
        { id: 2, title: 'Test 2' },
      ],
      total: 100,
      page: 1,
      hasNextPage: true,
    };

    const result = PaginatedSearchResultsSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should require results array', () => {
    const invalid = {
      total: 100,
    };

    const result = PaginatedSearchResultsSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('parseJSON', () => {
  it('should parse and validate valid JSON', () => {
    const json = '{"title": "Test"}';
    const result = parseJSON(json, MetadataResponseSchema);

    expect(result).not.toBe(null);
    expect(result?.title).toBe('Test');
  });

  it('should return null for invalid JSON', () => {
    const result = parseJSON('invalid', MetadataResponseSchema);
    expect(result).toBe(null);
  });

  it('should return null for schema validation failure', () => {
    const json = '{"description": "No title"}';
    const result = parseJSON(json, MetadataResponseSchema);
    expect(result).toBe(null);
  });
});

describe('parseJSONWithError', () => {
  it('should return success with data', () => {
    const json = '{"title": "Test"}';
    const result = parseJSONWithError(json, MetadataResponseSchema);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test');
    }
  });

  it('should return error for invalid JSON', () => {
    const result = parseJSONWithError('invalid', MetadataResponseSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should return error with issues for validation failure', () => {
    const json = '{"description": "No title"}';
    const result = parseJSONWithError(json, MetadataResponseSchema);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Validation failed');
      expect(result.issues).toBeDefined();
    }
  });
});

describe('validateData', () => {
  it('should validate valid data', () => {
    const data = { title: 'Test' };
    const result = validateData(data, MetadataResponseSchema);

    expect(result).not.toBe(null);
    expect(result?.title).toBe('Test');
  });

  it('should return null for invalid data', () => {
    const data = { description: 'No title' };
    const result = validateData(data, MetadataResponseSchema);

    expect(result).toBe(null);
  });
});

describe('createPartialSchema', () => {
  it('should create schema with all optional fields', () => {
    const PartialMetadataSchema = createPartialSchema(MetadataResponseSchema);

    // Should validate with no fields
    const result1 = PartialMetadataSchema.safeParse({});
    expect(result1.success).toBe(true);

    // Should validate with some fields
    const result2 = PartialMetadataSchema.safeParse({ title: 'Test' });
    expect(result2.success).toBe(true);

    // Should still validate types
    const result3 = PartialMetadataSchema.safeParse({ year: 'not-a-number' });
    expect(result3.success).toBe(false);
  });
});

// ============================================================================
// Real-world Example Tests
// ============================================================================

describe('Real-world scenarios', () => {
  it('should handle AniList API response', () => {
    const apiResponse = {
      id: 30013,
      title: {
        romaji: 'One Piece',
        english: 'One Piece',
        native: 'ワンピース',
      },
      coverImage: {
        large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-v5cWcovLBVvr.jpg',
      },
      description: 'Monkey D. Luffy wants to become the King of all pirates.',
      status: 'RELEASING',
      genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy'],
    };

    const result = AniListMediaSchema.safeParse(apiResponse);
    expect(result.success).toBe(true);
  });

  it('should handle partial provider data', () => {
    const providerData = {
      totalVolumes: 103,
      totalChapters: 1050,
      selectedCover: 'https://example.com/cover.jpg',
    };

    const result = RawProviderDataSchema.safeParse(providerData);
    expect(result.success).toBe(true);
  });

  it('should handle search results from different providers', () => {
    const anilistResult = {
      id: 30013,
      title: 'One Piece',
      coverImage: 'https://example.com/cover.jpg',
      score: 85,
    };

    const comicvineResult = {
      id: '12345',
      title: 'Spider-Man',
      year: 1963,
    };

    expect(SearchResultSchema.safeParse(anilistResult).success).toBe(true);
    expect(SearchResultSchema.safeParse(comicvineResult).success).toBe(true);
  });
});
