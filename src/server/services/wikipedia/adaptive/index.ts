/**
 * Wikipedia Adaptive Parser Module
 *
 * Provides adaptive parsing capabilities for Wikipedia manga pages.
 * Includes static analysis, URL discovery, pattern caching, and
 * specialized parsers for different page structures.
 *
 * @module wikipedia/adaptive
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  WikipediaPageType,
  WikipediaParserType,
  WikipediaUrlProbeResult,
  WikipediaUrlDiscoveryResult,
  WikitableAnalysis,
  SectionAnalysis,
  InfoboxAnalysis,
  LinkAnalysis,
  WikipediaStructureAnalysis,
  WikipediaCachedPattern,
  PatternCacheConfig,
  PatternCacheStats,
  WikipediaParserOptions,
  WikipediaParseResult,
  MediaSectionData,
  PublicationInfo,
  UrlPattern,
  TitleVariation,
} from './types';

export {
  WikipediaStructureType,
  DEFAULT_WIKIPEDIA_OPTIONS,
  DEFAULT_CACHE_CONFIG,
  WIKIPEDIA_API_BASE,
  WIKIPEDIA_ARTICLE_BASE,
  isCachedPattern,
  isParseResult,
} from './types';

// ============================================================================
// Static Analyzer Exports
// ============================================================================

export {
  analyzeWikipediaStructure,
  isListPage,
  hasMangaContent,
  extractSectionById,
} from './static-analyzer';

// ============================================================================
// URL Discoverer Exports
// ============================================================================

export {
  discoverWikipediaUrls,
  generateTitleVariations,
  buildWikipediaUrl,
  extractPageTitle,
  isWikipediaUrl,
  getNormalizedCacheKey,
} from './url-discoverer';

// ============================================================================
// Pattern Cache Exports
// ============================================================================

export {
  getWikipediaCache,
  resetWikipediaCache,
  createCacheEntry,
  warmCache,
} from './pattern-cache';

// ============================================================================
// Media Section Parser Exports
// ============================================================================

export {
  parseMediaSection,
  findMangaSection,
  extractVolumeCount,
  extractChapterCount,
  hasUsefulMangaData,
} from './media-section-parser';
