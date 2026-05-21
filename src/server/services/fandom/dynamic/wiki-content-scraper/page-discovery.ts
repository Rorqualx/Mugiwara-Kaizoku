/**
 * Page Discovery Module
 *
 * Purpose: Discovers volumes/chapters listing pages by analyzing wiki page links and structure.
 *
 * Extracted from: WikiContentScraper.ts (lines 209-245)
 *
 * Functions:
 * - discoverVolumesPage: Finds links to dedicated volumes/chapters listing pages
 *
 * Used for: Determining if there's a separate page for volume listings or if content
 * is embedded in the main page.
 */

import * as cheerio from 'cheerio';

import { resolveHref } from './url-utils';

import type { WikiPage } from './types';

/**
 * Discover the volumes/chapters listing page
 *
 * Searches for common patterns in wiki links that indicate dedicated volumes/chapters pages.
 * Returns null if content appears to be on the current page (detected by section headers).
 *
 * @param page - The wiki page to analyze
 * @returns Promise resolving to URL of volumes page, or null if content is on current page
 */
export async function discoverVolumesPage(page: WikiPage): Promise<string | null> {
  const $ = cheerio.load(page.html);
  const baseUrl = new URL(page.url).origin;

  // Derive series name from URL for series-specific discovery patterns
  // e.g., "Attack_on_Titan_(Manga)" → "Attack_on_Titan"
  const urlPath = new URL(page.url).pathname;
  const pageTitle = decodeURIComponent(urlPath.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
  const seriesName = pageTitle.replace(/\s*\(.*?\)\s*$/g, '').trim();
  const seriesSlug = seriesName.replace(/\s+/g, '_');

  // Common patterns for volume/chapter list pages
  // Series-specific patterns first, then generic patterns
  const patterns = [
    // Series-specific: e.g., List_of_Attack_on_Titan_chapters
    ...(seriesSlug ? [
      `a[href*="List_of_${seriesSlug}"]`,
      `a[href*="list_of_${seriesSlug.toLowerCase()}"]`,
    ] : []),
    'a[href*="List_of_Volumes"]',
    'a[href*="List_of_Chapters"]',
    'a[href*="List_of_volumes"]',
    'a[href*="List_of_chapters"]',
    'a[href*="Volumes_and_Chapters"]',
    'a[href*="Chapters_and_Volumes"]',
    'a[href*="Volume_List"]',
    'a[href*="Chapter_List"]',
    'a:contains("Volume")',
    'a:contains("Chapter")',
    '.toc a[href*="#Volume"]',
    '.toc a[href*="#Chapter"]'
  ];

  for (const pattern of patterns) {
    const link = $(pattern).first();
    if (link.length > 0) {
      const href = link.attr('href');
      if (href) {
        const resolvedUrl = resolveHref(href, baseUrl, page.url);
        if (resolvedUrl) {
          return Promise.resolve(resolvedUrl);
        }
      }
    }
  }

  // Check if there's a "Volumes" or "Chapters" section on the current page
  if ($('#Volumes, #Chapters, #Volume_List, #Chapter_List, #Volumes_and_Chapters, #Chapters_and_Volumes').length > 0) {
    return Promise.resolve(null); // Content is on the current page
  }

  return Promise.resolve(null);
}
