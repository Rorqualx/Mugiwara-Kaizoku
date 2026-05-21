/**
 * Wikipedia Main Page Fallback Extraction Module
 *
 * Extracts basic volume/chapter counts from main manga Wikipedia pages
 * when dedicated volume list pages are not available. Parses infobox
 * data to get approximate totals.
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 603-648)
 * ESLint fixes: Lines 622, 629 (prefer-optional-chain)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/server/utils/logger';

import { wikipediaApiClient } from './api-client';

import type { WikipediaVolumeData } from './types';

// ============================================================================
// Main Page Fallback Extraction
// ============================================================================

/**
 * Extract basic volume/chapter data from main manga page (fallback)
 *
 * When dedicated volume list pages are not available, this function
 * extracts approximate totals from the infobox on the main manga page.
 *
 * @param pageTitle - Main manga Wikipedia page title
 * @returns Basic volume data with totals, or null if extraction fails
 */
export async function extractFromMainPage(
  pageTitle: string,
): Promise<WikipediaVolumeData | null> {
  try {
    const html = await wikipediaApiClient.getPageHtml(pageTitle);
    if (!html) return null;

    const $ = cheerio.load(html);

    // Try to extract basic volume/chapter counts from infobox
    const infobox = {} as Record<string, unknown>;
    $('.infobox tr').each((_, row) => {
      const $row = $(row);
      const label = $row.find('th').text().trim().toLowerCase();
      const value = $row.find('td').text().trim();

      if (label.includes('volume')) {
        const volumeMatch = value.match(/\d+/);
        // ✅ FIXED: Use optional chaining instead of && check
        if (volumeMatch?.[0]) {
          infobox['volumes'] = parseInt(volumeMatch[0], 10);
        }
      }

      if (label.includes('chapter')) {
        const chapterMatch = value.match(/\d+/);
        // ✅ FIXED: Use optional chaining instead of && check
        if (chapterMatch?.[0]) {
          infobox['chapters'] = parseInt(chapterMatch[0], 10);
        }
      }
    });

    const totalVolumes =
      typeof infobox['volumes'] === 'number' ? infobox['volumes'] : 0;
    const totalChapters =
      typeof infobox['chapters'] === 'number' ? infobox['chapters'] : 0;

    return {
      volumes: [],
      totalVolumes,
      totalChapters,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error extracting from main page:', errorMessage);
    return null;
  }
}
