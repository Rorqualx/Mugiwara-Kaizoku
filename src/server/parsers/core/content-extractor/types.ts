/**
 * Content Extractor Type Definitions
 *
 * All type definitions and interfaces for the content extraction system.
 * Foundation module with no dependencies on implementation code.
 *
 * Extracted from: ContentExtractor.ts (lines 1-165)
 * Date: 2025-11-21
 */

import type { DetectedFormat } from '@/server/parsers/core/FormatDetector';
import type { ExtractedImage } from '@/server/parsers/extractors/ImageExtractor';
import type { ExtractedMetadata } from '@/server/parsers/extractors/metadata-extractor/types';
import type { TableData } from '@/server/parsers/extractors/table-extractor/types';

import type { CheerioAPI } from 'cheerio';

/**
 * Main content extraction result
 * Contains all extracted data from a web page
 */
export interface ExtractedContent {
  format: DetectedFormat;
  metadata: ExtractedMetadata;
  tables: TableData[];
  images: ExtractedImage[];
  volumes: VolumeData[];
  chapters: ChapterData[];
  links: ExtractedLink[] | ExtractedLinks;
  raw?: {
    html?: string;
    text?: string;
  };

  // Extended properties for comprehensive extraction
  text?: string;
  mergedData?: Record<string, unknown>;
  languages?: string[];
  galleries?: Gallery[];
  storyArcs?: StoryArc[];
  tabbedContent?: TabbedContent[];
  conflicts?: Conflict[];
  validation?: ValidationResult;
  custom?: Record<string, unknown>;
  errors?: Error[];
}

/**
 * Extended link structure that supports both array and categorized format
 */
export interface ExtractedLinks {
  internal?: ExtractedLink[];
  external?: ExtractedLink[];
  chapters?: ExtractedLink[];
  volumes?: ExtractedLink[];
}

/**
 * Gallery interface for image collections
 */
export interface Gallery {
  title?: string;
  images: ExtractedImage[];
  items?: Array<{ title?: string; image?: string; url?: string }>; // For test compatibility - gallery items
  type?: 'volume' | 'character' | 'promotional' | 'other';
}

/**
 * Story arc interface
 */
export interface StoryArc {
  name: string;
  startChapter?: string;
  endChapter?: string;
  chapters?: ChapterData[]; // For test compatibility
  description?: string;
}

/**
 * Tabbed content interface
 */
export interface TabbedContent {
  tabName: string;
  content: unknown;
  type?: string;
}

/**
 * Conflict interface for data conflicts
 */
export interface Conflict {
  field: string;
  values: unknown[];
  resolution?: unknown;
  source?: string[];
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  valid?: boolean; // Alias for tests
  errors?: string[];
  warnings?: string[];
  score?: number;
}

/**
 * Volume data structure
 */
export interface VolumeData {
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  isbn?: string;
  releaseDate?: string;
  chapters: ChapterData[];
  source: 'table' | 'gallery' | 'inferred';
}

/**
 * Chapter data structure
 */
export interface ChapterData {
  chapterNumber: string;
  title?: string;
  volumeNumber?: number;
  releaseDate?: string;
  url?: string;
  source: 'table' | 'list' | 'inferred';
}

/**
 * Individual link structure
 */
export interface ExtractedLink {
  url: string;
  text: string;
  type: 'chapter' | 'volume' | 'related' | 'external' | 'unknown';
  context?: string;
}

/**
 * Content extraction options configuration
 */
export interface ContentExtractionOptions {
  // Format detection
  autoDetectFormat?: boolean;
  formatHint?: 'fandom' | 'wikipedia' | 'generic';

  // Extraction options
  extractTables?: boolean;
  extractImages?: boolean;
  extractMetadata?: boolean;
  extractLinks?: boolean;
  extractTabbedContent?: boolean;

  // Processing options
  followLinks?: boolean;
  maxDepth?: number;
  mergeData?: boolean;
  parallel?: boolean;
  timeout?: number;
  mergeStrategy?: 'overwrite' | 'combine' | 'prefer-source' | 'prefer-infobox';
  conflictResolution?: 'first' | 'last' | 'manual' | 'vote' | 'prefer-higher';
  calculateConfidence?: boolean;

  // Content sections
  sections?: string[];
  customExtractors?: Record<string, (cheerio: CheerioAPI) => unknown>;

  // Filtering and transformation
  filters?: {
    tables?: (table: TableData) => boolean;
    images?: (image: ExtractedImage) => boolean;
    links?: (link: ExtractedLink) => boolean;
  };
  transformations?: {
    text?: (text: string) => string;
    metadata?: (metadata: ExtractedMetadata) => ExtractedMetadata;
  };

  // Validation
  validation?: {
    required?: string[];
    rules?: Record<string, (value: unknown) => boolean>;
  };

  // Output options
  includeRaw?: boolean;
  cleanText?: boolean;
  normalize?: boolean; // General normalization flag
}
