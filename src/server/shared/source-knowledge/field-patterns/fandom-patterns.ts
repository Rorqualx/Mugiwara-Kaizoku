/**
 * Fandom Field Patterns
 *
 * Unified label patterns, data-source maps, and label maps for Fandom wikis.
 * Single source of truth used by both:
 * - ML bootstrap-labeler (source-rules/fandom-rules.ts)
 * - Parser bridge (portable-infobox-extractor.ts)
 * - App parsers (infobox-parser.ts)
 *
 * @module shared/source-knowledge/field-patterns/fandom-patterns
 */

import type { DataSourceMap, FieldPatternMap, LabelMap } from './types';

/**
 * Label text patterns for detecting entity types in Fandom infoboxes.
 * Used by the ML labeler to match label tokens to entity types.
 */
export const FANDOM_LABEL_PATTERNS: FieldPatternMap = {
  author: ['author', 'writer', 'written by', 'created by', 'mangaka'],
  artist: ['artist', 'illustrator', 'illustrated by', 'art by'],
  publisher: ['publisher', 'published by', 'label'],
  magazine: ['magazine', 'serialized', 'serialization', 'published'],
  status: ['status', 'publication status'],
  demographic: ['demographic', 'target audience', 'audience'],
  volumes: ['volumes', 'no. of volumes', 'tankoubon'],
  chapters: ['chapters', 'no. of chapters', 'chapter'],
  chapterNumber: ['chapter number', 'chapter no', 'chapter #'],
  volumeNumber: ['volume number', 'volume no', 'volume #', 'volume'],
  genre: ['genre', 'genres', 'category'],
  releaseDate: ['release', 'published', 'start date', 'date'],
  originalRun: ['original run', 'run'],
  altTitle: ['japanese', 'romaji', 'romaji', 'kanji', 'kana', 'original title', 'native', 'hiragana', 'katakana'],
  characters: ['character', 'characters', 'cast', 'main character'],
  isbn: ['isbn'],
  pages: ['pages', 'page', 'page count'],
  title: ['title', 'name'],
};

/**
 * Maps data-source attribute values to canonical field names.
 * Used by portable-infobox-extractor for data-source based extraction.
 */
export const FANDOM_DATA_SOURCE_MAP: DataSourceMap = {
  'author': 'author',
  'writer': 'author',
  'story': 'author',
  'written_by': 'author',
  'artist': 'artist',
  'illustrator': 'artist',
  'art': 'artist',
  'illustrated_by': 'artist',
  'publisher': 'publisher',
  'magazine': 'magazine',
  'serialized': 'magazine',
  'chapters': 'chapters',
  'volumes': 'volumes',
  'status': 'status',
  'release': 'releaseDate',
  'release_date': 'releaseDate',
  'published': 'releaseDate',
  'genre': 'genres',
  'genres': 'genres',
  'demographic': 'demographic',
  'target': 'demographic',
  'title': 'title',
  'name': 'title',
  'japanese': 'alternativeTitles',
  'romaji': 'alternativeTitles',
  'kanji': 'alternativeTitles',
};

/**
 * Maps label text (lowercase) to canonical field names.
 * Used by portable-infobox-extractor for label/value pair extraction.
 */
export const FANDOM_LABEL_MAP: LabelMap = {
  'author': 'author',
  'writer': 'author',
  'written by': 'author',
  'story by': 'author',
  'story': 'author',
  'author & illustrator': 'author',
  'author/illustrator': 'author',
  'artist': 'artist',
  'illustrator': 'artist',
  'illustrated by': 'artist',
  'art by': 'artist',
  'art': 'artist',
  'publisher': 'publisher',
  'english publisher': 'publisher',
  'magazine': 'magazine',
  'serialized in': 'magazine',
  'serialization': 'magazine',
  'chapters': 'chapters',
  'volumes': 'volumes',
  'status': 'status',
  'original run': 'releaseDate',
  'published': 'releaseDate',
  'release date': 'releaseDate',
  'genre': 'genres',
  'genres': 'genres',
  'demographic': 'demographic',
};

/**
 * Author field keys used by the infobox-parser for looking up
 * author values in extracted infobox data records.
 */
export const FANDOM_AUTHOR_KEYS: readonly string[] = [
  'Author',
  'Author & Illustrator',
  'Author &amp; Illustrator',
  'Author/Illustrator',
  'Written by',
  'Writer',
  'Creator',
  'Created by',
  'Story',
  'Story by',
] as const;

/**
 * Artist field keys used by the infobox-parser.
 */
export const FANDOM_ARTIST_KEYS: readonly string[] = [
  'Illustrated by',
  'Artist',
  'Illustrator',
  'Author & Illustrator',
  'Author &amp; Illustrator',
  'Author/Illustrator',
  'Art',
  'Art by',
] as const;

/**
 * Publisher field keys used by the infobox-parser.
 */
export const FANDOM_PUBLISHER_KEYS: readonly string[] = [
  'Publisher',
  'English publisher',
  'English Publisher',
  'Published by',
  'Publication',
  'English Publication',
  'NA Publisher',
  'US Publisher',
  'Licensed by',
  'English licensed by',
] as const;

/**
 * Magazine field keys used by the infobox-parser.
 */
export const FANDOM_MAGAZINE_KEYS: readonly string[] = [
  'Magazine',
  'Serialized in',
  'Serialization',
  'Published in',
] as const;
