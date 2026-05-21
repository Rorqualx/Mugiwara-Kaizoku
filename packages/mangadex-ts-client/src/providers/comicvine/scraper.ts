/**
 * ComicVine HTML scraper using cheerio
 * Extracts data not available through the API
 */

import * as cheerio from 'cheerio';
import { stripHtml } from '../../core/utils';

/** Extract chapter range from issue HTML description */
export function extractChapterRange(html: string): string | undefined {
  if (!html) return undefined;

  const patterns = [
    /chapters?\s*[:#]?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /ch\.?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /(\d+)\s*[-–—]+\s*(\d+)\s*chapters?/i,
    /includes?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /collects?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /contains?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /covers?\s*chapters?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /chapter\s*(\d+)\s*through\s*(\d+)/i,
    /ch\.\s*(\d+)\s*through\s*(\d+)/i,
    /#(\d+)\s*[-–—]+\s*#(\d+)/,
    /issues?\s*(\d+)\s*[-–—to]+\s*(\d+)/i,
    /vol(?:ume)?\.?\s*\d+\s*[:(]\s*(\d+)\s*[-–—]+\s*(\d+)/i,
  ];

  const text = stripHtml(html);

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[2]) {
      return `${match[1]}-${match[2]}`;
    }
  }

  return undefined;
}

/** Extract themes/concepts from HTML page */
export function extractThemes(html: string): string[] {
  if (!html) return [];

  const $ = cheerio.load(html);
  const themes: string[] = [];

  // Strategy 1: Concept links
  $('a[href*="/concept/"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 1 && text.length < 50) {
      themes.push(text);
    }
  });

  // Strategy 2: Tag/genre sections
  $('.tags a, .genres a, [data-type="concept"] a').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 1 && text.length < 50) {
      themes.push(text);
    }
  });

  // Strategy 3: Wiki section headers with content
  $('h3:contains("Concepts"), h3:contains("Themes"), h3:contains("Genre")').each(
    (_, el) => {
      const nextUl = $(el).next('ul');
      nextUl.find('a').each((_, link) => {
        const text = $(link).text().trim();
        if (text && text.length > 1 && text.length < 50) {
          themes.push(text);
        }
      });
    }
  );

  // Deduplicate
  return [...new Set(themes.map((t) => t.toLowerCase()))].map(
    (t) => t.charAt(0).toUpperCase() + t.slice(1)
  );
}

/** Extract cover image URL from page HTML */
export function extractCoverFromPage(html: string): string | undefined {
  if (!html) return undefined;

  const $ = cheerio.load(html);

  // Strategy: .imgboxart image
  const imgBoxArt = $('.imgboxart img, .gallery-image img, .wiki-image img').first();
  if (imgBoxArt.length) {
    return imgBoxArt.attr('src') || imgBoxArt.attr('data-src');
  }

  // Fallback: og:image meta
  const ogImage = $('meta[property="og:image"]').attr('content');
  return ogImage;
}

/** Clean HTML description - strip tables, scripts, styles */
export function cleanDescription(html: string): string {
  if (!html) return '';
  return stripHtml(html);
}
