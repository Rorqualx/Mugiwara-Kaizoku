/**
 * Metadata Extractor Types
 *
 * Type definitions for extracted metadata structures.
 *
 * Extracted from: MetadataExtractor.ts
 */

import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

/**
 * Helper type for Cheerio elements
 */
export type CheerioElement = Cheerio<AnyNode>;

/**
 * Extracted metadata from various sources (infobox, schema.org, meta tags, content)
 */
export interface ExtractedMetadata {
  // Basic Information
  title?: string;
  alternativeTitles?: string[];
  japaneseTitle?: string;
  romajiTitle?: string;
  englishTitle?: string;
  // Creators
  author?: string[];
  artist?: string[];
  writer?: string[];
  illustrator?: string[];
  originalCreator?: string[];
  // Publication
  publisher?: string;
  englishPublisher?: string;
  japanesePublisher?: string;
  magazine?: string;
  serialization?: string;
  imprint?: string;
  // Demographics & Genres
  demographic?: string;
  genres?: string[];
  themes?: string[];
  tags?: string[];
  // Status & Dates
  status?: 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | 'NOT_YET_RELEASED';
  startDate?: string;
  endDate?: string;
  originalRun?: string;
  // Counts
  volumes?: number;
  chapters?: number;
  episodes?: number;
  // Description
  description?: string;
  synopsis?: string;
  plot?: string;
  // Additional Info
  website?: string;
  isbn?: string[];
  language?: string;
  country?: string;
  rating?: string;
  // Raw data for debugging
  rawInfobox?: Record<string, unknown>;
}

/**
 * Field mapping configuration for extracting metadata from various wiki formats
 */
export interface FieldMapping {
  fields: string[];
  target: keyof ExtractedMetadata;
  processor?: (value: string) => unknown;
  multi?: boolean;
}

/**
 * Options for metadata extraction
 */
export interface MetadataExtractionOptions {
  includeRaw?: boolean;
  preferSchema?: boolean;
  extractPlot?: boolean;
  cleanText?: boolean;
  language?: string;
  // Extended options for tests
  extractSchema?: boolean;
  extractMetaTags?: boolean;
  mergeStrategies?: Record<string, 'override' | 'combine' | 'prefer-first'>;
}
