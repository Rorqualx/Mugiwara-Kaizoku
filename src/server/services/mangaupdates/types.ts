/**
 * MangaUpdates API Types
 *
 * Type definitions for the MangaUpdates v1 API responses.
 * Covers search results, series details, and nested entities.
 */

// ============================================================================
// Search Types
// ============================================================================

export interface MUSearchResponse {
  total_hits: number;
  page: number;
  per_page: number;
  results: MUSearchHit[];
}

export interface MUSearchHit {
  hit_title: string;
  record: MUSearchRecord;
}

export interface MUSearchRecord {
  series_id: number;
  title: string;
  url: string;
  description: string;
  image: MUImage;
  type: string;
  year: string;
  bayesian_rating: number;
  rating_votes: number;
  genres: MUGenre[];
  latest_chapter: number;
  rank: MURank;
  last_updated: MUTimestamp;
}

// ============================================================================
// Series Detail Types
// ============================================================================

export interface MUSeriesDetails {
  series_id: number;
  title: string;
  url: string;
  associated: MUAssociatedName[];
  description: string;
  image: MUImage;
  type: string;
  year: string;
  bayesian_rating: number;
  rating_votes: number;
  genres: MUGenre[];
  categories: MUCategory[];
  latest_chapter: number;
  forum_id: number;
  status: string;
  licensed: boolean;
  completed: boolean;
  anime: MUAnimeRelation;
  related_series: MURelatedSeries[];
  authors: MUAuthor[];
  publishers: MUPublisher[];
  publications: MUPublication[];
  recommendations: MURecommendation[];
  category_recommendations: MUCategoryRecommendation[];
  rank: MURank;
  last_updated: MUTimestamp;
}

// ============================================================================
// Nested Entity Types
// ============================================================================

export interface MUImage {
  url: MUImageUrl;
  height: number;
  width: number;
}

export interface MUImageUrl {
  original: string;
  thumb: string;
}

export interface MUGenre {
  genre: string;
}

export interface MUCategory {
  series_id: number;
  category: string;
  votes: number;
  votes_plus: number;
  votes_minus: number;
  added_by: number;
}

export interface MUAuthor {
  name: string;
  author_id: number;
  type: string;
}

export interface MUPublisher {
  publisher_name: string;
  publisher_id: number;
  type: string;
  notes: string;
}

export interface MUPublication {
  publication_name: string;
  publisher_name: string;
}

export interface MUAssociatedName {
  title: string;
}

export interface MURelatedSeries {
  relation_id: number;
  relation_type: string;
  related_series_id: number;
  related_series_name: string;
  triggered_by_relation_id: number;
}

export interface MUAnimeRelation {
  start: string;
  end: string;
}

export interface MURecommendation {
  series_name: string;
  series_id: number;
  weight: number;
}

export interface MUCategoryRecommendation {
  series_name: string;
  series_id: number;
  weight: number;
}

export interface MURank {
  position: MURankPosition;
  old_position: MURankPosition;
  lists: MURankLists;
}

export interface MURankPosition {
  week: number;
  month: number;
  three_months: number;
  six_months: number;
  year: number;
}

export interface MURankLists {
  reading: number;
  wish: number;
  complete: number;
  unfinished: number;
  custom: number;
}

export interface MUTimestamp {
  timestamp: number;
  as_rfc3339: string;
  as_string: string;
}

// ============================================================================
// Release Types
// ============================================================================

export interface MUReleaseRecord {
  id: number;
  title: string;
  volume: string | null;
  chapter: string;
  groups: Array<{ name: string; group_id: number; url: string }>;
  release_date: string;
  time_added: MUTimestamp;
}

export interface MUReleaseSearchHit {
  record: MUReleaseRecord;
  metadata?: {
    series: {
      series_id: number;
      title: string;
      url: string;
      last_updated: MUTimestamp;
      admin: { approved: boolean };
    };
  };
}

export interface MUReleaseSearchResponse {
  total_hits: number;
  page: number;
  per_page: number;
  results: MUReleaseSearchHit[];
}
