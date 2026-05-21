/**
 * Core Search Types Module
 *
 * Core search result interfaces and types used throughout the application.
 * Includes Prisma payload types, search results, and metadata structures.
 *
 * Extracted from: search.types.ts (lines 32-244)
 * Purpose: Provide foundational search result types for UI components and API responses
 */

// ============================================================================
// Imports
// ============================================================================

import type { MetadataProvider } from './enums.types';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Prisma Payload Types
// ============================================================================

export type MangaWithRelations = Prisma.MangaGetPayload<{
  include: {
    Library: true;
    Chapter: true;
    Metadata: true;
    _count: {
      select: {
        Chapter: true;
      };
    };
  };
}>;

export type LibraryWithRelations = Prisma.LibraryGetPayload<{
  include: {
    Manga: {
      include: {
        Library: true;
        Chapter: true;
        Metadata: true;
        _count: {
          select: {
            Chapter: true;
          };
        };
      };
    };
  };
}>;

// ============================================================================
// Core Search Result Types
// ============================================================================

// Define MangaSearchResult and MangaMetadata interfaces
export interface MangaSearchResult {
  id: string | number;
  title: string;
  alternativeTitles?: string[];
  description?: string;
  status?: string; // Can be MangaPublicationStatus or provider-specific status string
  coverImage?: string;
  genres?: string[];
  tags?: string[] | unknown[] | Array<{
    id: number;
    name: string;
    category?: string;
    rank?: number;
    isGeneralSpoiler?: boolean;
    isMediaSpoiler?: boolean;
  }>;
  provider: string;
  source?: string; // Some components use this instead of provider
  sourceId?: string; // External source ID
  externalId?: string;
  url?: string;
  chapters?: number;
  volumes?: number;
  year?: number;
  // Allow additional properties for extended types
  [key: string]: unknown;
}

export interface MangaMetadata {
  id?: string | undefined; // Optional ID field for provider-specific identification
  title: string;
  alternativeTitles?: string[] | undefined;
  description?: string | undefined;
  status?: string | undefined; // Can be MangaPublicationStatus or provider-specific status string
  genres?: string[] | undefined;
  tags?: string[] | unknown[] | Array<{
    id: number;
    name: string;
    category?: string | undefined;
    rank?: number | undefined;
    isGeneralSpoiler?: boolean | undefined;
    isMediaSpoiler?: boolean | undefined;
  }> | undefined;
  authors?: string[] | undefined;
  artists?: string[] | undefined;
  coverImage?: string | undefined;
  coverUrl?: string | undefined; // Alias for coverImage used by some components
  bannerImage?: string | undefined;
  chapters?: number | undefined;
  volumes?: number | undefined;
  year?: number | undefined;
  publisher?: string | undefined;
  // Additional fields from Prisma Metadata model
  coverExtraLarge?: string | undefined;
  coverLarge?: string | undefined;
  coverMedium?: string | undefined;
  coverSmall?: string | undefined;
  cover?: string | undefined;
  summary?: string | undefined;
  synonyms?: string[] | undefined;
  characters?: string[] | undefined;
  startDate?: Date | string | undefined;
  endDate?: Date | string | undefined;
  urls?: string[] | undefined;
  rating?: number | undefined;
  averageScore?: number | undefined;
  popularity?: number | undefined;
  countryOfOrigin?: string | undefined;
  format?: string | undefined;
  externalLinks?: unknown | undefined;
  source?: string | undefined;
  sourceId?: string | undefined;
  language?: string | undefined;
  languages?: string[] | undefined;
  idMal?: number | undefined;
  // Extended fields for compatibility
  releaseYear?: number | undefined;
  isAdult?: boolean | undefined;
  contentWarnings?: string[] | undefined;
  covers?: unknown | undefined;
  // Provider-specific fields
  score?: number | undefined; // Score/rating from providers
  provider?: string | MetadataProvider | undefined; // Provider that supplied this metadata
  metadata?: unknown; // Additional provider-specific metadata
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;
}

export interface SearchResult {
  type: unknown;
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  provider: string;
  metadata?: unknown;
  // Extended fields for UI components
  cover?: string; // alias for coverImage
  genres?: string[];
  themes?: string[]; // Themes/concepts (extracted from providers like ComicVine)
  alternativeTitles?: string[];
  volumes?: number;
  chapters?: number;
  score?: number;
  status?: string; // Can be MangaPublicationStatus or provider-specific status string
  format?: string; // Added format field for manga type (MANGA, MANHWA, MANHUA, NOVEL, ONE_SHOT)
  url?: string;
  wikiUrl?: string; // Fandom-specific wiki URL for enrichment
  providerUrl?: string; // Provider-specific URL
  siteDetailUrl?: string; // ComicVine specific
  author?: string;
  totalChapters?: number;
  imageUrl?: string; // alias for coverImage used by some providers
  // Additional metadata fields
  authors?: string[];
  artists?: string[];
  artist?: string;
  publisher?: string;
  year?: number;
  startDate?: unknown;
  endDate?: unknown;
  tags?: string[] | unknown[] | Array<{
    id: number;
    name: string;
    category?: string;
    rank?: number;
    isGeneralSpoiler?: boolean;
    isMediaSpoiler?: boolean;
  }>;
  bannerImage?: string;
  // Provider-specific fields
  anilistId?: number;
  averageScore?: number;
  popularity?: number;
  trending?: number;
}

// ============================================================================
// Type Aliases
// ============================================================================

// Alias for backward compatibility
export type UnifiedSearchResult = MangaSearchResult;
export type MangaResult = SearchResult; // Alias used by SearchResults.tsx

// ============================================================================
// Extended Search Result
// ============================================================================

/**
 * Extended search result with additional metadata
 * Used in confirmation steps and detailed views
 */
export interface ExtendedMangaSearchResult extends MangaSearchResult {
  // Additional metadata fields
  authors?: string[];
  artists?: string[];
  startDate?: string | null;
  endDate?: string | null;
  anilistId?: number;
  malId?: number;
  comicvineId?: string;
  publisher?: string;
  volumeData?: unknown[];
  chapterData?: unknown[];
  bannerImage?: string;
  format?: string;
  releaseYear?: number;
  countryOfOrigin?: string;
  isAdult?: boolean;
  averageScore?: number;
  popularity?: number;

  // UI fields used by components
  cover?: string;
  coverUrl?: string;
  source?: string;
  sourceId?: string;
  metadata?: unknown;

  // Fields for UniversalImportWizard
  rawData?: unknown;
  providerSpecific?: unknown;

  // Fandom-specific fields for enrichment
  wikiUrl?: string;
  siteDetailUrl?: string;

  // Legacy fields for compatibility (will be removed)
  // Note: year is already defined in base interface as number
  media?: unknown;
  data?: unknown;
  publicationStatus?: string;
  mangaStatus?: string;
  publication?: unknown;
  start_year?: number;
  alternativeNames?: string[];
  synonyms?: string[];
  volumeCovers?: string[];

  // Index signature to allow dynamic property access
  [key: string]: unknown;
}
