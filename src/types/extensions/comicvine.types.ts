/**
 * ComicVine Extension Types
 * Provider-specific types for ComicVine integration
 */

import type { SearchResult } from '../search.types';

export interface ComicVineSearchResult extends SearchResult {
  comicvineId: number;
  deck?: string;
  volumeNumber?: number;
  issueNumber?: number;
  publisher?: string;
  startYear?: number;
  countOfIssues?: number;
}

export interface ComicVineVolume {
  id: number;
  name: string;
  count_of_issues?: number;
  description?: string;
  image?: {
    icon_url?: string;
    medium_url?: string;
    screen_url?: string;
    screen_large_url?: string;
    small_url?: string;
    super_url?: string;
    thumb_url?: string;
    tiny_url?: string;
    original_url?: string;
  };
}

export interface ComicVineIssue {
  id: number;
  name?: string;
  issue_number?: string;
  description?: string;
  cover_date?: string;
  store_date?: string;
}