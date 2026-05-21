/**
 * WikiContentScraper - Main Orchestrator
 *
 * Coordinates wiki scraping operations across specialized modules.
 *
 * Architecture:
 * - types.ts - Shared types and interfaces
 * - url-utils.ts - URL resolution utilities
 * - page-fetcher.ts - Page fetching and caching
 * - page-discovery.ts - Discover volumes pages
 * - volume-extractor.ts - Extract volume information
 * - chapter-extractor.ts - Extract chapter information
 * - enrichment.ts - Enrich with detailed content
 * - gallery-extractor.ts - Extract gallery images
 * - data-organizer.ts - Organize chapters into volumes
 *
 * Original: 670 lines → Refactored: ~250 lines orchestrator + 9 focused modules
 *
 * ESLint Violations Fixed:
 * - no-unused-vars (ExtractedData removed)
 * - max-params (extractVolumeFromLink: 6→2 params)
 * - max-params (extractChapterFromLink: 7→2 params)
 * - no-param-reassign (enrichment returns updates)
 * - max-depth (enrichment: 5→3 levels)
 * - no-await-in-loop (enrichment batch processing)
 */

import axios from 'axios';
import * as cheerio from 'cheerio';


import { logger } from '@/server/utils/logger';

import { DynamicWikiParser } from './DynamicWikiParser';
import { extractChapterFromLink } from './wiki-content-scraper/chapter-extractor';
import { organizeChaptersIntoVolumes } from './wiki-content-scraper/data-organizer';
import {
  isDisambiguationPageHtml,
  resolveDisambiguationPage,
} from './wiki-content-scraper/disambiguation-resolver';
import { enrichWithDetailedContent } from './wiki-content-scraper/enrichment';
import { extractGalleryFromPage } from './wiki-content-scraper/gallery-extractor';
import { discoverVolumesPage } from './wiki-content-scraper/page-discovery';
import { WikiPageFetcher } from './wiki-content-scraper/page-fetcher';
import { resolveHref } from './wiki-content-scraper/url-utils';
import { extractVolumeFromLink } from './wiki-content-scraper/volume-extractor';
import { WikiChapterDetailsExtractor } from './WikiChapterDetailsExtractor';
import { WikiDataConverter } from './WikiDataConverter';
import { WikiMetadataExtractor } from './WikiMetadataExtractor';

import type {
  ChapterExtractionContext,
  ScrapingOptions,
  ScrapingResult,
  VolumeExtractionContext,
  WikiPage
} from './wiki-content-scraper/types';
import type { VolumeInfo, ChapterInfo } from './WikiDataConverter';
import type { WikiMetadata } from './WikiMetadataExtractor';
import type { AxiosInstance } from 'axios';

// Re-export types
export type { VolumeInfo, ChapterInfo, WikiMetadata, ScrapingResult, ScrapingOptions };

/**
 * Logger interface for dependency injection
 */
interface LoggerInstance {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export class WikiContentScraper {
  private pageFetcher: WikiPageFetcher;
  private parser: DynamicWikiParser;
  private metadataExtractor: WikiMetadataExtractor;
  private chapterDetailsExtractor: WikiChapterDetailsExtractor;
  private dataConverter: WikiDataConverter;
  private log: LoggerInstance;
  private cache = new Map<string, WikiPage>();
  private visitedUrls = new Set<string>();

  constructor(
    parser?: DynamicWikiParser,
    metadataExtractor?: WikiMetadataExtractor,
    chapterDetailsExtractor?: WikiChapterDetailsExtractor,
    dataConverter?: WikiDataConverter,
    axiosInstance?: AxiosInstance
  ) {
    const axiosClient = axiosInstance ?? axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MugiwariKaizoku/1.0)'
      }
    });

    // Initialize logger - using logger directly as it doesn't have child() method
    this.log = logger;

    this.pageFetcher = new WikiPageFetcher(axiosClient, this.log);
    this.parser = parser ?? new DynamicWikiParser();
    this.metadataExtractor = metadataExtractor ?? new WikiMetadataExtractor();
    this.chapterDetailsExtractor = chapterDetailsExtractor ?? new WikiChapterDetailsExtractor();
    this.dataConverter = dataConverter ?? new WikiDataConverter();
  }

  /**
   * Main entry point - scrapes manga wiki page
   */
  async scrapeMangaWiki(wikiUrl: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    this.log.info('Starting manga wiki scraping', { url: wikiUrl });

    const result: ScrapingResult = {
      success: false,
      mainPageUrl: wikiUrl,
      volumes: [],
      chapters: [],
      totalVolumes: 0,
      totalChapters: 0,
      gallery: [],
      errors: []
    };

    try {
      // Reset visited URLs for new scraping session
      this.visitedUrls.clear();
      this.cache.clear();

      // Step 1: Fetch and analyze main page
      let mainPage = await this.fetchPageWithStructure(wikiUrl);
      if (!mainPage) {
        throw new Error('Failed to fetch main wiki page');
      }

      // Step 1.5: Check if main page is a disambiguation page
      if (isDisambiguationPageHtml(mainPage.html, mainPage.title)) {
        this.log.info('Detected disambiguation page, attempting resolution', { url: wikiUrl });
        const disambigResult = await resolveDisambiguationPage(wikiUrl, mainPage.html, this.log);
        if (disambigResult.resolved && disambigResult.resolvedUrl && disambigResult.resolvedHtml) {
          const resolvedPage = this.pageFetcher.createPageFromHtml(
            disambigResult.resolvedUrl,
            disambigResult.resolvedHtml
          );
          resolvedPage.structure = await this.parser.analyzePageStructure(
            resolvedPage.html,
            resolvedPage.url
          );
          mainPage = resolvedPage;
          result.mainPageUrl = disambigResult.resolvedUrl;
          this.log.info('Using resolved page instead of disambiguation', {
            original: wikiUrl,
            resolved: disambigResult.resolvedUrl,
            variant: disambigResult.variant,
          });
        } else {
          this.log.warn('Disambiguation page detected but could not resolve', { url: wikiUrl });
        }
      }

      // Step 2: Extract metadata from main page
      result.metadata = this.metadataExtractor.extractMetadata(mainPage.html, mainPage.title);

      // Step 2.5: Extract gallery from main page
      const mainPageGallery = await extractGalleryFromPage(mainPage);
      if (mainPageGallery.length > 0) {
        result.gallery = mainPageGallery;
        this.log.info(`🖼️ [GALLERY] Extracted ${mainPageGallery.length} gallery images from main page`);
      }

      // Step 3: Discover volumes/chapters page
      const volumesPageUrl = await discoverVolumesPage(mainPage);
      if (volumesPageUrl) {
        result.volumesPageUrl = volumesPageUrl;
        this.log.info('Found volumes page', { url: volumesPageUrl });

        // Step 4: Scrape volumes page
        const volumesData = await this.scrapeVolumesPage(volumesPageUrl);
        result.volumes = volumesData.volumes;
        result.chapters = volumesData.chapters;
        if (volumesData.gallery) {
          result.gallery = volumesData.gallery;
        }
      } else {
        // Try to extract volumes/chapters from main page
        this.log.info('No separate volumes page found, extracting from main page');
        const mainPageData = await this.extractVolumesAndChaptersFromPage(mainPage);
        result.volumes = mainPageData.volumes;
        result.chapters = mainPageData.chapters;
        if (mainPageData.gallery) {
          result.gallery = mainPageData.gallery;
        }
      }

      // Step 5: Enrich with detailed content if needed
      const needsCoverEnrichment = result.volumes.some(v => !v.coverImage);

      if (needsCoverEnrichment || options.followLinks) {
        await this.enrichContentWithDetails(result, options);
      }

      // Calculate totals
      result.totalVolumes = result.volumes.length;
      result.totalChapters = result.chapters.length;

      // Organize chapters into volumes if not already done
      if (result.volumes.length > 0 && result.chapters.length > 0) {
        organizeChaptersIntoVolumes(result.volumes, result.chapters);
      }

      result.success = true;

    } catch (error: unknown) {
      this.log.error('Wiki scraping failed', {
        url: wikiUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      result.errors?.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Helper: Fetch page and add structure analysis
   */
  private async fetchPageWithStructure(url: string): Promise<WikiPage | null> {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url) ?? null;
    }

    // Fetch the page
    const page = await this.pageFetcher.fetchPage(url);
    if (!page) {
      return null;
    }

    // Analyze structure
    page.structure = await this.parser.analyzePageStructure(page.html, page.url);

    // Cache the page
    this.cache.set(url, page);
    this.visitedUrls.add(url);

    return page;
  }

  /**
   * Scrapes volumes page for volume/chapter information
   */
  private async scrapeVolumesPage(url: string): Promise<{
    volumes: VolumeInfo[];
    chapters: ChapterInfo[];
    gallery?: unknown[];
  }> {
    const page = await this.fetchPageWithStructure(url);
    if (!page) {
      this.log.warn('Failed to fetch volumes page', { url });
      return { volumes: [], chapters: [], gallery: [] };
    }

    const extractedData = await this.parser.extractData(page);

    if (!extractedData.success) {
      this.log.warn('Failed to extract data from volumes page', {
        url: page.url,
        errors: extractedData.errors
      });
      return { volumes: [], chapters: [], gallery: [] };
    }

    return this.dataConverter.convertExtractedData(extractedData, page.url);
  }

  /**
   * Extract volumes and chapters from any page
   */
  private async extractVolumesAndChaptersFromPage(page: WikiPage): Promise<{
    volumes: VolumeInfo[];
    chapters: ChapterInfo[];
    gallery?: unknown[];
  }> {
    const extractedData = await this.parser.extractData(page);

    if (!extractedData.success) {
      // Try manual extraction as fallback
      return this.manualExtraction(page);
    }

    return this.dataConverter.convertExtractedData(extractedData, page.url);
  }

  /**
   * Manual extraction fallback
   */
  private manualExtraction(page: WikiPage): {
    volumes: VolumeInfo[];
    chapters: ChapterInfo[];
  } {
    const $ = cheerio.load(page.html);
    const volumes: VolumeInfo[] = [];
    const chapters: ChapterInfo[] = [];
    const baseUrl = new URL(page.url).origin;

    // Find all links that look like volumes or chapters
    $('a[href]').each((_, linkEl) => {
      const $link = $(linkEl);
      const text = $link.text().trim();
      const href = $link.attr('href');

      if (!href || !text) return;

      const resolvedHref = resolveHref(href, baseUrl, page.url);
      if (!resolvedHref) return;

      // Create context objects for extractors
      const volumeContext: VolumeExtractionContext = {
        $,
        $link,
        text,
        href: resolvedHref,
        pageUrl: page.url
      };

      // Extract volumes
      extractVolumeFromLink(volumeContext, volumes);

      // Extract chapters
      const chapterContext: ChapterExtractionContext = {
        ...volumeContext,
        volumes
      };
      extractChapterFromLink(chapterContext, chapters);
    });

    return { volumes, chapters };
  }

  /**
   * Enrich results by fetching individual chapter/volume pages
   */
  private async enrichContentWithDetails(
    result: ScrapingResult,
    options: ScrapingOptions
  ): Promise<void> {
    this.log.info('Enriching content with detailed information');

    await enrichWithDetailedContent(
      result,
      options,
      this.pageFetcher,
      this.chapterDetailsExtractor,
      this.log
    );
  }
}
