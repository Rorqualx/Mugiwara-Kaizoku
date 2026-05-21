/**
 * Type Definitions for Manga Selection Handler
 *
 * Contains all interfaces and type definitions used by the manga selection handler module.
 * These types define the structure of manga data, form values, and processing results.
 *
 * @module components/addManga/form/manga-selection-handler/types
 */

import type { ExtendedMangaSearchResult } from '@/types/search.types';

/**
 * Details about a single volume including metadata
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
 * Parsed volume and chapter data from various providers
 */
export interface ParsedVolumeData {
  volumes: number | VolumeDetail[];
  chapters: number | unknown[];
  volumeDetails?: VolumeDetail[];
}

/**
 * Publisher object with name and additional properties
 */
export interface PublisherObject {
  name: string;
  [key: string]: unknown;
}

/**
 * Metadata object containing extended manga information
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
 * Raw data object containing provider-specific information
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
 * Provider-specific data object (e.g., ComicVine, AniList)
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
 * Internal interface for manga with dynamic metadata structure
 * Used for type-safe access to varied metadata shapes
 */
export interface MangaWithDynamicMetadata {
  id: string | number;
  title: string;
  provider?: string;
  source?: string;
  cover?: string;
  coverImage?: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  genres?: string[];
  authors?: string[];
  alternativeTitles?: string[];
  metadata?: MetadataObject;
  parsedVolumeData?: ParsedVolumeData;
  issues?: unknown;
  issueCount?: number;
  characters?: unknown[];
  creators?: unknown[];
  publisher?: string | PublisherObject;
  rawData?: RawDataObject;
  providerSpecific?: ProviderSpecificObject;
  [key: string]: unknown;
}

/**
 * Form type definition for add manga form
 */
export interface FormType {
  query: string;
  mangaTitle: string;
  mangaId: string;
  libraryId: number;
  source?: string;
  downloadPath?: string;
  monitoringInterval?: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customInterval?: string;
  cover?: string;
  description?: string;
  status?: string;
  genres?: string[];
  parsedVolumeData?: {
    volumes: number;
    chapters: number;
    volumeDetails?: Array<{
      volumeNumber: number;
      title: string;
      chapterCount: number;
    }>;
  };
  [key: string]: unknown;
}

/**
 * Result of processing a manga selection
 */
export interface MangaSelectionResult {
  formUpdate: Partial<FormType> & Record<string, unknown>;
  selectedManga: ExtendedMangaSearchResult & {
    rawData?: RawDataObject;
    providerSpecific?: ProviderSpecificObject;
  };
}

/**
 * Extracted ComicVine data from manga object
 */
export interface ComicVineData {
  issues: unknown | undefined;
  characters: unknown[] | undefined;
  creators: unknown[] | undefined;
  publisher: string | undefined;
  rawData: RawDataObject | undefined;
  providerSpecific: ProviderSpecificObject | undefined;
}
