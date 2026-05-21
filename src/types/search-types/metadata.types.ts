/**
 * Metadata Types Module
 *
 * Unified metadata types, validation, quality metrics, and notification settings.
 * Includes comprehensive metadata structures for manga, characters, and external links.
 *
 * Extracted from: search.types.ts
 */

// ============================================================================
// Imports
// ============================================================================

import type { MangaMetadata } from './core-search.types';
import type {
  MangaFormat,
  MangaPublicationStatus,
  NotificationEventType,
  Priority
} from './enums.types';
import type { ProviderMetadata } from './provider.types';

// Re-export MangaFormat
export { MangaFormat } from './enums.types';

// ============================================================================
// Metadata Details
// ============================================================================

export interface MetadataDetails {
  title: string;
  alternativeTitles?: string[];
  description?: string;
  status?: MangaPublicationStatus;
  genres?: string[];
  tags?: string[] | unknown[] | Array<{
    id: number;
    name: string;
    category?: string;
    rank?: number;
    isGeneralSpoiler?: boolean;
    isMediaSpoiler?: boolean;
  }>;
  authors?: string[];
  artists?: string[];
  publisher?: string;
  volumes?: number;
  chapters?: number;
  coverImage?: string;
  bannerImage?: string;
}

// ============================================================================
// Metadata Provenance and Quality
// ============================================================================

export interface MetadataProvenance {
  [field: string]: {
    source: string;
    confidence: number;
    lastUpdated: Date;
  } | undefined;
}

export interface MetadataConflict {
  field: string;
  sources: Array<{
    provider: string;
    value: unknown;
    confidence: number;
  }>;
  resolved?: boolean;
  resolution?: unknown;
}

export interface MetadataQuality {
  completeness: number;
  accuracy: number;
  freshness: number;
  sources: number;
  overall: number;
}

// ============================================================================
// Unified Metadata
// ============================================================================

export interface UnifiedMangaMetadata extends Omit<MangaMetadata, 'chapters' | 'volumes' | 'tags' | 'characters'> {
  format?: MangaFormat;
  persons?: PersonInfo[];
  tags?: TagInfo[];
  covers?: CoverImages;
  externalIds?: ExternalIds;
  characters?: CharacterInfo[];
  chapters?: ChapterInfo[];
  volumes?: VolumeInfo[];
  quality?: MetadataQuality;
  validationResult?: MetadataValidationResult;
  startDate?: Date | string;
  endDate?: Date | string;
  primarySource?: string;
  providerMetadata?: ProviderMetadata[];
  metadataQuality?: MetadataQuality;
  updatedAt?: Date;
  // Keep the numeric fields for compatibility
  chapterCount?: number;
  volumeCount?: number;
}

export type PartialUnifiedMetadata = Partial<UnifiedMangaMetadata>;

// ============================================================================
// Person and Staff Types
// ============================================================================

export interface PersonInfo {
  name: string;
  role: 'AUTHOR' | 'ARTIST' | 'WRITER' | 'PENCILER' | 'INKER' | 'COLORIST' | 'LETTERER' | 'COVER_ARTIST' | 'EDITOR' | 'TRANSLATOR';
  id?: string;
  image?: string;
}

export interface StaffInfo extends PersonInfo {
  // StaffInfo is the same as PersonInfo for now
}

// ============================================================================
// Tags and Categories
// ============================================================================

export interface TagInfo {
  name: string;
  category?: string;
  description?: string;
  rank?: number;
  isGenre?: boolean;
  isMediaSpoiler?: boolean;
  isGeneralSpoiler?: boolean;
  isAdult?: boolean;
}

// ============================================================================
// Images and Covers
// ============================================================================

export interface CoverImages {
  extraLarge?: string;
  large?: string;
  medium?: string;
  small?: string;
  color?: string;
  original?: string;
  thumbnail?: string;
}

// ============================================================================
// External Identifiers
// ============================================================================

export interface ExternalIds {
  anilistId?: number;
  malId?: number;
  comicvineId?: string;
  mangaupdatesId?: string;
  kitsuId?: string;
  animePlanetId?: string;
  novelUpdatesId?: string;
  // Index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;
}

// ============================================================================
// Characters
// ============================================================================

export interface CharacterInfo {
  id?: string;
  name: string;
  role?: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  image?: string;
  description?: string;
}

// ============================================================================
// Chapters and Volumes
// ============================================================================

export interface ChapterInfo {
  id?: string;
  number: number;
  title?: string;
  volume?: number;
  releaseDate?: Date | string;
  scanlationGroup?: string;
  pages?: number;
}

export interface VolumeInfo {
  id?: string;
  number: number;
  title?: string;
  chapterStart?: number;
  chapterEnd?: number;
  releaseDate?: Date | string;
  coverImage?: string;
}

/**
 * Enhanced Volume Data for Multi-Tiered Scraping
 *
 * Extended volume information captured from 3-tier scraping:
 * - Tier 1: Series page (basic volume list)
 * - Tier 2: Volume page (detailed metadata)
 * - Tier 3: Chapter pages (individual chapter data)
 */
export interface EnhancedVolumeData extends VolumeInfo {
  // Extended metadata
  subtitle?: string;
  alternativeTitle?: string;
  description?: string;
  summary?: string;

  // Publication details
  isbn?: string;
  isbn13?: string;
  publisher?: string;
  pageCount?: number;
  format?: string; // Tankobon, Omnibus, Digital, etc.

  // Content breakdown
  chapters?: EnhancedChapterReference[];
  totalChapters?: number;

  // Themes and genres (from ComicVine concepts)
  themes?: string[];
  genres?: string[];

  // Creator credits
  creators?: {
    authors?: string[];
    artists?: string[];
    editors?: string[];
    colorists?: string[];
    letterers?: string[];
    coverArtists?: string[];
  };

  // Characters appearing in this volume
  characters?: string[];

  // Story arcs covered
  storyArcs?: string[];

  // Source tracking
  source?: 'comicvine' | 'fandom' | 'anilist';
  sourceId?: string;
  sourceUrl?: string;

  // Data freshness
  fetchedAt?: Date | string;
  lastEnriched?: Date | string;
  enrichmentTier?: 1 | 2 | 3;
}

/**
 * Enhanced Chapter Reference within a Volume
 *
 * Chapter data as extracted from volume pages.
 */
export interface EnhancedChapterReference {
  number: number;
  title?: string;
  alternativeTitle?: string;
  releaseDate?: Date | string;
  pages?: number;
  summary?: string;
  url?: string;
  coverImage?: string;

  // Special chapter flags
  isFinalChapter?: boolean;
  isEpilogue?: boolean;
  isPrologue?: boolean;
  isSpecial?: boolean;
  isFiller?: boolean;

  // Characters appearing in this chapter
  characters?: string[];

  // Source tracking
  sourceId?: string;
  enriched?: boolean;
}

/**
 * Provider Volume Data Structure
 *
 * Structure for storing volume data in Manga.providerMetadata
 */
export interface ProviderVolumeData {
  comicvine?: {
    volumeData: EnhancedVolumeData[];
    totalVolumes: number;
    totalChapters: number;
    themes: string[];
    genres: string[];
    creators: {
      authors: string[];
      artists: string[];
    };
    lastFetched: Date | string;
  };
  fandom?: {
    volumeData: EnhancedVolumeData[];
    totalVolumes: number;
    totalChapters: number;
    themes: string[];
    genres: string[];
    creators: {
      authors: string[];
      artists: string[];
    };
    lastFetched: Date | string;
  };
  anilist?: {
    volumeData: EnhancedVolumeData[];
    totalVolumes: number;
    totalChapters: number;
    themes: string[];
    genres: string[];
    lastFetched: Date | string;
  };
}

// ============================================================================
// Metadata Validation
// ============================================================================

export interface MetadataValidationResult {
  isValid: boolean;
  errors: MetadataValidationError[];
  warnings: MetadataValidationWarning[];
  score: number;
}

export interface MetadataValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface MetadataValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

// ============================================================================
// Rankings and External Links
// ============================================================================

export interface RankingInfo {
  rank: number;
  type: string;
  format?: string;
  year?: number;
  season?: string;
  allTime?: boolean;
  context?: string;
}

export interface ExternalLinkInfo {
  site: string;
  url: string;
  type?: 'INFO' | 'STREAMING' | 'SOCIAL';
  language?: string;
  color?: string;
  icon?: string;
  notes?: string;
}

// ============================================================================
// Notification Settings
// ============================================================================

export interface BaseNotificationSettings {
  enabled: boolean;
  events?: NotificationEventType[];
}

export interface EmailSettings extends BaseNotificationSettings {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  from: string;
  to: string[];
}

export interface DiscordSettings extends BaseNotificationSettings {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface SlackSettings extends BaseNotificationSettings {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface TelegramSettings extends BaseNotificationSettings {
  botToken: string;
  chatId: string;
  sendSilently?: boolean;
}

export interface WebhookSettings extends BaseNotificationSettings {
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
}

export interface NotificationEvent {
  type: NotificationEventType;
  payload: unknown;
  timestamp: Date;
  source?: string;
  priority?: Priority;
}