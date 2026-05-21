/**
 * GetComics Scraper Service
 *
 * Scrapes GetComics.org for comic book downloads.
 * Uses FlareSolverr for Cloudflare bypass when needed.
 *
 * @module server/services/getcomics/getcomicsService
 */

import * as cheerio from 'cheerio';

import { protectedFetch } from '@/server/services/shared/protectedFetch';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  DEFAULT_GETCOMICS_CONFIG,
  FILE_HOST_PATTERNS,
  GETCOMICS_SELECTORS,
} from './types';

import type {
  FileHostType,
  GetComicsConfig,
  GetComicsDetailPage,
  GetComicsDownloadLink,
  GetComicsSearchResult,
} from './types';

/**
 * GetComics Scraper Service
 *
 * Provides search and download link extraction for GetComics.org
 */
export class GetComicsService {
  private config: GetComicsConfig;
  private lastRequestTime = 0;

  constructor(config: Partial<GetComicsConfig> = {}) {
    this.config = { ...DEFAULT_GETCOMICS_CONFIG, ...config };
  }

  /**
   * Search for comics on GetComics
   *
   * @param query - Search query string
   * @returns Array of search results
   */
  async searchComics(query: string): Promise<AsyncResult<GetComicsSearchResult[], Error>> {
    try {
      await this.enforceRateLimit();

      const searchUrl = this.config.searchUrl.replace('{query}', encodeURIComponent(query));
      logger.info(`[GetComics] Searching: ${searchUrl}`);

      const result = await protectedFetch(searchUrl, {
        timeout: this.config.timeout,
        sessionName: 'getcomics-search',
      });

      if (!result.success || !result.html) {
        logger.error('[GetComics] Search fetch failed', { error: result.error });
        return createErrorResult(new Error(result.error ?? 'Failed to fetch search results'));
      }

      const results = this.parseSearchResults(result.html);
      logger.info(`[GetComics] Found ${results.length} results for "${query}"`);

      return createSuccessResult(results);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[GetComics] Search error', { error: errorMessage });
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Get download links from a comic detail page
   *
   * @param comicUrl - Full URL to the comic detail page
   * @returns Detail page with download links
   */
  async getDownloadLinks(comicUrl: string): Promise<AsyncResult<GetComicsDetailPage, Error>> {
    try {
      await this.enforceRateLimit();

      logger.info(`[GetComics] Fetching detail page: ${comicUrl}`);

      const result = await protectedFetch(comicUrl, {
        timeout: this.config.timeout,
        sessionName: 'getcomics-detail',
      });

      if (!result.success || !result.html) {
        logger.error('[GetComics] Detail fetch failed', { error: result.error });
        return createErrorResult(new Error(result.error ?? 'Failed to fetch detail page'));
      }

      const detailPage = this.parseDetailPage(result.html);
      logger.info(`[GetComics] Found ${detailPage.downloadLinks.length} download links`);

      return createSuccessResult(detailPage);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[GetComics] Detail page error', { error: errorMessage });
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Parse search results from HTML
   */
  private parseSearchResults(html: string): GetComicsSearchResult[] {
    const $ = cheerio.load(html);
    const results: GetComicsSearchResult[] = [];
    const selectors = GETCOMICS_SELECTORS.search;

    $(selectors.resultContainer).each((_index, element) => {
      try {
        const $el = $(element);

        // Get title and URL
        const $titleLink = $el.find(selectors.title);
        const title = $titleLink.text().trim();
        const url = $titleLink.attr('href') ?? '';

        if (!title || !url) {
          return; // Skip invalid entries
        }

        // Extract ID from URL (slug)
        const id = this.extractIdFromUrl(url);

        // Get cover image
        const coverImg = $el.find(selectors.coverImage).attr('src');

        // Get excerpt/description
        const excerpt = $el.find(selectors.excerpt).text().trim().substring(0, 200);

        // Try to extract year, format, size from title
        const metadata = this.extractMetadataFromTitle(title);

        const result: GetComicsSearchResult = {
          id,
          title,
          url,
          source: 'getcomics',
        };

        // Only add optional fields if they have values
        if (coverImg) result.coverUrl = coverImg;
        if (excerpt) result.description = excerpt;
        if (metadata.year) result.year = metadata.year;
        if (metadata.format) result.format = metadata.format;
        if (metadata.size) result.size = metadata.size;

        results.push(result);
      } catch (error: unknown) {
        logger.warn('[GetComics] Failed to parse search result', error);
      }
    });

    return results;
  }

  /**
   * Parse detail page for download links
   */
  private parseDetailPage(html: string): GetComicsDetailPage {
    const $ = cheerio.load(html);
    const selectors = GETCOMICS_SELECTORS.detail;

    // Get title
    const title = $(selectors.title).text().trim();

    // Get description from content
    const $content = $(selectors.content);
    const descriptionText = $content.find('p').first().text().trim();

    // Get cover image
    const coverImg = $(selectors.coverImage).first().attr('src');

    // Get tags
    const tags: string[] = [];
    $(selectors.tags).each((_i, el) => {
      const tag = $(el).text().trim();
      if (tag) tags.push(tag);
    });

    // Extract download links
    const downloadLinks = this.extractDownloadLinks($, selectors.downloadContainer);

    const result: GetComicsDetailPage = {
      title,
      downloadLinks,
    };

    // Only add optional fields if they have values
    if (descriptionText) result.description = descriptionText;
    if (coverImg) result.coverUrl = coverImg;
    if (tags.length > 0) result.tags = tags;

    return result;
  }

  /**
   * Extract download links from page
   */
  private extractDownloadLinks(
    $: cheerio.CheerioAPI,
    selector: string
  ): GetComicsDownloadLink[] {
    const links: GetComicsDownloadLink[] = [];
    const seenUrls = new Set<string>();

    $(selector).each((_index, element) => {
      try {
        const $el = $(element);
        const href = $el.attr('href');
        const text = $el.text().trim();

        if (!href || seenUrls.has(href)) {
          return;
        }

        // Skip non-download links
        if (this.isNonDownloadLink(href)) {
          return;
        }

        seenUrls.add(href);

        const host = this.detectFileHost(href);
        const label = this.generateLinkLabel(text, host);
        const isMirror = text.toLowerCase().includes('mirror') ||
                         text.toLowerCase().includes('link');

        links.push({
          url: href,
          host,
          label,
          isMirror,
        });
      } catch (error: unknown) {
        logger.warn('[GetComics] Failed to parse download link', error);
      }
    });

    // Sort: main links first, then by host preference
    return this.sortDownloadLinks(links);
  }

  /**
   * Detect file host type from URL
   */
  private detectFileHost(url: string): FileHostType {
    for (const [host, pattern] of Object.entries(FILE_HOST_PATTERNS)) {
      if (host !== 'unknown' && pattern.test(url)) {
        return host as FileHostType;
      }
    }
    return 'unknown';
  }

  /**
   * Check if URL is not a download link
   */
  private isNonDownloadLink(url: string): boolean {
    const nonDownloadPatterns = [
      /getcomics\.org\/?$/i,
      /getcomics\.org\/\?s=/i,
      /getcomics\.org\/tag\//i,
      /getcomics\.org\/category\//i,
      /facebook\.com/i,
      /twitter\.com/i,
      /instagram\.com/i,
      /#comment/i,
      /javascript:/i,
    ];

    return nonDownloadPatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Generate human-readable label for download link
   */
  private generateLinkLabel(text: string, host: FileHostType): string {
    if (text && text.length > 0 && text.length < 50) {
      return text;
    }

    const hostLabels: Record<FileHostType, string> = {
      mediafire: 'MediaFire',
      mega: 'MEGA',
      zippyshare: 'Zippyshare',
      dropapk: 'DropAPK',
      userscloud: 'UsersCloud',
      direct: 'Direct Download',
      unknown: 'Download',
    };

    return hostLabels[host];
  }

  /**
   * Sort download links by preference
   */
  private sortDownloadLinks(links: GetComicsDownloadLink[]): GetComicsDownloadLink[] {
    const hostPriority: Record<FileHostType, number> = {
      mediafire: 1,
      mega: 2,
      direct: 3,
      dropapk: 4,
      userscloud: 5,
      zippyshare: 6,
      unknown: 7,
    };

    return links.sort((a, b) => {
      // Main links before mirrors
      if (a.isMirror !== b.isMirror) {
        return a.isMirror ? 1 : -1;
      }
      // Then by host preference
      return hostPriority[a.host] - hostPriority[b.host];
    });
  }

  /**
   * Extract ID (slug) from GetComics URL
   */
  private extractIdFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      // Remove trailing slash and get last segment
      const segments = path.replace(/\/$/, '').split('/');
      return segments[segments.length - 1] || url;
    } catch {
      return url;
    }
  }

  /**
   * Extract metadata from comic title
   */
  private extractMetadataFromTitle(
    title: string
  ): { year: string | null; format: string | null; size: string | null } {
    // Year: (2023), (2024), etc.
    const yearMatch = /\((\d{4})\)/.exec(title);
    const year = yearMatch?.[1] ?? null;

    // Format: CBR, CBZ, PDF
    const formatMatch = /\b(CBR|CBZ|PDF|EPUB)\b/i.exec(title);
    const format = formatMatch?.[1]?.toUpperCase() ?? null;

    // Size: 100 MB, 1.5 GB, etc.
    const sizeMatch = /(\d+(?:\.\d+)?\s*(?:MB|GB))/i.exec(title);
    const size = sizeMatch?.[1] ?? null;

    return { year, format, size };
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const minInterval = 1000 / this.config.rateLimit;
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }

    this.lastRequestTime = Date.now();
  }
}

// Singleton instance
let serviceInstance: GetComicsService | null = null;

/**
 * Get or create the GetComics service instance
 */
export function getGetComicsService(config?: Partial<GetComicsConfig>): GetComicsService {
  serviceInstance ??= new GetComicsService(config);
  return serviceInstance;
}

/**
 * Reset the service instance (for testing)
 */
export function resetGetComicsService(): void {
  serviceInstance = null;
}
