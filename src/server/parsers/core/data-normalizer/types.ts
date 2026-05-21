/**
 * Data Normalizer Types Module
 *
 * Type definitions and interfaces for the data normalization engine.
 * These types are used across all data-normalizer modules.
 *
 * Extracted from: DataNormalizer.ts (lines 1-216)
 */

import { MangaPublicationStatus } from '@prisma/client';

// Re-export for backward compatibility
export type { ExtractedContent } from '@/server/parsers/core/ContentExtractor';

// Re-export from external modules (needed by other modules)
export type { ChapterData, ExtractedLink, VolumeData } from '@/server/parsers/core/ContentExtractor';
export type { ExtractedImage } from '@/server/parsers/extractors/ImageExtractor';
export type { ExtractedMetadata } from '@/server/parsers/extractors/MetadataExtractor';

// Export the Prisma enum for use in other modules
export { MangaPublicationStatus };

export interface NormalizedMangaData {
  // Basic Information
  title: string;
  alternativeTitles?: string[];
  description?: string;
  coverImage?: string;
  bannerImage?: string;
  year?: number;

  // Metadata
  author?: string[];
  artist?: string[];
  publisher?: string;
  magazine?: string;
  demographic?: string;
  format?: string; // MANGA, LIGHT_NOVEL, ONE_SHOT, etc.
  genres?: string[];
  themes?: string[];

  // Status
  status: MangaPublicationStatus;
  startDate?: Date;
  endDate?: Date;

  // Rating/Score
  rating?: number; // Score from 0-10
  popularity?: number;

  // Content
  volumes: NormalizedVolume[];
  chapters: NormalizedChapter[];
  totalVolumes?: number;
  totalChapters?: number;

  // Story Structure (for series/anime adaptations)
  storyArcs?: StoryArc[];
  episodes?: Episode[];
  seasons?: Season[];

  // Extracted Data Structures
  lists?: ExtractedList[];
  tables?: ExtractedTable[];
  references?: Reference[];

  // Additional
  externalLinks?: ExternalLink[];
  images?: NormalizedImage[];

  // Computed/Derived data
  volumeChapterMap?: Record<number, number[]>;
  volumeCovers?: Record<number, string>;
  statistics?: {
    averageChaptersPerVolume?: number;
    averageReleaseInterval?: number;
    totalPages?: number;
    completionPercentage?: number;
    totalChapters?: number;
    totalVolumes?: number;
  };

  // Additional fields for tests
  authors?: string[]; // Alias for author
  quality?: number;
  validation?: {
    isValid?: boolean;
    errors?: string[];
    warnings?: string[];
    score?: number;
  };

  // Source information
  source: SourceInfo;

  // Provider-specific enhanced data (for storing rich metadata from providers)
  providerSpecificFields?: Record<string, unknown>;
}

// New interfaces for the extended properties
export interface StoryArc {
  name: string;
  startChapter?: number;
  endChapter?: number;
  startEpisode?: number;
  endEpisode?: number;
  description?: string;
}

export interface Episode {
  number: number;
  title?: string;
  seasonNumber?: number;
  airDate?: Date;
  chapterAdapted?: number[];
}

export interface Season {
  number: number;
  title?: string;
  episodeCount?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ExtractedList {
  title?: string;
  items: string[];
  type?: 'ordered' | 'unordered';
}

export interface ExtractedTable {
  headers?: string[];
  rows: string[][];
  caption?: string;
}

export interface Reference {
  text: string;
  url?: string;
  type?: 'citation' | 'footnote' | 'external' | 'internal';
}

export interface NormalizedVolume {
  number: number;
  title?: string;
  coverImage?: string;
  isbn?: string;
  releaseDate?: Date;
  chapters: number[];  // Chapter numbers in this volume
  pageCount?: number;
  price?: {
    value: number;
    currency: string;
  };
  // Extended properties for special editions
  isOmnibus?: boolean;
  volumeRange?: { start: number; end: number };
  chapterRange?: { start: number; end: number };
  edition?: string; // Edition type (Limited, Collector, Deluxe, Digital, Omnibus, etc.)
}

export interface NormalizedChapter {
  number: number;
  title?: string;
  volumeNumber?: number;
  releaseDate?: Date;
  pageCount?: number;
  scanlationGroup?: string;
  url?: string;
}

export interface NormalizedImage {
  url: string;
  type: 'cover' | 'gallery' | 'character' | 'other';
  description?: string;
  volumeNumber?: number;
  chapterNumber?: number;
}

export interface ExternalLink {
  url: string;
  type: 'official' | 'wiki' | 'database' | 'store' | 'other';
  label: string;
}

export interface SourceInfo {
  url?: string;
  type: 'fandom' | 'wikipedia' | 'mangadex' | 'anilist' | 'other';
  extractedAt: Date;
  confidence: number;
  parser?: string; // For tests
}

export interface NormalizationOptions {
  // Validation
  validateDates?: boolean;
  validateNumbers?: boolean;
  removeInvalid?: boolean;
  validate?: boolean; // General validation flag
  validateUrls?: boolean;
  required?: string[]; // Required fields for validation

  // Deduplication
  deduplicateChapters?: boolean;
  deduplicateVolumes?: boolean;
  mergeVariants?: boolean;

  // Enhancement
  inferMissingData?: boolean;
  fillGaps?: boolean;

  // Formatting
  sortChapters?: boolean;
  sortVolumes?: boolean;
  normalizeText?: boolean;

  // Processing
  groupChaptersByVolume?: boolean;
  cleanUrls?: boolean;
  calculateStats?: boolean;
  includeSource?: boolean;
  calculateQuality?: boolean;
  normalize?: boolean; // General normalization flag
}
