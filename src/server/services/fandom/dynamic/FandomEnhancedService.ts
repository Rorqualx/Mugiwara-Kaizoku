/**
 * Fandom Enhanced Service
 *
 * Wrapper service that provides AsyncResult-based interface for Fandom wiki scraping.
 * Integrates WikiContentScraper with error handling and type-safe results.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { WikiContentScraper } from './WikiContentScraper';


import type { ScrapingResult, ScrapingOptions } from './WikiContentScraper';

/**
 * Enhanced metadata result with statistics
 */
export interface EnhancedMetadata extends ScrapingResult {
  stats?: {
    totalVolumes: number;
    totalChapters: number;
  };
}

/**
 * FandomEnhancedService
 *
 * Provides AsyncResult-based methods for scraping Fandom wikis
 */
export class FandomEnhancedService {
  private scraper: WikiContentScraper;
  private log = logger.child('FandomEnhancedService');

  constructor() {
    this.scraper = new WikiContentScraper();
  }

  /**
   * Parse a volumes/chapters list page
   *
   * @param url - URL of the volumes or chapters list page
   * @param options - Scraping options
   * @returns AsyncResult with scraped data
   */
  async parseVolumesPage(
    url: string,
    options?: ScrapingOptions
  ): Promise<AsyncResult<EnhancedMetadata, Error>> {
    try {
      this.log.info('Parsing volumes page', { url });

      // Use WikiContentScraper to scrape the page
      const result = await this.scraper.scrapeMangaWiki(url, {
        followLinks: options?.followLinks ?? true,
        extractSummaries: options?.extractSummaries ?? true,
        cacheResults: options?.cacheResults ?? true,
        maxDepth: options?.maxDepth ?? 2,
        timeout: options?.timeout ?? 30000,
        retryAttempts: options?.retryAttempts ?? 3
      });

      // Add stats to result
      const enhancedResult: EnhancedMetadata = {
        ...result,
        stats: {
          totalVolumes: result.totalVolumes,
          totalChapters: result.totalChapters
        }
      };

      if (result.success) {
        this.log.info('Successfully parsed volumes page', {
          url,
          volumes: result.totalVolumes,
          chapters: result.totalChapters
        });
        return createSuccessResult(enhancedResult);
      } else {
        const errorMessage = result.errors?.join(', ') ?? 'Failed to parse volumes page';
        this.log.warn('Failed to parse volumes page', { url, error: errorMessage });
        return createErrorResult(new Error(errorMessage));
      }
    } catch (error) {
      this.log.error('Error parsing volumes page', { url, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResult(new Error(`Failed to parse volumes page: ${errorMessage}`));
    }
  }

  /**
   * Get enhanced metadata from a manga wiki page
   *
   * @param url - URL of the manga wiki page
   * @param options - Scraping options
   * @returns AsyncResult with enhanced metadata
   */
  async getEnhancedMetadata(
    url: string,
    options?: ScrapingOptions
  ): Promise<AsyncResult<EnhancedMetadata, Error>> {
    try {
      this.log.info('Getting enhanced metadata', { url });

      // Use WikiContentScraper to scrape the page
      const result = await this.scraper.scrapeMangaWiki(url, {
        followLinks: options?.followLinks ?? true,
        extractSummaries: options?.extractSummaries ?? true,
        cacheResults: options?.cacheResults ?? true,
        maxDepth: options?.maxDepth ?? 2,
        timeout: options?.timeout ?? 30000,
        retryAttempts: options?.retryAttempts ?? 3
      });

      // Add stats to result
      const enhancedResult: EnhancedMetadata = {
        ...result,
        stats: {
          totalVolumes: result.totalVolumes,
          totalChapters: result.totalChapters
        }
      };

      if (result.success) {
        this.log.info('Successfully got enhanced metadata', {
          url,
          volumes: result.totalVolumes,
          chapters: result.totalChapters
        });
        return createSuccessResult(enhancedResult);
      } else {
        const errorMessage = result.errors?.join(', ') ?? 'Failed to get enhanced metadata';
        this.log.warn('Failed to get enhanced metadata', { url, error: errorMessage });
        return createErrorResult(new Error(errorMessage));
      }
    } catch (error) {
      this.log.error('Error getting enhanced metadata', { url, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResult(new Error(`Failed to get enhanced metadata: ${errorMessage}`));
    }
  }

  /**
   * Scrape manga wiki with raw result
   *
   * @param url - URL of the manga wiki page
   * @param options - Scraping options
   * @returns AsyncResult with scraping result
   */
  async scrapeMangaWiki(
    url: string,
    options?: ScrapingOptions
  ): Promise<AsyncResult<ScrapingResult, Error>> {
    try {
      this.log.info('Scraping manga wiki', { url });

      const result = await this.scraper.scrapeMangaWiki(url, options);

      if (result.success) {
        this.log.info('Successfully scraped manga wiki', {
          url,
          volumes: result.totalVolumes,
          chapters: result.totalChapters
        });
        return createSuccessResult(result);
      } else {
        const errorMessage = result.errors?.join(', ') ?? 'Failed to scrape manga wiki';
        this.log.warn('Failed to scrape manga wiki', { url, error: errorMessage });
        return createErrorResult(new Error(errorMessage));
      }
    } catch (error) {
      this.log.error('Error scraping manga wiki', { url, error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResult(new Error(`Failed to scrape manga wiki: ${errorMessage}`));
    }
  }
}
