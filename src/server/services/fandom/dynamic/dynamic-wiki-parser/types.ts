/**
 * Dynamic Wiki Parser - Types Module
 *
 * Core type definitions for the dynamic wiki parsing system.
 * These types support structure analysis and content extraction.
 *
 * Extracted from: DynamicWikiParser.ts
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Types of page structures that can be detected
 */
export enum StructureType {
  TABLE_BASED = 'table_based',
  TABBED_INTERFACE = 'tabbed_interface',
  DEFINITION_LIST = 'definition_list',
  GALLERY_BASED = 'gallery_based',
  CATEGORY_PAGE = 'category_page',
  COLLAPSIBLE_SECTIONS = 'collapsible_sections',
  HYBRID = 'hybrid',
  UNKNOWN = 'unknown'
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Page structure analysis result
 */
export interface PageStructure {
  type: StructureType;
  confidence: number;
  selectors: DynamicSelectors;
  patterns: ContentPatterns;
  metadata: StructureMetadata;
}

/**
 * Dynamic selectors for content extraction
 */
export interface DynamicSelectors {
  content: SelectorStrategy[];
  fallbacks: SelectorStrategy[];
  contextual: Map<string, SelectorStrategy[]>;
}

/**
 * Strategy for selecting content elements
 */
export interface SelectorStrategy {
  selector: string;
  type: 'css' | 'xpath' | 'regex' | 'semantic';
  priority: number;
  confidence: number;
  extractionMethod: 'text' | 'html' | 'attr' | 'children';
  attribute?: string;
}

/**
 * Patterns for content matching
 */
export interface ContentPatterns {
  volumePattern?: RegExp;
  chapterPattern?: RegExp;
  datePattern?: RegExp;
  numberPattern?: RegExp;
  linkPattern?: RegExp;
}

/**
 * Metadata about page structure
 */
export interface StructureMetadata {
  hasVolumes: boolean;
  hasChapters: boolean;
  hasTabs: boolean;
  hasCollapsibles: boolean;
  hasGallery: boolean;
  hasInfobox: boolean;
  tableCount: number;
  listCount: number;
  linkDensity: number;
}

// ============================================================================
// Data Interfaces
// ============================================================================

/**
 * Wiki page representation
 */
export interface WikiPage {
  url: string;
  title: string;
  html: string;
  structure?: PageStructure;
}

/**
 * Extracted data result
 */
export interface ExtractedData {
  success: boolean;
  type: 'manga' | 'volumes' | 'chapters' | 'character';
  data: unknown;
  confidence: number;
  source: string;
  extractionMethod: string;
  errors?: string[];
}

/**
 * Volume data structure
 */
export interface VolumeData {
  number: number;
  title: string;
  url?: string;
  isbn?: string;
  releaseDate?: string;
  coverImage?: string;
  description?: string;
  /** Volume page count from Fandom infobox [data-source="pages"] */
  pageCount?: number;
  chapters: ChapterData[];
}

/**
 * Chapter data structure
 */
export interface ChapterData {
  number: string;
  title: string;
  url?: string;
  volume?: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for Record types
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard for VolumeData
 */
export function isVolumeData(value: unknown): value is VolumeData {
  return (
    isRecord(value) &&
    typeof value['number'] === 'number' &&
    typeof value['title'] === 'string' &&
    Array.isArray(value['chapters'])
  );
}

/**
 * Type guard for ChapterData
 */
export function isChapterData(value: unknown): value is ChapterData {
  return (
    isRecord(value) &&
    (typeof value['number'] === 'string' || typeof value['number'] === 'number') &&
    typeof value['title'] === 'string'
  );
}
