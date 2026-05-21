/**
 * Image scoring logic for selecting the best chapter cover image
 */

import { logger } from '@/utils/logger';

import type { ImageScoringContext } from './types';
import type { CheerioAPI } from 'cheerio';

/**
 * Image selectors to try in order of priority
 */
export const IMAGE_SELECTORS = [
  // First try common infobox selectors
  '.pi-image-collection img',
  '.pi-image img',
  '.infobox img',
  '.portable-infobox img',
  'aside.portable-infobox img',
  '.pi-item img',
  // Fire Force specific selectors
  '.pi-image-thumbnail img',
  '.pi-image-collection-tab-content img',
  // Gallery images
  '.wikia-gallery-item img',
  '.gallery img',
  '#gallery-0 img',
  // Then try content area images - but be more selective
  '#mw-content-text .thumb img',
  '#mw-content-text .image img',
  // Finally try more generic selectors
  '#mw-content-text img[alt*="Chapter"]',
  '#mw-content-text img[alt*="Cover"]',
  'img[src*="Joins_the_Force"]',
  'img[src*="Chapter_"]',
] as const;

/**
 * Calculate score for an image based on various criteria
 */
function calculateImageScore(
  src: string,
  alt: string,
  context: ImageScoringContext
): number {
  let score = 1; // Base score for any valid image

  // Give highest priority to infobox images
  if (
    context.selector.includes('.pi-image') ||
    context.selector.includes('.infobox')
  ) {
    score += 20;
  }

  // Give high priority to gallery images
  if (context.selector.includes('gallery')) {
    score += 15;
  }

  // Check if image matches the current chapter number
  if (context.chapterNumberFromUrl) {
    score += scoreChapterMatch(src, alt, context.chapterNumberFromUrl);
  }

  // Higher score for chapter-specific images in general
  if (src.includes('Chapter_') || src.includes('chapter')) {
    score += 5;
  }

  // Score based on image size
  score += scoreImageSize(src);

  // Lower score for small thumbnails
  if (
    src.includes('/40?') ||
    src.includes('/50?') ||
    src.includes('/60?')
  ) {
    score -= 5;
  }

  return score;
}

/**
 * Score image based on chapter number match
 */
function scoreChapterMatch(
  src: string,
  alt: string,
  chapterNumberFromUrl: string
): number {
  // For Chapter 0, look for "Chapter_0" or "Joins_the_Force" (Chapter 0's title)
  if (chapterNumberFromUrl === '0') {
    if (
      src.includes('Joins_the_Force') ||
      src.includes('Chapter_0') ||
      alt.includes('Chapter 0')
    ) {
      return 30; // Highest priority for exact match
    }
  } else {
    // For other chapters, check if the image URL contains the chapter number
    const chapterPattern = new RegExp(
      `Chapter[_\\s]${chapterNumberFromUrl}(?![0-9])`,
      'i'
    );
    if (chapterPattern.test(src) || chapterPattern.test(alt)) {
      return 30;
    }
  }

  // Penalize images that clearly belong to different chapters
  if (src.includes('Chapter_')) {
    const imgChapterMatch = src.match(/Chapter_(\d+)/i);
    if (imgChapterMatch && imgChapterMatch[1] !== chapterNumberFromUrl) {
      return -20; // Strong penalty for wrong chapter
    }
  }

  return 0;
}

/**
 * Score image based on size indicators
 */
function scoreImageSize(src: string): number {
  if (src.includes('scale-to-width-down')) {
    const sizeMatch = src.match(/scale-to-width-down\/(\d+)/);
    if (sizeMatch?.[1]) {
      const size = parseInt(sizeMatch[1], 10);
      if (size >= 250) {
        return 5;
      } else if (size >= 150) {
        return 2;
      } else if (size < 100) {
        return -3;
      }
    }
  } else if (!src.includes('scale-to-width-down')) {
    // Full size images get bonus
    return 3;
  }

  return 0;
}

/**
 * Find the best cover image from the page
 */
export function findBestCoverImage(
  $: CheerioAPI,
  chapterNumberFromUrl: string | null
): string | undefined {
  let bestImageUrl: string | undefined;
  let bestImageScore = 0;

  for (const selector of IMAGE_SELECTORS) {
    const imgs = $(selector);
    imgs.each((_, elem) => {
      const img = $(elem);
      const srcAttr = img.attr('data-src') ?? img.attr('src');
      const alt = img.attr('alt') ?? '';

      // Skip site logos, UI elements, and navigation images
      if (!srcAttr || typeof srcAttr !== 'string') return;

      if (
        srcAttr.includes('Site-logo.png') ||
        srcAttr.includes('wiki.png') ||
        srcAttr.includes('transparent.gif') ||
        srcAttr.includes('ajax.gif')
      ) {
        return;
      }

      const src: string = srcAttr;
      const context: ImageScoringContext = {
        chapterNumberFromUrl,
        selector,
      };

      const score = calculateImageScore(src, alt, context);

      logger.debug(
        `Found image with selector "${selector}", score ${score}: ${src}`
      );

      if (score > bestImageScore) {
        bestImageScore = score;
        bestImageUrl = src;
      }
    });
  }

  if (bestImageUrl) {
    logger.debug(
      `Selected best image with score ${bestImageScore}: ${bestImageUrl}`
    );
  }

  return bestImageUrl;
}
