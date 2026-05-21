/**
 * Fandom Volumes Parser
 *
 * Scrapes List of Volumes pages for accurate volume counts.
 * Parses rendered HTML instead of wikitext to get accurate data
 * from volume tables, tabs, and link patterns.
 */

import * as cheerio from 'cheerio';

import type { MediaWikiAPI } from '@/server/services/fandom/MediaWikiAPI';
import type { WikiConfig } from '@/server/services/fandom/types';
import { fetchPageHtmlViaApi } from '@/server/services/fandom/utils/mediaWikiApiFetch';
import { logger } from '@/utils/logger';

const log = logger.child('FandomVolumesParser');

/**
 * Result of volume scraping operation
 */
export interface VolumeScrapingResult {
  volumeCount: number;
  volumeNumbers: number[];
}

/**
 * Scrape volume list page for accurate volume count
 */
export async function scrapeVolumesList(
  title: string,
  mediaWikiAPI: MediaWikiAPI,
  wikiConfig: WikiConfig
): Promise<number | undefined> {
  try {
    // Search for the List of Volumes page
    const searchPatterns = [
      'List of Volumes',
      `${title} List of Volumes`,
      'Volumes',
      'Volume List'
    ];

    let relevantPage: { title: string; pageid: number } | null = null;

    // Search all patterns in parallel and find first valid result
    const searchResults = await Promise.all(
      searchPatterns.map(async (pattern) => {
        const volumeListPages = await mediaWikiAPI.search(pattern, { limit: 5 });
        const found = volumeListPages.find(p =>
          p.title.includes('Volume') || p.title.includes('volumes')
        ) ?? null;
        return { pattern, page: found };
      })
    );

    // Find the first successful result (preserving pattern priority order)
    const successfulResult = searchResults.find(result => result.page !== null);
    if (successfulResult) {
      relevantPage = successfulResult.page;
      log.info('Found volumes page', {
        searchPattern: successfulResult.pattern,
        pageTitle: relevantPage?.title
      });
    }

    if (!relevantPage) {
      log.warn('No volumes page found for title:', title);
      return undefined;
    }

    // Fetch the actual HTML page via MediaWiki API (bypasses Cloudflare)
    const pageUrl = `https://${wikiConfig.subdomain}.fandom.com/wiki/${encodeURIComponent(relevantPage.title)}`;
    log.info('Fetching HTML from List of Volumes page via MediaWiki API', { url: pageUrl });

    const html = await fetchPageHtmlViaApi(pageUrl);
    if (!html) {
      log.warn('Failed to fetch volumes page via MediaWiki API', { url: pageUrl });
      return undefined;
    }

    const $ = cheerio.load(html);
    const volumeNumbers = new Set<number>();

    // Look for volume links in the rendered HTML
    $('a[href*="/wiki/Volume_"]').each((_, el) => {
      const text = $(el).text();
      const href = $(el).attr('href');

      // Extract volume number from href or text
      const hrefMatch = href?.match(/Volume[_ ](\d+)/i);
      const textMatch = text.match(/Volume\s*(\d+)/i);

      if (hrefMatch) {
        volumeNumbers.add(parseInt(hrefMatch[1] ?? '0'));
      } else if (textMatch) {
        volumeNumbers.add(parseInt(textMatch[1] ?? '0'));
      }
    });

    // Extract series name for pattern matching
    const seriesName = title
      .replace(/\s*\(manga\)\s*$/i, '')
      .replace(/\s*\(series\)\s*$/i, '')
      .trim();

    // Look for links with the series name followed by a number
    $('a').each((_, el) => {
      const linkTitle = $(el).attr('title') ?? '';
      const linkText = $(el).text();

      // Create a dynamic pattern for this series
      const seriesPattern = new RegExp(
        `${seriesName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)`,
        'i'
      );

      // Check both title attribute and text content
      const titleMatch = linkTitle.match(seriesPattern);
      const textMatch = linkText.match(seriesPattern);

      if (titleMatch) {
        volumeNumbers.add(parseInt(titleMatch[1] ?? '0'));
      } else if (textMatch) {
        volumeNumbers.add(parseInt(textMatch[1] ?? '0'));
      }
    });

    // Check table cells for volume mentions
    $('td, th').each((_, el) => {
      const text = $(el).text();

      // Match "Volume X" pattern
      const volumeMatch = text.match(/Volume\s+(\d+)(?:\s|:|$)/i);
      if (volumeMatch) {
        volumeNumbers.add(parseInt(volumeMatch[1] ?? '0'));
      } else {
        // Check for series-specific patterns in table cells
        const seriesPattern = new RegExp(
          `${seriesName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)(?:\\s|:|$)`,
          'i'
        );
        const seriesMatch = text.match(seriesPattern);

        if (seriesMatch) {
          volumeNumbers.add(parseInt(seriesMatch[1] ?? '0'));
        }
      }
    });

    // Look for tabbed content (many wikis use tabs for organizing volumes)
    $('.wds-tab__content, .tabber-content').each((_, tabContent) => {
      $(tabContent).find('a[href*="/wiki/Volume_"]').each((_, el) => {
        const href = $(el).attr('href');
        const match = href?.match(/Volume[_ ](\d+)/i);

        if (match) {
          volumeNumbers.add(parseInt(match[1] ?? '0'));
        }
      });
    });

    if (volumeNumbers.size > 0) {
      const maxVolume = Math.max(...Array.from(volumeNumbers));
      const uniqueVolumes = volumeNumbers.size;

      log.info('Scraped volume count from List of Volumes HTML', {
        actualCount: maxVolume,
        uniqueVolumesFound: uniqueVolumes,
        volumeNumbersFound: Array.from(volumeNumbers).sort((a, b) => a - b)
      });

      return maxVolume;
    }

    log.warn('No volumes found in List of Volumes HTML', {
      pageTitle: relevantPage.title,
      url: pageUrl
    });

    return undefined;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Failed to scrape volumes list', {
      title,
      error: errorMessage
    });
    return undefined;
  }
}
