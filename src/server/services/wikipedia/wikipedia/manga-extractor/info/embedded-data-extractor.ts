/**
 * Embedded Data Extractor Module
 *
 * Extracts embedded volume and chapter data from Wikipedia pages:
 * - Volume count from infobox
 * - Chapter count from infobox
 * - Volume list URL
 * - Embedded chapters from HTML content
 * - Embedded volumes from HTML content
 *
 * Part of getMangaInfo extraction (lines 300-463 of original)
 */

import * as cheerio from 'cheerio';

import { extractEmbeddedVolumes } from '@/server/services/wikipedia/volume-parser';
import { extractEmbeddedChapters } from '@/server/services/wikipedia/wikipedia/chapter-parser';
import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';

import type { AnyNode } from 'domhandler';

/**
 * Extract volume count from infobox row
 */
function extractVolumeCount(volumesRow: cheerio.Cheerio<AnyNode>): number | null {
  const volumesText = volumesRow.find('td').text();
  const numMatch = volumesText.match(/(\d+)/);
  return numMatch?.[1] ? parseInt(numMatch[1], 10) : null;
}

/**
 * Extract volume list URL from infobox row
 */
function extractVolumeListUrl(
  volumesRow: cheerio.Cheerio<AnyNode>
): string | null {
  const volumeLink = volumesRow.find('td a');
  if (!volumeLink.length) return null;

  const href = volumeLink.attr('href');
  if (href?.startsWith('/wiki/')) {
    return `https://en.wikipedia.org${href}`;
  }
  return null;
}

/**
 * Extract chapter count from infobox row
 */
function extractChapterCount(chaptersRow: cheerio.Cheerio<AnyNode>): number | null {
  const chaptersText = chaptersRow.find('td').text();
  const allNumbers = [...chaptersText.matchAll(/(\d+)/g)].map((m) => parseInt(m[1] ?? '0', 10));
  if (allNumbers.length === 0) return null;
  // Multiple numbers in the cell (e.g. "700 chapters in 72 volumes") — prefer the largest,
  // which is almost always the chapter count (volume counts are smaller).
  // For single-number cells this is equivalent to the old behavior.
  return Math.max(...allNumbers);
}

/**
 * Extract infobox data (volumes, chapters, URLs)
 */
function extractInfoboxData(
  $: cheerio.CheerioAPI,
  mangaData: WikipediaMangaData
): void {
  const infobox = $('.infobox');
  if (!infobox.length) return;

  // Extract volumes with link to volume list
  const volumesRow = infobox.find('tr:contains("Volumes")');
  if (volumesRow.length) {
    const volumeCount = extractVolumeCount(volumesRow);
    if (volumeCount !== null) {
      // eslint-disable-next-line no-param-reassign
      mangaData.volumes = volumeCount;
    }

    const volumeListUrl = extractVolumeListUrl(volumesRow);
    if (volumeListUrl) {
      // eslint-disable-next-line no-param-reassign
      mangaData.volumeListUrl = volumeListUrl;
    }
  }

  // Extract chapter count from infobox (more accurate than counting patterns)
  const chaptersRow = infobox.find('tr:contains("Chapters")');
  if (chaptersRow.length) {
    const chapterCount = extractChapterCount(chaptersRow);
    if (chapterCount !== null) {
      // eslint-disable-next-line no-param-reassign
      mangaData.chapters = chapterCount;
    }
  }
}

/**
 * Extract embedded volume and chapter data from page content
 *
 * @param $ - Cheerio instance loaded with page HTML
 * @param htmlContent - Raw HTML content for parsing embedded data
 * @param mangaData - Existing manga data object to populate
 */
export function extractEmbeddedData(
  $: cheerio.CheerioAPI,
  htmlContent: string,
  mangaData: WikipediaMangaData
): void {
  // Extract data from infobox first (most accurate for counts)
  extractInfoboxData($, mangaData);

  // Check if the main page contains embedded volume/chapter data
  const embeddedChapters = extractEmbeddedChapters(htmlContent);
  if (embeddedChapters.length > 0) {
    // eslint-disable-next-line no-param-reassign
    mangaData.chapterList = embeddedChapters;
    // Only set chapter count from embedded if not already set from infobox
    // eslint-disable-next-line no-param-reassign
    mangaData.chapters ??= embeddedChapters.length;
  }

  // Extract embedded volume data if present
  const embeddedVolumes = extractEmbeddedVolumes(htmlContent);
  if (embeddedVolumes.length > 0) {
    // eslint-disable-next-line no-param-reassign
    mangaData.volumeList = embeddedVolumes;
    // eslint-disable-next-line no-param-reassign
    mangaData.volumes ??= embeddedVolumes.length;
  }
}
