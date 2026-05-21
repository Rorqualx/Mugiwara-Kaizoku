/**
 * Wikipedia Service Facade
 *
 * Main public API for Wikipedia manga data extraction.
 * Thin delegation layer that orchestrates calls to extracted modules.
 *
 * This service re-exports all extracted functionality while maintaining
 * backwards compatibility with the original WikipediaService interface.
 *
 * Extracted from: WikipediaService.ts (class structure)
 */

import { logger } from '@/utils/logger';

import {
  discoverWikipediaUrls,
  analyzeWikipediaStructure,
  getWikipediaCache,
  resetWikipediaCache,
  type WikipediaParseResult,
  type WikipediaParserOptions,
  type WikipediaStructureAnalysis,
  type WikipediaUrlDiscoveryResult,
  type WikipediaCachedPattern,
  type PatternCacheStats,
} from '../adaptive';

import {
  searchMangaOpenSearch,
  fetchPageExtract,
  searchChapterListPage,
} from './api-client';
import {
  getMangaInfo,
  getChapterList,
  getVolumeList,
  getVolumeWithChapters,
  getVolumesWithDescriptions,
  findBestMatch as findBestMatchExtractor,
  adaptiveExtract,
} from './manga-extractor';
import { createCache } from './utils';

// Import business logic functions

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process a single search result to extract detailed page information
 */
async function processSearchResult(
  title: string,
  url: string,
  fallbackDescription: string | undefined
): Promise<WikipediaSearchResult | null> {
  const extractData = await fetchPageExtract(title);
  const pages = extractData.query?.pages;

  if (!pages) {
    return null;
  }

  const pageIds = Object.keys(pages);
  const pageId = pageIds[0];

  if (!pageId) {
    return null;
  }

  const page = pages[pageId];

  if (!page) {
    return null;
  }

  const extract = page.extract ?? fallbackDescription;
  return {
    pageId: parseInt(pageId),
    title: page.title ?? title,
    ...(extract ? { extract } : {}),
    url: url,
    isDisambiguation: page.extract?.includes('may refer to:') ?? false,
  };
}

/**
 * Add chapter list page to results if found
 */
function addChapterListPage(
  results: WikipediaSearchResult[],
  chapterSearchData: { query?: { search?: Array<{ pageid: number; title: string }> } },
  query: string
): void {
  if (!chapterSearchData.query?.search || chapterSearchData.query.search.length === 0) {
    return;
  }

  const chapterPage = chapterSearchData.query.search[0];

  if (!chapterPage) {
    return;
  }

  results.push({
    pageId: chapterPage.pageid,
    title: chapterPage.title,
    extract: `Chapter list for ${query}`,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(chapterPage.title.replace(/ /g, '_'))}`,
  });
}

// Import types
import type {
  Cache,
  WikipediaMangaData,
  WikipediaChapter,
  WikipediaVolume,
  WikipediaSearchResult,
} from './types';

// Re-export types for convenience
export type {
  WikipediaMangaData,
  WikipediaChapter,
  WikipediaVolume,
  WikipediaSearchResult,
};

// Re-export adaptive types
export type {
  WikipediaParseResult,
  WikipediaParserOptions,
  WikipediaStructureAnalysis,
  WikipediaUrlDiscoveryResult,
  WikipediaCachedPattern,
  PatternCacheStats,
};

// ============================================================================
// WikipediaService Class
// ============================================================================

/**
 * Wikipedia Service for extracting manga metadata
 *
 * Provides a unified interface for:
 * - Searching for manga pages
 * - Extracting manga metadata (title, author, plot, etc.)
 * - Fetching chapter lists
 * - Fetching volume information
 * - Finding best matches for manga titles
 *
 * All methods delegate to extracted functions in manga-extractor.ts
 */
export default class WikipediaService {
  private cache: Cache<unknown>;

  constructor() {
    // Initialize cache with 1-hour TTL (3600000ms)
    // Extracted modules use their own cache, this is for searchManga only
    this.cache = createCache(3600000);
  }

  /**
   * Search Wikipedia for manga pages
   *
   * Searches for manga-related Wikipedia pages including:
   * - Main manga pages
   * - Disambiguation pages
   * - "List of X chapters" pages
   *
   * @param query - Search query (manga title)
   * @returns Array of search results with titles, URLs, and descriptions
   */
  async searchManga(query: string): Promise<WikipediaSearchResult[]> {
    const cacheKey = `search:${query}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      logger.debug(`Wikipedia cache hit for search: ${query}`);
      return cached as WikipediaSearchResult[];
    }

    try {
      const searchData = await searchMangaOpenSearch(query);

      if (!Array.isArray(searchData) || searchData.length < 4) {
        return [];
      }

      const titles = searchData[1] as string[];
      const descriptions = searchData[2] as string[];
      const urls = searchData[3] as string[];

      // Process all search results in parallel (fixes no-await-in-loop)
      const resultPromises = titles.map((title, i) => {
        const url = urls[i];
        if (!title || !url) {
          return Promise.resolve(null);
        }
        return processSearchResult(title, url, descriptions[i]);
      });

      const processedResults = await Promise.all(resultPromises);
      const results = processedResults.filter(
        (result): result is WikipediaSearchResult => result !== null
      );

      // Also search for "List of X chapters" pages
      const chapterSearchData = await searchChapterListPage(query);
      addChapterListPage(results, chapterSearchData, query);

      this.cache.set(cacheKey, results);
      return results;
    } catch (error: unknown) {
      logger.error(
        `Wikipedia search error for "${query}": ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Get detailed manga information from Wikipedia page
   *
   * Delegates to getMangaInfo from manga-extractor.ts
   *
   * @param pageTitleOrUrl - Wikipedia page title or full URL
   * @returns Complete manga metadata or null if not found
   */
  async getMangaInfo(pageTitleOrUrl: string): Promise<WikipediaMangaData | null> {
    return getMangaInfo(pageTitleOrUrl);
  }

  /**
   * Get chapter list from Wikipedia
   *
   * Delegates to getChapterList from manga-extractor.ts
   *
   * @param mangaTitle - Manga title to search for chapter list
   * @returns Array of chapters with titles and metadata
   */
  async getChapterList(mangaTitle: string): Promise<WikipediaChapter[]> {
    return getChapterList(mangaTitle);
  }

  /**
   * Get volume list from Wikipedia
   *
   * Delegates to getVolumeList from manga-extractor.ts
   *
   * @param volumeListUrl - URL to the volume list page
   * @returns Array of volumes with chapter information
   */
  async getVolumeList(volumeListUrl: string): Promise<WikipediaVolume[]> {
    return getVolumeList(volumeListUrl);
  }

  /**
   * Get specific volume with chapters from Wikipedia
   *
   * Delegates to getVolumeWithChapters from manga-extractor.ts
   *
   * @param chapterPageUrl - URL to the chapter list page
   * @param volumeNumber - Volume number to extract
   * @returns Volume with chapters or null if not found
   */
  async getVolumeWithChapters(
    chapterPageUrl: string,
    volumeNumber: number
  ): Promise<WikipediaVolume | null> {
    return getVolumeWithChapters(chapterPageUrl, volumeNumber);
  }

  /**
   * Get volumes with descriptions and chapter ranges from Wikipedia
   *
   * Delegates to getVolumesWithDescriptions from manga-extractor.ts
   *
   * @param volumeListUrl - URL to the volume list page
   * @returns Array of volumes with descriptions and chapter ranges
   */
  async getVolumesWithDescriptions(
    volumeListUrl: string
  ): Promise<WikipediaVolume[]> {
    return getVolumesWithDescriptions(volumeListUrl);
  }

  /**
   * Find best matching Wikipedia page for a manga title
   *
   * Orchestrates search and extraction to find the most relevant
   * Wikipedia page for a given manga title, including:
   * - Searching for main manga page
   * - Extracting complete metadata
   * - Following volume and chapter list URLs
   * - Enriching data with descriptions and summaries
   *
   * This is the main entry point for manga data extraction.
   *
   * Delegates to findBestMatch from manga-extractor.ts
   *
   * @param mangaTitle - Manga title to search
   * @returns Best matching page data with complete metadata or null
   */
  async findBestMatch(mangaTitle: string): Promise<WikipediaMangaData | null> {
    return findBestMatchExtractor(mangaTitle, this.searchManga.bind(this));
  }

  // ============================================================================
  // Adaptive Extraction Methods
  // ============================================================================

  /**
   * Adaptive manga extraction with intelligent parser selection
   *
   * Uses static analysis to detect page structure and route to the
   * appropriate parser for best results. Supports:
   * - Dedicated List_of_* pages (most reliable)
   * - Main article Media sections (for manga without chapter lists)
   * - Combined extraction from multiple sources
   *
   * This is the recommended method for new integrations as it handles
   * all Wikipedia page types automatically.
   *
   * @param titleOrUrl - Manga title or Wikipedia URL
   * @param options - Parser options (cache, timeout, enrichment)
   * @returns Parse result with volumes, chapters, confidence score
   */
  async getAdaptiveMangaInfo(
    titleOrUrl: string,
    options: Partial<WikipediaParserOptions> = {}
  ): Promise<WikipediaParseResult> {
    return adaptiveExtract(titleOrUrl, options);
  }

  /**
   * Analyze Wikipedia page structure without parsing
   *
   * Performs static analysis to detect:
   * - Page type (list-page, main-article, section-anchor)
   * - Structure type (wikitable, media section, infobox)
   * - Content indicators (volume tables, chapter links, infobox)
   * - Recommended parser with confidence score
   *
   * Useful for preview/validation before full extraction.
   *
   * @param url - Wikipedia URL to analyze
   * @returns Structure analysis with recommendations
   */
  async analyzeWikipediaPage(url: string): Promise<WikipediaStructureAnalysis | null> {
    try {
      const match = url.match(/\/wiki\/([^#?]+)/);
      if (!match?.[1]) {
        logger.warn('[WikipediaService] Invalid URL for analysis', { url });
        return null;
      }

      const pageTitle = decodeURIComponent(match[1].replace(/_/g, ' '));
      const { fetchPageContent } = await import('./api-client');
      const response = await fetchPageContent(pageTitle);

      if (!response.parse) {
        return null;
      }

      const htmlContent = response.parse.text?.['*'] ?? '';
      return analyzeWikipediaStructure(htmlContent, url);
    } catch (error) {
      logger.error('[WikipediaService] Analysis failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Discover Wikipedia URLs for a manga title
   *
   * Searches for both List_of_* chapter pages and main article pages
   * using extensive URL patterns and title variations.
   *
   * @param titleOrUrl - Manga title or partial URL
   * @param options - Discovery options
   * @returns Discovery result with found URLs
   */
  async discoverWikipediaUrl(
    titleOrUrl: string,
    options: { preferListPage?: boolean; timeoutMs?: number } = {}
  ): Promise<WikipediaUrlDiscoveryResult> {
    return discoverWikipediaUrls(titleOrUrl, options);
  }

  /**
   * Get pattern cache statistics
   *
   * Returns cache performance metrics including:
   * - Cache size and hit rate
   * - Expired and evicted counts
   *
   * @returns Cache statistics
   */
  getCacheStats(): PatternCacheStats {
    return getWikipediaCache().getStats();
  }

  /**
   * Clear the pattern cache
   *
   * Removes all cached patterns. Useful for:
   * - Testing fresh extractions
   * - Recovering from stale cache issues
   */
  clearCache(): void {
    resetWikipediaCache();
    logger.info('[WikipediaService] Pattern cache cleared');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance of WikipediaService for global use
 *
 * Provides backward compatibility with the original WikipediaService.ts
 * singleton export pattern. All consumers of the service should use this
 * instance to maintain consistent caching and behavior across the application.
 */
export const wikipediaService = new WikipediaService();
