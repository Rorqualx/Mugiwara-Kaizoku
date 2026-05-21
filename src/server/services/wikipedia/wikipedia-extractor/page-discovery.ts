/**
 * Wikipedia Page Discovery Module
 *
 * Discovers Wikipedia pages related to manga volumes and chapters.
 * Finds volume/chapter list pages and related pages using pattern matching
 * and link traversal.
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 70-106)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/server/utils/logger';

import {
  fetchPageContent,
  lookupPageByTitle,
} from './api-client';

// ============================================================================
// Page Existence Check
// ============================================================================

/**
 * Check if a Wikipedia page exists
 *
 * @param title - Wikipedia page title to check
 * @returns True if page exists, false otherwise
 */
async function pageExists(title: string): Promise<boolean> {
  try {
    return await lookupPageByTitle(title);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug(`Error checking if page exists: ${errorMessage}`);
    return false;
  }
}

// ============================================================================
// Links Extraction
// ============================================================================

/**
 * Get links from a Wikipedia page
 *
 * @param pageTitle - Wikipedia page title
 * @returns Array of linked page titles
 */
async function getPageLinks(pageTitle: string): Promise<string[]> {
  try {
    const htmlContent = await fetchPageContent(pageTitle);
    if (!htmlContent) {
      return [];
    }

    // Parse HTML and extract section titles
    const $ = cheerio.load(htmlContent);
    const sections: string[] = [];

    // Find all section headers that might contain chapter/volume information
    $('h2, h3').each((_, element) => {
      const sectionText = $(element).text().trim();
      if (sectionText &&
          (sectionText.toLowerCase().includes('chapter') ||
           sectionText.toLowerCase().includes('volume'))) {
        sections.push(sectionText);
      }
    });

    return sections;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug(`Error getting page links: ${errorMessage}`);
    return [];
  }
}

// ============================================================================
// Volume List Page Discovery
// ============================================================================

/**
 * Find the volume/chapter list page for a manga
 *
 * Searches for dedicated volume/chapter list pages using common patterns
 * and link discovery. Uses parallel page existence checks to avoid
 * sequential await-in-loop patterns.
 *
 * @param mainPageTitle - Main manga Wikipedia page title
 * @returns Volume list page title if found, null otherwise
 */
export async function findVolumeListPage(
  mainPageTitle: string,
): Promise<string | null> {
  try {
    // Common patterns for volume list pages
    const patterns = [
      `List of ${mainPageTitle} chapters`,
      `List of ${mainPageTitle} volumes`,
      `${mainPageTitle} chapter list`,
      `${mainPageTitle} volume list`,
    ];

    // ✅ PARALLEL CHECK - Avoid await-in-loop ESLint warning
    // Check all patterns concurrently
    const existsPromises = patterns.map((pattern) =>
      pageExists(pattern).then((exists) => ({ pattern, exists })),
    );

    const results = await Promise.all(existsPromises);
    const found = results.find((result) => result.exists);

    if (found) {
      return found.pattern;
    }

    // Try to find through links from main page
    const links = await getPageLinks(mainPageTitle);

    // Filter links that match chapter/volume patterns
    const matchedLink = links.find(
      (link) =>
        link.toLowerCase().includes('list') &&
        (link.toLowerCase().includes('chapter') ||
          link.toLowerCase().includes('volume')),
    );

    if (matchedLink) {
      return matchedLink;
    }

    return null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error finding volume list page:', { error: errorMessage });
    return null;
  }
}
