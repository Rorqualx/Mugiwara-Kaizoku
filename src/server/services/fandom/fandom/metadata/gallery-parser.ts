/**
 * Fandom Gallery Parser
 *
 * Extracts gallery images from wiki pages.
 * Handles both API response images and HTML-scraped gallery sections.
 */

import type { WikiConfig, MediaWikiPage } from '@/server/services/fandom/types';
import { logger } from '@/utils/logger';

const log = logger.child('FandomGalleryParser');

export interface GalleryResult {
  gallery: string[];
  coverImage: string | undefined;
}

/**
 * Extract gallery images from a wiki page
 */
export async function extractGallery(
  page: MediaWikiPage,
  wikiConfig: WikiConfig,
  title: string,
  existingCoverImage?: string
): Promise<GalleryResult> {
  const gallery: string[] = [];
  const seenImages = new Set<string>();

  // First, get images from API response
  if (page.images && page.images.length > 0) {
    for (const img of page.images) {
      const imageName = img.title.replace('File:', '');

      // Skip certain types of images
      if (shouldSkipImage(imageName)) {
        continue;
      }

      // Construct the image URL
      const imageUrl = buildImageUrl(imageName, wikiConfig.subdomain);
      if (!seenImages.has(imageUrl)) {
        seenImages.add(imageUrl);
        gallery.push(imageUrl);
      }
    }
  }

  // Additionally, try to fetch and scrape the HTML page for ACTUAL gallery images only
  const htmlGalleryImages = await scrapeHtmlGallery(title, wikiConfig, seenImages);
  gallery.push(...htmlGalleryImages);

  // Ensure cover image is in the gallery if we have one
  let coverImage = existingCoverImage;
  if (coverImage) {
    // Add cover to front of gallery if not already present
    if (!seenImages.has(coverImage)) {
      gallery.unshift(coverImage);
      seenImages.add(coverImage);
      log.info('Added cover image to front of gallery', {
        coverUrl: coverImage.substring(0, 100)
      });
    }
  }

  if (gallery.length > 0) {
    log.info(`Extracted total ${gallery.length} gallery images from page`);

    // If no cover image was extracted from infobox, use the first gallery image
    if (!coverImage && gallery[0]) {
      coverImage = gallery[0];
      log.info('Using first gallery image as cover image (fallback)', {
        coverUrl: gallery[0].substring(0, 100)
      });
    }
  } else if (!coverImage) {
    log.warn('No gallery images or cover image found for page', { title });
  }

  return { gallery, coverImage };
}

/**
 * Check if an image should be skipped based on filename
 */
function shouldSkipImage(imageName: string): boolean {
  return (
    /\.(svg|gif|webp)$/i.test(imageName) ||
    imageName.includes('Wiki') ||
    imageName.includes('Logo') ||
    imageName.includes('Icon') ||
    imageName.includes('Button')
  );
}

/**
 * Build a direct image URL from filename
 */
function buildImageUrl(imageName: string, subdomain: string): string {
  return `https://${subdomain}.fandom.com/wiki/Special:FilePath/${encodeURIComponent(imageName)}`;
}

/**
 * Check if an image URL should be skipped
 */
function shouldSkipGalleryUrl(imgUrl: string): boolean {
  return (
    imgUrl.startsWith('data:') ||
    imgUrl.includes('transparent.gif') ||
    imgUrl.includes('.svg')
  );
}

/**
 * Check if a URL is a valid gallery image (not a logo/icon)
 */
function isValidGalleryImage(fullSrc: string): boolean {
  const lower = fullSrc.toLowerCase();
  return (
    !lower.includes('logo') &&
    !lower.includes('icon') &&
    !lower.includes('badge') &&
    !lower.includes('button')
  );
}

/**
 * Extract images from a gallery HTML section
 */
function extractImagesFromGalleryHtml(
  galleryHtml: string,
  subdomain: string,
  seenImages: Set<string>,
  gallery: string[]
): number {
  const imgRegex = /(?:src|data-src|data-image-key)="([^"]+)"/gi;
  let imgMatch;
  let count = 0;

  while ((imgMatch = imgRegex.exec(galleryHtml)) !== null) {
    let imgUrl = imgMatch[1];
    if (!imgUrl || shouldSkipGalleryUrl(imgUrl)) continue;

    // Handle different URL formats and clean up
    imgUrl = normalizeImageUrl(imgUrl, subdomain);
    const fullSrc = cleanGalleryImageUrl(imgUrl);

    // Add to gallery if valid and not already present
    if (!seenImages.has(fullSrc) && isValidGalleryImage(fullSrc)) {
      seenImages.add(fullSrc);
      gallery.push(fullSrc);
      count++;
    }
  }

  return count;
}

/**
 * Scrape HTML page for gallery sections
 */
async function scrapeHtmlGallery(
  title: string,
  wikiConfig: WikiConfig,
  seenImages: Set<string>
): Promise<string[]> {
  const gallery: string[] = [];

  try {
    const pageUrl = `https://${wikiConfig.subdomain}.fandom.com/wiki/${encodeURIComponent(title)}`;
    const response = await fetch(pageUrl);

    if (!response.ok) {
      return gallery;
    }

    const html = await response.text();

    // Look for specific gallery sections ONLY
    const gallerySelectors = [
      // Main gallery sections with class "gallery"
      /<div[^>]*class="[^"]*\bgallery\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Wikia gallery modules
      /<div[^>]*class="[^"]*wikia-gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Image gallery sections
      /<div[^>]*class="[^"]*image-gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Gallery box sections
      /<div[^>]*id="[^"]*gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // Tabber galleries (like Weekly Shonen Magazine Covers)
      /<div[^>]*class="[^"]*tabber[^"]*"[^>]*>([\s\S]*?)<\/div[^>]*class="[^"]*tabber/gi
    ];

    let galleryImagesFound = 0;

    for (const selector of gallerySelectors) {
      let match;
      while ((match = selector.exec(html)) !== null) {
        const galleryHtml = match[1];
        if (!galleryHtml) continue;

        const found = extractImagesFromGalleryHtml(galleryHtml, wikiConfig.subdomain, seenImages, gallery);
        galleryImagesFound += found;
      }
    }

    log.info(`Found ${galleryImagesFound} gallery images from HTML gallery sections`);
  } catch (scrapeError: unknown) {
    log.debug('Failed to scrape HTML for gallery images:', {
      error: scrapeError instanceof Error ? scrapeError.message : 'Unknown error'
    });
    // Continue with API images only
  }

  return gallery;
}

/**
 * Normalize image URL to absolute format
 */
function normalizeImageUrl(imgUrl: string, subdomain: string): string {
  if (!imgUrl.startsWith('http')) {
    if (imgUrl.startsWith('//')) {
      return `https:${imgUrl}`;
    } else if (!imgUrl.includes('/')) {
      // Just a filename, likely from data-image-key
      return `https://${subdomain}.fandom.com/wiki/Special:FilePath/${encodeURIComponent(imgUrl)}`;
    } else {
      // Relative URL
      return `https://${subdomain}.fandom.com${imgUrl}`;
    }
  }
  return imgUrl;
}

/**
 * Clean gallery image URL to get full resolution
 */
function cleanGalleryImageUrl(imgUrl: string): string {
  let fullSrc = imgUrl;

  if (fullSrc.includes('/revision/')) {
    fullSrc = fullSrc.split('/revision/')[0] + '/revision/latest';
  }
  if (fullSrc.includes('/scale-to-width-down/')) {
    fullSrc = fullSrc.replace(/\/scale-to-width-down\/\d+/, '');
  }
  if (fullSrc.includes('/thumbnail/')) {
    fullSrc = fullSrc.replace('/thumbnail/', '/');
  }

  return fullSrc;
}
