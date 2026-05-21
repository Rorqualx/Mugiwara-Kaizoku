/**
 * Dynamic Wiki Parser - Table Extractor Module
 *
 * Extracts volume and chapter data from wiki tables.
 * Handles Fire Force specific patterns, volume headers,
 * chapter associations, and gallery images.
 *
 * Extracted from: DynamicWikiParser.ts (lines 393-621)
 */

import { getFullSizeImageUrl, extractBestImageUrl } from '@/server/services/fandom/utils/imageUtils';
import { logger } from '@/utils/logger';

import {
  type PageStructure,
  type VolumeData,
} from './types';
import { extractTableRow } from './utils';

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';


const log = logger.child('TableExtractor', { service: 'DynamicWikiParser' });

// ============================================================================
// Types
// ============================================================================

interface GalleryImage {
  url: string;
  caption: string;
  alt: string;
  type: 'magazine_cover' | 'volume_cover' | 'gallery';
}

interface TableExtractionResult {
  volumes: unknown[];
  chapters: unknown[];
  gallery: GalleryImage[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts chapter number from a wiki Chapter URL.
 * Handles Volume 0 prequel format (Chapter_0-1 → 0.1) and standard format.
 */
function extractChapterNumberFromHref(href: string): string | undefined {
  // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
  const zeroMatch = href.match(/Chapter_0+-(\d+)/i);
  if (zeroMatch?.[1]) {
    return `0.${zeroMatch[1]}`;
  }

  // Standard format: Chapter_1, Chapter_1.5
  const chapterMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/);
  return chapterMatch?.[1];
}

// ============================================================================
// Table Extraction
// ============================================================================

/**
 * Extract data from wiki tables
 *
 * Handles multiple table formats:
 * - Volume header tables with links
 * - Chapter association tables
 * - Gallery images within tables
 */
export function extractFromTables(
  $: CheerioAPI,
  _structure: PageStructure
): Promise<TableExtractionResult> {
  const volumes: unknown[] = [];
  const chapters: unknown[] = [];
  const processedChapters = new Set<string>();
  const processedVolumeData = new Map<number, VolumeData>();

  // First, expand any collapsed sections to access all content
  // This is important for pages like Fire Force List of Volumes
  $('.mw-collapsible').removeClass('mw-collapsed');
  $('.mw-collapsible-content').css('display', '');

  // Fire Force specific: Look for volume header tables
  const volumeTables = $('table').filter((_, table) => {
    const $table = $(table);
    const text = $table.text();
    // Check for volume links in table headers
    return $table.find('th a[href*="/wiki/Volume_"]').length > 0 ||
           (text.includes('Volume') && (text.includes('ISBN') || text.includes('Release')));
  });

  volumeTables.each((_: number, table: unknown) => {
    const $table = $(table as AnyNode);

    // Find volume header with link
    const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
    if (volumeHeader.length) {
      const volumeText = volumeHeader.text().trim();
      const volumeMatch = volumeText.match(/Volume\s*(\d+)/i);

      if (volumeMatch) {
        const matchValue = volumeMatch[1];
        if (matchValue === undefined) return;
        const volumeNumber = parseInt(matchValue);

        // Get or create volume data
        let volumeData = processedVolumeData.get(volumeNumber);
        if (!volumeData) {
          const url = volumeHeader.attr('href');
          const newVolumeData: VolumeData = {
            number: volumeNumber,
            title: volumeText,
            ...(url && { url }),
            chapters: []
          };
          processedVolumeData.set(volumeNumber, newVolumeData);
          volumes.push(newVolumeData);
          volumeData = newVolumeData;
        }

        // Extract ISBN
        const isbnMatch = $table.text().match(/ISBN[:\s]*([\d-]+)/);
        if (isbnMatch) {
          const isbnValue = isbnMatch[1];
          if (isbnValue) {
            volumeData.isbn = isbnValue;
          }
        }

        // Extract release date
        const releaseDateMatch = $table.text().match(/(\w+\s+\d{1,2},?\s+\d{4})/);
        if (releaseDateMatch) {
          const dateValue = releaseDateMatch[1];
          if (dateValue) {
            volumeData.releaseDate = dateValue;
          }
        }

        // Extract cover image with full-size URL
        const coverImage = $table.find('img').first();
        const imgUrl = coverImage.length ? extractBestImageUrl(coverImage) : undefined;
        const fullSizeUrl = imgUrl ? getFullSizeImageUrl(imgUrl) : undefined;
        if (fullSizeUrl) {
          volumeData.coverImage = fullSizeUrl;
        }

        // Find chapters associated with this volume
        // Look in the table itself and nearby elements
        const findChaptersInContext = ($context: Cheerio<AnyNode>): void => {
          $context.find('a').each((_: number, link: unknown) => {
            const $link = $(link as AnyNode);
            const href = $link.attr('href') ?? '';

            if (!href.includes('/wiki/Chapter_')) return;

            const chapterText = $link.text().trim() || href.replace('/wiki/', '').replace(/_/g, ' ');
            const chapterNumber = extractChapterNumberFromHref(href);

            if (!chapterNumber) return;

            // Check if chapter already exists globally
            if (!processedChapters.has(chapterNumber)) {
              processedChapters.add(chapterNumber);

              const chapterData = {
                number: chapterNumber,
                title: chapterText,
                url: href,
                volume: volumeNumber
              };

              // volumeData is always defined here due to the assignment above
              volumeData.chapters.push(chapterData);
              chapters.push(chapterData);
            }
          });
        };

        // Search in table
        findChaptersInContext($table);

        // Search in next siblings
        let $next = $table.next();
        let maxLookAhead = 5;

        while ($next.length && maxLookAhead > 0) {
          // Stop if we hit another volume table
          if ($next.is('table') && $next.find('a[href*="/wiki/Volume_"]').length > 0) {
            break;
          }

          findChaptersInContext($next);
          $next = $next.next();
          maxLookAhead--;
        }
      }
    }
  });

  // If no volumes found, try general table extraction
  if (volumes.length === 0) {
    const tables = $('table').not('.navbox, .infobox');

    tables.each((_: number, table: unknown) => {
      const $table = $(table as AnyNode);
      const headers = $table.find('th').map((_, th) => $(th).text().trim()).get();

      // Detect table type based on headers
      const isVolumeTable = headers.some(h => /volume/i.test(h));
      const isChapterTable = headers.some(h => /chapter/i.test(h));

      if (isVolumeTable || isChapterTable) {
        $table.find('tr').each((index, row) => {
          if (index === 0) return; // Skip header row

          const cells = $(row).find('td');
          if (cells.length < 2) return;

          const extractedItem = extractTableRow($, cells, headers);

          if (isVolumeTable) {
            volumes.push(extractedItem);
          } else {
            chapters.push(extractedItem);
          }
        });
      }
    });
  }

  // Also extract gallery images
  const galleryImages: GalleryImage[] = [];
  $('.gallery, .wikia-gallery').each((_: number, gallery: unknown) => {
    const $gallery = $(gallery as AnyNode);
    const items = $gallery.find('.gallerybox, .wikia-gallery-item, .gallery .thumb');

    items.each((_: number, item: unknown) => {
      const $item = $(item as AnyNode);
      const $img = $item.find('img').first();
      const $caption = $item.find('.gallerytext, .lightbox-caption, .thumbcaption');

      const imgUrl = extractBestImageUrl($img);
      if (imgUrl) {
        const captionText = $caption.text().trim();
        const cleanUrl = getFullSizeImageUrl(imgUrl);

        if (cleanUrl) {
          // Log gallery extraction for debugging
          log.info(`[GALLERY] Extracted image from table method: ${captionText || $img.attr('alt') || 'No caption'}`);

          galleryImages.push({
            url: cleanUrl,
            caption: captionText,
            alt: $img.attr('alt') ?? '',
            type: captionText.includes('Issue') ? 'magazine_cover' :
                  captionText.includes('Volume') ? 'volume_cover' : 'gallery'
          });
        }
      }
    });
  });

  // Also check for images directly in gallery without item wrapper
  if (galleryImages.length === 0) {
    $('.gallery img, .wikia-gallery img').each((_: number, img: unknown) => {
      const $img = $(img as AnyNode);
      const imgUrl = extractBestImageUrl($img);
      if (imgUrl) {
        const alt = $img.attr('alt') ?? '';
        const cleanUrl = getFullSizeImageUrl(imgUrl);

        if (cleanUrl) {
          log.info(`[GALLERY] Extracted direct image: ${alt || 'No alt'}`);

          galleryImages.push({
            url: cleanUrl,
            caption: alt,
            alt: alt,
            type: alt.includes('Issue') ? 'magazine_cover' :
                  alt.includes('Volume') ? 'volume_cover' : 'gallery'
          });
        }
      }
    });
  }

  if (galleryImages.length > 0) {
    log.info(`[GALLERY] Total gallery images extracted from tables: ${galleryImages.length}`);
  }

  return Promise.resolve({ volumes, chapters, gallery: galleryImages });
}
