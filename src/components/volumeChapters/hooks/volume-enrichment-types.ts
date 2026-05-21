/**
 * Volume Enrichment Types and Helpers
 *
 * Type-safe interfaces for extracting volume data from various providers.
 * These types replace unsafe `Record<string, unknown>` access patterns
 * and provide type guards for safe runtime validation.
 *
 * @module volume-enrichment-types
 * @description Foundation types for useEnrichedVolumeModalData decomposition
 *
 * Providers supported:
 * - ComicVine (issues with cover images, dates, descriptions)
 * - Wikipedia (volume lists with chapter data)
 * - Fandom (volume data with summaries)
 * - AniList (basic volume/chapter counts)
 */

import type { VolumeData, ChapterDataInVolume } from '../types';
import type { Chapter } from '@prisma/client';

// =============================================================================
// ComicVine Types
// =============================================================================

/**
 * Image object structure from ComicVine API
 */
export interface ComicVineImage {
  medium_url?: string;
  screen_url?: string;
  small_url?: string;
  thumb_url?: string;
  original_url?: string;
}

/**
 * ComicVine issue structure
 * Represents a single issue/volume from ComicVine API
 */
export interface ComicVineIssue {
  /** Issue name/title */
  name?: string;
  /** Issue number (snake_case from API) */
  issue_number?: number;
  /** Volume number (camelCase normalized) */
  volumeNumber?: number;
  /** Volume title */
  volumeTitle?: string;
  /** Cover image URL (normalized) */
  coverImage?: string;
  /** Image object with multiple resolutions */
  image?: ComicVineImage;
  /** Volume summary */
  volumeSummary?: string;
  /** Issue description */
  description?: string;
  /** Short description */
  deck?: string;
  /** Cover date (snake_case from API) */
  cover_date?: string;
  /** Release date (normalized) */
  releaseDate?: string;
  /** Store date (snake_case from API) */
  store_date?: string;
  /** Store date (camelCase) */
  storeDate?: string;
  /** Issue number (camelCase) */
  issueNumber?: number;
  /** ComicVine detail URL */
  site_detail_url?: string;
  /** Source URL (normalized) */
  sourceUrl?: string;
}

// =============================================================================
// Wikipedia Types
// =============================================================================

/**
 * Wikipedia chapter structure
 */
export interface WikipediaChapter {
  /** Chapter number (can be string like "1a" or number) */
  number?: string | number;
  /** Chapter title */
  title?: string;
}

/**
 * Wikipedia volume structure
 */
export interface WikipediaVolume {
  /** Volume number */
  volumeNumber: number;
  /** Release date */
  releaseDate?: string;
  /** Chapters in this volume */
  chapters?: WikipediaChapter[];
}

// =============================================================================
// Generic Provider Types
// =============================================================================

/**
 * Generic chapter structure from any provider
 */
export interface ProviderChapter {
  /** Chapter number */
  chapterNumber?: number;
  /** Chapter index */
  index?: number;
  /** Alternative number field */
  number?: number;
  /** Chapter title */
  title?: string;
  /** Alternative name field */
  name?: string;
  /** Alternative title field */
  chapterTitle?: string;
  /** Cover image URL */
  coverImageUrl?: string;
}

/**
 * Generic volume structure from any provider
 */
export interface ProviderVolume {
  /** Volume number */
  volumeNumber?: number;
  /** Alternative number field */
  number?: number;
  /** Volume title */
  title?: string;
  /** Cover image URL */
  coverImageUrl?: string;
  /** Alternative cover image field */
  coverImage?: string;
  /** Volume description */
  description?: string;
  /** Alternative summary field */
  summary?: string;
  /** Release date */
  releaseDate?: string;
  /** Chapters in this volume */
  chapters?: ProviderChapter[];
}

// =============================================================================
// Import Profile
// =============================================================================

/**
 * Import profile structure from providerMetadata
 * Defines which providers are used for volume vs chapter data
 */
export interface ImportProfile {
  /** Provider for volume data (e.g., 'comicvine', 'fandom') */
  volumeSource?: string;
  /** Provider for chapter data */
  chapterSource?: string;
  /** Primary source provider */
  primarySource?: string;
}

// =============================================================================
// Enriched Result Types
// =============================================================================

/**
 * Enriched chapter result after processing
 */
export interface EnrichedChapter {
  /** Chapter index/position */
  index: number;
  /** Chapter title */
  title: string;
  /** Chapter number */
  number: number;
  /** Cover image URL */
  coverImage?: string | undefined;
}

/**
 * Enriched volume result from useEnrichedVolumeModalData
 * Uses explicit undefined for optional properties (exactOptionalPropertyTypes)
 */
export interface EnrichedVolumeData {
  /** Volume number (required) */
  volumeNumber: number;
  /** Volume title */
  title?: string | undefined;
  /** Cover image URL */
  coverImage?: string | undefined;
  /** Volume description */
  description?: string | undefined;
  /** Release date */
  releaseDate?: string | undefined;
  /** Store date (ComicVine specific) */
  storeDate?: string | undefined;
  /** Issue number (ComicVine specific) */
  issueNumber?: number | undefined;
  /** Source URL for the volume */
  sourceUrl?: string | undefined;
  /** Enriched chapters with normalized data */
  chapters?: EnrichedChapter[] | undefined;
  /** Publisher name */
  publisher?: string | undefined;
  /** Page count */
  pageCount?: number | undefined;
}

// =============================================================================
// Parameter Types
// =============================================================================

/**
 * Parameters object for volume enrichment
 * Replaces the 7-parameter function signature for better maintainability
 */
export interface VolumeEnrichmentParams {
  /** Volume number to enrich */
  volumeNumber: number;
  /** Optional volume title override */
  volumeTitle: string | null | undefined;
  /** Optional volume cover override */
  volumeCover: string | null | undefined;
  /** Pre-parsed volume data from wizard */
  volumeData: VolumeData | null | undefined;
  /** Raw provider metadata (string or object) */
  providerMetadata: string | Record<string, unknown> | null | undefined;
  /** Selected source provider */
  selectedSource: string | undefined;
  /** Chapters belonging to this volume */
  chapters: Chapter[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for ComicVine issue structure
 * Validates that the value contains ComicVine-specific properties
 *
 * @param value - Unknown value to validate
 * @returns True if value is a ComicVineIssue
 */
export function isComicVineIssue(value: unknown): value is ComicVineIssue {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('name' in value ||
      'issue_number' in value ||
      'volumeNumber' in value ||
      'cover_date' in value ||
      'site_detail_url' in value)
  );
}

/**
 * Type guard for ComicVine image object
 *
 * @param value - Unknown value to validate
 * @returns True if value is a ComicVineImage
 */
export function isComicVineImage(value: unknown): value is ComicVineImage {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('medium_url' in value ||
      'screen_url' in value ||
      'original_url' in value ||
      'small_url' in value ||
      'thumb_url' in value)
  );
}

/**
 * Type guard for Wikipedia volume structure
 *
 * @param value - Unknown value to validate
 * @returns True if value is a WikipediaVolume
 */
export function isWikipediaVolume(value: unknown): value is WikipediaVolume {
  return (
    value !== null &&
    typeof value === 'object' &&
    'volumeNumber' in value &&
    typeof (value as WikipediaVolume).volumeNumber === 'number'
  );
}

/**
 * Type guard for generic provider volume
 *
 * @param value - Unknown value to validate
 * @returns True if value is a ProviderVolume
 */
export function isProviderVolume(value: unknown): value is ProviderVolume {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('volumeNumber' in value || 'number' in value)
  );
}

/**
 * Type guard for ImportProfile structure
 *
 * @param value - Unknown value to validate
 * @returns True if value is an ImportProfile
 */
export function isImportProfile(value: unknown): value is ImportProfile {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('volumeSource' in value ||
      'chapterSource' in value ||
      'primarySource' in value)
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse JSON with proper typing
 * Fixes ESLint no-unsafe-assignment errors from JSON.parse
 *
 * @param metadata - String or object metadata to parse
 * @returns Parsed object or null on failure
 */
export function safeParseProviderMetadata(
  metadata: string | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!metadata) return null;

  if (typeof metadata === 'object') {
    return metadata;
  }

  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract volume source from import profile in metadata
 *
 * @param metadata - Parsed provider metadata object
 * @returns Volume source string or default 'fandom'
 */
export function extractVolumeSource(
  metadata: Record<string, unknown> | null
): string {
  if (!metadata) return 'fandom';

  const importProfile = metadata['importProfile'];
  if (isImportProfile(importProfile)) {
    return importProfile.volumeSource ?? 'fandom';
  }

  return 'fandom';
}

/**
 * Extract the best available cover image URL from ComicVine image object
 * Prioritizes: medium_url > screen_url > original_url
 *
 * @param image - ComicVine image object or undefined
 * @returns Best available image URL or undefined
 */
export function extractComicVineCoverImage(
  image: unknown
): string | undefined {
  if (!isComicVineImage(image)) return undefined;

  return image.medium_url ?? image.screen_url ?? image.original_url;
}

/**
 * Normalize chapter number from various formats
 * Handles string numbers like "1a" or numeric values
 *
 * @param value - Chapter number in string or number format
 * @param fallback - Fallback value if parsing fails
 * @returns Normalized number
 */
export function normalizeChapterNumber(
  value: string | number | undefined | null,
  fallback: number
): number {
  if (value === undefined || value === null) return fallback;

  if (typeof value === 'number') return value;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Create enriched chapters from provider chapter data
 *
 * @param providerChapters - Array of provider chapters
 * @returns Array of enriched chapters with normalized data
 */
export function createEnrichedChaptersFromProvider(
  providerChapters: unknown[]
): EnrichedChapter[] {
  return providerChapters.map((ch: unknown, idx: number) => {
    if (typeof ch !== 'object' || ch === null) {
      return {
        index: idx + 1,
        title: 'Chapter ' + (idx + 1),
        number: idx + 1,
      };
    }

    const chObj = ch as Record<string, unknown>;
    const chapterNum = normalizeChapterNumber(
      (chObj['chapterNumber'] ?? chObj['index'] ?? chObj['number']) as
        | string
        | number
        | undefined,
      idx + 1
    );

    const coverImageValue = chObj['coverImageUrl'] as string | undefined;

    return {
      index: chapterNum,
      title: ((chObj['title'] ?? chObj['name'] ?? ('Chapter ' + chapterNum)) as string),
      number: chapterNum,
      ...(coverImageValue !== undefined && { coverImage: coverImageValue }),
    };
  });
}

/**
 * Create enriched chapters from database Chapter entities
 *
 * @param chapters - Array of database Chapter entities
 * @returns Array of enriched chapters
 */
export function createEnrichedChaptersFromDatabase(
  chapters: Chapter[]
): EnrichedChapter[] {
  return chapters.map((ch) => ({
    index: ch.index,
    title: ch.title || ('Chapter ' + ch.index),
    number: ch.index,
  }));
}

/**
 * Create enriched chapters from ChapterDataInVolume
 *
 * @param volumeChapters - Array of ChapterDataInVolume from volumeData
 * @returns Array of enriched chapters with normalized data
 */
export function createEnrichedChaptersFromVolumeData(
  volumeChapters: ChapterDataInVolume[]
): EnrichedChapter[] {
  return volumeChapters.map((ch: ChapterDataInVolume, idx: number) => ({
    index: ch.index ?? ch.chapterNumber ?? ch.number ?? idx + 1,
    title:
      ch.title ??
      ch.name ??
      ch.chapterTitle ??
      ('Chapter ' + (ch.chapterNumber ?? ch.number ?? idx + 1)),
    number: ch.chapterNumber ?? ch.number ?? idx + 1,
  }));
}
