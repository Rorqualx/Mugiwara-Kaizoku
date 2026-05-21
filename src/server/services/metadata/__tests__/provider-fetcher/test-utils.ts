/**
 * Test Utilities for ProviderFetchingService Tests
 *
 * Shared mocks, test data, and helper functions used across
 * all provider-fetcher test modules.
 *
 * Extracted from: provider-fetcher.test.ts
 */

// ============================================================================
// Mocks - MUST be defined BEFORE any imports for Jest hoisting to work
// ============================================================================

// Store the mock instance for access from tests
// NOTE: Bun doesn't support Jest's mock.instances feature
// We create the mock object in the factory function scope to ensure it's available
const mockProviderMatcherInstance = {
  findMatch: jest.fn(),
  match: jest.fn(),
  getMatchScore: jest.fn()
};

// Store the mock constructor for test assertions
const MockProviderMatcherConstructor = jest.fn().mockImplementation(() => mockProviderMatcherInstance);

jest.mock('@/server/services/search/registerProviders', () => ({
  searchProviderRegistry: {
    get: jest.fn(),
  },
}));

jest.mock('@/server/utils/providerMatcher', () => ({
  ProviderMatcher: MockProviderMatcherConstructor
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import types and classes AFTER mocks are defined

import { MangaFormat, MangaPublicationStatus } from '@prisma/client';

import { ProviderFetchingService } from '@/server/services/metadata/provider-fetcher';
import type { FetchInput } from '@/server/services/metadata/provider-fetcher';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';
import type { SearchResult } from '@/server/services/search/types';
import type { ProviderMatcher } from '@/server/utils/providerMatcher';
import { isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';


// Export function to get the mock instance
export function getMockProviderMatcherInstance(): jest.Mocked<ProviderMatcher> {
  return mockProviderMatcherInstance as unknown as jest.Mocked<ProviderMatcher>;
}

// Export the mock constructor for test assertions
export { MockProviderMatcherConstructor as ProviderMatcherMock };

// ============================================================================
// Test Data
// ============================================================================

export const mockManga: FetchInput = {
  id: 123,
  title: 'One Piece',
  source: 'anilist',
};

export const mockSearchResult: SearchResult = {
  id: '13',
  title: 'One Piece',
  description: 'Pirate adventure manga',
  coverImage: 'https://example.com/cover.jpg',
  status: 'RELEASING',
  format: 'MANGA',
  genres: ['Action', 'Adventure'],
  chapters: 1089,
  volumes: 106,
  year: 1997,
  provider: 'anilist',
  idMal: 13,
  author: 'Eiichiro Oda',
  tags: ['Pirates', 'Shounen'],
  bannerImage: 'https://example.com/banner.jpg',
  startDate: '1997-07-22',
};

// ============================================================================
// Helper Functions - Deduplication of Repetitive Test Patterns
// ============================================================================

/**
 * Helper to setup mock provider with common pattern
 * Deduplicates the repetitive provider setup code found in 25+ tests
 */
export function setupMockProvider(
  mockProviderMatcherParam: jest.Mocked<ProviderMatcher>,
  name: string,
  searchResult: SearchResult,
  matchId: string | null = '13'
): { mockProvider: { name: string; getMetadata: jest.Mock } } {
  const mockProviderMatcher = mockProviderMatcherParam;

  if (matchId) {
    mockProviderMatcher.findMatch = jest.fn().mockResolvedValue(matchId);
  } else {
    mockProviderMatcher.findMatch = jest.fn().mockResolvedValue(null);
  }

  const mockProvider = {
    name,
    getMetadata: jest.fn().mockResolvedValue(searchResult),
  };

  (searchProviderRegistry.get as jest.Mock).mockReturnValue(mockProvider);

  return { mockProvider };
}

/**
 * Helper to setup service and mocks for each test
 * Deduplicates the beforeEach pattern
 *
 * NOTE: Updated for Bun compatibility - uses getMockProviderMatcherInstance()
 * instead of Jest's mock.instances which isn't supported in Bun
 */
export function createTestContext(): {
  service: ProviderFetchingService;
  mockProviderMatcher: jest.Mocked<ProviderMatcher>;
} {
  const service = new ProviderFetchingService();
  // Use the stored instance instead of mock.instances (Bun compatibility)
  const mockProviderMatcher = getMockProviderMatcherInstance();
  return { service, mockProviderMatcher };
}

/**
 * Helper to assert success result with specific data checks
 * Deduplicates the repetitive success assertion pattern
 */
export function expectSuccessWithData<T>(
  result: AsyncResult<T>,
  assertions: (data: T) => void
): void {
  expect(isSuccess(result)).toBe(true);
  if (isSuccess(result)) {
    assertions(result.data);
  }
}

/**
 * Helper to assert error result contains specific message
 * Deduplicates the repetitive error assertion pattern
 */
export function expectErrorContaining(
  result: AsyncResult<unknown>,
  messageFragment: string
): void {
  expect(isError(result)).toBe(true);
  if (isError(result)) {
    const errorMessage =
      result.error instanceof Error ? result.error.message : String(result.error);
    expect(errorMessage).toContain(messageFragment);
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  isError,
  isSuccess,
  MangaFormat,
  MangaPublicationStatus,
  ProviderFetchingService,
  searchProviderRegistry,
};

export type { FetchInput, SearchResult, ProviderMatcher };
