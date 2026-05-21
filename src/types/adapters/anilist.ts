/**
 * AniList Adapter Types
 */

import type { BaseIntegrationConfig } from '../config.types';

// Define BaseAdapterConfig interface locally for this module
interface BaseAdapterConfig extends BaseIntegrationConfig {
  provider?: string;
  version?: string;
  features?: string[];
  maxRetries?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheDuration?: number;
}
/**
 * AniList configuration
 */
export interface AniListAdapterConfig extends BaseAdapterConfig {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

/**
 * AniList media
 */
export interface AniListMedia {
  id: number;
  idMal?: number;
  title: {
    romaji?: string;
    english?: string;
    native?: string;
    userPreferred?: string;
  };
  type?: 'ANIME' | 'MANGA';
  format?: 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC' | 'MANGA' | 'NOVEL' | 'ONE_SHOT';
  status?: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
  description?: string;
  startDate?: AniListDate;
  endDate?: AniListDate;
  season?: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
  seasonYear?: number;
  seasonInt?: number;
  episodes?: number;
  duration?: number;
  chapters?: number;
  volumes?: number;
  countryOfOrigin?: string;
  isLicensed?: boolean;
  source?: string;
  hashtag?: string;
  trailer?: {
    id?: string;
    site?: string;
    thumbnail?: string;
  };
  updatedAt?: number;
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    color?: string;
  };
  bannerImage?: string;
  genres?: string[];
  synonyms?: string[];
  averageScore?: number;
  meanScore?: number;
  popularity?: number;
  isLocked?: boolean;
  trending?: number;
  favourites?: number;
  tags?: AniListTag[];
  relations?: {
    edges?: AniListMediaEdge[];
    nodes?: AniListMedia[];
    pageInfo?: PageInfo;
  };
  characters?: {
    edges?: AniListCharacterEdge[];
    nodes?: AniListCharacter[];
    pageInfo?: PageInfo;
  };
  staff?: {
    edges?: AniListStaffEdge[];
    nodes?: AniListStaff[];
    pageInfo?: PageInfo;
  };
  studios?: {
    edges?: AniListStudioEdge[];
    nodes?: AniListStudio[];
    pageInfo?: PageInfo;
  };
  isFavourite?: boolean;
  isAdult?: boolean;
  nextAiringEpisode?: {
    id?: number;
    airingAt?: number;
    timeUntilAiring?: number;
    episode?: number;
    mediaId?: number;
  };
  airingSchedule?: {
    edges?: AniListAiringScheduleEdge[];
    nodes?: AniListAiringSchedule[];
    pageInfo?: PageInfo;
  };
  trends?: {
    edges?: AniListMediaTrendEdge[];
    nodes?: AniListMediaTrend[];
    pageInfo?: PageInfo;
  };
  externalLinks?: AniListExternalLink[];
  streamingEpisodes?: AniListStreamingEpisode[];
  rankings?: AniListMediaRank[];
  mediaListEntry?: AniListMediaListEntry;
  reviews?: {
    edges?: AniListReviewEdge[];
    nodes?: AniListReview[];
    pageInfo?: PageInfo;
  };
  recommendations?: {
    edges?: AniListRecommendationEdge[];
    nodes?: AniListRecommendation[];
    pageInfo?: PageInfo;
  };
  siteUrl?: string;
  autoCreateForumThread?: boolean;
  isRecommendationBlocked?: boolean;
  modNotes?: string;
}

/**
 * AniList date
 */
export interface AniListDate {
  year?: number;
  month?: number;
  day?: number;
}

/**
 * AniList tag
 */
export interface AniListTag {
  id?: number;
  name?: string;
  description?: string;
  category?: string;
  rank?: number;
  isGeneralSpoiler?: boolean;
  isMediaSpoiler?: boolean;
  isAdult?: boolean;
}

/**
 * AniList character
 */
export interface AniListCharacter {
  id?: number;
  name?: {
    first?: string;
    last?: string;
    full?: string;
    native?: string;
    alternative?: string[];
  };
  image?: {
    large?: string;
    medium?: string;
  };
  description?: string;
  isFavourite?: boolean;
  siteUrl?: string;
  favourites?: number;
}

/**
 * AniList staff
 */
export interface AniListStaff {
  id?: number;
  name?: {
    first?: string;
    last?: string;
    full?: string;
    native?: string;
  };
  language?: string;
  image?: {
    large?: string;
    medium?: string;
  };
  description?: string;
  isFavourite?: boolean;
  siteUrl?: string;
  favourites?: number;
}

/**
 * Edge types
 */
export interface AniListMediaEdge {
  id?: number;
  relationType?: string;
  node?: AniListMedia;
}

export interface AniListCharacterEdge {
  id?: number;
  role?: string;
  node?: AniListCharacter;
}

export interface AniListStaffEdge {
  id?: number;
  role?: string;
  node?: AniListStaff;
}

export interface AniListStudioEdge {
  id?: number;
  isMain?: boolean;
  node?: AniListStudio;
}

export interface AniListAiringScheduleEdge {
  id?: number;
  node?: AniListAiringSchedule;
}

export interface AniListMediaTrendEdge {
  node?: AniListMediaTrend;
}

export interface AniListReviewEdge {
  node?: AniListReview;
}

export interface AniListRecommendationEdge {
  node?: AniListRecommendation;
}

/**
 * Other types
 */
export interface AniListStudio {
  id?: number;
  name?: string;
  isAnimationStudio?: boolean;
  siteUrl?: string;
  isFavourite?: boolean;
  favourites?: number;
}

export interface AniListAiringSchedule {
  id?: number;
  airingAt?: number;
  timeUntilAiring?: number;
  episode?: number;
  mediaId?: number;
}

export interface AniListMediaTrend {
  mediaId?: number;
  date?: number;
  trending?: number;
  averageScore?: number;
  popularity?: number;
  episode?: number;
  releasing?: boolean;
  inProgress?: number;
  media?: AniListMedia;
}

export interface AniListExternalLink {
  id?: number;
  url?: string;
  site?: string;
  siteId?: number;
  type?: string;
  language?: string;
  color?: string;
  icon?: string;
}

export interface AniListStreamingEpisode {
  title?: string;
  thumbnail?: string;
  url?: string;
  site?: string;
}

export interface AniListMediaRank {
  id?: number;
  rank?: number;
  type?: string;
  format?: string;
  year?: number;
  season?: string;
  allTime?: boolean;
  context?: string;
}

export interface AniListMediaListEntry {
  id?: number;
  mediaId?: number;
  status?: string;
  score?: number;
  progress?: number;
  progressVolumes?: number;
  repeat?: number;
  priority?: number;
  private?: boolean;
  notes?: string;
  hiddenFromStatusLists?: boolean;
  customLists?: unknown;
  startedAt?: AniListDate;
  completedAt?: AniListDate;
  updatedAt?: number;
  createdAt?: number;
}

export interface AniListReview {
  id?: number;
  userId?: number;
  mediaId?: number;
  mediaType?: string;
  summary?: string;
  body?: string;
  rating?: number;
  ratingAmount?: number;
  userRating?: string;
  score?: number;
  private?: boolean;
  siteUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AniListRecommendation {
  id?: number;
  rating?: number;
  userRating?: string;
  media?: AniListMedia;
  mediaRecommendation?: AniListMedia;
}

export interface PageInfo {
  total?: number;
  perPage?: number;
  currentPage?: number;
  lastPage?: number;
  hasNextPage?: boolean;
}

/**
 * AniList API response
 */
export interface AniListApiResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    status?: number;
    locations?: Array<{
      line: number;
      column: number;
    }>;
  }>;
}

/**
 * AniList adapter instance config
 */
export interface AniListConfig extends AniListAdapterConfig {
  id: string;
  name: string;
}
