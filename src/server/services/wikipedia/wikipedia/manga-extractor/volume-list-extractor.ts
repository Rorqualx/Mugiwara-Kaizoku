/**
 * Volume List Extractor Module
 *
 * Orchestrates volume extraction from Wikipedia:
 * - Gets volume lists with chapter information
 * - Extracts specific volumes with chapters
 * - Retrieves volumes with rich descriptions
 * - Handles multiple volume table formats
 *
 * Extracted from manga-extractor (lines 716-998)
 */

import {
  parseVolumeTable,
  parseVolumeTableWithDescriptions,
} from '@/server/services/wikipedia/volume-parser';
import { wikipediaVolumeExtractor } from '@/server/services/wikipedia/wikipediaVolumeExtractor';
import { logger } from '@/utils/logger';
import { isObject, hasProperty, isArray, isString } from '@/utils/type-guards';

import { fetchPageContent } from '../api-client';
import { stripHtml } from '../utils';

import type { Cache, WikipediaVolume, WikipediaChapter } from '../types';

/**
 * Get volume list from Wikipedia
 *
 * Orchestrates volume extraction using:
 * 1. Enhanced volume extractor for rich metadata
 * 2. Fallback to standard HTML parsing
 * 3. Caching for performance
 *
 * @param volumeListUrl - URL to the volume list page
 * @param cache - Cache instance for storing results
 * @returns Array of volumes with chapter information
 */
export async function getVolumeList(
  volumeListUrl: string,
  cache: Cache<unknown>
): Promise<WikipediaVolume[]> {
  const cacheKey = `volumes:${volumeListUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug(`[WIKIPEDIA] Using cached volumes for: ${volumeListUrl}`);
    return cached as WikipediaVolume[];
  }

  try {
    // Extract page title from URL
    const urlMatch = volumeListUrl.match(/wiki\/(.+)$/);
    if (!urlMatch?.[1]) {
      return [];
    }

    const pageTitle = decodeURIComponent(urlMatch[1].replace(/_/g, ' '));
    logger.info(`[WIKIPEDIA] Fetching volume list from: ${pageTitle}`);

    // Use the enhanced volume extractor
    const volumeData = await wikipediaVolumeExtractor.extractVolumeData(pageTitle);

    if (volumeData && volumeData.volumes.length > 0) {
      logger.info(
        `[WIKIPEDIA] Enhanced extractor found ${volumeData.volumes.length} volumes with rich metadata`
      );

      // Convert to WikipediaVolume format
      const volumes: WikipediaVolume[] = volumeData.volumes.map((vol) => {
        const volume: WikipediaVolume = {
          number: parseInt(vol.number) || 0,
          chapters:
            vol['chapters']?.map((ch) => ({
              number: ch.number,
              title: ch['title'] ?? '',
            })) ?? [],
        };

        const volTitle = vol['title'] ?? vol.englishTitle ?? vol.japaneseTitle;
        if (volTitle) volume.title = volTitle;

        const altTitles = [vol.japaneseTitle, vol.englishTitle].filter(Boolean) as string[];
        if (altTitles.length > 0) volume.alternativeTitles = altTitles;

        if (vol.releaseDate) volume.originalReleaseDate = vol.releaseDate;
        if (vol.isbn) volume.isbn = vol.isbn;
        if (vol.summary) {
          volume.description = vol.summary;
          volume.summary = vol.summary;
        }

        return volume;
      });

      cache.set(cacheKey, volumes);
      return volumes;
    }

    // Fall back to original parsing method if enhanced extractor fails
    logger.info(`[WIKIPEDIA] Falling back to original parsing method`);
    const response = await fetchPageContent(pageTitle);
    const data: unknown = response;

    if (!isObject(data) || !hasProperty(data, 'parse')) {
      return [];
    }

    const parsedData = data['parse'];
    if (!isObject(parsedData) || !hasProperty(parsedData, 'text')) {
      return [];
    }

    const textData = parsedData['text'];
    if (!isObject(textData) || !hasProperty(textData, '*')) {
      return [];
    }

    const htmlContent = textData['*'];
    if (!isString(htmlContent)) {
      return [];
    }

    const volumes = parseVolumeTable(htmlContent);
    cache.set(cacheKey, volumes);
    return volumes;
  } catch (error: unknown) {
    logger.error(
      `Wikipedia getVolumeList error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Extract HTML content from Wikipedia API response
 *
 * Validates the response structure and extracts the HTML content.
 *
 * @param response - Wikipedia API response
 * @returns HTML content or null if invalid
 */
function extractHtmlContent(response: unknown): string | null {
  if (!isObject(response) || !hasProperty(response, 'parse')) {
    return null;
  }

  const parsedData = response['parse'];
  if (!isObject(parsedData) || !hasProperty(parsedData, 'text')) {
    return null;
  }

  const textData = parsedData['text'];
  if (!isObject(textData) || !hasProperty(textData, '*')) {
    return null;
  }

  const htmlContent = textData['*'];
  return isString(htmlContent) ? htmlContent : null;
}

/**
 * Find volume section in HTML content
 *
 * Searches for the specific volume section by ID.
 *
 * @param htmlContent - HTML content to search
 * @param volumeNumber - Volume number to find
 * @returns Volume section HTML or null if not found
 */
function findVolumeSection(htmlContent: string, volumeNumber: number): string | null {
  const volumePattern = new RegExp(`id="vol${volumeNumber}".*?(<tr.*?</tr>.*?){1,10}`, 's');
  const volumeMatch = htmlContent.match(volumePattern);

  if (!volumeMatch || !isArray(volumeMatch) || volumeMatch.length === 0) {
    return null;
  }

  const volumeSection = volumeMatch[0];
  return isString(volumeSection) ? volumeSection : null;
}

/**
 * Extract chapters from volume section
 *
 * Parses chapter titles from HTML list items.
 *
 * @param volumeSection - HTML section containing chapters
 * @param volumeNumber - Volume number for chapter association
 * @returns Array of chapters
 */
function extractChaptersFromSection(
  volumeSection: string,
  volumeNumber: number
): WikipediaChapter[] {
  const chapterPattern = /<li>"([^"<]+)"/g;
  const chapterMatches = [...volumeSection.matchAll(chapterPattern)];

  return chapterMatches.map((match, index) => {
    const chTitle = isArray(match) && match.length > 1 && isString(match[1]) ? match[1] : undefined;
    return {
      number: index + 1,
      title: chTitle ?? '',
      volumeNumber: volumeNumber,
    };
  });
}

/**
 * Extract volume title from section
 *
 * Searches for italic-formatted title in the volume section.
 *
 * @param volumeSection - HTML section to search
 * @returns Volume title or null if not found
 */
function extractVolumeTitle(volumeSection: string): string | null {
  const titleMatch = volumeSection.match(/<i>([^<]+)<\/i>/);

  if (!titleMatch || !isArray(titleMatch) || titleMatch.length <= 1) {
    return null;
  }

  const title = titleMatch[1];
  return isString(title) ? title : null;
}

/**
 * Extract volume description from section
 *
 * Searches for description paragraph after the chapter table.
 *
 * @param volumeSection - HTML section to search
 * @returns Description or null if not found
 */
function extractVolumeDescription(volumeSection: string): string | null {
  const descPattern = new RegExp(`</table>.*?<p>([^<]+.*?)</p>`, 's');
  const descMatch = volumeSection.match(descPattern);

  if (!descMatch || !isArray(descMatch) || descMatch.length <= 1) {
    return null;
  }

  const descContent = descMatch[1];
  if (!isString(descContent)) {
    return null;
  }

  return stripHtml(descContent) || null;
}

/**
 * Build volume object from extracted data
 *
 * Constructs a WikipediaVolume with optional title and description.
 *
 * @param volumeNumber - Volume number
 * @param chapters - Array of chapters
 * @param title - Optional volume title
 * @param description - Optional volume description
 * @returns Complete volume object
 */
function buildVolumeObject(
  volumeNumber: number,
  chapters: WikipediaChapter[],
  title: string | null,
  description: string | null
): WikipediaVolume {
  const volume: WikipediaVolume = {
    number: volumeNumber,
    chapters,
  };

  if (title) {
    volume.title = title;
  }

  if (description) {
    volume.description = description;
  }

  return volume;
}

/**
 * Get specific volume with chapters from Wikipedia
 *
 * Orchestrates extraction of a single volume's detailed information
 * including chapter titles and volume description.
 *
 * @param chapterPageUrl - URL to the chapter list page
 * @param volumeNumber - Volume number to extract
 * @returns Volume with chapters or null if not found
 */
export async function getVolumeWithChapters(
  chapterPageUrl: string,
  volumeNumber: number
): Promise<WikipediaVolume | null> {
  try {
    // Extract page title from URL
    const urlMatch = chapterPageUrl.match(/wiki\/(.+)$/);
    if (!urlMatch?.[1]) {
      return null;
    }

    const pageTitle = decodeURIComponent(urlMatch[1].replace(/_/g, ' '));
    logger.info(`[WIKIPEDIA] Fetching volume ${volumeNumber} details from: ${pageTitle}`);

    // Get and validate page content
    const response = await fetchPageContent(pageTitle);
    const htmlContent = extractHtmlContent(response);
    if (!htmlContent) {
      return null;
    }

    // Find the specific volume section
    const volumeSection = findVolumeSection(htmlContent, volumeNumber);
    if (!volumeSection) {
      return null;
    }

    // Extract all volume components
    const chapters = extractChaptersFromSection(volumeSection, volumeNumber);
    const title = extractVolumeTitle(volumeSection);
    const description = extractVolumeDescription(volumeSection);

    // Build and return the complete volume object
    return buildVolumeObject(volumeNumber, chapters, title, description);
  } catch (error: unknown) {
    logger.error(
      `Wikipedia getVolumeWithChapters error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Get volumes with descriptions and chapter ranges from Wikipedia
 *
 * Orchestrates extraction of volumes with rich metadata:
 * - Volume titles (Japanese and English)
 * - Chapter ranges or individual chapter lists
 * - Plot descriptions/summaries
 * - Release dates and ISBNs
 *
 * Handles multiple formats:
 * - Volume sections with descriptions (Kaiju No. 8 style)
 * - Fire Force style with individual chapter titles
 * - Table-based volume lists with descriptions
 *
 * @param volumeListUrl - URL to the volume list page
 * @param cache - Cache instance for storing results
 * @returns Array of volumes with descriptions and chapter ranges
 */
export async function getVolumesWithDescriptions(
  volumeListUrl: string,
  cache: Cache<unknown>
): Promise<WikipediaVolume[]> {
  const cacheKey = `volumes-desc:${volumeListUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug(`[WIKIPEDIA] Using cached volumes with descriptions for: ${volumeListUrl}`);
    return cached as WikipediaVolume[];
  }

  try {
    // Extract page title from URL
    const urlMatch = volumeListUrl.match(/wiki\/(.+)$/);
    if (!urlMatch?.[1]) {
      return [];
    }

    const pageTitle = decodeURIComponent(urlMatch[1].replace(/_/g, ' '));
    logger.info(`[WIKIPEDIA] Fetching volumes with descriptions from: ${pageTitle}`);

    // Get the page content
    const response = await fetchPageContent(pageTitle);
    const data: unknown = response;

    if (!isObject(data) || !hasProperty(data, 'parse')) {
      return [];
    }

    const parsedData = data['parse'];
    if (!isObject(parsedData) || !hasProperty(parsedData, 'text')) {
      return [];
    }

    const textData = parsedData['text'];
    if (!isObject(textData) || !hasProperty(textData, '*')) {
      return [];
    }

    const htmlContent = textData['*'];
    if (!isString(htmlContent)) {
      return [];
    }

    // Use volume-parser to parse volumes with descriptions
    const volumes = parseVolumeTableWithDescriptions(htmlContent);

    logger.info(`[WIKIPEDIA] Found ${volumes.length} volumes with descriptions`);
    cache.set(cacheKey, volumes);
    return volumes;
  } catch (error: unknown) {
    logger.error(
      `Wikipedia getVolumesWithDescriptions error: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
