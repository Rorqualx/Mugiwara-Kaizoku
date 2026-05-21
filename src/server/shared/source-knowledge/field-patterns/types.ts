/**
 * Field Pattern Types
 *
 * Interfaces for field-to-label mappings used across sources.
 *
 * @module shared/source-knowledge/field-patterns/types
 */

/**
 * Maps canonical field names to arrays of label text patterns.
 * Used for detecting which entity type a label refers to.
 */
export interface FieldPatternMap {
  author: string[];
  artist: string[];
  publisher: string[];
  magazine: string[];
  status: string[];
  demographic: string[];
  volumes: string[];
  chapters: string[];
  chapterNumber: string[];
  volumeNumber: string[];
  genre: string[];
  releaseDate: string[];
  originalRun: string[];
  altTitle: string[];
  characters: string[];
  isbn: string[];
  pages: string[];
  title: string[];
}

/**
 * Maps data-source attribute values to canonical field names.
 * Used for portable-infobox extraction where data-source attributes
 * identify the field semantically.
 */
export interface DataSourceMap {
  [dataSourceValue: string]: string;
}

/**
 * Maps label text (lowercase) to canonical field names.
 * Used for label/value pair extraction from infoboxes.
 */
export interface LabelMap {
  [labelText: string]: string;
}
