/**
 * Table Extractor - Gallery Extractors
 *
 * Functions for extracting volume data from wiki galleries
 * including Wikia galleries and tabbed gallery content.
 *
 * Extracted from: TableExtractor.ts (lines 335-406, 904-959)
 */

import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import {
  extractGalleryImage,
  parseChapterRange,
} from './utils';

import type {
  CheerioAPI,
  Element,
  VolumeInfo,
  TableData,
  ExtractionOptions,
} from './types';

// ============================================================================
// Gallery Pattern Extractors
// ============================================================================

/**
 * Extract volumes from Wikia gallery format
 */
export function extractWikiaGalleryVolumes(
  $: CheerioAPI,
  gallery: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const volumes: VolumeInfo[] = [];

  $(gallery).find('.wikia-gallery-item, .lightbox').each((_, item) => {
    const $item = $(item);
    const caption = $item.find('.lightbox-caption, .caption').text().trim();
    const imageUrl = extractGalleryImage($, item);

    // Parse volume info from caption
    const volumeMatch = patterns.match(caption, 'volume');
    if (!volumeMatch) return;

    const volumeNum = parseInt(volumeMatch.value.toString(), 10);

    // Parse chapter range from caption
    const chapterMatch = caption.match(/Chapter(?:s)?\s+([\d.-]+(?:\s*[-–]\s*[\d.-]+)?)/i);

    const volume: VolumeInfo = {
      volumeNumber: volumeNum,
      title: caption,
      coverImage: imageUrl,
      chapters: []
    };

    // Parse chapter range
    if (chapterMatch?.[1]) {
      volume.chapters = parseChapterRange(chapterMatch[1], volumeNum, patterns);
    }

    // Extract ISBN if present
    const isbnMatch = patterns.match(caption, 'isbn');
    if (isbnMatch) {
      volume.isbn = isbnMatch.value.toString();
    }

    // Extract release date
    const dateMatch = patterns.match(caption, 'date');
    if (dateMatch) {
      volume.releaseDate = dateMatch.value.toString();
    }

    volumes.push(volume);
  });

  return volumes.length > 0 ? {
    type: 'gallery',
    volumes,
    confidence: 0.9
  } : null;
}

/**
 * Extract volumes from tabbed gallery format
 */
export function extractTabbedGalleryVolumes(
  $: CheerioAPI,
  element: Element,
  options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const allVolumes: VolumeInfo[] = [];

  // Process each tab
  $(element).find('.wds-tab__content, .tabbertab').each((_, tab) => {
    const tabData = extractWikiaGalleryVolumes($, tab, options, patterns);
    if (tabData?.volumes) {
      allVolumes.push(...tabData.volumes);
    }
  });

  return allVolumes.length > 0 ? {
    type: 'gallery',
    volumes: allVolumes,
    pattern: 'tabbed-gallery',
    confidence: 0.85
  } : null;
}

/**
 * Extract gallery data (volumes and images)
 * Public API for gallery extraction
 */
export function extractGalleryData(
  $: CheerioAPI
): Promise<{ volumes: VolumeInfo[]; images: Array<{ url: string; alt: string; caption: string }> }> {
  const volumes: VolumeInfo[] = [];
  const images: Array<{ url: string; alt: string; caption: string }> = [];

  // Look for gallery elements
  $('.wikia-gallery, .gallery, .wikia-gallery-item, .gallerybox').each((_, element) => {
    const $item = $(element);

    // Try to extract volume info from caption
    const caption = $item.find('.lightbox-caption, .gallerytext, .thumbcaption').text();
    const volumeMatch = caption.match(/Volume\s+(\d+)/i);

    if (volumeMatch?.[1]) {
      const volume: VolumeInfo = {
        volumeNumber: parseInt(volumeMatch[1], 10),
        title: caption.trim(),
        chapters: []
      };

      const coverImage = $item.find('img').attr('src');
      if (coverImage) {
        volume.coverImage = coverImage;
      }

      // Try to extract additional info
      const isbnMatch = caption.match(/ISBN[:\s]*([\d-]+)/i);
      if (isbnMatch?.[1]) {
        volume.isbn = isbnMatch[1];
      }

      const dateMatch = caption.match(/(\w+\s+\d{4})/);
      if (dateMatch?.[1]) {
        volume.releaseDate = dateMatch[1];
      }

      const chapterMatch = caption.match(/Chapter(?:s)?\s+([\d-]+)/i);
      if (chapterMatch?.[1]) {
        volume.chapterRange = chapterMatch[1];
      }

      volumes.push(volume);
    }

    // Always extract images
    const imgSrc = $item.find('img').attr('src');
    if (imgSrc) {
      images.push({
        url: imgSrc,
        alt: $item.find('img').attr('alt') ?? '',
        caption: caption.trim()
      });
    }
  });

  return Promise.resolve({ volumes, images });
}
