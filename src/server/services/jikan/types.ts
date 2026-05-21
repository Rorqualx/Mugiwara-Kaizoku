/**
 * Jikan API Types
 *
 * Type definitions for the Jikan v4 REST API (MyAnimeList proxy).
 * Jikan is a free, open-source API — no authentication required.
 *
 * @module server/services/jikan/types
 */

/** Raw Jikan API response for manga by ID */
export interface JikanMangaResponse {
  data?: JikanMangaData;
}

/** Entry in Jikan genres / explicit_genres arrays */
export interface JikanGenreEntry {
  mal_id?: number;
  type?: string;
  name?: string;
  url?: string;
}

/** Manga data from Jikan API */
export interface JikanMangaData {
  mal_id?: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  status?: string;
  score?: number | null;
  scored_by?: number | null;
  rank?: number | null;
  popularity?: number | null;
  /** Safe-for-work genres (Action, Adventure, etc.) */
  genres?: JikanGenreEntry[];
  /** Explicit genres (Hentai, Erotica, etc.) — surfaced separately by Jikan */
  explicit_genres?: JikanGenreEntry[];
  /** MAL page URL */
  url?: string;
}

/** Normalized MAL result for internal use */
export interface MALResult {
  malId: number;
  title: string;
  titleEnglish: string | null;
  titleJapanese: string | null;
  chapters: number | null;
  volumes: number | null;
  status: string;
  score: number | null;
  /** Combined genres (safe + explicit) — lowercase names */
  genres: string[];
  /** True when MAL flags this title as hentai/erotica/adult */
  isAdult: boolean;
}

/** MAL status string to normalized status mapping */
export const MAL_STATUS_MAP: Record<string, string> = {
  'Publishing': 'RELEASING',
  'Finished': 'FINISHED',
  'On Hiatus': 'HIATUS',
  'Discontinued': 'CANCELLED',
  'Not yet published': 'NOT_YET_RELEASED',
};
