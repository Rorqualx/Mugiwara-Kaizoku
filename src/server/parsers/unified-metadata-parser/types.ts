/**
 * Type Definitions for UnifiedMetadataParser
 *
 * Shared type definitions for metadata parsing operations.
 * Extracted from UnifiedMetadataParser.ts for modularity.
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if a value is a Record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Options for configuring metadata parsing behavior
 */
export interface ParseOptions {
  source?: 'fandom' | 'wikipedia' | 'auto';
  followLinks?: boolean;
  maxDepth?: number;
  extractImages?: boolean;
  cleanUrls?: boolean;
}

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Volume information extracted from wiki pages
 */
export interface VolumeInfo {
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  isbn?: string;
  releaseDate?: string;
  pageCount?: number;
  chapters: ChapterInfo[];
}

/**
 * Chapter information extracted from wiki pages
 */
export interface ChapterInfo {
  chapterNumber: string;
  title?: string;
  volumeNumber?: number;
  releaseDate?: string;
  url?: string;
}

/**
 * Extracted metadata from wiki infoboxes and content
 */
export interface ExtractedMetadata {
  author?: string[];
  artist?: string[];
  publisher?: string;
  magazine?: string;
  demographic?: string;
  genres?: string[];
  status?: 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED';
  originalRun?: string;
  volumes?: number;
  chapters?: number;
  alternativeTitles?: string[];
}

/**
 * Parsed table data from wiki pages
 */
export interface TableData {
  type: 'volume' | 'chapter' | 'generic';
  headers: string[];
  rows: string[][];
}

/**
 * Infobox data extracted from wiki pages
 */
export interface InfoboxData {
  [key: string]: string | string[];
}

// ============================================================================
// Output Types
// ============================================================================

/**
 * Complete parsed content from a wiki page
 */
export interface ParsedContent {
  title?: string;
  description?: string;
  coverImage?: string;
  volumes: VolumeInfo[];
  chapters: ChapterInfo[];
  metadata: ExtractedMetadata;
  images: string[];
  tables: TableData[];
  infobox?: InfoboxData;
}

/**
 * UI-formatted content ready for display
 */
export interface UIFormattedContent {
  id: string;
  title: string;
  source: string;
  provider: string;
  cover: string;
  coverImage: string;
  coverUrl: string;
  description: string;
  status: string;
  genres: string[];
  alternativeTitles: string[];
  authors: string[];
  publisher: string;
  volumes: number | null;
  chapters: number | null;
  metadata: Record<string, unknown>;
}
