/**
 * Type Definitions for Confirmation Data Builder
 *
 * This module defines all type interfaces used throughout the
 * confirmation data building process.
 *
 * @module components/addManga/form/confirmation-data-builder/types
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';

/**
 * Volume detail structure with comprehensive information
 */
export interface VolumeDetail {
  number: number;
  title: string;
  chapters?: unknown[] | undefined;
  coverImage?: string | undefined;
  releaseDate?: string | undefined;
  pages?: number | undefined;
  // Legacy field support for backward compatibility
  volumeNumber?: number;
  coverImageUrl?: string | undefined;
  summary?: string | undefined;
  chapterCount?: number | undefined;
}

/**
 * Publisher object structure (may be string or object)
 */
export interface PublisherObject {
  name: string;
  [key: string]: unknown;
}

/**
 * Metadata object containing structured manga information
 */
export interface MetadataObject {
  volumes?: number | VolumeDetail[];
  chapters?: number | unknown[];
  volumeDetails?: VolumeDetail[];
  issues?: unknown;
  characters?: unknown[];
  creators?: unknown[];
  publisher?: string | PublisherObject;
  anilistId?: number | string;
  myAnimeListId?: number | string;
  releaseYear?: number;
  artists?: string[];
  authors?: string[];
  descriptions?: {
    main?: string;
    synopsis?: string;
    plot?: string;
    background?: string;
    history?: string;
  };
  [key: string]: unknown;
}

/**
 * Raw data object from external sources (wizard, Fandom, etc.)
 */
export interface RawDataObject {
  synopsis?: string;
  plot?: string;
  background?: string;
  history?: string;
  anilistId?: number | string;
  myAnimeListId?: number | string;
  releaseYear?: number;
  artists?: string[];
  authors?: string[];
  coverImage?: string;
  cover?: string;
  selectedCover?: string;
  bannerImage?: string;
  banner?: string;
  selectedBanner?: string;
  averageScore?: number;
  popularity?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  staff?: unknown[];
  format?: string;
  volumeDetails?: VolumeDetail[];
  chapterDetails?: unknown[];
  chapterUrls?: string[];
  shouldFetchChapterDetails?: boolean;
  selectedVolumes?: unknown[];
  selectedVolumesData?: unknown[];
  chapterMetadataCache?: unknown;
  providerMetadata?: Record<string, unknown>;
  selectedProviders?: string[];
  totalVolumes?: number;
  volumeCount?: number;
  totalChapters?: number;
  chapterCount?: number;
  volumes?: VolumeDetail[];
  volumeCovers?: unknown[];
  chapterCovers?: unknown[];
  importProfile?: string;
  [key: string]: unknown;
}

/**
 * Provider-specific data object (ComicVine, AniList, etc.)
 */
export interface ProviderSpecificObject {
  issues?: unknown;
  issueCount?: number;
  characters?: unknown[];
  creators?: unknown[];
  publisher?: string | PublisherObject;
  siteDetailUrl?: string;
  chapters?: number | unknown[];
  volumes?: number | VolumeDetail[];
  format?: string;
  averageScore?: number;
  popularity?: number;
  startDate?: string;
  tags?: string[];
  bannerImage?: string;
  authors?: string[];
  [key: string]: unknown;
}

/**
 * Manga object with dynamic metadata from various sources
 */
export interface MangaWithDynamicMetadata extends Omit<ExtendedMangaSearchResult, 'anilistId'> {
  metadata?: MetadataObject;
  rawData?: RawDataObject;
  providerSpecific?: ProviderSpecificObject;
  synopsis?: string;
  plot?: string;
  background?: string;
  history?: string;
  anilistId?: number | string;
  myAnimeListId?: number | string;
  releaseYear?: number;
  artists?: string[];
  chapters?: number | unknown[];
  volumes?: number | VolumeDetail[];
  format?: string;
  idMal?: number | string;
  synonyms?: string[];
  averageScore?: number;
  popularity?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  staff?: unknown[];
  bannerImage?: string;
  externalLinks?: unknown[];
  countryOfOrigin?: string;
  isAdult?: boolean;
  siteDetailUrl?: string;
  providerMetadata?: Record<string, unknown>;
  selectedProviders?: string[];
  issues?: unknown;
  issueCount?: number;
  characters?: unknown[];
  creators?: unknown[];
  publisher?: string | PublisherObject;
  [key: string]: unknown;
}

/**
 * Final confirmation data object structure
 */
export interface ConfirmationDataObject {
  id: string;
  type: 'manga';
  title: string;
  source: string;
  provider: string;
  sourceId?: string;
  cover?: string;
  coverImage?: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  genres?: string[];
  alternativeTitles?: string[];
  authors?: string[];
  metadata?: Record<string, unknown>;
  rawData?: RawDataObject;
  providerSpecific?: ProviderSpecificObject;
  providerMetadata?: Record<string, unknown>;
  selectedProviders?: string[];
  volumes?: number | VolumeDetail[];
  chapters?: number | unknown[];
  bannerImage?: string;
  volumeDetails?: VolumeDetail[];
  chapterCount?: number;
  volumeCount?: number;
  [key: string]: unknown;
}
