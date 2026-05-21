/**
 * ResponsiveChapterList Type Definitions
 *
 * Shared type definitions for volume data extraction and chapter list rendering.
 * Foundation module for all ResponsiveChapterList sub-modules.
 *
 * This module contains core type definitions for:
 * - Volume data structures from various providers (ComicVine, Fandom, Wikipedia, AniList)
 * - Provider metadata structures and extraction patterns
 * - Enriched volume data with merged chapter information
 * - Result types for volume data extraction operations
 *
 * Extracted from: ResponsiveChapterList.tsx (404 lines)
 * Created: 2025-11-17
 */

// ============================================================================
// Provider Constants
// ============================================================================

/**
 * Supported metadata provider sources for volume and chapter data
 */
export const PROVIDER_SOURCES = {
  COMICVINE: 'comicvine',
  FANDOM: 'fandom',
  WIKIPEDIA: 'wikipedia',
  ANILIST: 'anilist',
} as const;

export type ProviderSource = typeof PROVIDER_SOURCES[keyof typeof PROVIDER_SOURCES];

// ============================================================================
// Volume Data Types
// ============================================================================

/**
 * Enriched volume data structure from various providers
 *
 * This interface handles the polymorphic volume data structures returned
 * by different metadata providers (ComicVine, Fandom, Wikipedia, AniList).
 *
 * Field variations by provider:
 * - Volume number: `volumeNumber` or `number`
 * - Volume title: `title`, `volumeTitle`, `name`, or `volumeName`
 * - Cover image: `coverImageUrl`, `coverUrl`, or `cover`
 *
 * Chapter data is optionally embedded with release dates merged from database.
 */
export interface EnrichedVolume {
  /** Volume number (primary identifier) */
  volumeNumber?: number;
  /** Alternate volume number field */
  number?: number;

  /** Volume title (primary) */
  title?: string;
  /** Alternate volume title field */
  volumeTitle?: string;
  /** Volume name (Fandom provider) */
  name?: string;
  /** Alternate volume name field */
  volumeName?: string;

  /** Cover image URL (primary) */
  coverImageUrl?: string;
  /** Alternate cover URL field */
  coverUrl?: string;
  /** Alternate cover field (Fandom) */
  cover?: string;

  /** Embedded chapter data with release dates */
  Chapter?: Array<{
    /** Chapter index (used for matching with database) */
    index?: number;
    /** Release date (merged from database) */
    releaseDate?: Date;
    /** Additional provider-specific chapter fields */
    [key: string]: unknown;
  }>;

  /** Additional provider-specific volume fields */
  [key: string]: unknown;
}

// ============================================================================
// Provider Metadata Structures
// ============================================================================

/**
 * Structured provider metadata with normalized paths for all supported sources
 *
 * This interface maps the complex, nested metadata structures from various
 * providers into a consistent format for volume data extraction.
 *
 * Provider-specific paths:
 * - ComicVine: `comicvine.rawData.issues` or `comicvine_volumes.metadata.issues`
 * - Fandom: `FANDOM.volumeDetails` or `fandom_volumes` or `fandom_chapters.metadata.volumeDetails`
 * - Wikipedia: `wikipedia_chapters.volumeList`
 * - AniList: `anilist.volumes` or `anilist.metadata.volumes`
 *
 * Import profile contains selected provider sources from the import wizard.
 */
export interface ProviderMetadataStructure {
  /** Import profile from wizard containing selected provider sources */
  importProfile?: {
    /** Selected chapter source provider */
    chapterSource?: string;
    /** Primary metadata source (fallback) */
    primarySource?: string;
  };

  /** ComicVine metadata (lowercase key) */
  comicvine?: {
    /** Raw API response data */
    rawData?: {
      /** Comic book issues (used as volumes) */
      issues?: unknown[];
    };
    /** Normalized metadata */
    metadata?: {
      /** Comic book issues */
      issues?: unknown[];
    };
  };

  /** ComicVine volumes metadata (when selected via "Use This") */
  comicvine_volumes?: {
    /** Normalized metadata */
    metadata?: {
      /** Comic book issues */
      issues?: unknown[];
    };
    /** Direct issues array */
    issues?: unknown[];
  };

  /** Fandom volumes metadata (lowercase key) */
  fandom_volumes?: unknown;

  /** Fandom metadata (uppercase key) */
  FANDOM?: {
    /** Volume details object */
    volumeDetails?: unknown;
    /** Normalized metadata */
    metadata?: {
      /** Volume details */
      volumeDetails?: unknown;
    };
    /** Volumes array */
    volumes?: unknown[];
  };

  /** Fandom chapters metadata */
  fandom_chapters?: {
    /** Normalized metadata */
    metadata?: {
      /** Volume details embedded in chapters */
      volumeDetails?: unknown;
    };
  };

  /** Wikipedia chapters metadata */
  wikipedia_chapters?: {
    /** Volume list array */
    volumeList?: unknown[];
  };

  /** AniList metadata */
  anilist?: {
    /** Volume count (numeric) */
    volumes?: number;
    /** Normalized metadata */
    metadata?: {
      /** Volume count */
      volumes?: number;
    };
  };

  /** Additional provider-specific metadata */
  [key: string]: unknown;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of volume data extraction operation
 *
 * Contains enriched volume data with merged chapter information,
 * plus extracted volume titles and cover images as lookup maps.
 */
export interface ExtractedVolumeData {
  /** Enriched volume array with embedded chapters (null if extraction failed) */
  enrichedVolumeData: EnrichedVolume[] | null;
  /** Volume number -> title lookup map */
  volumeTitles: Record<number, string>;
  /** Volume number -> cover URL lookup map */
  volumeCovers: Record<number, string>;
}

/**
 * Volume metadata lookup maps
 *
 * Extracted title and cover image mappings indexed by volume number.
 */
export interface VolumeMetadata {
  /** Volume number -> title lookup map */
  volumeTitles: Record<number, string>;
  /** Volume number -> cover URL lookup map */
  volumeCovers: Record<number, string>;
}
