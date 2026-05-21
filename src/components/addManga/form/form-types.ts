/**
 * Form Types Module - Type definitions for AddMangaForm component.
 * Handles complex metadata structures from multiple providers.
 *
 * Note: ParsedVolumeData differs from @/types/index.ts version -
 * volumes can be number OR VolumeDetail[] depending on provider data.
 *
 * @module components/addManga/form/form-types
 */

import type { MangaSearchResult } from '@/types/search.types';

/** Re-export for backward compatibility */
export type SearchResult = MangaSearchResult;

/** Volume metadata structure */
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

/** Parsed volume/chapter data - form-specific version with dynamic types */
export interface ParsedVolumeData {
  volumes: number | VolumeDetail[];
  chapters: number | unknown[];
  volumeDetails?: VolumeDetail[];
}

/** Publisher information object */
export interface PublisherObject {
  name: string;
  [key: string]: unknown;
}

/** Normalized metadata from multiple providers */
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

/** Raw unprocessed data from provider responses */
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

/** Provider-specific data (ComicVine, AniList, etc.) */
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

/** Manga with dynamic metadata from multiple providers */
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
  [key: string]: unknown;
}

/** Confirmation data for submission after user confirmation */
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

/** Main form values for Add Manga form */
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

/** Extended form values with additional metadata fields */
export interface FormValuesExtended extends FormType {
  banner?: string;
  rawData?: RawDataObject;
  importProfile?: string;
  providerMetadata?: Record<string, unknown>;
  volumeCount?: number;
  chapterCount?: number;
  totalVolumes?: number;
  totalChapters?: number;
  dynamicSections?: unknown;
  [key: string]: unknown;
}

/** Props for AddMangaForm component */
export interface AddMangaFormProps {
  onClose: () => void;
  libraryId: number;
  onAdd?: () => void;
}

/** Steps in the add manga workflow */
export enum AddMangaStep {
  SEARCH = 0,
  CONFIRMATION = 1
}
