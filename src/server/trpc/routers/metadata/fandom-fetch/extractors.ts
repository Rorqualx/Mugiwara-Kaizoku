/**
 * Extraction helper functions for Fandom metadata
 *
 * This module provides focused extraction utilities for:
 * - Cover images (multiple fallback strategies)
 * - Genres from infobox
 * - Authors/writers from infobox
 * - Publication status
 * - Building the final metadata result
 */

import { logger } from '@/utils/logger';

import type { CheerioAPI } from 'cheerio';


/**
 * Clean image URL by removing revision/scale parameters
 */
function cleanImageUrl(url: string): string {
  // Remove /revision/... and /scale-to-width/... parts
  const cleaned = url.split('/revision')[0]?.split('/scale-to-width')[0];
  return cleaned ?? url;
}

/**
 * Check if an image URL is likely a volume cover (better quality for manga)
 */
function isVolumeCoverUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return (
    urlLower.includes('volume') ||
    urlLower.includes('vol_') ||
    urlLower.includes('vol.') ||
    urlLower.includes('cover') ||
    // Common patterns: Volume_1.png, Vol1.jpg, etc.
    /vol(?:ume)?[\s_.-]?\d/i.test(url)
  );
}

/**
 * Extract cover image URL from Fandom page with multiple fallback strategies
 *
 * Priority order:
 * 1. Infobox image that looks like a volume cover (Volume_1, etc.)
 * 2. Any image in infobox with "volume" or "cover" in filename
 * 3. Regular infobox image (portable-infobox)
 * 4. Thumbnail image (lazy loaded or direct)
 * 5. Figure image
 * 6. Image with "cover" in filename anywhere on page
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Cover image URL or undefined if not found
 */
export function extractCoverImage($: CheerioAPI): string | undefined {
  // Strategy 1: Look for volume cover images in infobox first (highest priority)
  // These are more likely to be the actual manga cover, not a logo
  const infoboxImages = $('.portable-infobox .pi-image img, .portable-infobox img, .infobox img');
  let volumeCoverUrl: string | undefined;

  infoboxImages.each((_: number, elem) => {
    if (volumeCoverUrl) return; // Already found one

    const src = $(elem).attr('data-src') ?? $(elem).attr('src');
    if (src && isVolumeCoverUrl(src)) {
      volumeCoverUrl = cleanImageUrl(src);
      logger.debug('[extractCoverImage] Found volume cover in infobox:', volumeCoverUrl);
    }
  });

  if (volumeCoverUrl) {
    return volumeCoverUrl;
  }

  // Strategy 2: Regular infobox image (usually the cover)
  const infoboxImage = $('.portable-infobox .pi-image img').first();
  const infoboxSrc = infoboxImage.attr('data-src') ?? infoboxImage.attr('src');
  if (infoboxSrc) {
    return cleanImageUrl(infoboxSrc);
  }

  // Strategy 3: Thumbnail image (check data-src for lazy loaded images)
  const thumbImage = $('img.thumbimage, img[data-image-key]').first();
  const thumbSrc = thumbImage.attr('data-src') ?? thumbImage.attr('src');

  if (thumbSrc && typeof thumbSrc === 'string' && !thumbSrc.startsWith('data:')) {
    return cleanImageUrl(thumbSrc);
  }

  // Strategy 4: Figure image near top of page
  const figureImage = $('figure.image img').first();
  const figureSrc = figureImage.attr('data-src') ?? figureImage.attr('src');
  if (figureSrc) {
    return cleanImageUrl(figureSrc);
  }

  // Strategy 5: Image with "cover" or "volume" in filename anywhere on page
  const coverImage = $('img[src*="cover" i], img[src*="volume" i], img[data-src*="cover" i], img[data-src*="volume" i]').first();
  const coverSrc = coverImage.attr('data-src') ?? coverImage.attr('src');
  if (coverSrc) {
    return cleanImageUrl(coverSrc);
  }

  return undefined;
}

/**
 * Extract genres from infobox data
 *
 * Looks for "Genre" or "Genres" labels and parses comma/semicolon separated values
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Array of genre strings
 */
 
export function extractGenres($: CheerioAPI): string[] {
  const genres: string[] = [];

  logger.debug('[extractGenres] Starting genre extraction');

  // Strategy 1: Portable infobox with pi-data-label
  const piDataLabels = $('.pi-data-label:contains("Genre"), .pi-data-label:contains("Genres")');
  logger.debug('[extractGenres] Strategy 1 - pi-data-label matches:', piDataLabels.length);

  piDataLabels.each((_: number, elem) => {
    const genreText = ($(elem).next('.pi-data-value').text() as string).trim();
    logger.debug('[extractGenres] Found pi-data-label genre text:', genreText);
    if (genreText) {
      const parsed = genreText
        .split(/[,;]/)
        .map((g: string) => g.trim())
        .filter((g: string) => g);
      genres.push(...parsed);
    }
  });

  // Strategy 2: Check for data-source="genre" attribute (Fandom's newer structure)
  if (genres.length === 0) {
    const dataSourceGenre = $('[data-source="genre"] .pi-data-value, [data-source="genres"] .pi-data-value');
    logger.debug('[extractGenres] Strategy 2 - data-source matches:', dataSourceGenre.length);

    dataSourceGenre.each((_: number, elem) => {
      const genreText = ($(elem).text() as string).trim();
      logger.debug('[extractGenres] Found data-source genre text:', genreText);
      if (genreText) {
        const parsed = genreText
          .split(/[,;]/)
          .map((g: string) => g.trim())
          .filter((g: string) => g);
        genres.push(...parsed);
      }
    });
  }

  // Strategy 3: Look for infobox rows with "Genre" in header (legacy wikia structure)
  if (genres.length === 0) {
    const infoboxRows = $('th:contains("Genre"), td.infobox-label:contains("Genre")');
    logger.debug('[extractGenres] Strategy 3 - infobox row matches:', infoboxRows.length);

    infoboxRows.each((_: number, elem) => {
      const genreText = ($(elem).next('td').text() as string).trim();
      logger.debug('[extractGenres] Found infobox genre text:', genreText);
      if (genreText) {
        const parsed = genreText
          .split(/[,;]/)
          .map((g: string) => g.trim())
          .filter((g: string) => g);
        genres.push(...parsed);
      }
    });
  }

  // Strategy 4: Table-based infobox with <td><b>Genre</b></td><td>values</td>
  if (genres.length === 0) {
    logger.debug('[extractGenres] Strategy 4 - Looking for table-based infobox');

    // Find td cells containing "Genre" as bold text
    $('td').each((_: number, elem) => {
      const $td = $(elem);
      const boldText = $td.find('b').text().trim();

      if (boldText === 'Genre' || boldText === 'Genres') {
        // Get the next sibling td
        const nextTd = $td.next('td');
        const genreText = (nextTd.text() as string).trim();

        logger.debug('[extractGenres] Found table-based genre text:', genreText);

        if (genreText && genres.length === 0) {
          const parsed = genreText
            .split(/[,;]/)
            .map((g: string) => g.trim())
            .filter((g: string) => g);
          genres.push(...parsed);
        }
      }
    });

    logger.debug('[extractGenres] Strategy 4 - table matches found:', genres.length);
  }

  // Strategy 5: Generic fallback - look for any element with Genre text followed by values
  if (genres.length === 0) {
    logger.debug('[extractGenres] Strategy 5 - Generic fallback search');
    const infoboxContent = $('.portable-infobox').html();
    logger.debug('[extractGenres] Portable infobox exists:', !!infoboxContent);
    if (infoboxContent) {
      logger.debug('[extractGenres] Infobox HTML preview (first 500 chars):', infoboxContent.substring(0, 500));
    }
  }

  logger.debug('[extractGenres] Final genres found:', genres);

  return genres;
}

/**
 * Extract authors/writers from infobox data
 *
 * Looks for "Author" or "Writer" labels and parses comma/semicolon separated values
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Array of author names
 */
export function extractAuthors($: CheerioAPI): string[] {
  const authors: string[] = [];

  // Strategy 1: Portable infobox with pi-data-label
  $('.pi-data-label:contains("Author"), .pi-data-label:contains("Writer")').each((_: number, elem) => {
    const authorText = ($(elem).next('.pi-data-value').text() as string).trim();
    if (authorText) {
      const parsed = authorText
        .split(/[,;]/)
        .map((a: string) => a.trim())
        .filter((a: string) => a);
      authors.push(...parsed);
    }
  });

  // Strategy 2: Table-based infobox with <td><b>Author</b></td><td>values</td>
  if (authors.length === 0) {
    $('td').each((_: number, elem) => {
      const $td = $(elem);
      const boldText = $td.find('b').text().trim();

      if (boldText === 'Author' || boldText === 'Writer' || boldText === 'Written by') {
        const nextTd = $td.next('td');
        const authorText = (nextTd.text() as string).trim();

        if (authorText && authors.length === 0) {
          const parsed = authorText
            .split(/[,;]/)
            .map((a: string) => a.trim())
            .filter((a: string) => a);
          authors.push(...parsed);
        }
      }
    });
  }

  return authors;
}

/**
 * Extract publication status from infobox
 *
 * Looks for "Status" label in infobox
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Status string or undefined if not found
 */
export function extractStatus($: CheerioAPI): string | undefined {
  let status: string | undefined;

  // Strategy 1: Portable infobox with pi-data-label
  $('.pi-data-label:contains("Status")').each((_: number, elem) => {
    const statusText = ($(elem).next('.pi-data-value').text() as string).trim();
    if (statusText) {
      status = statusText;
    }
  });

  // Strategy 2: Table-based infobox with <td><b>Status</b></td><td>values</td>
  if (!status) {
    $('td').each((_: number, elem) => {
      const $td = $(elem);
      const boldText = $td.find('b').text().trim();

      if (boldText === 'Status') {
        const nextTd = $td.next('td');
        const statusText = (nextTd.text() as string).trim();

        if (statusText && !status) {
          status = statusText;
        }
      }
    });
  }

  return status;
}

/**
 * Extract alternative titles (Romaji, Kanji, etc.) from infobox
 *
 * Looks for title-related labels and extracts their values
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Array of alternative title strings
 */
export function extractAlternativeTitles($: CheerioAPI): string[] {
  const titles: string[] = [];

  logger.debug('[extractAlternativeTitles] Starting alternative titles extraction');

  // Strategy 1: Portable infobox with pi-data-label
  const piDataLabels = $('.pi-data-label:contains("Romaji"), .pi-data-label:contains("Kanji"), .pi-data-label:contains("Japanese"), .pi-data-label:contains("English")');
  logger.debug('[extractAlternativeTitles] Strategy 1 - pi-data-label matches:', piDataLabels.length);

  piDataLabels.each((_: number, elem) => {
    const titleText = ($(elem).next('.pi-data-value').text() as string).trim();
    if (titleText && !titles.includes(titleText)) {
      titles.push(titleText);
    }
  });

  // Strategy 2: Table-based infobox with <td><b>Label</b></td><td>value</td>
  if (titles.length === 0) {
    logger.debug('[extractAlternativeTitles] Strategy 2 - Looking for table-based infobox');

    $('td').each((_: number, elem) => {
      const $td = $(elem);
      const boldText = $td.find('b').text().trim();

      if (['Romaji', 'Kanji', 'Japanese', 'English', 'Other names', 'Alternative'].includes(boldText)) {
        const nextTd = $td.next('td');
        const titleText = (nextTd.text() as string).trim();

        logger.debug(`[extractAlternativeTitles] Found ${boldText}:`, titleText);

        if (titleText && !titles.includes(titleText)) {
          titles.push(titleText);
        }
      }
    });
  }

  logger.debug('[extractAlternativeTitles] Final titles found:', titles);

  return titles;
}

/**
 * Extract MyAnimeList URL and ID from page
 *
 * Looks for anchor tags with myanimelist.net in the href
 * and parses the manga ID from the URL
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Object with MAL URL and ID (both may be undefined)
 */
export function extractMyAnimeListUrl($: CheerioAPI): {
  url: string | undefined;
  id: number | undefined;
} {
  logger.debug('[extractMyAnimeListUrl] Starting MAL URL extraction');

  // Find anchor tags with myanimelist.net in href
  const malLink = $('a[href*="myanimelist.net"]').first().attr('href');

  logger.debug('[extractMyAnimeListUrl] Found MAL link:', malLink ?? 'None');

  let malId: number | undefined;
  if (malLink) {
    // Extract ID from URL like https://myanimelist.net/manga/91037/Enen_no_Shouboutai
    const idMatch = malLink.match(/myanimelist\.net\/manga\/(\d+)/);
    if (idMatch?.[1]) {
      malId = parseInt(idMatch[1], 10);
    }
    logger.debug('[extractMyAnimeListUrl] Extracted MAL ID:', malId ?? 'None');
  }

  return { url: malLink ?? undefined, id: malId };
}

/**
 * Extract Original Run dates from infobox
 *
 * Looks for "Original Run" label and parses start/end dates
 *
 * @param $ - Cheerio instance loaded with HTML
 * @returns Object with startDate and endDate strings
 */
export function extractOriginalRun($: CheerioAPI): { startDate: string | undefined; endDate: string | undefined } {
  let startDate: string | undefined;
  let endDate: string | undefined;

  logger.debug('[extractOriginalRun] Starting Original Run extraction');

  // Strategy 1: Portable infobox with pi-data-label
  $('.pi-data-label:contains("Original Run"), .pi-data-label:contains("Published"), .pi-data-label:contains("Run")').each((_: number, elem) => {
    const dateText = ($(elem).next('.pi-data-value').text() as string).trim();
    if (dateText && !startDate) {
      // Parse "September 23, 2015 - February 22, 2022" or similar formats
      const parts = dateText.split(/\s*[-–—]\s*/);
      if (parts[0]) startDate = parts[0].trim();
      if (parts[1]) endDate = parts[1].trim();
    }
  });

  // Strategy 2: Table-based infobox
  if (!startDate) {
    $('td').each((_: number, elem) => {
      const $td = $(elem);
      const boldText = $td.find('b').text().trim();

      if (boldText === 'Original Run' || boldText === 'Published' || boldText === 'Run') {
        const nextTd = $td.next('td');
        const dateText = (nextTd.text() as string).trim();

        logger.debug('[extractOriginalRun] Found date text:', dateText);

        if (dateText && !startDate) {
          // Parse "September 23, 2015 - February 22, 2022"
          const parts = dateText.split(/\s*[-–—]\s*/);
          if (parts[0]) startDate = parts[0].trim();
          if (parts[1]) endDate = parts[1].trim();
        }
      }
    });
  }

  logger.debug('[extractOriginalRun] Extracted dates:', { startDate, endDate });

  return { startDate, endDate };
}
