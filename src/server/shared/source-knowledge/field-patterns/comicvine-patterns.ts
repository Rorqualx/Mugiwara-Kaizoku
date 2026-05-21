/**
 * ComicVine Field Patterns
 *
 * Field-to-label mappings for ComicVine pages.
 * Used by both the ML labeler and parser bridge.
 *
 * @module shared/source-knowledge/field-patterns/comicvine-patterns
 */

import type { FieldPatternMap } from './types';

/**
 * Label text patterns for detecting entity types in ComicVine pages.
 */
export const COMICVINE_LABEL_PATTERNS: FieldPatternMap = {
  author: ['writer', 'writers', 'written by', 'creator', 'created by'],
  artist: ['artist', 'artists', 'penciler', 'pencilers', 'inker', 'inkers'],
  publisher: ['publisher', 'published by'],
  magazine: ['imprint'],
  status: ['status'],
  demographic: ['demographic', 'audience'],
  volumes: ['volumes', 'count of volumes', 'volume count'],
  chapters: ['issues', 'count of issues', 'issue count'],
  chapterNumber: ['issue number', 'issue #'],
  volumeNumber: ['volume number', 'volume #'],
  genre: ['genre', 'genres'],
  releaseDate: ['start year', 'cover date', 'date added'],
  originalRun: [], // ComicVine doesn't typically have original run fields
  altTitle: ['aliases', 'real name'],
  characters: ['characters', 'character credits'],
  isbn: [],
  pages: [],
  title: ['name', 'title'],
};

/**
 * Writer role labels for ComicVine creator extraction.
 */
export const COMICVINE_WRITER_LABELS: readonly string[] = [
  'writer', 'writers', 'written by',
] as const;

/**
 * Artist role labels for ComicVine creator extraction.
 */
export const COMICVINE_ARTIST_LABELS: readonly string[] = [
  'artist', 'artists', 'penciler', 'pencilers',
] as const;
