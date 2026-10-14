/**
 * Dynamic Wiki Parser - Tab Gallery
 *
 * Gallery images on a tabbed list page (magazine covers, volume covers).
 *
 * @module dynamic-wiki-parser/tab-extractor/gallery
 */

import { getFullSizeImageUrl, extractBestImageUrl } from '@/server/services/fandom/utils/imageUtils';
import { logger } from '@/utils/logger';

import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

const log = logger.child('TabExtractor', { service: 'DynamicWikiParser' });

export interface TabGalleryImage {
  url: string | undefined;
  caption: string;
  alt: string;
  type: 'magazine_cover' | 'volume_cover' | 'gallery';
}

function imageType(text: string): TabGalleryImage['type'] {
  if (text.includes('Issue')) return 'magazine_cover';
  return text.includes('Volume') ? 'volume_cover' : 'gallery';
}

function toImage($img: Cheerio<AnyNode>, caption: string): TabGalleryImage | null {
  const imgUrl = extractBestImageUrl($img);
  if (!imgUrl) return null;
  const alt = $img.attr('alt') ?? '';
  return { url: getFullSizeImageUrl(imgUrl), caption, alt, type: imageType(caption) };
}

/** Gallery images from `.gallery` / `.wikia-gallery` blocks. */
export function extractTabGallery($: CheerioAPI): TabGalleryImage[] {
  const images: TabGalleryImage[] = [];
  $('.gallery, .wikia-gallery')
    .find('.gallerybox, .wikia-gallery-item, .gallery .thumb')
    .each((_, item) => {
      const $item = $(item);
      const caption = $item.find('.gallerytext, .lightbox-caption, .thumbcaption').text().trim();
      const image = toImage($item.find('img').first(), caption);
      if (image) images.push(image);
    });

  // Images placed directly in a gallery, without an item wrapper.
  if (images.length === 0) {
    $('.gallery img, .wikia-gallery img').each((_, img) => {
      const $img = $(img);
      const image = toImage($img, $img.attr('alt') ?? '');
      if (image) images.push(image);
    });
  }

  if (images.length > 0) log.info(`[GALLERY] Total gallery images extracted from tabs: ${images.length}`);
  return images;
}
