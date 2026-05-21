/**
 * Type definitions for ComicVine English Matcher
 */

export interface CSVRow {
  Title: string;
  AniListID: string;
  WikipediaURL: string;
  FandomURL: string;
  ComicVineID: string;
  FandomDiscoveredURLs: string;
  WikipediaDiscoveredURLs: string;
  ComicVineDiscoveredURLs: string;
}

export interface AniListTitles {
  english: string | null;
  romaji: string | null;
  native: string | null;
}

export interface AniListMedia {
  id: number;
  title: AniListTitles;
  synonyms: string[];
}

export interface ComicVineSearchResult {
  id: number;
  name: string;
  publisher?: {
    name?: string;
  };
  site_detail_url?: string;
}

export interface ComicVineAPIResponse {
  status_code: number;
  error: string;
  results: ComicVineSearchResult[];
}

export interface Progress {
  lastIndex: number;
  results: Record<string, ComicVineMatch | null>;
}

export interface ComicVineMatch {
  id: number;
  name: string;
  publisher: string | null;
  url: string | null;
  similarity: number;
  isEnglish: boolean;
}

export interface AlternativeTitles {
  english?: string | null;
  romaji?: string | null;
  synonyms?: string[];
}
