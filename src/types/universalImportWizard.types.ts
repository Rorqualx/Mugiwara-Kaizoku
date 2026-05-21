

// Import all canonical types
import type { ExtendedMangaSearchResult as _CanonicalExtendedSearchResult, MangaSearchResult as _CanonicalMangaSearchResult } from '../types/search.types';
import type { MangaPublicationStatus } from '@prisma/client';

// Re-export types from search.types
export type { MangaSearchResult, ExtendedMangaSearchResult, ProviderSearchResult } from '../types/search.types';

// ============================================
// Core Data Types
// ============================================

// External IDs structure
export interface ExternalIds {
  anilistId: string;
  malId: string;
  comicVineId: string;
  kitsuId: string;
  mangaUpdatesId: string;
  [key: string]: string; // Allow additional ID types
}

// Volume structure
export interface Volume {
  volumeNumber?: number;
  number?: number;
  title: string;
  chapters?: Chapter[];
  chapterCount?: number;
  coverImageUrl?: string;
  coverUrl?: string;
  coverImage?: string;
  description?: string;
  needsChapterScraping?: boolean;
  issueNumber?: number;
  issueName?: string;
  name?: string;
  volumeName?: string;
  volumeSummary?: string;
  url?: string;
}

// Chapter structure
export interface Chapter {
  number?: number;
  chapterNumber?: number;
  volume?: number;
  title?: string;
  url?: string;
  coverImageUrl?: string;
  coverUrl?: string;
  coverImage?: string;
  cover?: string;
  summary?: string;
  description?: string;
  synopsis?: string;
  releaseDate?: string;
  pageCount?: number;
  // Track if we've fetched details for this chapter
  detailsFetched?: boolean;
}

// Media gallery structure
export interface MediaGallery {
  covers: string[];
  coversWithProviders?: Array<{ url: string; provider: string }>;
  banners: string[];
  gallery: string[];
  volumeCovers: string[];
  chapterCovers: string[];
}

// Volumes data structure
export interface VolumesData {
  volumes: Volume[];
  totalVolumes: number;
  totalChapters: number;
  // Indicates chapter scraping is in progress (for ComicVine/providers needing FlareSolverr)
  isScrapingChapters?: boolean;
  // Progress tracking for chapter scraping
  scrapingProgress?: {
    current: number;
    total: number;
    message?: string;
    stage?: 'connecting' | 'api_call' | 'scraping' | 'merging' | 'complete' | 'error';
  };
  // Optional fandom-specific nested data
  fandom?: {
    volumes: Volume[];
    totalVolumes: number;
    totalChapters: number;
  };
}

// Metadata from providers
export interface ProviderMetadata {
  id?: string;
  sourceId?: string;
  title?: string;
  description?: string;
  synopsis?: string;
  status?: string;
  format?: string;
  genres?: string[];
  tags?: string[];
  themes?: string[];
  authors?: string[];
  artists?: string[];
  publisher?: string | { name?: string; english?: string; japan?: string };
  demographic?: string;
  startDate?: string | { year?: number; month?: number; day?: number };
  endDate?: string | { year?: number; month?: number; day?: number };
  // Volume and chapter counts (always numbers)
  volumes?: number;
  chapters?: number;
  volumeCount?: number; // Deprecated - use volumes instead
  chapterCount?: number; // Deprecated - use chapters instead

  // Detailed volume/chapter data (always arrays)
  volumeData?: Volume[];
  chapterData?: Chapter[];
  alternativeTitles?: string[];
  coverImage?: string;
  coverUrl?: string;
  volumesListUrl?: string; // URL to the volumes list page (for Fandom)
  chaptersListUrl?: string; // URL to the chapters list page (for Fandom)
  bannerImage?: string;
  url?: string;
  wikiUrl?: string;
  siteUrl?: string;
  siteDetailUrl?: string; // ComicVine volume detail page URL
  links?: Record<string, string>;
  externalLinks?: string[];
  idMal?: number;
  anilistId?: number;
  comicVineId?: string;
  mangaUpdatesId?: string;
  averageScore?: number;
  popularity?: number;
  rawData?: unknown;
  metadata?: unknown;
  isAdult?: boolean;
  images?: string[];
  gallery?: string[];
  // Additional publication metadata (primarily from Wikipedia)
  originalRun?: string;
  magazine?: string;
  englishPublisher?: string;
  // Provider-specific data
  fandomUrl?: string;
  comicVineUrl?: string; // ComicVine series/volume URL for scraping
  metadataProvider?: string;
}

// Description edit modes
export type DescriptionEditMode = Record<string, boolean>;

// Batch fetch progress
export interface BatchFetchProgress {
  current: number;
  total: number;
  message?: string;
}

// Import progress
export interface ImportProgress {
  status: 'idle' | 'importing' | 'success' | 'error';
  progress: number;
  message?: string;
  error?: string;
}

// ============================================
// Form Data Types
// ============================================

/**
 * Form data structure for the Universal Import Wizard
 */
export interface WizardFormData {
  // Basic Information
  title: string;
  alternativeTitles: string[];
  alternativeNames?: string[];
  description?: string;
  descriptionRaw?: string;  // Raw value with provider suffix for Select component
  synopsis?: string;
  synopsisRaw?: string;     // Raw value with provider suffix for Select component
  plot?: string;
  background?: string;
  history?: string;
  descriptions?: {
    synopsis?: string;
    plot?: string;
    background?: string;
    history?: string;
  };

  // Cover and Media
  coverUrl?: string;
  bannerUrl?: string;
  covers?: Array<{
    source: string;
    url: string;
    confidence?: number;
  }>;

  // Publication Details
  status?: MangaPublicationStatus | string;
  format?: string;
  publisher?: string;
  demographic?: string;
  startDate?: string;
  endDate?: string;
  releaseYear?: number | string;
  country?: string;
  language?: string;
  averageScore?: number;
  popularity?: number;
  publication?: {
    status?: MangaPublicationStatus | string;
    startDate?: string;
    endDate?: string;
    releaseYear?: number | string;
    publisher?: {
      japan?: string;
      english?: string;
    };
    demographic?: string;
  };

  // Genre and Tags
  genres?: string[];
  themes?: string[];
  tags?: string[];

  // Additional Info
  reception?: string;
  isAdult?: boolean;

  // Authors and Artists
  author?: string;
  illustrator?: string;
  authors?: string[];
  artists?: string[];

  // Volume and Chapter Info
  volumeInfo?: string; // Simple string for description
  volumes?: number | Volume[]; // Can be count or array of volumes
  chapters?: number | Chapter[]; // Can be count or array of chapters
  selectedVolumes?: number[];
  selectedChapters?: (string | Chapter)[];

  // External IDs and Links
  externalIds?: ExternalIds;
  externalLinks?: string[];

  // Provider info
  searchProvider?: string;
  selectedSource?: string;
  selectedSourceId?: string;
  metadataProvider?: string;

  // Cached search results from initial search
  cachedSearchResults?: unknown[];
  
  // Additional Metadata
  metadata?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
  
  // Field Selections (for confirmation step)
  fieldSelections?: Record<string, {
    source: string;
    value: unknown;
    confidence?: number;
  }>;
  
  // Download Settings
  downloadSettings?: {
    autoDownload?: boolean;
    downloadQuality?: string;
    chapterRange?: {
      start?: number;
      end?: number;
    };
    selectedVolumes?: number[];
    selectedChapters?: string[];
  };
  
  // Provider-specific data
  anilistId?: string;
  myAnimeListId?: string;
  myAnimeListUrl?: string;
  comicVineId?: string;
  wikipediaUrl?: string;
  fandomUrl?: string;
}

// ============================================
// Component Props Types
// ============================================

/**
 * Props for metadata preview items
 */
export interface MetadataPreviewItem {
  label: string;
  value: string | number | boolean | undefined;
  badge?: boolean;
  color?: string;
}

/**
 * Props for field selector options
 */
export interface FieldSelectorOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
  data?: {
    source: string;
    confidence?: number;
    description?: string;
    originalValue: unknown;
  };
}

/**
 * Provider option for field selection
 */
export interface ProviderOption {
  value: string;
  label: string;
  source?: string;
  provider?: string;
  confidence?: number;
}

/**
 * Field options type
 */
export type FieldOptions = Record<string, ProviderOption[]>;

// ============================================
// State Types
// ============================================

/**
 * Loading states for various operations
 */
export interface LoadingStates {
  search: boolean;
  metadata: boolean;
  covers: boolean;
  chapters: boolean;
  submit: boolean;
  [key: string]: boolean;
}

/**
 * Error states
 */
export interface ErrorStates {
  search?: string;
  metadata?: string;
  covers?: string;
  chapters?: string;
  submit?: string;
  [key: string]: string | undefined;
}

// ============================================
// Unified Field Selection Types
// ============================================

/**
 * Unified field selection for a single field
 */
export interface UnifiedFieldSelection {
  /** Field name (e.g., 'title', 'description', 'genres') */
  field: string;
  /** Selected provider for this field */
  selectedProvider: string;
  /** The actual value from the selected provider */
  value: unknown;
  /** Confidence score for this selection */
  confidence: number;
  /** Array merge mode for array fields (genres, tags, etc.) */
  arrayMergeMode?: 'replace' | 'union';
  /** For arrays, track which providers contributed items */
  mergedFrom?: Array<{ provider: string; items: unknown[] }>;
  /** Whether this was an explicit user selection (vs auto-selected) */
  isExplicit: boolean;
}

/**
 * Collection of field selections keyed by field name
 */
export type UnifiedFieldSelections = Record<string, UnifiedFieldSelection>;

// ============================================
// Utility Types
// ============================================

/**
 * Type guard to check if a result has a specific property
 */
export function hasProperty<T extends Record<string, unknown>, K extends PropertyKey>(
  obj: T,
  prop: K
): obj is T & Record<K, unknown> {
  return prop in obj;
}

/**
 * Safe property access
 */
export function getProperty<T extends Record<string, unknown>>(
  obj: T | undefined | null,
  path: string,
  defaultValue: unknown = undefined
): unknown {
  if (!obj) return defaultValue;
  
  const keys = path.split('.');
  let result: unknown = obj;
  
  for (const key of keys) {
    if ((result as Record<string, unknown>)[key] === undefined) {
      return defaultValue;
    }
    result = (result as Record<string, unknown>)[key];
  }
  
  return result;
}

/**
 * Type for setState callback parameters
 */
export type SetStateCallback<T> = (prev: T) => T;

/**
 * Type for async operations
 */
export type AsyncOperation<T> = () => Promise<T>;

// ============================================
// Type aliases for backward compatibility
// ============================================

export type FormData = WizardFormData;

// ============================================
// Wizard Component Types
// ============================================

/**
 * Initial data that can be passed to the wizard
 */
export interface WizardInitialData {
  title?: string;
  url?: string;
  searchQuery?: string;
  provider?: string;
  metadata?: ProviderMetadata;
  externalIds?: Partial<ExternalIds>;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Volume result from API responses
 */
export interface VolumeResult {
  volumeDetails?: Volume[];
  metadata?: ProviderMetadata;
  volumes?: Volume[];
  [key: string]: unknown;
}

/**
 * ComicVine specific metadata
 */
export interface ComicVineMetadata extends ProviderMetadata {
  volumeId?: string;
  issues?: Array<{
    id: string;
    name: string;
    issue_number: string;
  }>;
}

/**
 * Anilist cover image structure
 */
export interface AnilistCoverImage {
  extraLarge?: string;
  large?: string;
  medium?: string;
  color?: string;
}

/**
 * ComicVine volume URLs response
 */
export interface ComicVineVolumeUrlsResult {
  volumeUrls: Array<{
    volumeNumber: number;
    url: string;
  }>;
}

/**
 * ComicVine chapters scrape response
 */
export interface ComicVineChaptersResult {
  volumes: Volume[];
}

/**
 * Fandom parse result
 */
export interface FandomParseResult {
  volumes?: number | Volume[];
  chapters?: number;
  volumeDetails?: Volume[];
  volumesListUrl?: string;
  rawData?: {
    chapters?: Chapter[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}