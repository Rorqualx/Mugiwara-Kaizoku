/**
 * Metadata Extractor Module
 *
 * Extracts manga metadata from Wikipedia infobox and page content:
 * - Plot/description
 * - Cover image
 * - Genres and demographic
 *
 * Part of getMangaInfo extraction (lines 110-300 of original)
 */

import * as cheerio from 'cheerio';

import type {
  WikipediaMangaData,
  WikipediaSection,
  MangaTypeClassification,
} from '@/server/services/wikipedia/wikipedia/types';

import type { AnyNode } from 'domhandler';



/**
 * Find plot section from Wikipedia sections
 */
function findPlotSection(sections: WikipediaSection[]): WikipediaSection | undefined {
  return sections.find((s: WikipediaSection) => {
    const line = s.line;
    if (typeof line === 'string') {
      const lowerLine = line.toLowerCase();
      return (
        lowerLine.includes('plot') ||
        lowerLine.includes('synopsis') ||
        lowerLine.includes('story')
      );
    }
    return false;
  });
}

/**
 * Extract plot text from a plot section
 */
function extractPlotText(
  $: cheerio.CheerioAPI,
  plotSection: WikipediaSection
): string | null {
  const plotId = plotSection.anchor;
  if (typeof plotId !== 'string') {
    return null;
  }

  const plotElement = $(`#${plotId}`).parent();
  if (!plotElement.length) {
    return null;
  }

  let plotText = '';
  let nextElem = plotElement.next();
  while (nextElem.length && nextElem[0]?.name === 'p') {
    plotText += nextElem.text().trim().replace(/\[\d+\]/g, '') + ' ';
    nextElem = nextElem.next();
  }

  return plotText ? plotText.trim() : null;
}

/**
 * Extract synopsis from Plot/Synopsis/Story sections
 * This is the actual story content, separate from the intro description
 */
function extractSynopsis(
  $: cheerio.CheerioAPI,
  sections: WikipediaSection[],
  mangaData: WikipediaMangaData
): void {
  const plotSection = findPlotSection(sections);
  if (!plotSection) {
    return;
  }

  const synopsisText = extractPlotText($, plotSection);
  if (synopsisText) {
    // eslint-disable-next-line no-param-reassign
    mangaData.synopsis = synopsisText;
    // Also set plot for backwards compatibility
    // eslint-disable-next-line no-param-reassign
    mangaData.plot = synopsisText;
  }
}

/**
 * Extract description from intro paragraphs after infobox
 * These are the overview paragraphs about the manga (serialization, adaptation, etc.)
 * Separate from synopsis which is the actual story content
 */
function extractDescriptionFromInfobox(
  $: cheerio.CheerioAPI,
  mangaData: WikipediaMangaData
): void {
  // Always extract intro paragraphs as description (separate from synopsis)
  const infobox = $('.infobox');
  const paragraphs: string[] = [];

  // Get paragraphs between infobox and first section heading
  let current = infobox.length ? infobox.next() : $('p').first();

  while (current.length) {
    const tagName = current.prop('tagName')?.toLowerCase();

    // Stop at section headers (h2, h3, etc.)
    if (tagName?.match(/^h[1-6]$/)) {
      break;
    }

    // Collect paragraph text
    if (tagName === 'p') {
      const text = current.text().trim().replace(/\[\d+\]/g, '');
      if (text && text.length > 30) {
        paragraphs.push(text);
      }
    }

    current = current.next();
  }

  if (paragraphs.length > 0) {
    // eslint-disable-next-line no-param-reassign
    mangaData['description'] = paragraphs.join('\n\n');
  }
}

/**
 * Convert thumbnail URL to full-size image URL
 */
function convertToFullSizeImage(url: string): string {
  if (!url.includes('/thumb/')) {
    return url;
  }

  const parts = url.split('/thumb/');
  if (parts.length <= 1) {
    return url;
  }

  const afterThumb = parts[1];
  if (!afterThumb) {
    return url;
  }

  const lastSlashIndex = afterThumb.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return url;
  }

  return parts[0] + '/' + afterThumb.substring(0, lastSlashIndex);
}

/**
 * Extract cover image from infobox
 */
function extractCoverImage(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>,
  mangaData: WikipediaMangaData
): void {
  const coverImageElement = infobox.find('.infobox-image img').first();
  if (!coverImageElement.length) {
    return;
  }

  let coverImageUrl = coverImageElement.attr('src') ?? '';
  if (!coverImageUrl) {
    return;
  }

  // Handle protocol-relative URLs
  if (coverImageUrl.startsWith('//')) {
    coverImageUrl = 'https:' + coverImageUrl;
  }

  // Get full-size image if it's a thumbnail
  coverImageUrl = convertToFullSizeImage(coverImageUrl);

  // eslint-disable-next-line no-param-reassign
  mangaData.coverImage = coverImageUrl;
}

/**
 * Extract genres from linked elements
 */
function extractGenresFromLinks(
  $: cheerio.CheerioAPI,
  genreRow: cheerio.Cheerio<AnyNode>
): string[] {
  const genres: string[] = [];
  genreRow.find('td a').each((i, elem) => {
    const genre = $(elem)
      .text()
      .trim()
      .replace(/\[\d+\]/g, '');
    if (genre && genre.length > 2) {
      genres.push(genre);
    }
  });
  return genres;
}

/**
 * Extract genres from plain text
 */
function extractGenresFromText(
  $: cheerio.CheerioAPI,
  genreRow: cheerio.Cheerio<AnyNode>
): string[] {
  const genreText = genreRow.find('td').text().replace(/\[\d+\]/g, '');
  if (!genreText) {
    return [];
  }

  return genreText
    .split(/[,;·]/)
    .map((g) => g.trim())
    .filter((g) => g && g.length > 2 && !g.match(/^\d+$/));
}

/**
 * Extract genres from infobox
 */
function extractGenres(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>,
  mangaData: WikipediaMangaData
): void {
  const genreRow = infobox.find('tr:contains("Genre")');
  if (!genreRow.length) {
    return;
  }

  const linkedGenres = extractGenresFromLinks($, genreRow);
  const genres = linkedGenres.length > 0
    ? linkedGenres
    : extractGenresFromText($, genreRow);

  if (genres.length > 0) {
    // eslint-disable-next-line no-param-reassign
    mangaData['genres'] = [...new Set(genres)];
  }
}

/**
 * Extract demographic from infobox
 */
function extractDemographic(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>,
  mangaData: WikipediaMangaData
): void {
  const demographicRow = infobox.find('tr:contains("Demographic")');
  if (!demographicRow.length) {
    return;
  }

  const demographicText = demographicRow.find('td').text().trim();
  if (demographicText) {
    // eslint-disable-next-line no-param-reassign
    mangaData.demographic = demographicText;
  }
}

/**
 * Extract editor(s) from infobox
 */
function extractEditor(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>,
  mangaData: WikipediaMangaData
): void {
  // Look for "Edited by" or "Editor" rows
  const editorRow = infobox.find('tr').filter((_, el) => {
    const headerText = $(el).find('th').text().toLowerCase();
    return headerText.includes('edited by') || headerText.includes('editor');
  });

  if (!editorRow.length) return;

  const editors: string[] = [];
  editorRow.find('td a, td').each((_, elem) => {
    const text = $(elem).text().trim().replace(/\[\d+\]/g, '');
    if (text && text.length > 1 && !text.includes('\n')) {
      editors.push(text);
    }
  });

  // Take the first meaningful result (the td text includes all links)
  const editorText = editorRow.find('td').text().trim().replace(/\[\d+\]/g, '');
  if (editorText) {
    const parsed = editorText.split(/[,;]/).map(e => e.trim()).filter(e => e.length > 1);
    if (parsed.length > 0) {
      // eslint-disable-next-line no-param-reassign
      mangaData.editor = parsed;
    }
  }
}

/**
 * Infer manga type from country of origin or infobox content
 */
function extractMangaType(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>,
  mangaData: WikipediaMangaData
): void {
  // Check infobox class for hints
  const infoboxClass = infobox.attr('class') ?? '';
  const infoboxClassLower = infoboxClass.toLowerCase();

  if (infoboxClassLower.includes('manhwa')) {
    // eslint-disable-next-line no-param-reassign
    mangaData.mangaType = 'manhwa';
    return;
  }
  if (infoboxClassLower.includes('manhua')) {
    // eslint-disable-next-line no-param-reassign
    mangaData.mangaType = 'manhua';
    return;
  }

  // Check for country/origin row
  const countryRow = infobox.find('tr').filter((_, el) => {
    const headerText = $(el).find('th').text().toLowerCase();
    return headerText.includes('country') || headerText.includes('origin');
  });

  if (countryRow.length) {
    const countryText = countryRow.find('td').text().toLowerCase();
    const type = inferTypeFromCountry(countryText);
    if (type) {
      // eslint-disable-next-line no-param-reassign
      mangaData.mangaType = type;
      return;
    }
  }

  // Check page title or categories for hints
  const title = $('title').text().toLowerCase();
  const categoryLinks = $('#mw-normal-catlinks a').text().toLowerCase();
  const combinedText = title + ' ' + categoryLinks;

  if (combinedText.includes('manhwa') || combinedText.includes('korean')) {
    // eslint-disable-next-line no-param-reassign
    mangaData.mangaType = 'manhwa';
  } else if (combinedText.includes('manhua') || combinedText.includes('chinese')) {
    // eslint-disable-next-line no-param-reassign
    mangaData.mangaType = 'manhua';
  } else if (combinedText.includes('webtoon')) {
    // eslint-disable-next-line no-param-reassign
    mangaData.mangaType = 'webtoon';
  } else if (combinedText.includes('manga') || combinedText.includes('japanese')) {
    // eslint-disable-next-line no-param-reassign
    mangaData.mangaType = 'manga';
  }
}

/**
 * Infer manga type from country text
 */
function inferTypeFromCountry(countryText: string): MangaTypeClassification | null {
  if (countryText.includes('japan')) return 'manga';
  if (countryText.includes('korea') || countryText.includes('south korea')) return 'manhwa';
  if (countryText.includes('china') || countryText.includes('chinese')) return 'manhua';
  return null;
}

/**
 * Extract licensed publishers from infobox
 */
function extractLicensedBy(
  $: cheerio.CheerioAPI,
  infobox: cheerio.Cheerio<AnyNode>,
  mangaData: WikipediaMangaData
): void {
  // Look for "Licensed by" or "English publisher" with multiple entries
  const licenseRow = infobox.find('tr').filter((_, el) => {
    const headerText = $(el).find('th').text().toLowerCase();
    return headerText.includes('licensed') || headerText.includes('english publisher');
  });

  if (!licenseRow.length) return;

  const publishers: string[] = [];
  licenseRow.find('td li a, td a').each((_, elem) => {
    const text = $(elem).text().trim().replace(/\[\d+\]/g, '');
    if (text && text.length > 1 && !publishers.includes(text)) {
      publishers.push(text);
    }
  });

  // If no links, try plain text parsing
  if (publishers.length === 0) {
    const licenseText = licenseRow.find('td').text().trim().replace(/\[\d+\]/g, '');
    const parsed = licenseText.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 1);
    publishers.push(...parsed);
  }

  if (publishers.length > 0) {
    // eslint-disable-next-line no-param-reassign
    mangaData.licensedBy = [...new Set(publishers)];
  }
}

/**
 * Check if paragraph text is meaningful
 */
function isMeaningfulParagraph(text: string): boolean {
  return (
    text.length > 50 &&
    !text.startsWith('Not to be confused') &&
    !text.startsWith('See also:')
  );
}

/**
 * Extract first meaningful paragraph as fallback description
 * Only used if extractDescriptionFromInfobox didn't find anything
 */
function extractFallbackDescription(
  $: cheerio.CheerioAPI,
  mangaData: WikipediaMangaData
): void {
  // Only use fallback if description wasn't already extracted
  if (mangaData['description']) {
    return;
  }

  const paragraphs = $('p').not('.infobox p');
  for (let i = 0; i < paragraphs.length; i++) {
    const text = $(paragraphs[i]).text().trim();
    if (isMeaningfulParagraph(text)) {
      // eslint-disable-next-line no-param-reassign
      mangaData['description'] = text;
      break;
    }
  }
}

/**
 * Extract metadata from Wikipedia page
 *
 * @param $ - Cheerio instance loaded with page HTML
 * @param sections - Array of Wikipedia sections from the page
 * @param mangaData - Existing manga data object to populate
 */
export function extractMetadata(
  $: cheerio.CheerioAPI,
  sections: WikipediaSection[],
  mangaData: WikipediaMangaData
): void {
  const infobox = $('.infobox');

  // Extract description from intro paragraphs (about the manga, serialization, etc.)
  extractDescriptionFromInfobox($, mangaData);

  // Extract synopsis from Plot/Synopsis/Story sections (actual story content)
  extractSynopsis($, sections, mangaData);

  // Extract infobox metadata if present
  if (infobox.length) {
    extractCoverImage($, infobox, mangaData);
    extractGenres($, infobox, mangaData);
    extractDemographic($, infobox, mangaData);
    extractEditor($, infobox, mangaData);
    extractMangaType($, infobox, mangaData);
    extractLicensedBy($, infobox, mangaData);
  }

  // Extract fallback description from paragraphs if none found
  extractFallbackDescription($, mangaData);
}
