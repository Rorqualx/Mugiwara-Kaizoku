/**
 * Dynamic Wiki Parser - Other Extractors Module
 *
 * Additional extraction methods for various wiki structures:
 * definition lists, galleries, collapsibles, categories, and fallbacks.
 *
 * Extracted from: DynamicWikiParser.ts (lines 1102-1309)
 */


import { extractBestImageUrl } from '@/server/services/fandom/utils/imageUtils';
import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';


import {
  type PageStructure,
  isRecord,
} from './types';
import { classifyLink } from './utils';

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

const log = logger.child('OtherExtractors', { service: 'DynamicWikiParser' });

// ============================================================================
// Helper: Extract Chapters from Content
// ============================================================================

/**
 * Extract chapter links from a content element
 */
export function extractChaptersFromContent(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>
): unknown[] {
  const chapters: unknown[] = [];

  const chapterLinks = $content.find('a[href*="Chapter"], a[href*="chapter"]');
  chapterLinks.each((_: number, link: unknown) => {
    const $link = $(link as AnyNode);
    const chapterMatch = $link.text().match(/Chapter\s*(\d+(?:\.\d+)?)/i);

    chapters.push({
      number: chapterMatch?.[1] ? parseFloat(chapterMatch[1]) : null,
      title: $link.text().trim(),
      url: $link.attr('href')
    });
  });

  return chapters;
}

// ============================================================================
// Helper: Extract Volume from Content
// ============================================================================

/**
 * Extract volume data from a content element
 */
export function extractVolumeFromContent(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>
): unknown {
  const volume: Record<string, unknown> = {
    chapters: []
  };

  // Extract volume number
  const volumeMatch = $content.text().match(/Volume\s*(\d+)/i);
  if (volumeMatch?.[1]) {
    volume['number'] = parseInt(volumeMatch[1]);
  }

  // Extract chapters
  const chapterLinks = $content.find('a[href*="Chapter"], a[href*="chapter"]');
  chapterLinks.each((_: number, link: unknown) => {
    const $link = $(link as AnyNode);
    (volume['chapters'] as unknown[]).push({
      title: $link.text().trim(),
      url: $link.attr('href')
    });
  });

  const volumeChapters = volume['chapters'];
  return Array.isArray(volumeChapters) && volumeChapters.length > 0 ? volume : null;
}

// ============================================================================
// Definition List Extraction
// ============================================================================

/**
 * Extract data from definition list structures (dl/dt/dd)
 */
export function extractFromDefinitionList(
  $: CheerioAPI,
  _structure: PageStructure
): Promise<unknown> {
  const data: Record<string, unknown> = { volumes: [], chapters: [] };

  $('dl').each((_: number, dl: unknown) => {
    const $dl = $(dl as AnyNode);
    const items = $dl.find('dt');

    items.each((_: number, dt: unknown) => {
      const $dt = $(dt as AnyNode);
      const $dd = $dt.next('dd');

      const title = $dt.text().trim();

      if (/volume/i.test(title)) {
        (data['volumes'] as unknown[]).push({
          title,
          content: extractChaptersFromContent($, $dd)
        });
      } else if (/chapter/i.test(title)) {
        (data['chapters'] as unknown[]).push({
          title,
          url: $dd.find('a').first().attr('href')
        });
      }
    });
  });

  return Promise.resolve(data);
}

// ============================================================================
// Gallery Extraction
// ============================================================================

/**
 * Extract data from gallery-based page structures
 */
export function extractFromGallery(
  $: CheerioAPI,
  _structure: PageStructure
): Promise<unknown> {
  const volumes: unknown[] = [];
  const galleryImages: unknown[] = [];

  $('.gallery, .wikia-gallery').each((_: number, gallery: unknown) => {
    const $gallery = $(gallery as AnyNode);
    const items = $gallery.find('.gallerybox, .wikia-gallery-item');

    items.each((_: number, item: unknown) => {
      const $item = $(item as AnyNode);
      const $caption = $item.find('.gallerytext, .lightbox-caption');
      const $img = $item.find('img');

      // Extract the image URL (handles lazy-loaded images)
      const imgUrl = extractBestImageUrl($img);

      // Get caption text for categorization
      const captionText = $caption.text().trim();

      // Store all gallery images
      if (imgUrl) {
        galleryImages.push({
          url: imgUrl,
          caption: captionText,
          alt: $img.attr('alt') ?? '',
          type: captionText.includes('Issue') ? 'magazine_cover' :
                captionText.includes('Volume') ? 'volume_cover' : 'gallery'
        });
      }

      // Check if this is a volume
      const volumeMatch = captionText.match(/Volume\s*(\d+)/i);
      if (volumeMatch?.[1]) {
        volumes.push({
          number: parseInt(volumeMatch[1]),
          title: captionText,
          coverImage: imgUrl,
          url: $item.find('a').first().attr('href')
        });
      }
    });
  });

  return Promise.resolve({ volumes, gallery: galleryImages });
}

// ============================================================================
// Collapsibles Extraction
// ============================================================================

/**
 * Extract data from collapsible section structures
 */
export function extractFromCollapsibles(
  $: CheerioAPI,
  _structure: PageStructure
): Promise<unknown> {
  const data: Record<string, unknown> = { volumes: [], chapters: [] };

  $('.mw-collapsible').each((_: number, collapsible: unknown) => {
    const $collapsible = $(collapsible as AnyNode);
    const header = $collapsible.find('.mw-collapsible-toggle').text() ||
                   $collapsible.prev('h2, h3').text();

    if (/volume/i.test(header)) {
      const volumeData = extractVolumeFromContent($, $collapsible);
      if (volumeData) (data['volumes'] as unknown[]).push(volumeData);
    }

    if (/chapter/i.test(header)) {
      const chapterData = extractChaptersFromContent($, $collapsible);
      if (Array.isArray(chapterData)) {
        (data['chapters'] as unknown[]).push(...chapterData);
      }
    }
  });

  return Promise.resolve(data);
}

// ============================================================================
// Category Page Extraction
// ============================================================================

/**
 * Extract data from category page structures
 */
export function extractFromCategory(
  $: CheerioAPI,
  _structure: PageStructure
): Promise<unknown> {
  const pages: unknown[] = [];

  $('#mw-pages li a').each((_: number, link: unknown) => {
    const $link = $(link as AnyNode);
    pages.push({
      title: $link.text().trim(),
      url: $link.attr('href')
    });
  });

  // Categorize pages
  const chapters = pages.filter(p => {
    if (!isRecord(p)) return false;
    const title = getUnknownProperty(p, 'title');
    return typeof title === 'string' && /chapter/i.test(title);
  });
  const volumes = pages.filter(p => {
    if (!isRecord(p)) return false;
    const title = getUnknownProperty(p, 'title');
    return typeof title === 'string' && /volume/i.test(title);
  });

  return Promise.resolve({ volumes, chapters, pages });
}

// ============================================================================
// Fallback Extraction
// ============================================================================

/**
 * Extract data using fallback selectors when primary methods fail
 */
export function extractWithFallbacks(
  $: CheerioAPI,
  structure: PageStructure
): Promise<unknown> {
  const data: Record<string, unknown> = { volumes: [], chapters: [], links: [] };

  // Try each fallback selector
  for (const selector of structure.selectors.fallbacks) {
    try {
      const elements = $(selector.selector);

      elements.each((_: number, el: unknown) => {
        const $el = $(el as AnyNode);

        if (selector.extractionMethod === 'attr' && selector.attribute) {
          const value = $el.attr(selector.attribute);
          if (value) {
            (data['links'] as unknown[]).push({
              text: $el.text().trim(),
              url: value,
              type: classifyLink(value, $el.text())
            });
          }
        } else {
          const text = $el.text().trim();
          if (/volume/i.test(text)) {
            (data['volumes'] as unknown[]).push({ title: text, element: $el.html() });
          } else if (/chapter/i.test(text)) {
            (data['chapters'] as unknown[]).push({ title: text, element: $el.html() });
          }
        }
      });
    } catch (error: unknown) {
      log.debug('Fallback selector failed', {
        selector: selector.selector,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return Promise.resolve(data);
}
