/**
 * Quick Add Service - Test Utilities
 *
 * Mock factories and test helpers for QuickAddService unit tests.
 *
 * @module components/addManga/services/quickAddService/__tests__/test-utils
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';

import type {
  FetchedVolumeData,
  FieldProviderPreferences,
  FieldSelectionMap,
  QuickAddCallbacks,
  VolumeFieldSources
} from '../types';

// ============================================================================
// Mock Search Result Factory
// ============================================================================

/**
 * Create a mock ExtendedMangaSearchResult for testing
 */
export function createMockSearchResult(
  overrides: Partial<ExtendedMangaSearchResult> = {}
): ExtendedMangaSearchResult {
  return {
    id: 1,
    title: 'Test Manga',
    description: 'A test manga description',
    provider: 'anilist',
    coverImage: 'https://example.com/cover.jpg',
    bannerImage: 'https://example.com/banner.jpg',
    status: 'RELEASING',
    genres: ['Action', 'Adventure'],
    tags: ['Shounen', 'Fantasy'],
    authors: ['Test Author'],
    artists: ['Test Artist'],
    publisher: 'Test Publisher',
    format: 'MANGA',
    volumes: 10,
    chapters: 100,
    startDate: '2020-01-01',
    endDate: undefined,
    averageScore: 85,
    popularity: 10000,
    alternativeTitles: ['Test Manga Alt'],
    anilistId: 123,
    malId: 456,
    comicvineId: '4050-12345',
    ...overrides
  } as ExtendedMangaSearchResult;
}

/**
 * Create mock search results for multiple providers
 */
export function createMockAllSearchResults(
  providers: string[] = ['anilist', 'comicvine', 'fandom']
): Record<string, ExtendedMangaSearchResult[]> {
  const results: Record<string, ExtendedMangaSearchResult[]> = {};

  providers.forEach((provider, index) => {
    results[provider] = [
      createMockSearchResult({
        id: index + 1,
        provider,
        title: `Test Manga - ${provider}`,
        description: `Description from ${provider}`
      })
    ];
  });

  return results;
}

// ============================================================================
// Mock Preferences Factory
// ============================================================================

/**
 * Create mock FieldProviderPreferences for testing
 */
export function createMockFieldProviderPreferences(
  overrides: Partial<FieldProviderPreferences> = {}
): FieldProviderPreferences {
  return {
    enabled: true,
    preferences: {
      title: ['anilist', 'comicvine', 'fandom'],
      description: ['anilist', 'comicvine', 'fandom'],
      coverImage: ['anilist', 'comicvine', 'fandom'],
      status: ['anilist', 'comicvine'],
      genres: ['anilist', 'comicvine'],
      tags: ['anilist'],
      authors: ['anilist', 'comicvine'],
      artists: ['anilist', 'comicvine'],
      publisher: ['comicvine', 'anilist'],
      volumes: ['comicvine', 'fandom'],
      chapters: ['fandom', 'comicvine'],
      startDate: ['anilist', 'comicvine'],
      endDate: ['anilist', 'comicvine'],
      averageScore: ['anilist'],
      popularity: ['anilist']
    },
    fallbackMode: 'priority',
    ...overrides
  };
}

/**
 * Create mock VolumeFieldSources for testing
 */
export function createMockVolumeFieldSources(
  overrides: Partial<VolumeFieldSources> = {}
): VolumeFieldSources {
  return {
    volumeCover: 'comicvine',
    volumeSummary: 'comicvine',
    volumeTitle: 'comicvine',
    chapterCover: 'fandom',
    chapterSummary: 'fandom',
    chapterTitle: 'fandom',
    ...overrides
  };
}

// ============================================================================
// Mock Volume Data Factory
// ============================================================================

/**
 * Create mock FetchedVolumeData for testing
 */
export function createMockFetchedVolumeData(
  overrides: Partial<FetchedVolumeData> = {}
): FetchedVolumeData {
  return {
    provider: 'comicvine',
    volumes: [
      { volumeNumber: 1, title: 'Volume 1', chapters: [] },
      { volumeNumber: 2, title: 'Volume 2', chapters: [] },
      { volumeNumber: 3, title: 'Volume 3', chapters: [] }
    ],
    totalVolumes: 3,
    totalChapters: 30,
    volumeDetails: [
      {
        volumeNumber: 1,
        title: 'Volume 1',
        coverImageUrl: 'https://example.com/v1.jpg',
        chapters: [
          { chapterNumber: 1, title: 'Chapter 1' },
          { chapterNumber: 2, title: 'Chapter 2' }
        ]
      }
    ],
    ...overrides
  };
}

// ============================================================================
// Mock Field Selections Factory
// ============================================================================

/**
 * Create mock FieldSelectionMap for testing
 */
export function createMockFieldSelections(
  overrides: Partial<FieldSelectionMap> = {}
): FieldSelectionMap {
  return {
    title: { source: 'anilist', value: 'Test Manga' },
    description: { source: 'anilist', value: 'Test description' },
    coverImage: { source: 'anilist', value: 'https://example.com/cover.jpg' },
    status: { source: 'anilist', value: 'RELEASING' },
    genres: { source: 'anilist', value: ['Action', 'Adventure'] },
    tags: { source: 'anilist', value: ['Shounen'] },
    volumes: { source: 'comicvine', value: 10 },
    chapters: { source: 'fandom', value: 100 },
    ...overrides
  };
}

// ============================================================================
// Mock Callbacks Factory
// ============================================================================

/**
 * Create mock QuickAddCallbacks for testing with Jest spies
 */
export function createMockCallbacks(): QuickAddCallbacks & {
  onProgress: jest.Mock;
  onSuccess: jest.Mock;
  onError: jest.Mock;
} {
  return {
    onProgress: jest.fn(),
    onSuccess: jest.fn(),
    onError: jest.fn()
  };
}

// ============================================================================
// Mock tRPC Client Factory
// ============================================================================

/**
 * Create a mock tRPC client for testing
 * Returns a partial mock that can be extended as needed
 */
export function createMockTRPCClient(): {
  settings: {
    getBatch: {
      query: jest.Mock;
    };
  };
  metadata: {
    parseFandomUrl: {
      mutate: jest.Mock;
    };
    fetchComicvineVolumeDetails: {
      mutate: jest.Mock;
    };
  };
  manga: {
    add: {
      mutate: jest.Mock;
    };
  };
} {
  return {
    settings: {
      getBatch: {
        query: jest.fn().mockResolvedValue({
          isOk: () => true,
          isErr: () => false,
          data: {
            'fieldProviderPreferences.enabled': true,
            'fieldProviderPreferences.preferences': {
              title: ['anilist'],
              description: ['anilist'],
              volumes: ['comicvine'],
              chapters: ['fandom']
            }
          }
        })
      }
    },
    metadata: {
      parseFandomUrl: {
        mutate: jest.fn().mockResolvedValue({
          isOk: () => true,
          isErr: () => false,
          data: {
            volumes: 10,
            chapters: 100,
            volumeDetails: []
          }
        })
      },
      fetchComicvineVolumeDetails: {
        mutate: jest.fn().mockResolvedValue({
          isOk: () => true,
          isErr: () => false,
          data: {
            name: 'Test Manga',
            issueCount: 10,
            issues: []
          }
        })
      }
    },
    manga: {
      add: {
        mutate: jest.fn().mockResolvedValue({
          id: 123,
          title: 'Test Manga'
        })
      }
    }
  };
}

// ============================================================================
// Test Data Constants
// ============================================================================

/** Valid provider names for testing */
export const TEST_PROVIDERS = ['anilist', 'comicvine', 'fandom', 'wikipedia'] as const;

/** Sample library ID for testing */
export const TEST_LIBRARY_ID = 1;

/** Sample manga ID returned from successful import */
export const TEST_MANGA_ID = 123;
