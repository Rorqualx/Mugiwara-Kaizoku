/**
 * WikiPageFetcher Module
 *
 * Handles fetching and caching wiki pages with title extraction.
 * Manages visited URLs to prevent duplicate requests.
 *
 * Extracted from: WikiContentScraper.ts (lines 170-204, 641-646)
 */

import * as cheerio from 'cheerio';

import { fetchPageHtmlViaApi } from '@/server/services/fandom/utils/mediaWikiApiFetch';

import type { WikiPage } from './types';
import type { AxiosInstance } from 'axios';

/**
 * Logger interface matching the logger.child() return type
 */
interface LoggerInstance {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Fetches and caches wiki pages with deduplication
 */
export class WikiPageFetcher {
  private cache = new Map<string, WikiPage>();
  private visitedUrls = new Set<string>();

  constructor(
    private readonly axios: AxiosInstance,
    private readonly logger: LoggerInstance
  ) {}

  /**
   * Fetch a wiki page with caching and deduplication
   * Uses MediaWiki API to bypass Cloudflare protection
   */
  async fetchPage(url: string): Promise<WikiPage | null> {
    // Check cache first
    if (this.cache.has(url)) {
      const cached = this.cache.get(url);
      return cached ?? null;
    }

    // Mark as visited
    this.visitedUrls.add(url);

    try {
      // Try MediaWiki API first (bypasses Cloudflare)
      const htmlData = await fetchPageHtmlViaApi(url);

      if (!htmlData) {
        // Fallback to direct axios if not a Fandom URL
        this.logger.debug('MediaWiki API returned null, trying direct fetch', { url });
        const response = await this.axios.get(url);
        const directHtml = response.data as string;
        const page: WikiPage = {
          url,
          title: this.extractPageTitle(directHtml),
          html: directHtml
        };
        this.cache.set(url, page);
        return page;
      }

      const page: WikiPage = {
        url,
        title: this.extractPageTitle(htmlData),
        html: htmlData
      };

      // Cache the page
      this.cache.set(url, page);

      return page;

    } catch (error: unknown) {
      this.logger.error('Failed to fetch page', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Extract page title from HTML
   */
  private extractPageTitle(html: string): string {
    const $ = cheerio.load(html);
    return $('h1').first().text().trim() ||
           $('title').text().replace(/ - .*$/, '').trim() ||
           'Unknown';
  }

  /**
   * Clear the page cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear visited URLs set
   */
  clearVisitedUrls(): void {
    this.visitedUrls.clear();
  }

  /**
   * Check if URL has been visited
   */
  hasVisited(url: string): boolean {
    return this.visitedUrls.has(url);
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get visited URLs count for monitoring
   */
  getVisitedCount(): number {
    return this.visitedUrls.size;
  }

  /**
   * Create a WikiPage from raw URL + HTML without fetching
   * Used when disambiguation resolution already has the HTML
   */
  createPageFromHtml(url: string, html: string): WikiPage {
    const page: WikiPage = {
      url,
      title: this.extractPageTitle(html),
      html
    };
    this.cache.set(url, page);
    return page;
  }
}
