/**
 * Wikipedia Field Patterns
 *
 * Infobox label mappings for Wikipedia pages.
 * Used by both the ML labeler and parser bridge.
 *
 * @module shared/source-knowledge/field-patterns/wikipedia-patterns
 */

import type { FieldPatternMap } from './types';

/**
 * Label text patterns for detecting entity types in Wikipedia infoboxes.
 */
export const WIKIPEDIA_LABEL_PATTERNS: FieldPatternMap = {
  author: ['written by', 'author', 'created by', 'story by'],
  artist: ['illustrated by', 'artist', 'art by'],
  publisher: ['publisher', 'published by', 'english publisher'],
  magazine: ['magazine', 'serialized in', 'serialization', 'original run'],
  status: ['status', 'publication status'],
  demographic: ['demographic', 'target'],
  volumes: ['volumes', 'volume', 'tankobon'],
  chapters: ['chapters', 'chapter', 'episodes'],
  chapterNumber: ['chapter number', 'episode number'],
  volumeNumber: ['volume number', 'volume'],
  genre: ['genre', 'genres'],
  releaseDate: ['published', 'release date', 'first published'],
  originalRun: ['original run', 'run'],
  altTitle: ['japanese', 'romaji', 'native name', 'original name', 'kanji'],
  characters: ['characters'],
  isbn: ['isbn'],
  pages: ['pages'],
  title: ['title', 'name'],
};
