/**
 * Adaptive Fandom Parser
 *
 * Intelligent parsing system that handles any manga wiki structure by:
 * 1. Discovering correct chapter/volume URLs across multiple patterns
 * 2. Detecting page structure dynamically
 * 3. Caching successful patterns for reuse
 * 4. Coordinating extraction with existing parsers
 *
 * @example
 * ```typescript
 * import { adaptiveParse, getPatternCache } from '@/server/services/fandom/adaptive';
 * import { logger } from '@/utils/logger';
 *
 * // Parse a wiki by domain
 * const result = await adaptiveParse('mob-psycho-100.fandom.com');
 * if (result.success) {
 *   logger.info('Found volumes', { count: result.data.volumeList?.length });
 * }
 *
 * // Check cache statistics
 * const stats = getPatternCache().getStats();
 * logger.info('Cache stats', { hitRate: stats.hitRate });
 * ```
 *
 * @module adaptive
 */

// Types
export type {
  UrlProbeResult,
  UrlDiscoveryResult,
  UrlContentScore,
  CachedPattern,
  PatternCacheConfig,
  AdaptiveParserOptions,
  AdaptiveParseResult,
  WikiExtractionConfig,
  PatternDiscoveryLog,
  StructureType,
  PageStructure,
  DynamicSelectors,
  ContentPatterns,
  StructureMetadata,
  // Metadata types
  MetadataFetchOptions,
  FetchedMetadata,
  MetadataFetchResult,
} from './types';

export {
  URL_PROBE_PATTERNS,
  KNOWN_DOMAIN_REDIRECTS,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_PARSER_OPTIONS,
  DEFAULT_METADATA_OPTIONS,
  isCachedPattern,
  isAdaptiveParseResult,
} from './types';

// URL Discovery
export type { UrlDiscoveryConfig, MultiSourceDiscoveryResult, ExtractionScore } from './url-discoverer';

export {
  probeUrl,
  discoverChapterVolumeUrl,
  discoverBestChapterVolumeUrl,
  discoverCustomUrl,
  discoverAllChapterVolumeUrls,
  discoverSupplementaryUrls,
  resolveKnownRedirect,
  extractDomainFromUrl,
  isFandomDomain,
  scorePageContent,
  scoreByExtraction,
  DEFAULT_URL_DISCOVERY_CONFIG,
  SUPPLEMENTARY_URL_PATTERNS,
} from './url-discoverer';

// Pattern Cache
export type { CacheStats } from './pattern-cache';

export { PatternCache, getPatternCache, resetPatternCache } from './pattern-cache';

// Bulleted List Parser
export type { BulletedVolume, BulletedChapter, BulletedParseResult } from './bulleted-list-parser';

export {
  parseBulletedListStructure,
  parseBulletedListEnhanced,
  isBulletedListStructure,
  hasTableListChapters,
  hasStandaloneVolumeTables,
} from './bulleted-list-parser';

// Category Page Parser
export type { CategoryPageVolume, CategoryPageChapter, CategoryPageResult } from './category-page-parser';

export { parseCategoryPage, isCategoryPageStructure, detectCategoryType } from './category-page-parser';

// Collapsible Table Parser
export type { CollapsibleVolume, CollapsibleChapter, CollapsibleTableResult } from './collapsible-table-parser';

export { parseCollapsibleTables, isCollapsibleTableStructure } from './collapsible-table-parser';

// Plain Table Parser
export type { PlainTableVolume, PlainTableChapter, PlainTableParseResult } from './plain-table-parser';

export { parsePlainTableStructure, isPlainTableStructure } from './plain-table-parser';

// Arc-Based Parser
export type { ArcInfo, ArcVolume, ArcChapter, ArcBasedParseResult } from './arc-based-parser';

export { parseArcBasedStructure, isArcBasedStructure, parseChaptersFromVolumePage } from './arc-based-parser';

// Per-Volume Iterator
export type {
  VolumePageChapter,
  VolumePageData,
  PerVolumeIteratorOptions,
  PerVolumeIteratorResult,
} from './per-volume-iterator';

export { iterateVolumePages, hasPerVolumeStructure } from './per-volume-iterator';

// Paragraph Link Parser
export type { ParagraphLinkParseResult } from './paragraph-link-parser';

export {
  parseParagraphLinkStructure,
  parseParagraphLinkStructureEnhanced,
  isParagraphLinkStructure,
} from './paragraph-link-parser';

// Shifted Column Parser
export type { ShiftedColumnVolume, ShiftedColumnChapter, ShiftedColumnParseResult } from './shifted-column-parser';

export { parseShiftedColumnStructure, isShiftedColumnStructure } from './shifted-column-parser';

// ID-Based Volume Table Parser
export type { IdVolumeVolume, IdVolumeChapter, IdVolumeTableResult } from './id-volume-table-parser';

export { parseIdVolumeTableStructure, isIdVolumeTableStructure } from './id-volume-table-parser';

// JoJo Parser
export type { JoJoVolume, JoJoChapter, JoJoParseResult } from './jojo-parser';

export { parseJoJoStructure, isJoJoStructure } from './jojo-parser';

// Metadata Fetcher
export { fetchMainPageMetadata } from './metadata-fetcher';

// Orchestrator
export { adaptiveParse, batchAdaptiveParse, warmCache, toVolumeDetails } from './orchestrator';

// Type converters for router integration
export type { FandomChapterDetail, FandomVolumeDetail } from './orchestrator';
