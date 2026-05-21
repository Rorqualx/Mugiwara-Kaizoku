/**
 * Extensions Index
 *
 * Provider-specific type extensions with explicit exports for tree-shaking.
 */

// AniList specific types
export type {
  AniListSearchResult,
  AniListMediaFormat,
  AniListMediaStatus,
} from './anilist.types';

// ComicVine specific types
export type {
  ComicVineSearchResult,
  ComicVineVolume,
  ComicVineIssue,
} from './comicvine.types';
