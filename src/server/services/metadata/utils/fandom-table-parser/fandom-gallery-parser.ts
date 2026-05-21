/**
 * Fandom Gallery Parser
 *
 * Parses volume covers and chapter information from Fandom wiki galleries
 * (Fire Force style - galleries with associated chapter lists)
 *
 * Extracted from: fandomTableParser.ts (lines 132-270)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { ChapterData, VolumeData } from './fandom-types';
import type { Element } from 'domhandler';

/**
 * Extract chapter range from caption text (e.g., "Chapters 1-7" → {start: 1, end: 7})
 */
function extractChapterRange(text: string): { start: number; end: number } | null {
  const rangeMatch = text.match(/Chapters?\s+(\d+)\s*[-–—]\s*(\d+)/i);
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return { start, end };
    }
  }
  return null;
}

/**
 * Generate chapter stubs from a range (for wikis that only show ranges)
 */
function generateChaptersFromRange(range: { start: number; end: number }): unknown[] {
  const chapters: unknown[] = [];
  for (let i = range.start; i <= range.end; i++) {
    chapters.push({ number: i, title: `Chapter ${i}` });
  }
  return chapters;
}

/**
 * Extract chapters from list items near a gallery item
 */
function extractChaptersFromParent(
  $: cheerio.CheerioAPI,
  $parent: cheerio.Cheerio<Element>
): unknown[] {
  const chapters: unknown[] = [];

  $parent.find('ul li').each((_, li) => {
    const $li = $(li);
    const $link = $li.find('a[href*="/wiki/Chapter_"], a[title*="Chapter "]').first();
    if (!$link.length) return;

    const liText = $li.text().trim();
    const linkText = $link.text().trim();
    const liMatch = liText.match(/^(\d+)\./);

    if (liMatch?.[1]) {
      const chapterNumber = parseFloat(liMatch[1]);
      chapters.push({ number: chapterNumber, title: linkText || `Chapter ${chapterNumber}` });
    }
  });

  return chapters;
}

/**
 * Process a single gallery item and return volume data if valid
 */
function processGalleryItem(
  $: cheerio.CheerioAPI,
  $item: cheerio.Cheerio<Element>
): VolumeData | null {
  const $caption = $item.find('.lightbox-caption, .gallerytext, .thumbcaption');
  const captionText = $caption.text().trim();

  const volumeMatch = captionText.match(/(?:Volume|Vol\.?)\s*(\d+)/i);
  if (!volumeMatch?.[1]) return null;

  const volumeNumber = parseInt(volumeMatch[1], 10);

  // Extract cover image
  const $img = $item.find('img').first();
  let coverImage = $img.attr('data-src') ?? $img.attr('src');
  if (coverImage !== undefined && !coverImage.startsWith('http')) {
    coverImage = `https:${coverImage}`;
  }

  // Find chapters from parent or from caption range
  const $parent = $item.closest('td, div').parent();
  let chapters = extractChaptersFromParent($, $parent);

  // If no individual chapters, try chapter range from caption (Black Clover style)
  if (chapters.length === 0) {
    const chapterRange = extractChapterRange(captionText);
    if (chapterRange) {
      chapters = generateChaptersFromRange(chapterRange);
    }
  }

  // Extract title - remove chapter range info
  let volumeTitle = `Volume ${volumeNumber}`;
  const titleMatch = captionText.match(/(?:Volume|Vol\.?)\s*\d+[\s:.-]+(.+)/i);
  if (titleMatch?.[1]) {
    const extractedTitle = titleMatch[1].replace(/Chapters?\s+\d+\s*[-–—]\s*\d+/i, '').trim();
    if (extractedTitle.length > 2) volumeTitle = extractedTitle;
  }

  const volume: VolumeData = { number: volumeNumber, title: volumeTitle, chapters };
  if (coverImage !== undefined) volume.coverImage = coverImage;
  return volume;
}

/**
 * Parse galleries with chapter lists (Fire Force style)
 * Also handles wikis with chapter ranges (Black Clover style: "Chapters 1-7")
 */
export function parseGalleryWithLists(html: string): VolumeData[] {
  const $ = cheerio.load(html);
  const volumeMap = new Map<number, VolumeData>();

  $('.wikia-gallery, .gallery').each((_, gallery) => {
    $(gallery).find('.wikia-gallery-item, .gallerybox, li').each((_, item) => {
      const volume = processGalleryItem($, $(item));
      if (volume) volumeMap.set(volume.number, volume);
    });
  });

  const volumes = Array.from(volumeMap.values()).sort((a, b) => a.number - b.number);
  const totalChapters = volumes.reduce((sum, v) => sum + (v.chapters?.length ?? 0), 0);
  logger.info(`[parseGalleryWithLists] Found ${volumes.length} volumes with ${totalChapters} chapters`);

  return volumes;
}

/**
 * Extract chapters from <ul> lists
 */
export function extractChaptersFromLists(html: string): ChapterData[] {
  const $ = cheerio.load(html);
  const chapterMap = new Map<number, ChapterData>();

  // Debug: Count all chapter links found
  const allChapterLinks = $('a[href*="/wiki/Chapter_"]').length;
  logger.info(`[extractChaptersFromLists] Total chapter links found in HTML: ${allChapterLinks}`);

  // Find all chapter links in lists
  // eslint-disable-next-line complexity -- HTML parsing with multiple extraction strategies for chapter numbers, URLs, and cover images
  $('ul li').each((_, li) => {
    const $li = $(li);
    const $link = $li.find('a[href*="/wiki/Chapter_"], a[title*="Chapter "]').first();

    if ($link.length) {
      const href = $link.attr('href');
      const linkText = $link.text().trim();
      const liText = $li.text().trim();

      // Extract chapter number
      let chapterNumber: number | undefined;

      // Try list item format (e.g., "00. Title")
      const liMatch = liText.match(/^(\d+)\./);
      if (liMatch?.[1]) {
        chapterNumber = parseFloat(liMatch[1]);
      } else {
        // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
        const zeroMatch = href?.match(/Chapter_0+-(\d+)/i);
        if (zeroMatch?.[1]) {
          chapterNumber = parseFloat(`0.${zeroMatch[1]}`);
        } else {
          // Try href or title
          const chapterMatch = href?.match(/Chapter_(\d+)/i);
          if (chapterMatch?.[1]) {
            chapterNumber = parseFloat(chapterMatch[1]);
          }
        }
      }

      // Debug: Log when we find chapters >= 290
      if (chapterNumber !== undefined && chapterNumber >= 290) {
        logger.info(`[extractChaptersFromLists] Found chapter ${chapterNumber} from: "${liText.substring(0, 100)}"`);
      }

      if (chapterNumber !== undefined) {
        // Extract cover image - look for images near the chapter link
        let coverImage: string | undefined;
        const $img = $li.find('img').first();

        if ($img.length) {
          coverImage = $img.attr('data-src') ?? $img.attr('data-image-url') ?? $img.attr('src');
          if (coverImage && !coverImage.startsWith('http')) {
            coverImage = coverImage.startsWith('//') ? `https:${coverImage}` : `https://${coverImage}`;
          }
          logger.debug(`[extractChaptersFromLists] Chapter ${chapterNumber} cover found:`, coverImage);
        }

        const chapter: ChapterData = {
          number: chapterNumber,
          title: linkText || `Chapter ${chapterNumber}`
        };
        const chapterUrl = href ? (href.startsWith('http') ? href : `https://fandom.com${href}`) : undefined;
        if (chapterUrl !== undefined) chapter.url = chapterUrl;
        if (coverImage !== undefined) chapter.coverImage = coverImage;
        chapterMap.set(chapterNumber, chapter);
      }
    }
  });

  const chapters = Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);

  // Debug: Log extraction summary
  const maxNum = chapters.length > 0 ? Math.max(...chapters.map(c => c.number)) : 0;
  logger.info(`[extractChaptersFromLists] Extracted ${chapters.length} chapters, max chapter number: ${maxNum}`);

  // Debug: Log chapters 290-310 if present
  const highChapters = chapters.filter(c => c.number >= 290);
  if (highChapters.length > 0) {
    logger.info(`[extractChaptersFromLists] Chapters >= 290: ${JSON.stringify(highChapters.map(c => c.number))}`);
  } else {
    logger.info(`[extractChaptersFromLists] No chapters >= 290 found`);
  }

  return chapters;
}
