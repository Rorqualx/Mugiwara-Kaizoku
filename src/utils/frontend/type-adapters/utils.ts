/**
 * Type Adapter Utilities Module
 *
 * Shared type definitions, enums, and helper functions for type adapters.
 * Provides extraction, parsing, and mapping utilities for search results.
 *
 * Extracted from: type-adapters.ts (foundation layer)
 */


import { MangaPublicationStatus } from '@prisma/client';

import type { MangaSearchResult } from '@/types/search.types';
import { mapToMangaStatus } from '@/utils/status-mapper';


// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Unified search result type alias (uses MangaSearchResult as base)
 */
export type UnifiedSearchResult = MangaSearchResult;

/**
 * Provider-specific data storage type
 */
export type ProviderSpecificData = Record<string, unknown>;

/**
 * Partial metadata structure for building unified results
 */
export type PartialUnifiedMetadata = {
  id: string;
  title: string;
  alternativeTitles?: string[];
  description?: string;
  summary?: string;
  covers?: {
    original?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  status?: MangaPublicationStatus;
  format?: string;
  chapters?: number;
  volumes?: number;
  authors?: Array<{
    name: string;
  }>;
  artists?: Array<{
    name: string;
  }>;
  genres?: string[];
  tags?: Array<{
    name: string;
  }>;
  startDate?: Date;
  endDate?: Date;
  releaseYear?: number;
  averageScore?: number;
  popularity?: number;
  publisher?: string;
  bannerImage?: string;
  primarySource?: string;
};

// ============================================================================
// Enums
// ============================================================================

/**
 * Manga format enumeration
 */
export enum MangaFormat {
  MANGA = 'MANGA',
  MANHWA = 'MANHWA',
  MANHUA = 'MANHUA',
  NOVEL = 'NOVEL',
  ONE_SHOT = 'ONE_SHOT',
  DOUJINSHI = 'DOUJINSHI',
  COMIC = 'COMIC',
  GRAPHIC_NOVEL = 'GRAPHIC_NOVEL',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// Helper Functions - Field Extraction
// ============================================================================

/**
 * Extract cover URL from result
 * Checks multiple possible locations for cover image URL
 * @param result - Search result object
 * @returns Cover URL string or fallback
 */
export function extractCoverUrl(result: unknown): string {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;

  // Check each potential source and return first valid string
  const cover = r['cover'];
  if (typeof cover === 'string' && cover) return cover;

  const coverUrl = r['coverUrl'];
  if (typeof coverUrl === 'string' && coverUrl) return coverUrl;

  const coverImage = r['coverImage'];
  if (typeof coverImage === 'string' && coverImage) return coverImage;

  const metaCover = metadata?.['cover'];
  if (typeof metaCover === 'string' && metaCover) return metaCover;

  const metaCoverUrl = metadata?.['coverUrl'];
  if (typeof metaCoverUrl === 'string' && metaCoverUrl) return metaCoverUrl;

  const metaCoverImage = metadata?.['coverImage'];
  if (typeof metaCoverImage === 'string' && metaCoverImage) return metaCoverImage;

  return '/cover-not-found.jpg';
}

/**
 * Extract description from result
 * @param result - Search result object
 * @returns Description string
 */
export function extractDescription(result: unknown): string {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  return (r['description'] ?? metadata?.['description'] ?? metadata?.['summary'] ?? r['summary'] ?? '') as string;
}

/**
 * Extract alternative titles from result
 * @param result - Search result object
 * @returns Array of alternative titles
 */
export function extractAlternativeTitles(result: unknown): string[] {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const titles = r['alternativeTitles'] ?? metadata?.['alternativeTitles'] ?? metadata?.['synonyms'] ?? [];

  if (!Array.isArray(titles)) return [];

  // Validate and filter to only strings
  return titles.filter((t): t is string => typeof t === 'string');
}

/**
 * Extract status from result
 * @param result - Search result object
 * @returns Mapped manga publication status
 */
export function extractStatus(result: unknown): MangaPublicationStatus | undefined {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const status = r['status'] ?? metadata?.['status'];
  return status ? mapStatus(status) : undefined;
}

/**
 * Extract format from result
 * @param result - Search result object
 * @returns Mapped manga format
 */
export function extractFormat(result: unknown): MangaFormat | undefined {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const format = r['format'] ?? metadata?.['format'];
  return format ? mapFormat(format) : undefined;
}

/**
 * Extract numeric field from result
 * @param result - Search result object
 * @param fields - Field names to check
 * @returns Numeric value or undefined
 */
export function extractNumber(result: unknown, ...fields: string[]): number | undefined {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  for (const field of fields) {
    const value = r[field] ?? metadata?.[field];
    if (value !== null) {
      const num = Number(value);
      if (!isNaN(num)) return num;
    }
  }
  return undefined;
}

/**
 * Extract string field from result
 * @param result - Search result object
 * @param fields - Field names to check
 * @returns String value or undefined
 */
export function extractString(result: unknown, ...fields: string[]): string | undefined {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  for (const field of fields) {
    const value = r[field] ?? metadata?.[field];
    if (typeof value === 'string' && value) {
      return value;
    }
  }
  return undefined;
}

/**
 * Extract authors from result
 * @param result - Search result object
 * @returns Array of author objects
 */
export function extractAuthors(result: unknown): Array<{
  name: string;
}> {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const authors = r['authors'] ?? metadata?.['authors'] ?? [];
  if (!Array.isArray(authors)) return [];
  return authors.map(author => {
    if (typeof author === 'string') {
      return {
        name: author
      };
    }
    const authorObj = author as Record<string, unknown>;
    const authorName = authorObj['name'];
    return {
      name: typeof authorName === 'string' ? authorName : 'Unknown'
    };
  });
}

/**
 * Extract artists from result
 * @param result - Search result object
 * @returns Array of artist objects
 */
export function extractArtists(result: unknown): Array<{
  name: string;
}> {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const artists = r['artists'] ?? metadata?.['artists'] ?? [];
  if (!Array.isArray(artists)) return [];
  return artists.map(artist => {
    if (typeof artist === 'string') {
      return {
        name: artist
      };
    }
    const artistObj = artist as Record<string, unknown>;
    const artistName = artistObj['name'];
    return {
      name: typeof artistName === 'string' ? artistName : 'Unknown'
    };
  });
}

/**
 * Extract genres from result
 * @param result - Search result object
 * @returns Array of genre strings
 */
export function extractGenres(result: unknown): string[] {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const genres = r['genres'] ?? metadata?.['genres'] ?? [];
  return Array.isArray(genres) ? genres.map(g => typeof g === 'string' ? g : (g as Record<string, unknown>)['name'] as string) : [];
}

/**
 * Extract tags from result
 * @param result - Search result object
 * @returns Array of tag objects
 */
export function extractTags(result: unknown): Array<{
  name: string;
}> {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const tags = r['tags'] ?? metadata?.['tags'] ?? [];
  if (!Array.isArray(tags)) return [];
  return tags.map(tag => {
    if (typeof tag === 'string') {
      return {
        name: tag
      };
    }
    const tagObj = tag as Record<string, unknown>;
    const tagName = tagObj['name'];
    const tagLabel = tagObj['label'];
    const nameValue = typeof tagName === 'string' ? tagName : typeof tagLabel === 'string' ? tagLabel : 'Unknown';
    return {
      name: nameValue
    };
  });
}

/**
 * Extract date field from result
 * @param result - Search result object
 * @param field - Field name to extract
 * @returns Date object or undefined
 */
export function extractDate(result: unknown, field: string): Date | undefined {
  const r = result as Record<string, unknown>;
  const metadata = r['metadata'] as Record<string, unknown> | undefined;
  const value = r[field] ?? metadata?.[field];
  return parseDate(value);
}

// ============================================================================
// Helper Functions - Parsing & Mapping
// ============================================================================

/**
 * Parse date from various formats
 * Handles: Date objects, ISO strings, timestamps, AniList date objects
 * @param value - Value to parse as date
 * @returns Date object or undefined
 */
export function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  // Handle AniList-style date objects
  if (typeof value === 'object' && 'year' in value) {
    const dateObj = value as Record<string, unknown>;
    const year = Number(dateObj['year']);
    const month = Number(dateObj['month'] ?? 1) - 1;
    const day = Number(dateObj['day'] ?? 1);
    if (!isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  return undefined;
}

/**
 * Map status string to MangaPublicationStatus enum
 * @param status - Status value to map
 * @returns Mapped publication status
 */
export function mapStatus(status: unknown): MangaPublicationStatus {
  if (!status) return MangaPublicationStatus.UNKNOWN;
  const statusStr = String(status).toUpperCase();
  return mapToMangaStatus(statusStr);
}

/**
 * Map format string to MangaFormat enum
 * @param format - Format value to map
 * @returns Mapped manga format
 */
export function mapFormat(format: unknown): MangaFormat {
  if (!format) return MangaFormat.UNKNOWN;
  const formatStr = String(format).toUpperCase();
  switch (formatStr) {
    case 'MANGA':
      return MangaFormat.MANGA;
    case 'MANHWA':
      return MangaFormat.MANHWA;
    case 'MANHUA':
      return MangaFormat.MANHUA;
    case 'NOVEL':
    case 'LIGHT_NOVEL':
      return MangaFormat.NOVEL;
    case 'ONE_SHOT':
    case 'ONESHOT':
      return MangaFormat.ONE_SHOT;
    case 'DOUJINSHI':
      return MangaFormat.DOUJINSHI;
    case 'COMIC':
      return MangaFormat.COMIC;
    case 'GRAPHIC_NOVEL':
      return MangaFormat.GRAPHIC_NOVEL;
    default:
      return MangaFormat.UNKNOWN;
  }
}
