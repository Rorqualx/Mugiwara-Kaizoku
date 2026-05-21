/**
 * Helper functions for URL parsing and manipulation
 * Extracted from manga.ts lines 1361-1632 refactoring
 *
 * @module urlHelpers
 */

import { logger } from '@/utils/logger';

/**
 * Type guard for record objects
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely get a string value from an unknown object
 */
function safeGetString(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const value = obj[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Extract URL origin from base URL or fallback to chapter URLs
 *
 * @param baseUrl - Primary URL to extract origin from (sourceUrl or volumesUrl)
 * @param chapterUrls - Fallback array of chapter URLs
 * @param defaultOrigin - Default origin if extraction fails (default: 'https://fandom.com')
 * @returns Extracted origin or default
 */
export function extractUrlOrigin(
  baseUrl: string | undefined,
  chapterUrls: unknown[],
  defaultOrigin: string = 'https://fandom.com'
): string {
  // Try to extract from base URL first
  if (baseUrl) {
    try {
      return new URL(baseUrl).origin;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Could not parse base URL: ${baseUrl}, error: ${errorMessage}`);
    }
  }

  // Try to extract origin from the first valid chapter URL
  const firstValidUrl = findFirstHttpUrl(chapterUrls);
  if (firstValidUrl) {
    try {
      return new URL(firstValidUrl).origin;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Could not parse chapter URL: ${firstValidUrl}, error: ${errorMessage}`);
    }
  }

  // Fall back to default origin
  logger.info(`Using default origin: ${defaultOrigin}`);
  return defaultOrigin;
}

/**
 * Find the first valid HTTP(S) URL in an array of unknown URL data
 *
 * @param urls - Array of URL data (strings or objects with 'url' property)
 * @returns First valid HTTP(S) URL or null if none found
 */
function findFirstHttpUrl(urls: unknown[]): string | null {
  for (const urlData of urls) {
    const urlStr = extractUrlString(urlData);
    if (urlStr?.startsWith('http')) {
      return urlStr;
    }
  }
  return null;
}

/**
 * Extract URL string from URL data (string or object format)
 *
 * @param urlData - URL data in string or object format
 * @returns Extracted URL string or null
 */
function extractUrlString(urlData: unknown): string | null {
  if (typeof urlData === 'string') {
    return urlData;
  }

  if (isRecord(urlData)) {
    return safeGetString(urlData, 'url');
  }

  return null;
}
