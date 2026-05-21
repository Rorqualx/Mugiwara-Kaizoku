/**
 * Configuration Types Module
 *
 * Configuration interfaces and constants for various integrations,
 * including metadata providers, notifications, and library settings.
 *
 * Extracted from: search.types.ts
 */

// ============================================================================
// Imports
// ============================================================================

import type {
  ProviderType,
  SortCriteria,
  SortOrder,
  ConfigScope
} from './enums.types';

// ============================================================================
// Search Configuration
// ============================================================================

/**
 * Alternative titles from metadata sources (AniList, MAL, etc.)
 * Used for multi-query search optimization in providers like ComicVine.
 */
export interface AlternativeTitlesOption {
  english?: string | undefined;
  romaji?: string | undefined;
  native?: string | undefined;
  synonyms?: string[] | undefined;
}

export interface SearchOptions {
  query?: string;
  provider?: string;
  providers?: string[];
  type?: ProviderType;
  sort?: SortCriteria;
  order?: SortOrder;
  page?: number;
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  includeAdult?: boolean;
  /**
   * Alternative titles to improve search accuracy.
   * When provided, providers like ComicVine can search using multiple
   * title variants (English, romaji, native) for better matching.
   */
  alternativeTitles?: AlternativeTitlesOption;
}

// ============================================================================
// Metadata Configuration
// ============================================================================

export const METADATA_FIELDS = [
  // Core text fields
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'synopsis', label: 'Synopsis' },
  { value: 'alternativeTitles', label: 'Alternative Titles' },

  // Publication metadata
  { value: 'status', label: 'Status' },
  { value: 'format', label: 'Format' },
  { value: 'demographic', label: 'Demographic' },
  { value: 'isAdult', label: 'Adult Content' },

  // Categorization
  { value: 'genres', label: 'Genres' },
  { value: 'tags', label: 'Tags' },
  { value: 'themes', label: 'Themes' },

  // Creator info
  { value: 'author', label: 'Author' },
  { value: 'artist', label: 'Artist' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'englishPublisher', label: 'English Publisher' },
  { value: 'magazine', label: 'Magazine' },

  // Dates
  { value: 'year', label: 'Year' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'endDate', label: 'End Date' },
  { value: 'originalRun', label: 'Original Run' },

  // Volume/Chapter counts
  { value: 'chapters', label: 'Chapters' },
  { value: 'volumes', label: 'Volumes' },

  // Media
  { value: 'coverImage', label: 'Cover Image' },
  { value: 'bannerImage', label: 'Banner Image' },

  // Ratings
  { value: 'averageScore', label: 'Average Score' },
  { value: 'popularity', label: 'Popularity' },

  // Volume-level field sources (for Quick Add presets)
  { value: 'volumeCover', label: 'Volume Cover Source' },
  { value: 'volumeSummary', label: 'Volume Summary Source' },
  { value: 'volumeTitle', label: 'Volume Title Source' },

  // Chapter-level field sources (for Quick Add presets)
  { value: 'chapterCover', label: 'Chapter Cover Source' },
  { value: 'chapterSummary', label: 'Chapter Summary Source' },
  { value: 'chapterTitle', label: 'Chapter Title Source' }
] as const;

// Metadata providers configuration
export const METADATA_PROVIDERS = [
  { value: 'anilist', label: 'AniList' },
  { value: 'mangadex', label: 'MangaDex' },
  { value: 'comicvine', label: 'ComicVine' },
  { value: 'fandom', label: 'Fandom' },
  { value: 'wikipedia', label: 'Wikipedia' }
] as const;

// Permanent field priorities for metadata providers (fallbackMode: 'confidence')
export const DEFAULT_FIELD_PRIORITIES: Record<string, string[]> = {
  // Core text fields
  title: ['fandom', 'anilist', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  description: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  synopsis: ['fandom', 'anilist', 'wikipedia', 'comicvine', 'mangadex', 'mangaupdates'],
  alternativeTitles: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],

  // Publication metadata
  status: ['fandom', 'anilist', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  format: ['fandom', 'anilist', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  demographic: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  isAdult: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],

  // Categorization
  genres: ['anilist', 'comicvine', 'fandom', 'wikipedia', 'mangadex', 'mangaupdates'],
  tags: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  themes: ['fandom', 'anilist', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],

  // Creator info
  author: ['anilist', 'comicvine', 'fandom', 'wikipedia', 'mangadex', 'mangaupdates'],
  artist: ['fandom', 'anilist', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  publisher: ['fandom', 'comicvine', 'wikipedia', 'anilist', 'mangadex', 'mangaupdates'],
  englishPublisher: ['wikipedia', 'comicvine', 'fandom', 'anilist', 'mangadex', 'mangaupdates'],
  magazine: ['wikipedia', 'fandom', 'anilist', 'comicvine', 'mangadex', 'mangaupdates'],

  // Dates
  year: ['comicvine', 'anilist', 'fandom', 'wikipedia', 'mangadex', 'mangaupdates'],
  startDate: ['anilist', 'comicvine', 'fandom', 'wikipedia', 'mangadex', 'mangaupdates'],
  endDate: ['anilist', 'comicvine', 'fandom', 'wikipedia', 'mangadex', 'mangaupdates'],
  originalRun: ['wikipedia', 'fandom', 'anilist', 'comicvine', 'mangadex', 'mangaupdates'],

  // Volume/Chapter counts
  chapters: ['fandom', 'wikipedia', 'comicvine', 'anilist', 'mangadex', 'mangaupdates'],
  volumes: ['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangadex', 'mangaupdates'],

  // Media
  coverImage: ['fandom', 'anilist', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  bannerImage: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],

  // Ratings
  averageScore: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],
  popularity: ['anilist', 'fandom', 'comicvine', 'wikipedia', 'mangadex', 'mangaupdates'],

  // Volume-level field sources
  volumeCover: ['comicvine', 'fandom', 'anilist', 'wikipedia', 'mangadex', 'mangaupdates'],
  volumeSummary: ['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangadex', 'mangaupdates'],
  volumeTitle: ['comicvine', 'fandom', 'anilist', 'wikipedia', 'mangadex', 'mangaupdates'],

  // Chapter-level field sources
  chapterCover: ['fandom', 'comicvine', 'anilist', 'wikipedia', 'mangadex', 'mangaupdates'],
  chapterSummary: ['fandom', 'comicvine', 'wikipedia', 'anilist', 'mangadex', 'mangaupdates'],
  chapterTitle: ['fandom', 'comicvine', 'anilist', 'wikipedia', 'mangadex', 'mangaupdates'],
};

/** Permanent fallback mode: use highest confidence provider */
export const DEFAULT_FALLBACK_MODE = 'confidence' as const;

/**
 * Field provider preferences type
 * Maps metadata fields to priority-ordered arrays of provider names
 */
export type FieldProviderPreferencesType = Record<string, string[]>;

/**
 * Fallback mode for provider selection when primary provider has no data
 * - 'priority': Use the 2nd, 3rd, 4th priority in order
 * - 'confidence': Use whichever remaining provider has highest match confidence
 */
export type FallbackMode = 'priority' | 'confidence';

// ============================================================================
// Integration Configurations
// ============================================================================

export interface SuwayomiConfig {
  host: string;
  port?: number;
  pathPrefix?: string;
  username?: string;
  password?: string;
}

/**
 * Native Download types for search
 */
export interface NativeDownloadProvider {
  id: string;
  name: string;
  enabled: boolean;
  priority?: number;
}

export interface NativeDownloadConfig {
  url: string;
  apiKey: string;
  rootFolder?: string;
  qualityProfile?: string;
  metadataProfile?: string;
  autoSearch?: boolean;
  autoMonitor?: boolean;
  autoDownload?: boolean;
}

export interface NativeDownloadManga {
  id: number;
  title: string;
  alternativeTitles?: string[];
  overview?: string;
  status?: string;
  year?: number;
  images?: unknown[];
  monitored?: boolean;
  qualityProfileId?: number;
  metadataProfileId?: number;
  rootFolderPath?: string;
}

export interface NativeDownloadChapter {
  id: number;
  title?: string;
  chapterNumber: number;
  volumeNumber?: number;
  releaseDate?: string;
  monitored?: boolean;
  downloaded?: boolean;
}

export interface NativeDownloadSourceConfig {
  id: string;
  name: string;
  enabled: boolean;
  url?: string;
  apiKey?: string;
  rootFolder?: string;
  priority?: number;
}

// ============================================================================
// App Configuration
// ============================================================================

export interface AppConfig {
  [key: string]: unknown;
}

export interface ConfigWithMetadata<T = unknown> {
  key: string;
  value: T;
  metadata?: unknown;
  scope?: string | ConfigScope;
  category?: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// Notification Configuration
// ============================================================================

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    host: string;
    port: number;
    username?: string;
    password?: string;
    from: string;
    to: string[];
    ssl?: boolean;
  };
  discord?: {
    enabled: boolean;
    webhookUrl: string;
    username?: string;
    avatarUrl?: string;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel?: string;
    username?: string;
    iconEmoji?: string;
  };
  telegram?: {
    enabled: boolean;
    botToken: string;
    chatId: string;
  };
  webhook?: {
    enabled: boolean;
    url: string;
    method?: string;
    headers?: Record<string, string>;
    retryAttempts?: number;
  };
}

export interface NotificationTestResult {
  success: boolean;
  message: string;
}

// ============================================================================
// Library Configuration
// ============================================================================

export interface LibrarySettings {
  autoScan: boolean;
  scanInterval: number;
  downloadAutomatically: boolean;
  preferredQuality: string;
}

export interface AutoDownloadConfig {
  enabled: boolean;
  checkInterval: number;
  quality?: string;
  minQuality?: string;
  maxSize?: number;
  preferredGroups?: string[];
  excludeGroups?: string[];
  format?: 'raw' | 'cbz' | 'pdf';
  language?: string;
}
