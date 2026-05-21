/**
 * WikiContentScraper Types Module
 *
 * Shared type definitions and interfaces for wiki content scraping.
 * All scraper modules import from this foundation module.
 *
 * Extracted from: WikiContentScraper.ts (lines 15-46)
 *
 * Fixes:
 * - Removes unused ExtractedData import (no-unused-vars)
 * - Adds context types to fix max-params violations
 */

// Import dependencies
import type { WikiPage as WikiPageType } from '../DynamicWikiParser';
import type { VolumeInfo as VolumeInfoType, ChapterInfo as ChapterInfoType } from '../WikiDataConverter';
import type { WikiMetadata as WikiMetadataType } from '../WikiMetadataExtractor';
import type { CheerioAPI } from 'cheerio';
import type * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

// Import and re-export types from other modules (FIXED - removed unused ExtractedData)

export type VolumeInfo = VolumeInfoType;
export type ChapterInfo = ChapterInfoType;
export type WikiMetadata = WikiMetadataType;
export type WikiPage = WikiPageType;

// ============================================================================
// Main Scraping Interfaces
// ============================================================================

/**
 * Result of wiki content scraping operation
 */
export interface ScrapingResult {
  success: boolean;
  mainPageUrl: string;
  volumesPageUrl?: string;
  volumes: VolumeInfo[];
  chapters: ChapterInfo[];
  totalVolumes: number;
  totalChapters: number;
  metadata?: WikiMetadata;
  gallery?: unknown[];
  errors?: string[];
}

/**
 * Options for configuring wiki scraping behavior
 */
export interface ScrapingOptions {
  maxDepth?: number;
  followLinks?: boolean;
  extractSummaries?: boolean;
  cacheResults?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

// ============================================================================
// Parameter Context Types (NEW - for max-params fix)
// ============================================================================

/**
 * Context object for volume extraction
 * Reduces extractVolumeFromLink from 6 params to 2 params
 */
export interface VolumeExtractionContext {
  $: CheerioAPI;
  $link: cheerio.Cheerio<Element>;
  text: string;
  href: string;
  pageUrl: string;
}

/**
 * Context object for chapter extraction
 * Reduces extractChapterFromLink from 7 params to 2 params
 */
export interface ChapterExtractionContext extends VolumeExtractionContext {
  volumes: VolumeInfo[];
}

/**
 * Result of chapter enrichment operation
 */
export interface ChapterEnrichmentResult {
  chapterNumber: string | number;
  details: Partial<ChapterInfo>;
}

/**
 * Result of volume cover enrichment operation
 */
export interface VolumeEnrichmentResult {
  volumeNumber: number;
  updates: Partial<VolumeInfo>;
}
