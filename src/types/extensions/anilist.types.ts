/**
 * AniList Extension Types
 * Provider-specific types for AniList integration
 */

import type { SearchResult } from '../search.types';

export interface AniListSearchResult extends SearchResult {
  anilistId: number;
  format?: string;
  episodes?: number;
  season?: string;
  seasonYear?: number;
  averageScore?: number;
  popularity?: number;
  isAdult?: boolean;
}

export interface AniListMediaFormat {
  TV: 'TV';
  TV_SHORT: 'TV_SHORT';
  MOVIE: 'MOVIE';
  SPECIAL: 'SPECIAL';
  OVA: 'OVA';
  ONA: 'ONA';
  MUSIC: 'MUSIC';
  MANGA: 'MANGA';
  NOVEL: 'NOVEL';
  ONE_SHOT: 'ONE_SHOT';
}

export interface AniListMediaStatus {
  FINISHED: 'FINISHED';
  RELEASING: 'RELEASING';
  NOT_YET_RELEASED: 'NOT_YET_RELEASED';
  CANCELLED: 'CANCELLED';
  HIATUS: 'HIATUS';
}