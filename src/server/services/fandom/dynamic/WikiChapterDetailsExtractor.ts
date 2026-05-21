/**
 * Wiki Chapter Details Extractor
 *
 * Handles extraction of detailed chapter information from wiki pages
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

export interface ChapterInfo {
  number: number | string;
  title: string;
  alternativeTitles?: string[];
  volume?: number;
  pages?: number;
  releaseDate?: string;
  url?: string;
  summary?: string;
  coverImage?: string;
}

export class WikiChapterDetailsExtractor {
  private log = logger.child('WikiChapterDetailsExtractor', { service: 'WikiChapterDetailsExtractor' });

  /**
   * Extract detailed chapter information from a page
   */
  extractChapterDetails(html: string): Partial<ChapterInfo> {
    const $ = cheerio.load(html);
    const details: Partial<ChapterInfo> = {};

    // Extract summary/synopsis
    const summary = this.extractSummary($);
    if (summary !== undefined) {
      details.summary = summary;
    }

    // Extract cover image
    const coverImage = this.extractCoverImage($);
    if (coverImage !== undefined) {
      details.coverImage = coverImage;
    }

    // Extract page count
    const pageCount = this.extractPageCount($);
    if (pageCount) {
      details.pages = pageCount;
    }

    // Extract release date
    const releaseDate = this.extractReleaseDate($);
    if (releaseDate !== undefined) {
      details.releaseDate = releaseDate;
    }

    // Extract alternative titles
    const altTitles = this.extractAlternativeTitles($);
    if (altTitles.length > 0) {
      details.alternativeTitles = altTitles;
    }

    return details;
  }

  /**
   * Extract summary/synopsis from page
   */
  private extractSummary($: CheerioAPI): string | undefined {
    const summaryHeadingSelectors = [
      'h2:contains("Summary")', 'h2:contains("Synopsis")', 'h2:contains("Plot")',
      'h3:contains("Summary")', 'h3:contains("Synopsis")', 'h3:contains("Plot")',
      '#Summary', '#Synopsis', '#Plot'
    ];

    for (const selector of summaryHeadingSelectors) {
      const heading = $(selector).first();
      if (heading.length) {
        const paragraphs: string[] = [];

        // Get all sibling paragraphs after the heading until the next heading
        let current = heading.next();
        while (current.length && !current.is('h1, h2, h3, h4')) {
          if (current.is('p') && current.text().trim()) {
            paragraphs.push(current.text().trim());
          }
          current = current.next();
        }

        if (paragraphs.length > 0) {
          return paragraphs.join('\n\n');
        }
      }
    }

    return undefined;
  }

  /**
   * Extract cover image from page
   */
  private extractCoverImage($: CheerioAPI): string | undefined {
    const coverSelectors = [
      '.infobox img', '.portable-infobox img',
      'img[alt*="cover" i]', 'img[alt*="chapter" i]',
      '.pi-image img', '.image img'
    ];

    for (const selector of coverSelectors) {
      const img = $(selector).first();
      if (img.length) {
        const srcset = img.attr('data-src') ?? img.attr('src');
        if (srcset) {
          // Get full resolution image URL
          const fullUrl = srcset.replace(/\/scale-to-width-down\/\d+/, '')
                                .replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest');
          return fullUrl;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract page count from infobox
   */
  private extractPageCount($: CheerioAPI): number | undefined {
    let pageCount: number | undefined;

    $('tr, .pi-data, .pi-item').each((_: number, row: Element) => {
      if (pageCount) return false; // Already found, stop searching

      const $row = $(row);
      const rowText = $row.text();

      // Check if this row contains page count information
      if (/\bPages?\b[:\s]*/i.test(rowText)) {
        pageCount = this.extractPageCountFromRow($, $row);
      }
    });

    if (pageCount) {
      this.log.debug(`[PAGE COUNT] Found: ${pageCount} pages`);
    } else {
      this.log.debug(`[PAGE COUNT] No page count found in infobox/table structure`);
    }

    return pageCount;
  }

  /**
   * Extract page count from a table row
   */
  private extractPageCountFromRow($: CheerioAPI, $row: cheerio.Cheerio<Element>): number | undefined {
    const rowText = $row.text();

    // Try different table cell patterns
    const cells = $row.find('td');
    if (cells.length >= 2) {
      // Pattern: <td>Pages</td><td>54</td>
      const firstCell = cells.eq(0).text().trim();
      const secondCell = cells.eq(1).text().trim();

      if (/\bPages?\b/i.test(firstCell)) {
        const match = secondCell.match(/(\d+)/);
        if (match?.[1]) {
          this.log.debug(`[PAGE COUNT] Found in table: ${match[1]} pages from "${rowText}"`);
          return parseInt(match[1], 10);
        }
      }
    }

    // Try pi-data-label / pi-data-value pattern (portable infobox)
    const label = $row.find('.pi-data-label, .pi-label').text().trim();
    const value = $row.find('.pi-data-value, .pi-value').text().trim();

    if (/\bPages?\b/i.test(label) && value) {
      const match = value.match(/(\d+)/);
      if (match?.[1]) {
        this.log.debug(`[PAGE COUNT] Found in portable infobox: ${match[1]} pages`);
        return parseInt(match[1], 10);
      }
    }

    // Try th / td pattern (same row)
    const th = $row.find('th').text().trim();
    const td = $row.find('td').text().trim();

    if (/\bPages?\b/i.test(th) && td) {
      const match = td.match(/(\d+)/);
      if (match?.[1]) {
        this.log.debug(`[PAGE COUNT] Found in th/td: ${match[1]} pages`);
        return parseInt(match[1], 10);
      }
    }

    return undefined;
  }

  /**
   * Extract release date from page
   */
  private extractReleaseDate($: CheerioAPI): string | undefined {
    // Strategy 1: Look for infobox or table rows with release date information
    let releaseDateText = this.extractReleaseDateFromTable($);

    this.log.debug(`[RELEASE DATE] After Strategy 1 (tables): releaseDateText = ${releaseDateText ? `"${releaseDateText}"` : 'undefined'}`);

    // Strategy 2: Enhanced definition list search
    if (!releaseDateText) {
      releaseDateText = this.extractReleaseDateFromDl($);
      this.log.debug(`[RELEASE DATE] After Strategy 2 (definition lists): releaseDateText = ${releaseDateText ? `"${releaseDateText}"` : 'undefined'}`);
    }

    // Strategy 3: Fallback to plain text regex
    if (!releaseDateText) {
      const releaseDateMatch = $.text().match(/Release[d\s]*Date[:\s]*([^,\n]+)/i);
      if (releaseDateMatch?.[1]) {
        releaseDateText = releaseDateMatch[1].trim();
      }
    }

    // Parse and store the release date
    if (releaseDateText) {
      // Pre-validate: Check if text looks like a date before attempting to parse
      if (!this.looksLikeDate(releaseDateText)) {
        this.log.debug(`[RELEASE DATE] Skipping non-date text: "${releaseDateText}"`);
        return undefined;
      }

      this.log.debug(`[RELEASE DATE] Found raw text: "${releaseDateText}"`);
      const parsedDate = this.parseReleaseDate(releaseDateText);
      if (parsedDate !== undefined) {
        this.log.debug(`[RELEASE DATE] Parsed to: "${parsedDate}"`);
        return parsedDate;
      }

      this.log.warn(`[RELEASE DATE] Failed to parse: "${releaseDateText}"`);
    } else {
      this.log.debug(`[RELEASE DATE] No release date text found in page`);
    }

    return undefined;
  }

  /**
   * Extract release date from table rows
   */
  private extractReleaseDateFromTable($: CheerioAPI): string | undefined {
    let releaseDateText: string | undefined;

    $('tr, .pi-data, .pi-item').each((_: number, row: Element) => {
      if (releaseDateText) return false; // Already found, stop searching

      const $row = $(row);
      const rowText = $row.text();

      // Check if this row contains release date information
      if (/Release[d\s]*(Date|Info)?[:\s]*/i.test(rowText)) {
        releaseDateText = this.extractReleaseDateFromTableRow($, $row);
      }
    });

    return releaseDateText;
  }

  /**
   * Extract release date from a single table row
   */
  private extractReleaseDateFromTableRow($: CheerioAPI, $row: cheerio.Cheerio<Element>): string | undefined {
    // Try different table cell patterns
    const cells = $row.find('td');
    if (cells.length >= 2) {
      const firstCell = cells.eq(0).text().trim();
      const secondCell = cells.eq(1).text().trim();

      if (/Release/i.test(firstCell)) {
        return secondCell;
      } else if (/Release/i.test(secondCell)) {
        return cells.eq(2).text().trim();
      }
    }

    // Try pi-data-label / pi-data-value pattern
    const label = $row.find('.pi-data-label, .pi-label').text().trim();
    const value = $row.find('.pi-data-value, .pi-value').text().trim();

    if (/Release/i.test(label) && value) {
      return value;
    }

    // Try th / td pattern
    const th = $row.find('th').text().trim();
    const td = $row.find('td').text().trim();

    if (/Release/i.test(th) && td) {
      return td;
    }

    // Fire Force pattern: Check next rows for date data
    if (/Release\s*(Info|Date)/i.test(th)) {
      return this.extractDateFromNextRows($, $row);
    }

    return undefined;
  }

  /**
   * Extract date from next table rows (Fire Force pattern)
   */
  private extractDateFromNextRows($: CheerioAPI, $row: cheerio.Cheerio<Element>): string | undefined {
    this.log.debug(`[RELEASE DATE] Found Release Info/Date header, checking next rows`);

    let $nextRow = $row.next('tr');
    let attempts = 0;
    let releaseDateText: string | undefined;

    while ($nextRow.length && attempts < 5 && !releaseDateText) {
      const nextCells = $nextRow.find('td');

      if (nextCells.length >= 2) {
        const firstCell = nextCells.eq(0).text().trim();
        const secondCell = nextCells.eq(1).text().trim();

        // Check if first cell contains country label
        if (/^(Japan|Japanese|English|USA?|America)/i.test(firstCell)) {
          // Prioritize Japan release date
          if (/Japan/i.test(firstCell) && secondCell) {
            releaseDateText = secondCell;
            this.log.debug(`[RELEASE DATE] Found Japan release date in next row: "${releaseDateText}"`);
            break;
          } else if (!releaseDateText && secondCell) {
            releaseDateText = secondCell;
            this.log.debug(`[RELEASE DATE] Found ${firstCell} release date in next row: "${releaseDateText}"`);
          }
        }
      }

      $nextRow = $nextRow.next('tr');
      attempts++;
    }

    return releaseDateText;
  }

  /**
   * Extract release date from definition lists
   */
  private extractReleaseDateFromDl($: CheerioAPI): string | undefined {
    this.log.debug(`[RELEASE DATE] Trying Strategy 2 (definition lists)...`);

    // Try 1: Search within infobox/metadata areas
    const infoboxDls = $('.infobox dl, .portable-infobox dl, .pi-data dl, .pi-item dl');
    if (infoboxDls.length) {
      this.log.debug(`[RELEASE DATE] Found ${infoboxDls.length} <dl> element(s) in infobox areas`);
      let foundDate: string | undefined;
      infoboxDls.each((_: number, dl: Element) => {
        if (foundDate) return false;
        foundDate = this.extractFromDl($, $(dl), 'infobox');
      });
      if (foundDate) return foundDate;
    }

    // Try 2: Look for Release Info/Date heading, then search nearby <dl>
    const headingDate = this.extractFromHeadingBasedSearch($);
    if (headingDate) return headingDate;

    // Try 3: Global search all <dl> elements
    const globalDate = this.extractFromGlobalDl($);
    return globalDate;
  }

  /**
   * Extract date from heading-based search
   */
  private extractFromHeadingBasedSearch($: CheerioAPI): string | undefined {
    this.log.debug(`[RELEASE DATE] Trying heading-based search...`);
    let releaseDateText: string | undefined;

    $('th, h3, h4, .pi-data-label, .pi-label').each((_: number, heading: Element) => {
      if (releaseDateText) return false;

      const $heading = $(heading);
      const headingText = $heading.text().trim();

      // Check if this heading is about release info/date
      if (/Release\s*(Info|Date)/i.test(headingText)) {
        this.log.debug(`[RELEASE DATE] Found Release heading: "${headingText}"`);
        releaseDateText = this.findDlNearHeading($, $heading);
      }
    });

    return releaseDateText;
  }

  /**
   * Find <dl> near heading element
   */
  private findDlNearHeading($: CheerioAPI, $heading: cheerio.Cheerio<Element>): string | undefined {
    // Try different patterns
    let $dl = $heading.next('dl');

    if (!$dl.length) {
      $dl = $heading.closest('tr').nextAll().find('dl').first();
    }

    if (!$dl.length) {
      $dl = $heading.nextAll('dl').first();
    }

    if (!$dl.length) {
      $dl = $heading.parent().next().find('dl');
    }

    if ($dl.length) {
      this.log.debug(`[RELEASE DATE] Found <dl> near Release heading`);
      return this.extractFromDl($, $dl, 'heading-adjacent');
    }

    return undefined;
  }

  /**
   * Extract from global <dl> search
   */
  private extractFromGlobalDl($: CheerioAPI): string | undefined {
    this.log.debug(`[RELEASE DATE] Trying global <dl> search...`);
    const allDls = $('dl');
    this.log.debug(`[RELEASE DATE] Found ${allDls.length} total <dl> element(s) on page`);

    let foundDate: string | undefined;
    allDls.each((_: number, dl: Element) => {
      if (foundDate) return false;
      foundDate = this.extractFromDl($, $(dl), 'global');
    });

    return foundDate;
  }

  /**
   * Extract date from definition list element
   */
  private extractFromDl($: CheerioAPI, $dl: cheerio.Cheerio<Element>, context: string): string | undefined {
    let foundDate: string | undefined;

    $dl.find('dt').each((_: number, dt: Element) => {
      if (foundDate) return false;

      const $dt = $(dt);
      const dtText = $dt.text().trim();

      // Check if this dt contains a country/region label
      if (/^(Japan|Japanese|English|USA?|America|UK|United States|United Kingdom)/i.test(dtText)) {
        const $dd = $dt.next('dd');
        if ($dd.length) {
          const ddText = $dd.text().trim();

          // Prioritize Japan release date
          if (/Japan/i.test(dtText) && ddText) {
            foundDate = ddText;
            this.log.debug(`[RELEASE DATE] Found Japan release date in ${context}: "${foundDate}"`);
            return false;
          } else if (!foundDate && ddText) {
            foundDate = ddText;
            this.log.debug(`[RELEASE DATE] Found ${dtText} release date in ${context}: "${foundDate}"`);
          }
        }
      }
    });

    return foundDate;
  }

  /**
   * Extract alternative titles
   */
  private extractAlternativeTitles($: CheerioAPI): string[] {
    const alternativeTitles: string[] = [];

    $('tr').each((_: number, row: Element) => {
      const $row = $(row);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const firstCell = cells.eq(0).text().trim();
        const secondCell = cells.eq(1).text().trim();

        // Check if first cell contains language/title type labels
        if (/^(Japanese|Romaji|English|Kanji|Rōmaji|Kana|Hiragana|Katakana)$/i.test(firstCell)) {
          if (secondCell && secondCell.length > 0) {
            // Filter out dates
            const isDate = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\w+\s+\d{1,2},?\s+\d{4})$/i.test(secondCell);

            // Avoid duplicates and filter out dates
            if (!isDate &&
                !alternativeTitles.includes(secondCell) &&
                !['Japanese', 'Romaji', 'English', 'Kanji', 'Rōmaji', 'Kana', 'Hiragana', 'Katakana'].includes(secondCell)) {
              alternativeTitles.push(secondCell);
              this.log.debug(`[ALTERNATIVE TITLES] Found ${firstCell} title: "${secondCell}"`);
            } else if (isDate) {
              this.log.debug(`[ALTERNATIVE TITLES] Skipping date value: "${secondCell}"`);
            }
          }
        }
      }
    });

    if (alternativeTitles.length > 0) {
      this.log.debug(`[ALTERNATIVE TITLES] Extracted ${alternativeTitles.length} alternative titles:`, alternativeTitles);
    } else {
      this.log.debug(`[ALTERNATIVE TITLES] No alternative titles found in page`);
    }

    return alternativeTitles;
  }

  /**
   * Check if text appears to be a date
   */
  private looksLikeDate(text: string): boolean {
    if (!text || text.length <= 1) return false;

    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/,
      /\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/,
      /\d{1,2}\s+\w+,?\s+\d{4}/
    ];

    return datePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Parse release date string
   */
  private parseReleaseDate(date: string | undefined): string | undefined {
    if (!date) return undefined;

    // If it's just a single character, ignore it
    if (date.length <= 1) return undefined;

    const cleanDate = date.trim();

    const datePatterns = [
      /(\w+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\s+\w+\s+\d{4})/
    ];

    for (const pattern of datePatterns) {
      const match = cleanDate.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // If no pattern matches but the string looks like a date, return it
    if (cleanDate.match(/\d{4}/) && cleanDate.length > 4) {
      return cleanDate;
    }

    return undefined;
  }
}
