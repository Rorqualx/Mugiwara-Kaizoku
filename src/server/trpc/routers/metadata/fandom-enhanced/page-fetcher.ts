/**
 * Page Fetcher Module
 *
 * Handles HTTP fetching and HTML processing for Fandom wiki pages.
 * Automatically follows "List of Volumes" links when present.
 */

import { logger } from '@/utils/logger';

/**
 * Fetch HTML content from a Fandom URL
 * @param url - The URL to fetch
 * @returns The HTML content as a string
 */
export async function fetchPageHtml(url: string): Promise<string> {
  const axios = (await import('axios')).default;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    timeout: 30000,
  });

  return String(response.data);
}

/**
 * Check if the page contains a link to a separate volumes page and fetch it
 * @param html - The HTML content to check
 * @param baseUrl - The wiki base URL for constructing absolute URLs
 * @returns The volumes page HTML if found, otherwise the original HTML
 */
export async function fetchVolumesPageIfExists(
  html: string,
  baseUrl: string
): Promise<string> {
  const { load } = await import('cheerio');
  const $ = load(html);

  // Check for "List of Volumes" link
  const volumesLink = $('a[href*="/wiki/List_of_Volumes"], a[title="List of Volumes"]')
    .first()
    .attr('href');

  if (!volumesLink?.includes('/wiki/List_of_Volumes')) {
    return html;
  }

  // Construct full URL for the volumes page
  const volumesUrl = volumesLink.startsWith('http') ? volumesLink : `${baseUrl}${volumesLink}`;

  logger.info(`Following link to volumes page: ${volumesUrl}`);

  // Fetch the volumes page
  const axios = (await import('axios')).default;
  const volumesResponse = await axios.get(volumesUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
    timeout: 30000,
  });

  return String(volumesResponse.data);
}

/**
 * Extract wiki base URL from a full URL
 * @param url - The full URL
 * @returns The base URL (protocol + host)
 */
export function extractWikiBaseUrl(url: string): string {
  const urlObj = new URL(url);
  return `${urlObj.protocol}//${urlObj.host}`;
}
