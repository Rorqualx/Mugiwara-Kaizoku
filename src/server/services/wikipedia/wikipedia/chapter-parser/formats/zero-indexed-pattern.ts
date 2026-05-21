/**
 * Zero-Indexed Chapter Pattern Parser
 *
 * Parses chapters from Wikipedia HTML content when chapters start with 00 or 0.
 * Pattern: "00. Title", "01. Title", etc.
 * Enhanced to extract chapter release dates and volume mappings from table structure.
 *
 * Used by: Fire Force and similar manga with zero-indexed chapter numbering
 */

import * as cheerio from 'cheerio';

import { extractDateString, containsWikipediaArtifacts } from '@/server/services/shared/parsing-utils';
import { DEFAULT_PARSER_CONFIG } from '@/server/services/wikipedia/parser-config';
import type { ChapterMatch, WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { cleanChapterTitle } from '@/server/services/wikipedia/wikipedia/utils';
import { logger } from '@/utils/logger';

// Use configurable values instead of hardcoded magic numbers
const { chapters: chapterConfig } = DEFAULT_PARSER_CONFIG;

/**
 * Extract chapter release dates from Wikipedia table structure
 *
 * Parses the HTML table to find release dates for each chapter.
 * Wikipedia chapter tables typically have columns: No. | Title | Release date
 *
 * @param html - HTML content containing chapter table
 * @returns Map of chapter number to release date
 */
function extractChapterDatesFromTable(html: string): Map<number | string, string> {
  const chapterDates = new Map<number | string, string>();
  const $ = cheerio.load(html);

  // Find chapter tables (usually have class "wikitable" and contain chapter rows)
  const tables = $('table.wikitable');

  tables.each((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr');

    // Skip if table doesn't look like a chapter table
    const headerRow = rows.first();
    const headerText = headerRow.text().toLowerCase();
    if (!headerText.includes('no') && !headerText.includes('chapter') && !headerText.includes('title')) {
      return;
    }

    // Find which column contains the release date
    let dateColumnIndex = -1;
    const headerCells = headerRow.find('th');
    headerCells.each((idx, cell) => {
      const cellText = $(cell).text().toLowerCase();
      if (cellText.includes('release') || cellText.includes('date') || cellText.includes('published')) {
        dateColumnIndex = idx;
      }
    });

    // If no explicit date column found, try the last column (common pattern)
    if (dateColumnIndex === -1) {
      dateColumnIndex = headerCells.length - 1;
    }

    // Parse each data row (skip header row)
    rows.slice(DEFAULT_PARSER_CONFIG.patterns.headerRowCount).each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td, th');

      if (cells.length < 2) return;

      // Extract chapter number from first cell (supports up to 5 digits)
      const firstCellText = $(cells[0]).text().trim();
      const chapterMatch = firstCellText.match(/^(\d{1,5})/);

      if (!chapterMatch?.[1]) return;

      const chapterNum = parseInt(chapterMatch[1], 10);

      // Extract date from the date column using shared utility
      if (dateColumnIndex >= 0 && dateColumnIndex < cells.length) {
        const dateCell = $(cells[dateColumnIndex]);
        const dateText = dateCell.text().trim();

        const dateString = extractDateString(dateText);
        if (dateString) {
          chapterDates.set(chapterNum, dateString);
        }
      }
    });
  });

  // Also try to extract from nested chapter rows within volume sections
  $('table').each((_, table) => {
    const $table = $(table);

    // Look for chapter rows with dates
    // Pattern: <td>00. "Title"</td> ... <td>September 23, 2015</td>
    $table.find('tr').each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');

      cells.each((_, cell) => {
        const cellText = $(cell).text();

        // Check if cell contains chapter number pattern (supports up to 5 digits)
        const chapterMatch = cellText.match(/^(\d{1,5})\.\s*[""]([^""]+)[""]/);
        if (chapterMatch?.[1]) {
          const chapterNum = parseInt(chapterMatch[1], 10);

          // Look for date in subsequent cells of this row
          cells.each((_, otherCell) => {
            const otherText = $(otherCell).text().trim();
            const dateString = extractDateString(otherText);
            if (dateString && !chapterDates.has(chapterNum)) {
              chapterDates.set(chapterNum, dateString);
            }
          });
        }
      });
    });
  });

  if (chapterDates.size > 0) {
    logger.info(`[WIKIPEDIA] Extracted ${chapterDates.size} chapter release dates from table`);
  }

  return chapterDates;
}

/**
 * Extract chapters from content using pattern matching
 * Returns true if any chapters were found
 */
function extractChaptersFromPatterns(
  volumeContent: string,
  volNum: number,
  chapterToVolume: Map<number, number>
): boolean {
  const chapterPatterns = [
    /(\d{1,5})\.\s*[""]([^""]+)[""]/g,     // Curly quotes: 00. "Title"
    /(\d{1,5})\.\s*"([^"]+)"/g,            // Regular quotes: 00. "Title"
    /(\d{1,5})\.\s*&quot;([^&]+)&quot;/g,  // HTML entities: 00. &quot;Title&quot;
    /<td[^>]*>(\d{1,5})\.\s*[""]?([^<]+)[""]?<\/td>/g  // In table cells
  ];

  for (const pattern of chapterPatterns) {
    const chapterMatches = [...volumeContent.matchAll(pattern)];
    if (chapterMatches.length > 0) {
      logger.info(`[WIKIPEDIA] Volume ${volNum}: Found ${chapterMatches.length} chapters with pattern`);
      chapterMatches.forEach(match => {
        if (match[1]) {
          chapterToVolume.set(parseInt(match[1], 10), volNum);
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * Extract chapters from list items in content
 */
function extractChaptersFromListItems(
  volumeContent: string,
  volNum: number,
  chapterToVolume: Map<number, number>
): void {
  const listItemMatches = [...volumeContent.matchAll(/<li[^>]*>.*?(\d{1,5})\.\s*[""]?([^<"]+)[""]?/g)];
  if (listItemMatches.length > 0) {
    logger.info(`[WIKIPEDIA] Volume ${volNum}: Found ${listItemMatches.length} chapters in list items`);
    listItemMatches.forEach(match => {
      if (match[1]) {
        chapterToVolume.set(parseInt(match[1], 10), volNum);
      }
    });
  }
}

/**
 * Extract chapter-to-volume mapping dynamically from HTML
 *
 * Parses volume sections (id="vol1", id="vol2", etc.) and finds
 * which chapters belong to each volume based on actual HTML structure.
 *
 * @param html - HTML content containing volume sections
 * @param totalVolumes - Total number of volumes detected
 * @returns Map of chapter number to volume number
 */
function extractVolumeMapping(html: string, totalVolumes: number): Map<number, number> {
  const chapterToVolume = new Map<number, number>();
  const $ = cheerio.load(html);

  if (totalVolumes === 0) {
    logger.info(`[WIKIPEDIA] No volumes detected, skipping volume mapping`);
    return chapterToVolume;
  }

  const volumeIdPrefix = DEFAULT_PARSER_CONFIG.patterns.volumeIdPrefix;
  logger.info(`[WIKIPEDIA] Extracting volume mapping for ${totalVolumes} volumes`);

  // For each volume, find the chapters it contains
  for (let volNum = 1; volNum <= totalVolumes; volNum++) {
    // Find volume section by id
    let volElement = $(`[id="${volumeIdPrefix}${volNum}"]`);

    if (!volElement.length) {
      // Try alternative ID formats
      volElement = $(`[id="Volume_${volNum}"], [id="Vol._${volNum}"], [id="Vol${volNum}"]`);
      if (!volElement.length) {
        continue;
      }
    }

    // Get the parent row or section containing this volume
    const volumeRow = volElement.closest('tr');

    // Also check for subsequent rows that might contain chapter listings
    // Fire Force style: volume row followed by rows with individual chapters
    let volumeContent = '';
    if (volumeRow.length) {
      // Get content from the volume row and following rows until next volume
      volumeContent = volumeRow.html() ?? '';

      // Also get following sibling rows that belong to this volume
      let nextRow = volumeRow.next('tr');
      let rowCount = 0;
      const maxRows = 20; // Limit to prevent infinite loops

      while (nextRow.length && rowCount < maxRows) {
        const nextHtml = nextRow.html() ?? '';
        // Stop if we hit the next volume marker
        if (nextHtml.includes(`id="${volumeIdPrefix}${volNum + 1}"`) ||
            nextHtml.match(/id="vol\d+"/)) {
          break;
        }
        volumeContent += nextHtml;
        nextRow = nextRow.next('tr');
        rowCount++;
      }
    }

    if (!volumeContent) {
      continue;
    }

    // Pattern 1: Look for chapter ranges like "Chapters 0-5", "Ch. 1–9", or "#0-5"
    const rangeMatch = volumeContent.match(/(?:Chapters?|Ch\.?|#)\s*(\d+)\s*[–-]\s*(\d+)/i);
    if (rangeMatch?.[1] && rangeMatch[2]) {
      const startCh = parseInt(rangeMatch[1], 10);
      const endCh = parseInt(rangeMatch[2], 10);
      logger.info(`[WIKIPEDIA] Volume ${volNum}: Found chapter range ${startCh}-${endCh}`);
      for (let ch = startCh; ch <= endCh; ch++) {
        chapterToVolume.set(ch, volNum);
      }
      continue;
    }

    // Pattern 2: Look for individual chapter listings with various quote types
    const foundChapters = extractChaptersFromPatterns(volumeContent, volNum, chapterToVolume);

    // Pattern 3: Look for numbered list items (ol > li)
    if (!foundChapters) {
      extractChaptersFromListItems(volumeContent, volNum, chapterToVolume);
    }
  }

  // If we couldn't extract from HTML structure, fall back to estimation
  if (chapterToVolume.size === 0 && totalVolumes > 0) {
    logger.info(`[WIKIPEDIA] Could not extract volume mapping from HTML, using estimation fallback`);
    return estimateVolumeMapping(totalVolumes);
  }

  logger.info(`[WIKIPEDIA] Extracted ${chapterToVolume.size} chapter-to-volume mappings from HTML`);
  return chapterToVolume;
}

/**
 * Estimate chapter-to-volume mapping when HTML extraction fails
 *
 * Uses typical manga volume distribution as fallback.
 *
 * @param totalVolumes - Total number of volumes
 * @returns Map of chapter number to volume number
 */
function estimateVolumeMapping(totalVolumes: number): Map<number, number> {
  const chapterToVolume = new Map<number, number>();

  // Use configurable values
  let currentChapter = 0;
  const avgChaptersPerVolume = chapterConfig.avgChaptersPerVolume;
  const maxChapterNumber = chapterConfig.maxChapterNumber;

  for (let vol = 1; vol <= totalVolumes && currentChapter < maxChapterNumber; vol++) {
    for (let i = 0; i < avgChaptersPerVolume; i++) {
      chapterToVolume.set(currentChapter++, vol);
    }
  }

  return chapterToVolume;
}

/**
 * Find the highest regular chapter number from matches
 *
 * Used to determine epilogue offset dynamically.
 *
 * @param matches - Array of chapter matches
 * @returns Highest chapter number found
 */
function findHighestChapterNumber(matches: ChapterMatch[]): number {
  let highest = 0;

  for (const match of matches) {
    const numStr = match.chapterNumber;
    // Only count numeric chapters (not Epilogue, Prologue, etc.)
    if (/^\d+$/.test(numStr)) {
      const num = parseInt(numStr, 10);
      if (num > highest) {
        highest = num;
      }
    }
  }

  return highest;
}

/**
 * Parse zero-indexed chapters from HTML content
 *
 * Handles chapters starting with 00 and distributes them across volumes.
 * Enhanced to extract release dates and volume mappings from the HTML structure.
 *
 * @param html - HTML content containing chapter data
 * @param allChapterMatches - Matched chapter patterns from HTML
 * @param totalVolumes - Total number of volumes detected
 * @returns Array of parsed chapters with release dates
 */
export function parseZeroIndexedPattern(
  html: string,
  allChapterMatches: ChapterMatch[],
  totalVolumes: number
): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];

  logger.info(`[WIKIPEDIA] Using zero-indexed chapter pattern`);

  // Extract chapter release dates from table structure
  const chapterDates = extractChapterDatesFromTable(html);

  // Extract chapter-to-volume mapping dynamically from HTML
  const chapterToVolume = extractVolumeMapping(html, totalVolumes);

  // Find highest regular chapter number for epilogue offset
  const highestChapter = findHighestChapterNumber(allChapterMatches);

  let currentVolume = 1;

  for (const match of allChapterMatches) {
    // Check if this is a special chapter (Epilogue, Prologue, etc.)
    const matchType: string = match.chapterNumber;
    const matchTitle: string = match.chapterTitle;
    if (!matchType || !matchTitle) continue;

    const isSpecialChapter =
      matchType.match(/^(Epilogue|Prologue|Introduction|Intro|Final Chapter|Special|Extra)/i) !== null;

    let chapterNum: number;
    let chapterIdentifier: string | number;

    if (isSpecialChapter) {
      // For special chapters like "Epilogue 1", "Epilogue 2"
      // Map them to sequential numbers after the last regular chapter
      const epilogueMatch = matchType.match(/Epilogue\s*(\d+)/i);
      if (epilogueMatch?.[1]) {
        // Use dynamically found highest chapter + epilogue number
        chapterNum = highestChapter + parseInt(epilogueMatch[1], 10);
        chapterIdentifier = chapterNum;
      } else {
        // For special chapters without numbers, use a string identifier
        chapterIdentifier = matchType;
        chapterNum = NaN; // Will be handled specially
      }
    } else {
      // Handle regular chapters and chapter 00
      chapterNum = parseInt(matchType, 10);
      chapterIdentifier = chapterNum;
    }

    const chapterTitle: string = matchTitle;

    // Determine which volume this chapter belongs to
    if (!isNaN(chapterNum) && chapterToVolume.has(chapterNum)) {
      currentVolume = chapterToVolume.get(chapterNum) ?? 1;
    }

    // Clean the chapter title
    const cleanedTitle = cleanChapterTitle(chapterTitle);

    // Skip obvious artifacts using shared utility
    const isArtifact = cleanedTitle.length < 2 || containsWikipediaArtifacts(cleanedTitle);

    if (!isArtifact) {
      const chapter: WikipediaChapter = {
        number: isNaN(chapterNum) ? chapterIdentifier : chapterNum,
        title: cleanedTitle || (typeof chapterIdentifier === 'number' ? `Chapter ${chapterIdentifier}` : chapterIdentifier)
      };

      if (totalVolumes > 0) {
        chapter.volumeNumber = currentVolume;
      }

      // Add release date if available
      const releaseDate = chapterDates.get(chapterNum);
      if (releaseDate) {
        chapter.releaseDate = releaseDate;
      }

      chapters.push(chapter);
    }
  }

  // Log summary of date extraction
  const chaptersWithDates = chapters.filter(ch => ch.releaseDate).length;
  if (chaptersWithDates > 0) {
    logger.info(`[WIKIPEDIA] Added release dates to ${chaptersWithDates}/${chapters.length} chapters`);
  }

  return chapters;
}

/**
 * Detect if HTML contains zero-indexed chapters (starting with 00 or "00")
 *
 * @param html - HTML content to check
 * @returns True if zero-indexed chapters are detected
 */
export function isZeroIndexedPattern(html: string): boolean {
  return html.includes('00.') || html.includes('"00"');
}
