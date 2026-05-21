/**
 * Source Selector Types
 *
 * Type definitions for source-specific CSS selectors used in metadata extraction.
 * Canonical location - imported by both ML labeler and app parsers.
 *
 * @module shared/source-knowledge/selectors/types
 */

import type { SourceType } from '../types';

export type { SourceType };

/**
 * CSS selectors for extracting metadata fields from a specific source
 */
export interface SourceSelectors {
  // Core metadata
  title: string[];
  altTitles: string[];
  author: string[];
  artist: string[];
  status: string[];
  genres: string[];
  summary: string[];

  // Publication info
  volumeCount: string[];
  chapterCount: string[];
  publisher: string[];
  magazine: string[];
  demographic: string[];
  releaseDate: string[];

  // Extended fields
  themes: string[];
  tags: string[];
  format: string[];
  characters: string[];
  coverImage: string[];

  // Structural selectors
  infoboxContainer: string[];
  chapterTable: string[];
  volumeTable: string[];
}
