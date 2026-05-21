/**
 * Fandom Table Parser Types
 *
 * Type definitions for parsing Fandom wiki pages including volumes, chapters,
 * and structure detection.
 *
 * Extracted from: fandomTableParser.ts (lines 12-40)
 */

export interface VolumeData {
  number: number;
  title?: string;
  alternativeTitle?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  releaseDateEn?: string;
  isbn?: string;
  isbnEn?: string;
  /** URL to the individual volume wiki page */
  url?: string;
  chapters?: unknown[];
  galleryImages?: string[];
  /** Volume page count from Fandom infobox [data-source="pages"] */
  pageCount?: number;
}

export interface ChapterData {
  number: number;
  title?: string;
  volume?: number;
  url?: string;
  coverImage?: string;
  /** Chapter synopsis from volume page section */
  summary?: string;
  /** Page count for this chapter (from infobox if available) */
  pageCount?: number;
  /** Release date (inherited from volume when not available per-chapter) */
  releaseDate?: string;
}

export enum WikiStructureType {
  GALLERY_WITH_LISTS = 'gallery_with_lists',
  TABLES_WITH_CHAPTERS = 'tables_with_chapters',
  NAVIGATION_TABLES = 'navigation_tables',
  MIXED_STRUCTURE = 'mixed_structure',
  UNKNOWN = 'unknown'
}
