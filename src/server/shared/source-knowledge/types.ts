/**
 * Shared Source Knowledge Types
 *
 * Core type definitions for the shared source knowledge layer.
 * Used by both the ML bootstrap-labeler and the app parser bridge.
 *
 * @module shared/source-knowledge/types
 */

/**
 * Known source types for manga/anime databases and wikis.
 * Superset of all source types used across the codebase.
 */
export type SourceType =
  | 'fandom'
  | 'wikipedia'
  | 'anilist'
  | 'comicvine'
  | 'mangadex'
  | 'myanimelist'
  | 'unknown';
