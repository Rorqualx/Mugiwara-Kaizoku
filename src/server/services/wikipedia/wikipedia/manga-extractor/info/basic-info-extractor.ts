/**
 * Basic Info Extractor Module
 *
 * Extracts basic manga information from Wikipedia infobox:
 * - Title, URLs, alternative titles
 * - Author, artist, publisher information
 * - Publication metadata
 *
 * Part of getMangaInfo extraction (lines 71-240 of original)
 */

import * as cheerio from 'cheerio';

import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';

import type { AnyNode } from 'domhandler';

// ============================================================================
// Alternative Title Extraction
// ============================================================================

/**
 * Extract Japanese title from infobox header
 */
function extractJapaneseTitle(
  $: cheerio.CheerioAPI,
  japaneseHeader: cheerio.Cheerio<AnyNode>
): string | null {
  const $japaneseSpan = japaneseHeader.find('span[lang="ja"]');
  if (!$japaneseSpan.length) {
    return null;
  }
  const japaneseTitle = $japaneseSpan.text().trim();
  return japaneseTitle || null;
}

/**
 * Extract romanized title from infobox header
 */
function extractRomanizedTitle(
  $: cheerio.CheerioAPI,
  japaneseHeader: cheerio.Cheerio<AnyNode>
): string | null {
  const $romanSpan = japaneseHeader.find('i[lang="ja-Latn"]');
  if (!$romanSpan.length) {
    return null;
  }
  const romanTitle = $romanSpan.text().trim();
  return romanTitle || null;
}

/**
 * Extract literal translation from infobox HTML
 */
function extractLiteralTranslation(infoboxHtml: string): string | null {
  const litMatch = infoboxHtml.match(/lit\.\s*"([^"]+)"/);
  return litMatch?.[1] ?? null;
}

/**
 * Extract alternative titles from Japanese name header
 */
function extractAlternativeTitles(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string[] {
  const japaneseHeader = infobox.find('th.infobox-header').filter(function () {
    const html = $(this).html() ?? '';
    return html.includes('lang="ja"') || html.includes('lang="ja-Latn"');
  });

  if (!japaneseHeader.length) {
    return [];
  }

  const alternativeTitles: string[] = [];

  const japaneseTitle = extractJapaneseTitle($, japaneseHeader);
  if (japaneseTitle) {
    alternativeTitles.push(japaneseTitle);
  }

  const romanTitle = extractRomanizedTitle($, japaneseHeader);
  if (romanTitle) {
    alternativeTitles.push(romanTitle);
  }

  const infoboxHtml = infobox.html() ?? '';
  const literalTitle = extractLiteralTranslation(infoboxHtml);
  if (literalTitle) {
    alternativeTitles.push(literalTitle);
  }

  return alternativeTitles;
}

// ============================================================================
// Creator Extraction (Author/Artist)
// ============================================================================

/**
 * Clean and split creator text into array
 */
function parseCreatorText(text: string): string[] {
  const cleanedText = text.trim().replace(/\[\d+\]/g, '');
  if (!cleanedText) {
    return [];
  }

  return cleanedText
    .split(/,|and/)
    .map((a) => a.trim())
    .filter((a) => a && !a.match(/^\d+$/));
}

/**
 * Extract author from "Written by" row
 */
function extractAuthor(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string[] | undefined {
  const authorRow = infobox
    .find('tr')
    .filter(function () {
      return $(this).text().includes('Written') && $(this).text().includes('by');
    })
    .first();

  if (!authorRow.length) {
    return undefined;
  }

  const authorText = authorRow.find('td').text();
  const authors = parseCreatorText(authorText);
  return authors.length > 0 ? authors : undefined;
}

/**
 * Extract artist from "Illustrated by" row
 */
function extractArtist(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string[] | undefined {
  const artistRow = infobox.find('tr').filter(function () {
    return $(this).text().includes('Illustrated') && $(this).text().includes('by');
  });

  if (!artistRow.length) {
    return undefined;
  }

  const artistText = artistRow.find('td').text();
  const artists = parseCreatorText(artistText);
  return artists.length > 0 ? artists : undefined;
}

// ============================================================================
// Publisher Extraction
// ============================================================================

/**
 * Extract main publisher from "Published by" row
 */
function extractPublisher(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string | undefined {
  const publisherRow = infobox
    .find('tr')
    .filter(function () {
      return $(this).text().includes('Published') && $(this).text().includes('by');
    })
    .first();

  if (!publisherRow.length) {
    return undefined;
  }

  const publisherText = publisherRow.find('td').text().trim().replace(/\[\d+\]/g, '');
  return publisherText || undefined;
}

/**
 * Extract English publisher
 */
function extractEnglishPublisher(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string | undefined {
  const englishPubRow = infobox.find('tr:contains("English publisher")');
  if (!englishPubRow.length) {
    return undefined;
  }

  const pubText = englishPubRow.find('td').text().trim().replace(/\[\d+\]/g, '');
  if (!pubText) {
    return undefined;
  }

  // Remove region codes like NA:, UK:, etc.
  return pubText.replace(/[A-Z]{2}:/g, '').trim() || undefined;
}

// ============================================================================
// Publication Info Extraction
// ============================================================================

/**
 * Extract imprint from infobox
 */
function extractImprint(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string | undefined {
  const imprintRow = infobox.find('tr:contains("Imprint")');
  if (!imprintRow.length) {
    return undefined;
  }

  const imprintText = imprintRow.find('td').text().trim();
  return imprintText || undefined;
}

/**
 * Extract magazine from infobox
 */
function extractMagazine(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): string | undefined {
  const magazineRow = infobox.find('tr:contains("Magazine")');
  if (!magazineRow.length) {
    return undefined;
  }

  const magazineText = magazineRow.find('td').text().trim();
  return magazineText || undefined;
}

/**
 * Parse date string safely
 */
function parseDateSafe(dateStr: string): Date | undefined {
  try {
    return new Date(dateStr);
  } catch {
    return undefined;
  }
}

/**
 * Derive manga publication status from originalRun string
 *
 * Logic:
 * - If ends with "present", "ongoing", or similar → ONGOING
 * - If has a concrete end date → COMPLETED
 * - If only start date (no separator) → ONGOING (assume still publishing)
 * - Otherwise → UNKNOWN
 *
 * @param originalRun - The original run string (e.g., "September 23, 2015 – present")
 * @returns Status string: 'ONGOING', 'COMPLETED', or 'UNKNOWN'
 */
function deriveStatusFromOriginalRun(originalRun: string): string {
  if (!originalRun) {
    logger.debug('[deriveStatusFromOriginalRun] No originalRun provided, returning UNKNOWN');
    return 'UNKNOWN';
  }

  const runLower = originalRun.toLowerCase().trim();
  logger.debug('[deriveStatusFromOriginalRun] Processing:', { originalRun, runLower });

  // Check for ongoing indicators
  const ongoingIndicators = ['present', 'ongoing', 'current', 'continuing'];
  for (const indicator of ongoingIndicators) {
    if (runLower.includes(indicator)) {
      logger.debug(`[deriveStatusFromOriginalRun] Found ongoing indicator: "${indicator}", returning ONGOING`);
      return 'ONGOING';
    }
  }

  // Check if there's a date range separator (– or -)
  // Use more explicit pattern to avoid character class range issues
  const hasSeparator = originalRun.includes('–') || originalRun.includes('-');
  logger.debug('[deriveStatusFromOriginalRun] Separator check:', { hasSeparator, hasEnDash: originalRun.includes('–'), hasHyphen: originalRun.includes('-') });

  if (hasSeparator) {
    // Has a separator - check if there's content after it
    const parts = originalRun.split(/[–-]/);
    const afterSeparator = parts[1]?.trim();
    logger.debug('[deriveStatusFromOriginalRun] Split result:', { parts, afterSeparator });

    if (afterSeparator && afterSeparator.length > 0) {
      // Has end date content - check if it's a real date (not "present")
      const datePattern = /\d{4}/; // Contains a year
      const hasYear = datePattern.test(afterSeparator);
      logger.debug('[deriveStatusFromOriginalRun] Year check:', { afterSeparator, hasYear });
      if (hasYear) {
        logger.debug('[deriveStatusFromOriginalRun] Found end year, returning COMPLETED');
        return 'COMPLETED';
      }
    }
  }

  // If only start date with no end indication, assume ongoing
  const hasStartDate = /\d{4}/.test(originalRun);
  if (hasStartDate && !hasSeparator) {
    logger.debug('[deriveStatusFromOriginalRun] Only start date found, returning ONGOING');
    return 'ONGOING';
  }

  logger.debug('[deriveStatusFromOriginalRun] No pattern matched, returning UNKNOWN');
  return 'UNKNOWN';
}

/**
 * Extract only the first date range from originalRun text
 * Wikipedia infoboxes may contain multiple media dates (manga + anime)
 * e.g., "September 23, 2015 – February 22, 2022 July 6, 2019 – present"
 * We only want the first range (manga dates)
 */
function extractFirstDateRange(runText: string): string {
  // Pattern to match a complete date range: "Month Day, Year – Month Day, Year" or "Month Day, Year – present"
  const dateRangePattern = /^(\w+\s+\d+,\s+\d{4})\s*[–-]\s*(\w+\s+\d+,\s+\d{4}|present)/i;
  const match = runText.match(dateRangePattern);

  if (match) {
    // Return just the first date range
    const firstRange = match[0];
    logger.debug('[extractFirstDateRange] Extracted first date range:', { original: runText, firstRange });
    return firstRange;
  }

  // If no full range found, try to find first date range by looking for year boundaries
  // Split on pattern where a year is followed by a space and another month name
  const splitPattern = /(\d{4})\s+([A-Z][a-z]+\s+\d)/;
  const splitMatch = runText.match(splitPattern);

  if (splitMatch?.index !== undefined) {
    // Split at the boundary between first range end and second range start
    const firstRange = runText.substring(0, splitMatch.index + 4).trim(); // +4 to include the year
    logger.debug('[extractFirstDateRange] Split at year boundary:', { original: runText, firstRange });
    return firstRange;
  }

  return runText;
}

/**
 * Extract original run and parse dates
 */
function extractOriginalRun(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>
): { originalRun?: string; startDate?: Date; endDate?: Date; status?: string } {
  const runRow = infobox.find('tr:contains("Original run")');
  if (!runRow.length) {
    logger.debug('[extractOriginalRun] No "Original run" row found in infobox');
    return {};
  }

  const rawRunText = runRow.find('td').text().trim();
  logger.debug('[extractOriginalRun] Found raw runText:', { rawRunText });

  if (!rawRunText) {
    return {};
  }

  // Extract only the first date range (manga dates, not anime)
  const runText = extractFirstDateRange(rawRunText);
  logger.debug('[extractOriginalRun] Using first date range:', { rawRunText, runText });

  const derivedStatus = deriveStatusFromOriginalRun(runText);
  logger.info('[extractOriginalRun] Derived status:', { runText, derivedStatus });

  const result: { originalRun?: string; startDate?: Date; endDate?: Date; status?: string } = {
    originalRun: runText,
    status: derivedStatus,
  };

  // Parse start and end dates from original run
  // Format: "September 23, 2015 – February 22, 2022"
  const dateMatch = runText.match(
    /(\w+\s+\d+,\s+\d{4})\s*[–-]\s*(\w+\s+\d+,\s+\d{4}|present)/i
  );

  if (dateMatch?.[1]) {
    const startDate = parseDateSafe(dateMatch[1]);
    if (startDate) {
      result.startDate = startDate;
    }
    if (dateMatch[2] && dateMatch[2].toLowerCase() !== 'present') {
      const endDate = parseDateSafe(dateMatch[2]);
      if (endDate) {
        result.endDate = endDate;
      }
    }
  }

  logger.info('[extractOriginalRun] Final result:', {
    originalRun: result.originalRun,
    status: result.status,
    hasStartDate: !!result.startDate,
    hasEndDate: !!result.endDate
  });

  return result;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Extract basic manga information from infobox
 *
 * @param $ - Cheerio instance loaded with page HTML
 * @param pageTitle - Page title for constructing Wikipedia URL
 * @param mangaData - Existing manga data object to use as base
 * @returns Updated manga data object (new instance)
 */
export function extractBasicInfo(
  $: cheerio.CheerioAPI,
  pageTitle: string,
  mangaData: WikipediaMangaData
): WikipediaMangaData {
  // Create a new object to avoid mutating the parameter
  const updates: Partial<WikipediaMangaData> = {
    title: pageTitle,
    wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
  };

  const infobox = $('.infobox');
  if (!infobox.length) {
    return { ...mangaData, ...updates };
  }

  // Extract alternative titles
  const alternativeTitles = extractAlternativeTitles($, infobox);
  if (alternativeTitles.length > 0) {
    updates.alternativeTitles = alternativeTitles;
  }

  // Extract creators
  const author = extractAuthor($, infobox);
  if (author) {
    updates.author = author;
  }

  const artist = extractArtist($, infobox);
  if (artist) {
    updates.artist = artist;
  }

  // Extract publishers
  const publisher = extractPublisher($, infobox);
  if (publisher) {
    updates.publisher = publisher;
  }

  const englishPublisher = extractEnglishPublisher($, infobox);
  if (englishPublisher) {
    updates.englishPublisher = englishPublisher;
  }

  // Extract publication info
  const imprint = extractImprint($, infobox);
  if (imprint) {
    updates.imprint = imprint;
  }

  const magazine = extractMagazine($, infobox);
  if (magazine) {
    updates.magazine = magazine;
  }

  const { originalRun, startDate, endDate, status } = extractOriginalRun($, infobox);
  if (originalRun) {
    updates.originalRun = originalRun;
  }
  if (startDate) {
    updates.startDate = startDate;
  }
  if (endDate) {
    updates.endDate = endDate;
  }
  if (status) {
    updates.status = status;
  }

  return { ...mangaData, ...updates };
}
