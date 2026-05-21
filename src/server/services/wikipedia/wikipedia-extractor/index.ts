/**
 * Wikipedia Volume Extractor Main Class
 *
 * Orchestrates extraction of manga volume data from Wikipedia pages.
 * This is the main entry point that coordinates all specialized extraction modules.
 *
 * Usage:
 *   import { wikipediaVolumeExtractor } from '@/server/services/wikipedia/wikipedia-extractor';
 *   const data = await wikipediaVolumeExtractor.extractVolumeData('One Piece');
 *
 * Refactored from: wikipediaVolumeExtractor.ts (689 lines)
 * Now composed of 10 focused modules totaling ~800 lines
 *
 * @see docs/sessions/wikipedia-volume-extractor-refactoring-plan.md
 */

import { logger } from '@/server/utils/logger';

import { extractFromMainPage } from './main-page-fallback';
import { findVolumeListPage } from './page-discovery';
import { extractFromVolumePage } from './volume-page-extraction';

import type { WikipediaVolumeData } from './types';

// ============================================================================
// Main Extractor Class
// ============================================================================

/**
 * Wikipedia Volume Extractor
 *
 * Main orchestrator for extracting manga volume and chapter data from
 * Wikipedia pages. Handles page discovery, fallback strategies, and
 * coordinates specialized extraction modules.
 *
 * Architecture:
 * - Page Discovery: Finds dedicated volume/chapter list pages
 * - Volume Page Extraction: Extracts from dedicated list pages
 * - Main Page Fallback: Extracts basic data from manga main page
 *
 * @example
 * ```typescript
 * const data = await wikipediaVolumeExtractor.extractVolumeData('One Piece');
 * if (data) {
 *   console.log(`Found ${data.totalVolumes} volumes with ${data.totalChapters} chapters`);
 * }
 * ```
 */
export class WikipediaVolumeExtractor {
  /**
   * Extract volume data from a Wikipedia page
   *
   * Attempts to find dedicated volume/chapter list pages first,
   * then falls back to extracting from the main manga page.
   *
   * Strategy:
   * 1. Search for dedicated volume/chapter list pages
   * 2. If found, extract detailed volume and chapter data
   * 3. If not found, fall back to extracting basic counts from main page
   *
   * @param pageTitle - Wikipedia page title (e.g., "One Piece")
   * @returns Complete volume data with metadata, or null if extraction fails
   *
   * @example
   * ```typescript
   * const data = await extractor.extractVolumeData('Fire Force');
   * // Returns detailed volume data with chapters, ISBNs, release dates
   * ```
   */
  async extractVolumeData(pageTitle: string): Promise<WikipediaVolumeData | null> {
    try {
      // First try to find a volume/chapter list page
      const volumePageTitle = await findVolumeListPage(pageTitle);

      if (volumePageTitle) {
        logger.info(`Found volume list page: ${volumePageTitle}`);
        return await extractFromVolumePage(volumePageTitle);
      }

      // Fall back to extracting from main page
      logger.info(`Extracting volumes from main page: ${pageTitle}`);
      return await extractFromMainPage(pageTitle);
    } catch (err: unknown) {
      logger.error('Error extracting volume data:', {
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }

  /**
   * Extract volume data from a Wikipedia URL
   *
   * Convenience method that extracts the page title from a Wikipedia URL
   * and delegates to extractVolumeData.
   *
   * Supported URL formats:
   * - https://en.wikipedia.org/wiki/One_Piece
   * - https://en.wikipedia.org/wiki/List_of_Fire_Force_chapters
   * - http://en.wikipedia.org/wiki/My_Hero_Academia (auto-upgraded to HTTPS)
   *
   * @param url - Full Wikipedia URL
   * @returns Complete volume data with metadata, or null if extraction fails
   *
   * @example
   * ```typescript
   * const data = await extractor.extractFromUrl('https://en.wikipedia.org/wiki/Fire_Force');
   * // Extracts page title "Fire Force" and calls extractVolumeData
   * ```
   */
  async extractFromUrl(url: string): Promise<WikipediaVolumeData | null> {
    try {
      // Extract page title from URL
      // Matches: /wiki/Page_Title or /wiki/Page_Title#section
      const titleMatch = url.match(/\/wiki\/([^#?]+)/);
      if (!titleMatch?.[1]) {
        logger.info('Could not extract page title from URL', { url });
        return null;
      }

      // Decode URL encoding and replace underscores with spaces
      const pageTitle = decodeURIComponent(titleMatch[1].replace(/_/g, ' '));

      logger.info('Extracted page title from URL', { url, pageTitle });
      return await this.extractVolumeData(pageTitle);
    } catch (err: unknown) {
      logger.error('Error extracting from URL:', {
        error: err instanceof Error ? err.message : String(err),
        url
      });
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance & Re-exports
// ============================================================================

/**
 * Singleton instance of WikipediaVolumeExtractor
 *
 * Use this instance throughout the application to ensure
 * consistent behavior and avoid unnecessary instantiation.
 *
 * @example
 * ```typescript
 * import { wikipediaVolumeExtractor } from '@/server/services/wikipedia/wikipedia-extractor';
 *
 * const data = await wikipediaVolumeExtractor.extractVolumeData('One Piece');
 * ```
 */
export const wikipediaVolumeExtractor = new WikipediaVolumeExtractor();

// Re-export types for backward compatibility
export type { WikipediaVolume, WikipediaChapter, WikipediaVolumeData } from './types';
