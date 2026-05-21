/**
 * Wikipedia Volume Page Extraction Module
 *
 * Extracts volume data from dedicated volume/chapter list pages.
 * Orchestrates extraction from wikitable elements using specialized extractors.
 *
 * Extracted from: wikipediaVolumeExtractor.ts (lines 145-183)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/server/utils/logger';

import { wikipediaApiClient } from './api-client';
import { extractChaptersFromCell, extractChaptersFromText } from './chapter-extraction';
import { extractFireForceStyleVolumes } from './fire-force-extraction';
import { extractPublicationInfo } from './publication-info';
import { extractVolumesFromTable } from './volume-table-extraction';

import type { WikipediaVolumeData, WikipediaVolume } from './types';
import type { Element } from 'domhandler';

// ============================================================================
// Volume Page Extraction
// ============================================================================

/**
 * Extract volume data from a dedicated volume/chapter list page
 *
 * @param pageTitle - Wikipedia page title (e.g., "List of One Piece chapters")
 * @returns Volume data with metadata, or null if extraction fails
 */
export async function extractFromVolumePage(
  pageTitle: string,
): Promise<WikipediaVolumeData | null> {
  try {
    // Get the parsed HTML content
    const html: string | null = await wikipediaApiClient.getPageHtml(pageTitle);
    if (!html) return null;

    const $ = cheerio.load(html);
    const volumes: WikipediaVolume[] = [];

    // Find all volume tables
    $('table.wikitable').each((_, table) => {
      const $table: cheerio.Cheerio<Element> = $(table as Element);

      // Create a wrapper function for extractFireForceStyleVolumes that uses extractChaptersFromText
      const fireForceExtractor = ($: cheerio.CheerioAPI, $table: cheerio.Cheerio<Element>): WikipediaVolume[] =>
        extractFireForceStyleVolumes($, $table, extractChaptersFromText);

      const extractedVolumes = extractVolumesFromTable(
        $,
        $table,
        fireForceExtractor,
        extractChaptersFromCell,
      );
      volumes.push(...extractedVolumes);
    });

    // Extract publication info
    const publicationInfo = extractPublicationInfo($);

    // Calculate totals
    const totalChapters = volumes.reduce(
      (sum, vol) => sum + (vol.chapters?.length ?? 0),
      0,
    );

    return {
      volumes,
      totalVolumes: volumes.length,
      totalChapters,
      ...publicationInfo,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error extracting from volume page:', errorMessage);
    return null;
  }
}
