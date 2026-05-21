/**
 * Fandom Metadata Extractor
 *
 * Extracts additional metadata from Fandom wiki pages including alternate titles
 * (other names, alternative titles) and full descriptions from synopsis sections.
 *
 * Extracted from: fandomTableParser.ts (lines 1399-1469)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

export function extractAlternateTitles(html: string): string[] {
  try {
    const $ = cheerio.load(html);
    const titles: string[] = [];

    // Look for alternate titles in infobox
    $('.pi-data-label:contains("Other names"), .pi-data-label:contains("Alternative"), .pi-data-label:contains("Also known as")').each((_, el) => {
      const value = $(el).next('.pi-data-value').text().trim();
      if (value) {
        // Split by common separators
        const alts = value.split(/[,;]\s*/);
        titles.push(...alts.filter(t => t.length > 0));
      }
    });

    // Old-style infobox
    $('th:contains("Other names"), th:contains("Alternative"), th:contains("Also known as")').each((_, el) => {
      const value = $(el).next('td').text().trim();
      if (value) {
        const alts = value.split(/[,;]\s*/);
        titles.push(...alts.filter(t => t.length > 0));
      }
    });

    // Strategy 3: Table-based infobox with <td><b>Label</b></td><td>value</td>
    // Common in Fire Force and similar wikis
    $('td').each((_, elem) => {
      const $td = $(elem);
      const boldText = $td.find('b').text().trim();

      if (['Romaji', 'Kanji', 'Japanese', 'English', 'Other names', 'Alternative'].includes(boldText)) {
        const nextTd = $td.next('td');
        const titleText = nextTd.text().trim();

        if (titleText && !titles.includes(titleText)) {
          titles.push(titleText);
        }
      }
    });

    return [...new Set(titles)]; // Remove duplicates
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error extracting alternate titles:', errorMessage);
    return [];
  }
}

export function extractFullDescription(html: string): string {
  try {
    const $ = cheerio.load(html);
    let description = '';

    // Try to find synopsis/plot sections
    const synopsisSections = ['#Synopsis', '#Plot', '#Summary', '#Story', '#Description'];

    for (const selector of synopsisSections) {
      const $section = $(selector);
      if ($section.length > 0) {
        // Get all paragraphs following the section header
        const $parent = $section.parent();
        const $paragraphs = $parent.nextUntil('h2, h3').filter('p');

        if ($paragraphs.length > 0) {
          description = $paragraphs.map((_, p) => $(p).text().trim()).get().join('\n\n');
          break;
        }
      }
    }

    // If no synopsis section, get the first few paragraphs from the main content
    if (!description) {
      const $paragraphs = $('#mw-content-text > p, .mw-parser-output > p').slice(0, 5);
      description = $paragraphs.map((_, p) => $(p).text().trim()).get().join('\n\n');
    }

    // Clean up the description
    description = description
      .replace(/\[\d+\]/g, '') // Remove citation markers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return description;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error extracting full description:', errorMessage);
    return '';
  }
}
