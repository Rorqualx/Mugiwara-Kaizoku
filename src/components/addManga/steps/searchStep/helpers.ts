/**
 * SearchStep Helper Functions
 *
 * Utility functions for search operations, data extraction,
 * and provider handling.
 *
 * Extracted from: searchStep.tsx (lines 28-147)
 */

import type { AsyncResult } from '@/utils/async-result';
import { isLoading } from '@/utils/async-result';

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata provider definition
 */
export interface MetadataProvider {
  id: string;
  name: string;
  status: string;
}

/**
 * Parsed search query structure
 */
export interface ParsedSearchQuery {
  searchText: string;
  text?: string;
  type?: 'url' | 'identifier' | 'text' | 'id' | 'isbn' | 'filtered';
  identifiers?: {
    anilistId?: number;
    malId?: number;
    comicvineId?: string;
    isbn?: string;
    kitsuId?: string;
  };
  suggestedProviders?: string[];
  provider?: string;
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Safely convert unknown value to string
 *
 * @param value - The value to convert
 * @returns A string representation of the value
 */
export function safeString(value: unknown): string {
  if (value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[Object]';
  }
}

// ============================================================================
// Provider Utilities
// ============================================================================

/**
 * Get badge color for a provider
 *
 * @param provider - The provider name
 * @returns The Mantine color for the badge
 */
export function getProviderBadgeColor(provider: string): string {
  const colors: Record<string, string> = {
    anilist: 'blue',
    myanimelist: 'indigo',
    comicvine: 'green',
    fandom: 'purple',
    wikipedia: 'gray',
    mangadex: 'orange',
    manual: 'gray'
  };
  return colors[provider.toLowerCase()] ?? 'gray';
}

/**
 * Convert unknown array to MetadataProvider array
 *
 * @param providers - Unknown value that should be an array of providers
 * @returns Array of validated MetadataProvider objects
 */
export function convertToMetadataProviders(providers: unknown): MetadataProvider[] {
  if (!Array.isArray(providers)) {
    return [];
  }
  // Validate each provider has required fields
  return providers.filter((provider): provider is MetadataProvider => {
    return (
      provider !== null &&
      typeof provider === 'object' &&
      'id' in provider &&
      'name' in provider &&
      'status' in provider
    );
  });
}

/**
 * Detect provider from result item
 *
 * @param item - The result item to check
 * @returns The provider name or null if not found
 */
export function detectProvider(item: Record<string, unknown>): string | null {
  // Provider detection logic
  if (item['provider'] && typeof item['provider'] === 'string') {
    return item['provider'];
  }
  if (item['source'] && typeof item['source'] === 'string') {
    return item['source'];
  }
  return null;
}

// ============================================================================
// AsyncResult Utilities
// ============================================================================

/**
 * Check if AsyncResult is in loading state
 *
 * @param result - The AsyncResult to check
 * @returns True if the result is loading
 */
export function checkIsLoading<T, E>(result: AsyncResult<T, E>): boolean {
  return isLoading(result);
}

// ============================================================================
// URL Detection Utilities
// ============================================================================

/**
 * Supported metadata provider types for URL detection
 */
export type SupportedUrlProvider = 'fandom' | 'comicvine' | 'wikipedia';

/**
 * Detects if a search query is a supported provider URL
 *
 * @param query - The search query string
 * @returns The detected provider name or null if not a supported URL
 */
export function detectProviderUrl(query: string): SupportedUrlProvider | null {
  const trimmed = query.trim();
  if (!trimmed.startsWith('http')) return null;

  if (trimmed.includes('fandom.com')) return 'fandom';
  if (trimmed.includes('comicvine.gamespot.com')) return 'comicvine';
  if (trimmed.includes('wikipedia.org')) return 'wikipedia';
  return null;
}

// ============================================================================
// Search Utilities
// ============================================================================

/**
 * Search example definition
 */
export interface SearchExample {
  query: string;
  description: string;
}

/**
 * Get search examples for help popover
 *
 * @returns Array of search examples with queries and descriptions
 */
export function getSearchExamples(): SearchExample[] {
  return [
    {
      query: 'One Piece',
      description: 'Search by title'
    },
    {
      query: 'anilist:21',
      description: 'Search by AniList ID'
    },
    {
      query: 'mal:1234',
      description: 'Search by MAL ID'
    },
    {
      query: 'isbn:9781234567890',
      description: 'Search by ISBN'
    }
  ];
}

/**
 * Parse search query for special syntax
 *
 * @param query - The search query string
 * @returns Parsed search query object
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  return {
    searchText: query
  };
}

// ============================================================================
// Field Extraction
// ============================================================================

/**
 * Extract field from result item with provider-specific handling
 *
 * @param item - The result item to extract from
 * @param field - The field name to extract
 * @param provider - The provider name for special handling
 * @returns The extracted field value or undefined
 */
export function extractField(
  item: Record<string, unknown>,
  field: string,
  provider: string
): unknown {
  // Field extraction logic
  if (field in item) {
    const value = item[field];

    // Special handling for Anilist coverImage which is nested
    if (field === 'coverImage' && provider === 'anilist' && value && typeof value === 'object') {
      const coverObj = value as Record<string, unknown>;
      // Try to get the largest available image
      return coverObj['extraLarge'] ?? coverObj['large'] ?? coverObj['medium'];
    }

    return value;
  }
  // Check nested metadata
  if (item['metadata'] && typeof item['metadata'] === 'object') {
    const metadata = item['metadata'] as Record<string, unknown>;
    if (field in metadata) {
      return metadata[field];
    }
  }
  return undefined;
}
