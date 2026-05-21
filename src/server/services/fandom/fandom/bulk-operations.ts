/**
 * Fandom Bulk Operations
 *
 * Bulk fetching for volumes, chapters, and characters.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { MediaWikiAPI } from '../MediaWikiAPI';
import type { WikiConfig } from '../types';

const log = logger.child('FandomBulkOps');

export interface BulkFetchOptions {
  includeChapterDetails?: boolean;
  maxChaptersPerVolume?: number;
  cacheResults?: boolean;
}

export interface BulkFetchResult {
  volumes: unknown[];
  chapters: unknown[];
  totalChapters: number;
  fetchTime: number;
}

/**
 * Get all characters from the wiki
 */
export async function getAllCharacters(
  wikiConfig: WikiConfig,
  mediaWikiAPI: MediaWikiAPI,
  limit: number = 500
): Promise<string[]> {
  if (!wikiConfig.categories?.characters) {
    return [];
  }
  const characters = await mediaWikiAPI.getCategoryMembers(
    wikiConfig.categories.characters,
    { limit }
  );
  return characters.map(char => char.title);
}

/**
 * Get all manga chapters
 */
export async function getAllChapters(
  wikiConfig: WikiConfig,
  mediaWikiAPI: MediaWikiAPI,
  limit: number = 500
): Promise<string[]> {
  if (!wikiConfig.categories?.chapters) {
    return [];
  }
  const chapters = await mediaWikiAPI.getCategoryMembers(
    wikiConfig.categories.chapters,
    { limit }
  );
  return chapters.map(chap => chap.title);
}

/**
 * Bulk fetch volumes and chapters with their details
 * Optimized method that fetches all data in fewer requests
 */
export async function bulkFetchVolumeChapterData(
  volumesListUrl: string | undefined,
  mediaWikiAPI: MediaWikiAPI,
  _options: BulkFetchOptions = {}
): Promise<BulkFetchResult> {
  const startTime = Date.now();

  try {
    // If we have a volumes list URL, fetch and parse it
    if (volumesListUrl) {
      const response = await axios.get(volumesListUrl);
      const $ = cheerio.load(response.data as string);

      // Parse volume tables for bulk data extraction
      const volumes: unknown[] = [];
      const allChapters: unknown[] = [];

      // Access the baseUrl from the MediaWikiAPI config
      const config = mediaWikiAPI['config'] as { baseUrl: string };
      const baseUrl = config.baseUrl;

      // Find all volume tables (Fire Force uses plain tables)
      $('table').each((_, table) => {
        const $table = $(table);
        const rows = $table.find('tr').slice(1); // Skip header

        rows.each((_, row) => {
          const $row = $(row);
          const cells = $row.find('td');

          if (cells.length >= 2) {
            // Extract volume number
            const volumeText = cells.eq(0).text().trim();
            const volumeMatch = volumeText.match(/\d+/);
            if (!volumeMatch) return;

            const volumeNumber = parseInt(volumeMatch[0]);

            // Extract chapter links from the row
            const chapterLinks = $row.find('a[href*="Chapter"]');
            const chapters: unknown[] = [];

            chapterLinks.each((_, link) => {
              const $link = $(link);
              const href = $link.attr('href');
              const title = $link.text().trim();
              const chapterMatch = title.match(/Chapter\s+(\d+)/i);

              if (href && chapterMatch) {
                const chapterNumber = parseInt(chapterMatch[1] ?? '0');
                const fullUrl = href.startsWith('http') ? href :
                  `${baseUrl}${href.startsWith('/') ? '' : '/wiki/'}${href}`;

                chapters.push({
                  chapterNumber: chapterNumber.toString(),
                  title,
                  url: fullUrl
                });

                allChapters.push({
                  volumeNumber,
                  chapterNumber: chapterNumber.toString(),
                  title,
                  url: fullUrl
                });
              }
            });

            // Extract volume description if available
            const description = cells.eq(2).text().trim() || '';

            volumes.push({
              volumeNumber,
              title: `Volume ${volumeNumber}`,
              chapters,
              chapterCount: chapters.length,
              description: description.substring(0, 500)
            });
          }
        });
      });

      const fetchTime = Date.now() - startTime;
      log.info(`Bulk fetched ${volumes.length} volumes with ${allChapters.length} chapters in ${fetchTime}ms`);

      return {
        volumes,
        chapters: allChapters,
        totalChapters: allChapters.length,
        fetchTime
      };
    }

    // Fallback - return empty if no URL provided
    return {
      volumes: [],
      chapters: [],
      totalChapters: 0,
      fetchTime: Date.now() - startTime
    };
  } catch (error) {
    log.error('Failed to bulk fetch volume/chapter data:', error);
    throw error;
  }
}

/**
 * Check if a Chapter 0 page exists for the manga
 * Uses parallel requests to check multiple possible page titles
 */
export async function checkChapterZeroPageExists(
  mediaWikiAPI: MediaWikiAPI,
  subdomain: string,
  title?: string
): Promise<boolean> {
  try {
    // Try common Chapter 0 page title patterns
    const possibleTitles = [
      'Chapter 0',
      'Chapter Zero',
      'Prologue'
    ];

    if (title) {
      // Add manga-specific variations
      const cleanTitle = title.replace(/ \(manga\)| \(series\)/gi, '');
      possibleTitles.push(
        `${cleanTitle} Chapter 0`,
        `Chapter 0 (${cleanTitle})`,
        `${cleanTitle}/Chapter 0`
      );
    }

    // Check all pages in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      possibleTitles.map(pageTitle => mediaWikiAPI.getPageByTitle(pageTitle))
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.pageid) {
        const pageTitle = possibleTitles[results.indexOf(result)];
        log.info(`Found Chapter 0 page: "${pageTitle}" (ID: ${result.value.pageid})`);
        return true;
      }
    }

    return false;
  } catch (error) {
    log.debug('Error checking for Chapter 0 page:', error);
    return false;
  }
}
