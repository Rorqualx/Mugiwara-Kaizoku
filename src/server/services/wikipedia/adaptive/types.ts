/**
 * Wikipedia Adaptive Parser Types
 *
 * Type definitions for the adaptive Wikipedia parsing system.
 * Provides structured types for page analysis, URL discovery,
 * pattern caching, and parse results.
 *
 * @module wikipedia/adaptive/types
 */

import type { WikipediaMangaData, WikipediaVolume, WikipediaChapter } from '../wikipedia/types';

// ============================================================================
// Page Type Definitions
// ============================================================================

/**
 * Types of Wikipedia pages containing manga data.
 */
export type WikipediaPageType =
  | 'list-page'        // Dedicated List_of_* page
  | 'main-article'     // Main manga article with embedded data
  | 'section-anchor'   // Section within a larger article (#Media, #Manga)
  | 'unknown';

/**
 * Structure types detected in Wikipedia pages.
 */
export enum WikipediaStructureType {
  /** Standard volume table with columns */
  WIKITABLE_VOLUMES = 'wikitable_volumes',
  /** Standard chapter table with columns */
  WIKITABLE_CHAPTERS = 'wikitable_chapters',
  /** Combined volume + chapter table */
  COMBINED_TABLE = 'combined_table',
  /** Data embedded in Media section */
  MEDIA_SECTION = 'media_section',
  /** Data in Publication section */
  PUBLICATION_SECTION = 'publication_section',
  /** Infobox only (no tables) */
  INFOBOX_ONLY = 'infobox_only',
  /** Unknown structure */
  UNKNOWN = 'unknown',
}

/**
 * Parser types for Wikipedia pages.
 */
export type WikipediaParserType =
  | 'list-page'
  | 'wikitable'
  | 'media-section'
  | 'combined'
  | 'infobox-only';

// ============================================================================
// URL Discovery Types
// ============================================================================

/**
 * Result of probing a Wikipedia URL for existence and content quality.
 */
export interface WikipediaUrlProbeResult {
  /** Probed URL */
  url: string;
  /** Whether the page exists */
  exists: boolean;
  /** HTTP status code */
  statusCode: number;
  /** Time taken to probe in ms */
  probeTimeMs: number;
  /** Whether page has volume data indicators */
  hasVolumeData: boolean;
  /** Whether page has chapter data indicators */
  hasChapterData: boolean;
  /** Detected page type */
  pageType: WikipediaPageType;
  /** Page size in bytes (from batch lookup) */
  size?: number;
}

/**
 * Result of URL discovery process.
 */
export interface WikipediaUrlDiscoveryResult {
  /** Primary URL to use for extraction */
  primaryUrl: string | null;
  /** Dedicated List_of_* page URL if found */
  listPageUrl: string | null;
  /** Main article URL */
  mainArticleUrl: string | null;
  /** Section anchor if applicable (e.g., #Media) */
  sectionAnchor: string | null;
  /** All URLs tried during discovery */
  triedUrls: string[];
  /** Status codes for tried URLs */
  statusCodes: Map<string, number>;
  /** Detected page type */
  pageType: WikipediaPageType;
  /** Time taken for discovery in ms */
  durationMs: number;
}

// ============================================================================
// Static Analysis Types
// ============================================================================

/**
 * Analysis of wikitable structure.
 */
export interface WikitableAnalysis {
  /** Total number of wikitables */
  totalCount: number;
  /** Tables with volume data */
  volumeTables: number;
  /** Tables with chapter data */
  chapterTables: number;
  /** Tables with combined volume+chapter data */
  combinedTables: number;
  /** Detected column headers */
  columnHeaders: string[][];
  /** Whether tables have sortable columns */
  hasSortable: boolean;
}

/**
 * Analysis of page sections.
 */
export interface SectionAnalysis {
  /** All section headers found */
  headers: string[];
  /** Whether page has #Manga section */
  hasMangaSection: boolean;
  /** Whether page has #Media section */
  hasMediaSection: boolean;
  /** Whether page has #Publication section */
  hasPublicationSection: boolean;
  /** Whether page has #Volumes section */
  hasVolumesSection: boolean;
  /** Whether page has #Chapters section */
  hasChaptersSection: boolean;
  /** Section IDs that contain relevant data */
  relevantSectionIds: string[];
}

/**
 * Analysis of infobox structure.
 */
export interface InfoboxAnalysis {
  /** Whether page has an infobox */
  hasInfobox: boolean;
  /** Infobox class (e.g., 'infobox', 'infobox-manga') */
  infoboxClass: string | null;
  /** Fields found in infobox */
  fields: string[];
  /** Whether infobox has cover image */
  hasCoverImage: boolean;
  /** Whether infobox has volume count */
  hasVolumeCount: boolean;
  /** Whether infobox has chapter count */
  hasChapterCount: boolean;
}

/**
 * Analysis of links in the page.
 */
export interface LinkAnalysis {
  /** Number of volume-related links */
  volumeLinks: number;
  /** Number of chapter-related links */
  chapterLinks: number;
  /** Whether page links to a List_of_* page */
  linksToListPage: boolean;
  /** URL of linked list page if found */
  listPageUrl: string | null;
  /** Example link patterns found */
  linkPatterns: string[];
}

/**
 * Complete static analysis result.
 */
export interface WikipediaStructureAnalysis {
  /** Detected page type */
  pageType: WikipediaPageType;
  /** Detected structure type */
  structureType: WikipediaStructureType;
  /** Wikitable analysis */
  tables: WikitableAnalysis;
  /** Section analysis */
  sections: SectionAnalysis;
  /** Infobox analysis */
  infobox: InfoboxAnalysis;
  /** Link analysis */
  links: LinkAnalysis;
  /** Recommended parser based on analysis */
  recommendedParser: WikipediaParserType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for recommendation */
  recommendationReason: string;
  /** Time taken for analysis in ms */
  analysisTimeMs: number;
}

// ============================================================================
// Pattern Cache Types
// ============================================================================

/**
 * Cached pattern for Wikipedia parsing.
 */
export interface WikipediaCachedPattern {
  /** Original title/query used */
  title: string;
  /** Normalized title for matching */
  normalizedTitle: string;
  /** Path to dedicated list page (e.g., "List_of_Tokyo_Ghoul_chapters") */
  listPagePath: string | null;
  /** Path to main article page (e.g., "Tokyo_Ghoul") */
  mainPagePath: string | null;
  /** Detected page type */
  pageType: WikipediaPageType;
  /** Detected structure type */
  structureType: WikipediaStructureType;
  /** Recommended parser */
  recommendedParser: WikipediaParserType;
  /** When pattern was first discovered */
  discoveredAt: Date;
  /** When pattern was last used */
  lastUsedAt: Date;
  /** Number of successful extractions */
  successCount: number;
  /** Number of failed extractions */
  failureCount: number;

  // ============================================================================
  // Extended Cache Fields (Phase 2 Optimization)
  // ============================================================================

  /** Cached structure analysis (avoids re-analysis on cache hit) */
  analysis?: WikipediaStructureAnalysis;
  /** Cached extracted volumes (avoids re-extraction on cache hit) */
  extractedVolumes?: WikipediaVolume[];
  /** Cached chapter count */
  extractedChapters?: number;
  /** Cached metadata fields (partial, for quick access) */
  extractedMetadata?: Partial<WikipediaMangaData>;
  /** URL existence map (avoids re-probing known 404s) */
  urlExistsMap?: Record<string, boolean>;
  /** When extraction data was last fetched */
  lastFetchedAt?: Date;
  /** Page size in bytes (for quick content validation) */
  pageSize?: number;
}

/**
 * Cache configuration options.
 */
export interface PatternCacheConfig {
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Maximum number of cached patterns */
  maxSize: number;
  /** Number of failures before invalidating pattern */
  failureThreshold: number;
}

/**
 * Cache statistics.
 */
export interface PatternCacheStats {
  /** Current cache size */
  size: number;
  /** Total successful cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Number of expired entries removed */
  expiredCount: number;
  /** Number of entries evicted due to size limit */
  evictedCount: number;
}

// ============================================================================
// Parser Options & Results
// ============================================================================

/**
 * Options for Wikipedia adaptive parser.
 */
export interface WikipediaParserOptions {
  /** Timeout for URL probing in ms */
  probeTimeoutMs: number;
  /** Timeout for content extraction in ms */
  extractionTimeoutMs: number;
  /** Whether to use pattern cache */
  useCache: boolean;
  /** Wikipedia language code */
  language: string;
  /** Whether to prefer List_of_* pages over main articles */
  preferListPage: boolean;
  /** Whether to extract detailed chapter information */
  extractChapters: boolean;
  /** Whether to fetch main article metadata when using list page */
  enrichWithMainArticle: boolean;
  /** Custom user agent string */
  userAgent?: string;
}

/**
 * Default parser options.
 */
export const DEFAULT_WIKIPEDIA_OPTIONS: WikipediaParserOptions = {
  probeTimeoutMs: 5000,
  extractionTimeoutMs: 30000,
  useCache: true,
  language: 'en',
  preferListPage: true,
  extractChapters: true,
  enrichWithMainArticle: true,
};

/**
 * Result of Wikipedia parse operation.
 */
export interface WikipediaParseResult {
  /** Whether extraction was successful */
  success: boolean;
  /** Extracted manga data */
  data: WikipediaMangaData | null;
  /** Extracted volumes */
  volumes: WikipediaVolume[];
  /** Extracted chapters */
  chapters: WikipediaChapter[];
  /** Error message if failed */
  error: string | null;
  /** Detected page type */
  pageType: WikipediaPageType;
  /** Detected structure type */
  structureType: WikipediaStructureType;
  /** URL that was parsed */
  parsedUrl: string;
  /** List page URL if used */
  listPageUrl: string | null;
  /** Main article URL if used */
  mainArticleUrl: string | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Time taken for extraction in ms */
  durationMs: number;
  /** Whether result came from cache */
  usedCache: boolean;
}

// ============================================================================
// Media Section Types
// ============================================================================

/**
 * Data extracted from Media/Manga section.
 */
export interface MediaSectionData {
  /** Volume count extracted from text */
  volumeCount: number | null;
  /** Chapter count extracted from text */
  chapterCount: number | null;
  /** Publication start date */
  startDate: string | null;
  /** Publication end date */
  endDate: string | null;
  /** Publisher name */
  publisher: string | null;
  /** Magazine name */
  magazine: string | null;
  /** Status (ongoing, completed, etc.) */
  status: string | null;
  /** Volumes extracted from inline table */
  volumes: WikipediaVolume[];
  /** Chapters extracted from inline table */
  chapters: WikipediaChapter[];
  /** Raw section text for debugging */
  rawText: string;
}

/**
 * Publication info extracted from section.
 */
export interface PublicationInfo {
  /** Volume count */
  volumes: number | null;
  /** Chapter count */
  chapters: number | null;
  /** Start date */
  startDate: string | null;
  /** End date */
  endDate: string | null;
  /** Publisher */
  publisher: string | null;
  /** Magazine */
  magazine: string | null;
  /** Demographic */
  demographic: string | null;
  /** Status */
  status: string | null;
}

// ============================================================================
// URL Pattern Types
// ============================================================================

/**
 * URL pattern for Wikipedia page discovery.
 */
export interface UrlPattern {
  /** Pattern template (e.g., "List_of_{TITLE}_chapters") */
  template: string;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Expected page type */
  expectedPageType: WikipediaPageType;
  /** Whether this pattern requires URL encoding */
  requiresEncoding: boolean;
}

/**
 * Title variation for URL discovery.
 */
export interface TitleVariation {
  /** Variation of the title */
  title: string;
  /** Type of variation (original, encoded, normalized, etc.) */
  type: 'original' | 'encoded' | 'normalized' | 'parenthetical';
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: PatternCacheConfig = {
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 500,
  failureThreshold: 3,
};

/**
 * Wikipedia API base URL.
 */
export const WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/w/api.php';

/**
 * Wikipedia article base URL.
 */
export const WIKIPEDIA_ARTICLE_BASE = 'https://en.wikipedia.org/wiki/';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for WikipediaCachedPattern.
 */
export function isCachedPattern(obj: unknown): obj is WikipediaCachedPattern {
  if (typeof obj !== 'object' || obj === null) return false;
  const pattern = obj as Partial<WikipediaCachedPattern>;
  return (
    typeof pattern.title === 'string' &&
    typeof pattern.normalizedTitle === 'string' &&
    typeof pattern.pageType === 'string' &&
    typeof pattern.structureType === 'string' &&
    pattern.discoveredAt instanceof Date &&
    pattern.lastUsedAt instanceof Date
  );
}

/**
 * Type guard for WikipediaParseResult.
 */
export function isParseResult(obj: unknown): obj is WikipediaParseResult {
  if (typeof obj !== 'object' || obj === null) return false;
  const result = obj as Partial<WikipediaParseResult>;
  return (
    typeof result.success === 'boolean' &&
    typeof result.pageType === 'string' &&
    typeof result.structureType === 'string' &&
    typeof result.confidence === 'number'
  );
}
