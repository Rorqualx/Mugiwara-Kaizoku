/**
 * MangaDex API types — extended from original types.ts
 * Reuses all original types + adds statistics, aggregate, and AtHome types
 */

// Re-export everything from original types for backward compat
export type { UUID, LanguageCode, ContentRating, PublicationStatus, PublicationDemographic } from '../../types/common';

// ==================== Relationship Types ====================

export type MangaDexRelationshipType =
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

export type MangaDexSortOrder = 'asc' | 'desc';
export type MangaDexTagMode = 'AND' | 'OR';
export type MangaDexTagGroup = 'genre' | 'theme' | 'format' | 'content' | 'demographic';

// ==================== Error Types ====================

export interface MangaDexApiErrorInfo {
  id: string;
  status: number;
  title: string;
  detail: string;
  context?: unknown;
}

export interface MangaDexErrorResponse {
  result: 'error';
  errors: MangaDexApiErrorInfo[];
}

// ==================== Tag Types ====================

export interface MangaDexTagAttributes {
  name: Record<string, string>;
  description: Record<string, string>;
  group: MangaDexTagGroup;
  version: number;
}

export interface MangaDexTag {
  id: string;
  type: 'tag';
  attributes: MangaDexTagAttributes;
  relationships: MangaDexRelationship[];
}

// ==================== Relationship ====================

export interface MangaDexRelationship {
  id: string;
  type: MangaDexRelationshipType;
  related?: string;
  attributes?: Record<string, unknown>;
}

// ==================== Manga Types ====================

export type LocalizedString = Record<string, string>;

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

export interface MangaDescription {
  en?: string;
  ja?: string;
  ko?: string;
  zh?: string;
  [key: string]: string | undefined;
}

export interface MangaLinks {
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

export interface MangaAttributes {
  title: MangaTitle;
  altTitles: MangaTitle[];
  description: MangaDescription;
  isLocked: boolean;
  links: MangaLinks;
  originalLanguage: string;
  lastVolume?: string;
  lastChapter?: string;
  publicationDemographic?: 'shounen' | 'shoujo' | 'josei' | 'seinen' | 'none';
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  year?: number;
  contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  tags: MangaDexTag[];
  state: 'published' | 'draft' | 'rejected';
  chapterNumbersResetOnNewVolume: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
  availableTranslatedLanguages: string[];
  latestUploadedChapter?: string;
}

export interface Manga {
  id: string;
  type: 'manga';
  attributes: MangaAttributes;
  relationships: MangaDexRelationship[];
}

// ==================== Chapter Types ====================

export interface ChapterAttributes {
  title?: string;
  volume?: string;
  chapter?: string;
  pages: number;
  translatedLanguage: string;
  uploader: string;
  externalUrl?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishAt: string;
  readableAt: string;
}

export interface Chapter {
  id: string;
  type: 'chapter';
  attributes: ChapterAttributes;
  relationships: MangaDexRelationship[];
}

// ==================== Cover Art Types ====================

export interface CoverArtAttributes {
  volume?: string;
  fileName: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CoverArt {
  id: string;
  type: 'cover_art';
  attributes: CoverArtAttributes;
  relationships: MangaDexRelationship[];
}

// ==================== Author Types ====================

export interface AuthorAttributes {
  name: string;
  imageUrl?: string;
  biography: Record<string, string>;
  twitter?: string;
  pixiv?: string;
  melonBook?: string;
  fanBox?: string;
  booth?: string;
  nicoVideo?: string;
  skeb?: string;
  fantia?: string;
  tumblr?: string;
  youtube?: string;
  weibo?: string;
  naver?: string;
  website?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Author {
  id: string;
  type: 'author' | 'artist';
  attributes: AuthorAttributes;
  relationships: MangaDexRelationship[];
}

// ==================== Response Wrappers ====================

export interface MangaDexApiResponse<T> {
  result: 'ok' | 'error';
  response?: string;
  data: T | T[];
  limit?: number;
  offset?: number;
  total?: number;
}

export type MangaListResponse = MangaDexApiResponse<Manga>;
export type ChapterListResponse = MangaDexApiResponse<Chapter>;
export type CoverArtListResponse = MangaDexApiResponse<CoverArt>;
export type AuthorListResponse = MangaDexApiResponse<Author>;

// ==================== Search Parameters ====================

export interface MangaSearchParams {
  limit?: number;
  offset?: number;
  title?: string;
  authorOrArtist?: string;
  authors?: string[];
  artists?: string[];
  year?: number | 'none';
  includedTags?: string[];
  includedTagsMode?: MangaDexTagMode;
  excludedTags?: string[];
  excludedTagsMode?: MangaDexTagMode;
  status?: ('ongoing' | 'completed' | 'hiatus' | 'cancelled')[];
  originalLanguage?: string[];
  excludedOriginalLanguage?: string[];
  availableTranslatedLanguage?: string[];
  publicationDemographic?: ('shounen' | 'shoujo' | 'josei' | 'seinen' | 'none')[];
  ids?: string[];
  contentRating?: ('safe' | 'suggestive' | 'erotica' | 'pornographic')[];
  createdAtSince?: string;
  updatedAtSince?: string;
  order?: Record<string, MangaDexSortOrder>;
  includes?: MangaDexRelationshipType[];
  hasAvailableChapters?: boolean | '0' | '1' | 'true' | 'false';
  hasUnavailableChapters?: boolean | '0' | '1' | 'true' | 'false';
  group?: string;
}

export interface ChapterSearchParams {
  limit?: number;
  offset?: number;
  ids?: string[];
  title?: string;
  groups?: string[];
  uploader?: string;
  manga?: string;
  volume?: string | string[];
  chapter?: string | string[];
  translatedLanguage?: string[];
  originalLanguage?: string[];
  excludedOriginalLanguage?: string[];
  contentRating?: ('safe' | 'suggestive' | 'erotica' | 'pornographic')[];
  excludedGroups?: string[];
  excludedUploaders?: string[];
  includeFutureUpdates?: '0' | '1';
  createdAtSince?: string;
  updatedAtSince?: string;
  publishAtSince?: string;
  order?: Record<string, MangaDexSortOrder>;
  includes?: MangaDexRelationshipType[];
}

// ==================== NEW: Statistics Types ====================

export interface MangaStatisticsRating {
  average?: number;
  bayesian?: number;
  distribution: Record<string, number>;
}

export interface MangaStatistics {
  rating: MangaStatisticsRating;
  follows: number;
  comments?: { repliesCount: number; threadId: number };
}

export interface StatisticsResponse {
  result: 'ok';
  statistics: Record<string, MangaStatistics>;
}

// ==================== NEW: Aggregate Types ====================

export interface AggregateChapter {
  chapter: string;
  id: string;
  others: string[];
  count: number;
}

export interface AggregateVolume {
  volume: string;
  count: number;
  chapters: Record<string, AggregateChapter>;
}

export interface AggregateResponse {
  result: 'ok';
  volumes: Record<string, AggregateVolume>;
}

// ==================== NEW: AtHome Types ====================

export interface AtHomeResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

// ==================== Utility Types ====================

export type SafeParams = Record<
  string,
  string | number | boolean | (string | number)[] | Record<string, string> | undefined
>;

export function isMangaDexErrorResponse(response: unknown): response is MangaDexErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'result' in response &&
    (response as MangaDexErrorResponse).result === 'error'
  );
}

export function isMangaDexSuccessResponse<T>(
  response: unknown
): response is MangaDexApiResponse<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'result' in response &&
    (response as MangaDexApiResponse<T>).result === 'ok'
  );
}
