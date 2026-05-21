/**
 * External API Type Definitions
 * 
 * Type definitions for manga data from external APIs.
 * These types represent the raw data structures returned by various providers.
 */

/**
 * Anilist API Manga structure
 */
export interface ExternalAnilistManga {
  id: number;
  idMal?: number;
  title: {
    romaji: string;
    english?: string | null;
    native: string;
    userPreferred?: string;
  };
  description?: string | null;
  format?: string;
  status?: 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  endDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  };
  chapters?: number | null;
  volumes?: number | null;
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    color?: string;
  };
  bannerImage?: string;
  genres?: string[];
  synonyms?: string[];
  meanScore?: number;
  popularity?: number;
  favourites?: number;
  tags?: Array<{
    id: number;
    name: string;
    description?: string;
    category?: string;
    rank?: number;
    isGeneralSpoiler?: boolean;
    isMediaSpoiler?: boolean;
    isAdult?: boolean;
  }>;
  staff?: {
    nodes?: Array<{
      id: number;
      name: {
        full: string;
        native?: string;
      };
      role?: string;
    }>;
  };
  isAdult?: boolean;
  siteUrl?: string;
  countryOfOrigin?: string;
}

/**
 * Suwayomi/Tachidesk API Manga structure
 */
export interface ExternalSuwayomiManga {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  artist?: string;
  author?: string;
  description?: string;
  genre?: string[];
  status: string;
  thumbnailUrl?: string;
  inLibrary?: boolean;
  source?: string;
  realUrl?: string;
  lastFetchedAt?: string;
  chaptersLastFetchedAt?: string;
  updateStrategy?: string;
  initialized?: boolean;
  chapterCount?: number;
  downloadCount?: number;
  unreadCount?: number;
  lastChapterRead?: {
    id: string;
    url: string;
    name: string;
    uploadDate?: number;
    chapterNumber?: number;
    scanlator?: string;
    mangaId: string;
    read: boolean;
    bookmarked: boolean;
    lastPageRead?: number;
    lastReadAt?: number;
    index?: number;
  };
}

/**
 * MyAnimeList API Manga structure
 */
export interface ExternalMALManga {
  id: number;
  title: string;
  main_picture?: {
    medium?: string;
    large?: string;
  };
  alternative_titles?: {
    synonyms?: string[];
    en?: string;
    ja?: string;
  };
  start_date?: string;
  end_date?: string;
  synopsis?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  num_list_users?: number;
  num_scoring_users?: number;
  nsfw?: 'white' | 'gray' | 'black';
  created_at?: string;
  updated_at?: string;
  media_type?: string;
  status?: 'finished' | 'currently_publishing' | 'not_yet_published' | 'discontinued' | 'on_hiatus';
  genres?: Array<{
    id: number;
    name: string;
  }>;
  my_list_status?: {
    status?: string;
    score?: number;
    num_chapters_read?: number;
    num_volumes_read?: number;
    is_rereading?: boolean;
    updated_at?: string;
  };
  num_volumes?: number;
  num_chapters?: number;
  authors?: Array<{
    node: {
      id: number;
      first_name?: string;
      last_name?: string;
    };
    role?: string;
  }>;
}

/**
 * Kitsu API Manga structure
 */
export interface ExternalKitsuManga {
  id: string;
  type: 'manga';
  links?: {
    self?: string;
  };
  attributes?: {
    createdAt?: string;
    updatedAt?: string;
    slug?: string;
    synopsis?: string;
    description?: string;
    coverImageTopOffset?: number;
    titles?: {
      en?: string;
      en_jp?: string;
      ja_jp?: string;
      en_us?: string;
    };
    canonicalTitle?: string;
    abbreviatedTitles?: string[];
    averageRating?: string;
    ratingFrequencies?: Record<string, string>;
    userCount?: number;
    favoritesCount?: number;
    startDate?: string;
    endDate?: string;
    nextRelease?: string | null;
    popularityRank?: number;
    ratingRank?: number;
    ageRating?: 'G' | 'PG' | 'R' | 'R18';
    ageRatingGuide?: string;
    subtype?: string;
    status?: 'current' | 'finished' | 'tba' | 'unreleased' | 'upcoming';
    tba?: string;
    posterImage?: {
      tiny?: string;
      small?: string;
      medium?: string;
      large?: string;
      original?: string;
    };
    coverImage?: {
      tiny?: string;
      small?: string;
      large?: string;
      original?: string;
    };
    chapterCount?: number;
    volumeCount?: number;
    serialization?: string;
    mangaType?: string;
  };
  relationships?: Record<string, unknown>;
}

/**
 * Generic provider response wrapper
 */
export interface ExternalProviderResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
  };
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
}