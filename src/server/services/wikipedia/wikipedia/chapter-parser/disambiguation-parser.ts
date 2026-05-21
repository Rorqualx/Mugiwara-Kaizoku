/**
 * Disambiguation Page Parser
 *
 * Parses disambiguation pages to find chapter sub-pages.
 * Handles cases like One Piece where there are multiple chapter list sub-pages.
 */

import { fetchPageContentById, lookupPageByTitle } from '@/server/services/wikipedia/wikipedia/api-client';
import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';

import { parseVolumeListPattern } from './formats/volume-list-pattern';

/**
 * Parse disambiguation page to find chapter sub-pages
 *
 * Searches through disambiguation page HTML for links to chapter sub-pages
 * (e.g., "List of One Piece chapters (1-100)", "List of One Piece chapters (101-200)").
 * Fetches and parses the first matching sub-page.
 *
 * @param html - HTML content of disambiguation page
 * @returns Array of chapters from first sub-page
 */
export async function parseDisambiguationPage(html: string): Promise<WikipediaChapter[]> {
  logger.info(`[WIKIPEDIA] Found disambiguation page, looking for chapter sub-pages`);

  // Extract links to chapter sub-pages - handle both href and plain text patterns
  // Pattern matches: href="/wiki/List_of_X_chapters_(1-100)" etc.
  const hrefPattern = /href="\/wiki\/([^"]+chapters[^"]+\d+[^"]*\d+[^"]*)"/g;
  const hrefMatches = [...html.matchAll(hrefPattern)];

  if (hrefMatches.length === 0) {
    return [];
  }

  logger.info(`[WIKIPEDIA] Found ${hrefMatches.length} chapter sub-page links`);

  // Decode and get the first sub-page
  const firstMatch = hrefMatches[0];
  const firstSubPageEncoded = firstMatch?.[1];

  if (!firstSubPageEncoded) {
    return [];
  }

  const firstSubPage = decodeURIComponent(firstSubPageEncoded.replace(/_/g, ' '));
  logger.info(`[WIKIPEDIA] Fetching first sub-page: ${firstSubPage}`);

  // Fetch and parse the sub-page
  const chapters = await fetchAndParseSubPage(firstSubPage);
  return chapters;
}

/**
 * Fetch and parse a chapter sub-page
 *
 * @param subPageTitle - Title of the sub-page to fetch
 * @returns Array of chapters from the sub-page
 */
async function fetchAndParseSubPage(subPageTitle: string): Promise<WikipediaChapter[]> {
  // Look up the sub-page to get its page ID
  const subPageData = await lookupPageByTitle(subPageTitle);
  const subPages = subPageData.query?.pages;

  if (!subPages) {
    return [];
  }

  const subPageId = Object.keys(subPages)[0];

  if (!subPageId || subPageId === '-1') {
    return [];
  }

  // Get the sub-page content using page ID
  const subData = await fetchPageContentById(parseInt(subPageId, 10));

  if (!subData.parse) {
    return [];
  }

  const chapters = parseVolumeListPattern(subData.parse.text?.['*'] ?? '');
  return chapters;
}
