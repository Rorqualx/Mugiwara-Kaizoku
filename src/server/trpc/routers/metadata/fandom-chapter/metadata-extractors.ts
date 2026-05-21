/**
 * Metadata extraction functions for Fandom chapter pages
 */

import type { CheerioAPI } from 'cheerio';

/**
 * Extract chapter title from the page
 */
export function extractTitle($: CheerioAPI): string {
  let title = '';

  // Try to find a descriptive title in infobox data
  $('.pi-data-label').each((_, el) => {
    const label = $(el).text().trim().toLowerCase();
    if (label.includes('title') || label.includes('name')) {
      const value = $(el).next('.pi-data-value').text().trim();
      if (value && !value.match(/^Chapter\s+\d+$/i)) {
        title = value;
        return false; // break
      }
    }
  });

  // If no descriptive title found, use the page header
  if (!title) {
    title = $('h1.page-header__title, h1#firstHeading, .pi-title')
      .first()
      .text()
      .trim();
  }

  return title;
}

/**
 * Extract chapter number from title or infobox
 */
export function extractChapterNumber($: CheerioAPI, title: string): string | undefined {
  let chapterNumber = title.match(/Chapter\s+(\d+)/i)?.[1];
  if (!chapterNumber) {
    chapterNumber = $('.pi-data-value:contains("Chapter")')
      .text()
      .match(/\d+/)?.[0];
  }
  return chapterNumber;
}

/**
 * Extract description/synopsis from the page
 */
export function extractDescription($: CheerioAPI): string {
  let description = '';
  const synopsisSelectors = [
    '#Synopsis',
    '#Summary',
    '#Plot',
    'h2:contains("Synopsis")',
    'h2:contains("Summary")',
  ];

  for (const selector of synopsisSelectors) {
    const section = $(selector);
    if (section.length > 0) {
      // Get the next paragraphs after the heading
      let nextEl = section.next();
      while (nextEl.length > 0 && !nextEl.is('h2')) {
        if (nextEl.is('p')) {
          description += nextEl.text().trim() + ' ';
        }
        nextEl = nextEl.next();
      }
      if (description) break;
    }
  }

  // If no synopsis section, try the first paragraph
  if (!description) {
    description = $('#mw-content-text > p').first().text().trim();
  }

  return description;
}

/**
 * Extract release date from infobox
 */
export function extractReleaseDate($: CheerioAPI): string | undefined {
  let releaseDate: string | undefined;
  $(
    '.pi-data-label:contains("Release Date"), .pi-data-label:contains("Published")'
  ).each((_, el) => {
    const value = $(el).next('.pi-data-value').text().trim();
    if (value) {
      releaseDate = value;
      return false; // break
    }
  });
  return releaseDate;
}

/**
 * Extract page count from infobox
 */
export function extractPageCount($: CheerioAPI): number | undefined {
  let pageCount: number | undefined;
  $('.pi-data-label:contains("Pages")').each((_, el) => {
    const value = $(el).next('.pi-data-value').text().trim();
    const pages = parseInt(value, 10);
    if (!isNaN(pages)) {
      pageCount = pages;
      return false; // break
    }
  });
  return pageCount;
}
