/**
 * MangaDex Integration Types
 *
 * Type definitions for MangaDex API integration with Mugiwara-Kaizoku.
 * These types are based on MangaDex API v5.13.1
 *
 * @module server/services/mangadex/types
 */

import type { SearchResult } from '@/server/services/search/types';

// ==================== Core MangaDex Types ====================

/** UUID string type for all MangaDex IDs */
export type UUID = string;

/** ISO 639-1 language code */
export type LanguageCode = string;

/** Content rating categories */
export type ContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic';

/** Manga publication status */
export type PublicationStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled';

/** Publication demographic */
export type PublicationDemographic = 'shounen' | 'shoujo' | 'josei' | 'seinen' | 'none';

/** Tag grouping categories */
export type TagGroup = 'genre' | 'theme' | 'format' | 'content' | 'demographic';

/** Relationship types */
export type RelationshipType =
  | 'manga'
  | 'chapter'
  | 'cover_art'
  | 'author'
  | 'artist'
  | 'scanlation_group'
  | 'tag'
  | 'user'
  | 'custom_list'
  | 'creator';

/** Sort order */
export type SortOrder = 'asc' | 'desc';

/** Tag inclusion/exclusion modes */
export type TagMode = 'AND' | 'OR';

// ==================== Entity Types ====================

/** Generic relationship structure */
export interface MangaDexRelationship {
  id: UUID;
  type: RelationshipType;
  related?: string;
  attributes?: Record<string, unknown>;
}

/** Title in multiple languages */
export type LocalizedString = Record<LanguageCode, string>;

/** Manga title information */
export interface MangaTitle {
  en?: string;
  ja?: string;
  'ja-ro'?: string;
  ko?: string;
  'ko-ro'?: string;
  zh?: string;
  'zh-ro'?: string;
  [key: string]: string | undefined;
}

/** Manga description in multiple languages */
export interface MangaDescription {
  en?: string;
  ja?: string;
  ko?: string;
  zh?: string;
  [key: string]: string | undefined;
}

/** External links for manga */
export interface MangaDexExternalLinks {
  al?: string;
  ap?: string;
  bw?: string;
  kt?: string;
  mu?: string;
  amz?: string;
  ebj?: string;
  mal?: string;
  raw?: string;
  engtl?: string;
  [key: string]: string | undefined;
}

/** Tag attributes */
export interface TagAttributes {
  name: Record<LanguageCode, string>;
  description: Record<LanguageCode, string>;
  group: TagGroup;
  version: number;
}

/** Tag entity */
export interface MangaDexTag {
  id: UUID;
  type: 'tag';
  attributes: TagAttributes;
  relationships: MangaDexRelationship[];
}

/** Manga attributes */
export interface MangaAttributes {
  title: MangaTitle;
  altTitles: MangaTitle[];
  description: MangaDescription;
  isLocked: boolean;
  links: MangaDexExternalLinks | null;
  originalLanguage: LanguageCode;
  lastVolume?: string;
  lastChapter?: string;
  publicationDemographic?: PublicationDemographic;
  status: PublicationStatus;
  year?: number;
  contentRating: ContentRating;
  tags: MangaDexTag[];
  state: 'published' | 'draft' | 'rejected';
  chapterNumbersResetOnNewVolume: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  availableTranslatedLanguages: LanguageCode[];
  latestUploadedChapter?: UUID;
}

/** Manga entity */
export interface MangaDexManga {
  id: UUID;
  type: 'manga';
  attributes: MangaAttributes;
  relationships: MangaDexRelationship[];
}

/** Chapter attributes */
export interface ChapterAttributes {
  title?: string;
  volume?: string;
  chapter?: string;
  pages: number;
  translatedLanguage: LanguageCode;
  uploader: UUID;
  externalUrl?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishAt: string;
  readableAt: string;
}

/** Chapter entity */
export interface MangaDexChapter {
  id: UUID;
  type: 'chapter';
  attributes: ChapterAttributes;
  relationships: MangaDexRelationship[];
}

/** Cover art attributes */
export interface CoverArtAttributes {
  volume?: string;
  fileName: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Cover art entity */
export interface MangaDexCoverArt {
  id: UUID;
  type: 'cover_art';
  attributes: CoverArtAttributes;
  relationships: MangaDexRelationship[];
}

/** Author/Artist attributes */
export interface AuthorAttributes {
  name: string;
  imageUrl?: string;
  biography: Record<LanguageCode, string>;
  twitter?: string;
  pixiv?: string;
  website?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Author entity */
export interface MangaDexAuthor {
  id: UUID;
  type: 'author' | 'artist';
  attributes: AuthorAttributes;
  relationships: MangaDexRelationship[];
}

// ==================== Response Types ====================

/** Generic API response wrapper */
export interface MangaDexApiResponse<T> {
  result: 'ok' | 'error';
  response?: string;
  data: T | T[];
  limit?: number;
  offset?: number;
  total?: number;
}

/** Manga list response */
export type MangaListResponse = MangaDexApiResponse<MangaDexManga>;

/** Chapter list response */
export type ChapterListResponse = MangaDexApiResponse<MangaDexChapter>;

/** Cover art list response */
export type CoverArtListResponse = MangaDexApiResponse<MangaDexCoverArt>;

/** Author list response */
export type AuthorListResponse = MangaDexApiResponse<MangaDexAuthor>;

// ==================== Search Parameters ====================

/** Manga search parameters */
export interface MangaSearchParams {
  limit?: number;
  offset?: number;
  title?: string;
  authorOrArtist?: UUID;
  authors?: UUID[];
  artists?: UUID[];
  year?: number | 'none';
  includedTags?: UUID[];
  includedTagsMode?: TagMode;
  excludedTags?: UUID[];
  excludedTagsMode?: TagMode;
  status?: PublicationStatus[];
  originalLanguage?: LanguageCode[];
  excludedOriginalLanguage?: LanguageCode[];
  availableTranslatedLanguage?: LanguageCode[];
  publicationDemographic?: PublicationDemographic[];
  ids?: UUID[];
  contentRating?: ContentRating[];
  createdAtSince?: string;
  updatedAtSince?: string;
  order?: Record<string, SortOrder>;
  includes?: RelationshipType[];
  hasAvailableChapters?: boolean | '0' | '1' | 'true' | 'false';
  group?: UUID;
}

/** Chapter search parameters */
export interface ChapterSearchParams {
  limit?: number;
  offset?: number;
  ids?: UUID[];
  title?: string;
  groups?: UUID[];
  uploader?: UUID;
  manga?: UUID;
  volume?: string | string[];
  chapter?: string | string[];
  translatedLanguage?: LanguageCode[];
  originalLanguage?: LanguageCode[];
  excludedOriginalLanguage?: LanguageCode[];
  contentRating?: ContentRating[];
  excludedGroups?: UUID[];
  excludedUploaders?: UUID[];
  includeFutureUpdates?: '0' | '1';
  createdAtSince?: string;
  updatedAtSince?: string;
  publishAtSince?: string;
  order?: Record<string, SortOrder>;
  includes?: RelationshipType[];
}

// ==================== API Configuration ====================

/** Rate limiting configuration */
export interface RateLimitConfig {
  maxRequests: number;
  perMilliseconds: number;
  retryAfterHeader?: string;
}

/** API configuration */
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  rateLimit?: RateLimitConfig;
  userAgent?: string;
  defaultContentRating?: ContentRating[];
}

// ==================== Application-Specific Types ====================

/**
 * MangaDex-specific search result extending the base SearchResult
 */
export interface MangaDexSearchResult extends Omit<SearchResult, 'type'> {
  /** Type is optional for MangaDex results */
  type?: unknown;
  /** MangaDex UUID */
  mangadexId: string;
  /** Content rating from MangaDex */
  contentRating?: ContentRating;
  /** Target demographic */
  demographic?: PublicationDemographic;
  /** Original publication language */
  originalLanguage?: string;
  /** Languages with available translations */
  availableTranslatedLanguages?: string[];
  /** External links to other platforms */
  links?: MangaDexLinks;
  /** Last chapter number */
  lastChapter?: string;
  /** Last volume number */
  lastVolume?: string;
  /** Tags from MangaDex */
  mangadexTags?: SimpleMangaDexTag[];
}

/**
 * External links to other platforms from MangaDex
 */
export interface MangaDexLinks {
  /** AniList ID */
  al?: string | undefined;
  /** Anime-Planet slug */
  ap?: string | undefined;
  /** Bookwalker.jp URL */
  bw?: string | undefined;
  /** MangaUpdates ID */
  mu?: string | undefined;
  /** Novel Updates URL */
  nu?: string | undefined;
  /** Kitsu ID */
  kt?: string | undefined;
  /** Amazon URL */
  amz?: string | undefined;
  /** eBooKJapan URL */
  ebj?: string | undefined;
  /** MyAnimeList ID */
  mal?: string | undefined;
  /** Raw source URL */
  raw?: string | undefined;
  /** Official English translation URL */
  engtl?: string | undefined;
}

/**
 * Simplified MangaDex tag with group information
 */
export interface SimpleMangaDexTag {
  id: string;
  name: string;
  group: TagGroup;
}

/**
 * MangaDex chapter images response
 */
export interface MangaDexChapterImages {
  /** Base URL for the image server */
  baseUrl: string;
  /** Chapter image data */
  chapter: {
    /** Chapter hash for URL building */
    hash: string;
    /** Full quality image filenames */
    data: string[];
    /** Data saver (compressed) image filenames */
    dataSaver: string[];
  };
}

/**
 * Scanlation group data from MangaDex
 */
export interface MangaDexScanlationGroup {
  id: string;
  name: string;
  description?: string | undefined;
  website?: string | undefined;
  discord?: string | undefined;
  twitter?: string | undefined;
  focusedLanguages: string[];
  isOfficial: boolean;
  isInactive: boolean;
  uploadDelay?: number | undefined;
}

/**
 * MangaDex chapter with full details
 */
export interface MangaDexChapterDetails {
  id: string;
  title?: string;
  volume?: string;
  chapter?: string;
  pages: number;
  translatedLanguage: string;
  publishAt: string;
  readableAt: string;
  scanlationGroups: MangaDexScanlationGroup[];
}

// Configuration types live in `./config-types.ts` to keep this API-types
// module under the 500-line ceiling. Re-exported here for back-compat with
// existing consumers that import them from `./types`.
export type {
  MangaDexRateLimit,
  MangaDexMetadataConfig,
  MangaDexDownloadConfig,
  MangaDexConfig,
} from './config-types';
export {
  DEFAULT_MANGADEX_METADATA_CONFIG,
  DEFAULT_MANGADEX_DOWNLOAD_CONFIG,
  DEFAULT_MANGADEX_CONFIG,
} from './config-types';

/**
 * MangaDex download options
 */
export interface MangaDexDownloadOptions {
  /** Use data saver (compressed) images */
  dataSaver?: boolean;
  /** Preferred scanlation group ID */
  preferredGroupId?: string;
  /** Output format */
  format?: 'cbz' | 'pdf' | 'raw';
  /** Destination path override */
  destinationPath?: string;
}

/**
 * MangaDex download progress event
 */
export interface MangaDexDownloadProgress {
  downloadId: string;
  chapterId: string;
  status: 'downloading' | 'bundling' | 'completed' | 'failed';
  currentPage: number;
  totalPages: number;
  progress: number;
  error?: string;
}

/**
 * Release schedule detection result
 */
export interface MangaDexReleaseSchedule {
  mangaId: string;
  pattern: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'IRREGULAR';
  confidence: number;
  dayOfWeek?: number | undefined;
  averageInterval?: number | undefined;
  lastRelease?: Date | undefined;
  nextExpectedRelease?: Date | undefined;
}

// ==================== Aggregate Types ====================

/**
 * Chapter info within the aggregate response
 * MangaDex aggregate endpoint returns minimal chapter data
 */
export interface MangaDexAggregateChapter {
  /** Chapter number as string (e.g., "1", "1.5", "none" for unnumbered) */
  chapter: string;
  /** Chapter UUID */
  id: UUID;
  /** Additional chapter IDs if multiple uploads exist */
  others?: UUID[];
  /** Total page count */
  count: number;
  /** Whether the chapter is unavailable (e.g., removed or restricted) */
  isUnavailable?: boolean;
}

/**
 * Volume info within the aggregate response
 * Contains nested chapters record keyed by chapter number
 */
export interface MangaDexAggregateVolume {
  /** Volume number as string (e.g., "1", "none" for unnumbered) */
  volume: string;
  /** Count of chapters in this volume */
  count: number;
  /** Chapters keyed by chapter number */
  chapters: Record<string, MangaDexAggregateChapter>;
}

/**
 * Full aggregate API response structure
 * GET /manga/{id}/aggregate returns this format
 */
export interface MangaDexAggregateResponse {
  result: 'ok' | 'error';
  /** Volumes keyed by volume number (e.g., "1", "2", "none") */
  volumes: Record<string, MangaDexAggregateVolume>;
}

/**
 * Transformed volume data for internal use in UI
 * Matches FetchedVolumeData format for consistency
 */
export interface TransformedMangaDexVolume {
  /** Volume number (numeric, or 0 for unnumbered) */
  volumeNumber: number;
  /** Display number for UI */
  number: number;
  /** Volume title (e.g., "Volume 1") */
  title: string;
  /** Number of chapters in this volume */
  chapterCount: number;
  /** Chapter details for this volume */
  chapters: Array<{
    /** Chapter number (numeric, or 0 for unnumbered) */
    chapterNumber: number;
    /** Chapter UUID */
    id: string;
    /** Page count */
    pages: number;
  }>;
}
