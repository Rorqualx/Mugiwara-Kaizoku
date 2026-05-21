/**
 * Type definitions for SourceTester components
 */

/**
 * Interface representing a chapter result
 */
export interface ChapterResult {
  /** Chapter title */
  title: string;
  /** Chapter number */
  number: string;
  /** Optional URL to chapter page */
  url?: string;
  /** Optional chapter release date */
  date?: string;
  /** Index for chapter selection with --chapter flag */
  index?: number;
}

/**
 * Interface representing a manga search result
 */
export interface MangaResult {
  /** Manga title */
  title: string;
  /** Optional URL to manga page */
  url?: string;
  /** Optional URL to cover image */
  coverUrl?: string;
  /** Optional manga description */
  description?: string;
  /** Optional array of chapter results */
  chapters?: ChapterResult[];
  /** Optional manga status (e.g., "Ongoing", "Completed") */
  status?: string;
  /** Unique identifier for the manga */
  id: string;
  /** Source provider name */
  source: string;
  /** Index for manga selection with --manga flag */
  index?: number;
}

/**
 * Predefined search queries for quick testing
 */
export const PREDEFINED_QUERIES = [
  { label: 'One Piece', value: 'one piece' },
  { label: 'Naruto', value: 'naruto' },
  { label: 'Dragon Ball', value: 'dragon ball' },
  { label: 'Bleach', value: 'bleach' },
  { label: 'Attack on Titan', value: 'attack on titan' }
] as const;
