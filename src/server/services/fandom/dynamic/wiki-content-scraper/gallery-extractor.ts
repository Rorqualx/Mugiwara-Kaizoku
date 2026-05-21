/**
 * WikiContentScraper Gallery Extractor Module
 *
 * Extracts gallery images from wiki pages with intelligent image URL resolution
 * and categorization (volume covers, magazine covers, general gallery).
 *
 * Extracted from: WikiContentScraper.ts lines 488-546
 *
 * Functions:
 * - extractGalleryFromPage: Main gallery extraction from WikiPage HTML
 */

import * as cheerio from 'cheerio';


import { getFullSizeImageUrl, extractBestImageUrl } from '@/server/services/fandom/utils/imageUtils';
import { listPageImageUrlsViaApi } from '@/server/services/fandom/utils/mediaWikiApiFetch';

import type { WikiPage } from './types';
import type { Element } from 'domhandler';

/**
 * Reject Fandom site-furniture images: logos, wordmarks, favicons, navbar
 * sprites, social-media glyphs, edit/star buttons, etc. Anything left is a
 * candidate for the gallery. Filename-based heuristic on top of the URL path.
 */
function isSiteFurniture(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes('/site-logo')) return true;
  if (u.includes('site_logo')) return true;
  if (u.includes('wiki-background')) return true;
  if (u.includes('/avatar')) return true;
  if (u.includes('/favicon')) return true;
  if (/\/(checkmark|button|icon|sprite|emoji|emoticon|wordmark|favicon)\b/.test(u)) return true;
  const fname = url.split('/').pop()?.toLowerCase() ?? '';
  if (fname.length < 4) return true;
  if (/^(spoiler|tab|tabber|info|edit|menu|nav|logo|button|icon)\b/.test(fname)) return true;
  return false;
}

/**
 * Gallery image item structure
 */
export interface GalleryImage {
  url: string;
  caption: string;
  alt: string;
  type: 'magazine_cover' | 'volume_cover' | 'gallery';
}

/**
 * Extracts gallery images from a wiki page
 *
 * Searches for common wiki gallery patterns:
 * - .gallery and .wikia-gallery containers
 * - .gallerybox, .wikia-gallery-item elements
 * - Fallback to direct img tags if no structured gallery found
 *
 * @param page - Wiki page object containing HTML content
 * @returns Array of gallery image objects
 */
export async function extractGalleryFromPage(page: WikiPage): Promise<GalleryImage[]> {
  const $ = cheerio.load(page.html);
  const gallery: GalleryImage[] = [];

  // Look for gallery sections
  $('.gallery, .wikia-gallery').each((_: number, galleryElem: Element) => {
    const $gallery = $(galleryElem);

    // Find all gallery items
    const items = $gallery.find('.gallerybox, .wikia-gallery-item, .gallery .thumb');

    items.each((_: number, item: Element) => {
      const $item = $(item);
      const $img = $item.find('img').first();
      const $caption = $item.find('.gallerytext, .lightbox-caption, .thumbcaption');

      const imgUrl = extractBestImageUrl($img);
      if (imgUrl) {
        const fullSizeUrl = getFullSizeImageUrl(imgUrl);
        if (!fullSizeUrl) return;

        const captionText = $caption.text().trim();
        const alt = $img.attr('alt') ?? '';

        gallery.push({
          url: fullSizeUrl,
          caption: captionText || alt,
          alt,
          type: captionText.includes('Issue') || alt.includes('Issue') ? 'magazine_cover' :
                captionText.includes('Volume') || alt.includes('Volume') ? 'volume_cover' : 'gallery'
        });
      }
    });
  });

  // If no gallery items found, try direct images
  if (gallery.length === 0) {
    $('.gallery img, .wikia-gallery img').each((_: number, img: Element) => {
      const $img = $(img);
      const imgUrl = extractBestImageUrl($img);
      if (imgUrl) {
        const fullSizeUrl = getFullSizeImageUrl(imgUrl);
        if (!fullSizeUrl) return;

        const alt = $img.attr('alt') ?? '';

        gallery.push({
          url: fullSizeUrl,
          caption: alt,
          alt: alt,
          type: alt.includes('Issue') ? 'magazine_cover' :
                alt.includes('Volume') ? 'volume_cover' : 'gallery'
        });
      }
    });
  }

  // Union with the MediaWiki API images list — far more complete than HTML
  // scraping, since most Fandom manga pages use [[File:...]] references that
  // don't render as <img> tags inside a .gallery container.
  if (page.url) {
    const apiUrls = await listPageImageUrlsViaApi(page.url);
    const seenUrls = new Set(gallery.map(g => g.url));
    for (const url of apiUrls) {
      if (isSiteFurniture(url)) continue;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      const fname = url.split('/').pop() ?? '';
      const type = /Volume|Vol[._]|Cover/i.test(fname) ? 'volume_cover' :
                   /Issue|Magazine|WSM|Jump/i.test(fname) ? 'magazine_cover' : 'gallery';
      gallery.push({ url, caption: fname.replace(/\.[a-z]+$/i, '').replace(/_/g, ' '), alt: '', type });
    }
  }

  return gallery;
}
