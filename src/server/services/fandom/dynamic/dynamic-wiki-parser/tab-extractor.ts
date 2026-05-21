/**
 * Dynamic Wiki Parser - Tab Extractor Module
 *
 * Extracts volume and chapter data from tabbed interfaces.
 * Handles both WDS (Wikia Design System) and legacy tabber formats.
 *
 * Extracted from: DynamicWikiParser.ts (lines 623-1042)
 */

import { getFullSizeImageUrl, extractBestImageUrl } from '@/server/services/fandom/utils/imageUtils';
import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import {
  type PageStructure,
  isRecord,
  isChapterData,
} from './types';
import { extractImageUrl } from './utils';

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

const log = logger.child('TabExtractor', { service: 'DynamicWikiParser' });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process volume data and add to data collections
 */
function processVolumeData(
  data: Record<string, unknown>,
  volumeData: Record<string, unknown>
): void {
  // Only push if volumeData has content (not empty object)
  if (Object.keys(volumeData).length === 0) return;

  (data['volumes'] as unknown[]).push(volumeData);
  const chapters = getUnknownProperty(volumeData, 'chapters');
  if (!Array.isArray(chapters)) return;

  // Safely iterate and push each chapter
  for (const chapter of chapters) {
    if (isChapterData(chapter) || isRecord(chapter)) {
      (data['chapters'] as unknown[]).push(chapter);
    }
  }
}

// ============================================================================
// Tab Extraction
// ============================================================================

/**
 * Extract data from tabbed interfaces
 */
export function extractFromTabs($: CheerioAPI, _structure: PageStructure): Promise<unknown> {
  const data: Record<string, unknown> = { volumes: [], chapters: [] };

  // Handle modern Fandom WDS (Wikia Design System) tabber
  const wdsTabbers = $('.wds-tabber, .tabber');

  if (wdsTabbers.length > 0) {
    wdsTabbers.each((_: number, tabber: unknown) => {
      const $tabber = $(tabber as AnyNode);

      // Find tab labels and content
      const tabLabels = $tabber.find('.wds-tabs__tab-label');
      const tabContents = $tabber.find('.wds-tab__content');

      // If WDS tabs found
      if (tabLabels.length > 0 && tabContents.length > 0) {
        tabContents.each((index, content) => {
          const $content = $(content);
          const tabLabel = tabLabels.eq(index).text().trim();

          // Extract volume number from tab label
          const volumeMatch = tabLabel.match(/Volume\s*(\d+)/i);
          if (!volumeMatch) return;

          const volumeMatchValue = volumeMatch[1];
          if (volumeMatchValue === undefined) return;

          const volumeNumber = parseInt(volumeMatchValue);
          const volumeData = extractVolumeDataFromContent($, $content, volumeNumber, tabLabel);
          processVolumeData(data, volumeData);
        });
      }
    });
  }

  // Fallback to old tabber implementation
  if (Array.isArray(data['volumes']) && data['volumes'].length === 0) {
    const oldTabbers = $('.tabber, .tabberlive');

    oldTabbers.each((_: number, tabber: unknown) => {
      const $tabber = $(tabber as AnyNode);

      // Find all tabs (old style)
      const tabs = $tabber.find('.tabbertab');

      tabs.each((_tabIndex, tab) => {
      const $tab = $(tab);
      const tabTitle = $tab.attr('title') ?? '';

      // Extract volume number from tab title
      const volumeMatch = tabTitle.match(/Volume\s*(\d+)/i);
      if (volumeMatch) {
        const matchValue = volumeMatch[1];
        if (matchValue === undefined) return;
        const volumeNumber = parseInt(matchValue);

        const volumeData: Record<string, unknown> = {
          number: volumeNumber,
          title: tabTitle,
          chapters: []
        };

        // Look for volume cover image
        const coverImg = $tab.find('img').first();
        if (coverImg.length) {
          volumeData['coverImage'] = extractImageUrl(coverImg);
        }

        // Extract chapters from tables within the tab
        const tables = $tab.find('table');
        tables.each((_: number, table: unknown) => {
          const $table = $(table as AnyNode);
          const rows = $table.find('tr');

          rows.each((rowIndex, row) => {
            if (rowIndex === 0) return; // Skip header

            const $row = $(row);
            const cells = $row.find('td');

            if (cells.length >= 2) {
              // Look for chapter links
              const chapterLink = $row.find('a[href*="Chapter"]').first();
              if (chapterLink.length) {
                // Try to get the full title from the row, not just the link text
                // Often the format is: Chapter X | "Title Here"
                let chapterTitle = chapterLink.text().trim();

                // Check if there's a title in the next cell or after the link
                const linkParent = chapterLink.parent();
                const nextCell = linkParent.next('td');
                if (nextCell.length && nextCell.text().trim()) {
                  const titleText = nextCell.text().trim();
                  // If the next cell has quotes or doesn't start with Chapter, it's likely the title
                  if (!titleText.startsWith('Chapter') && !titleText.match(/^\d+$/)) {
                    chapterTitle = `${chapterTitle}: ${titleText.replace(/^["']|["']$/g, '')}`;
                  }
                }

                // Also check for title after a colon or dash in the same cell
                const fullText = linkParent.text().trim();
                if (fullText.includes(':') || fullText.includes('–') || fullText.includes('-')) {
                  const titleMatch = fullText.match(/Chapter\s+\d+(?:\.\d+)?[:\s–-]+(.+)/i);
                  if (titleMatch) {
                    const chapterNum = chapterLink.text().match(/\d+(?:\.\d+)?/)?.[0] ?? '';
                    chapterTitle = `Chapter ${chapterNum}: ${titleMatch[1]?.trim().replace(/^["']|["']$/g, '') ?? ''}`;
                  }
                }

                const chapterUrl = chapterLink.attr('href');

                // Extract chapter number
                const chapterMatch = chapterTitle.match(/(\d+(?:\.\d+)?)/);
                const volumeChapters = volumeData['chapters'];
                const chapterNumber = chapterMatch ? chapterMatch[1] : (Array.isArray(volumeChapters) ? volumeChapters.length + 1 : 1);

                (volumeData['chapters'] as unknown[]).push({
                  number: chapterNumber,
                  title: chapterTitle,
                  url: chapterUrl,
                  volume: volumeNumber
                });

                (data['chapters'] as unknown[]).push({
                  number: chapterNumber,
                  title: chapterTitle,
                  url: chapterUrl,
                  volume: volumeNumber
                });
              }
            }
          });
        });

        // Also look for chapter lists in <ul> elements
        const chapterLists = $tab.find('ul li');
        chapterLists.each((_: number, li: unknown) => {
          const $li = $(li as AnyNode);
          const link = $li.find('a').first();
          if (link.length && link.attr('href')?.includes('Chapter')) {
            let chapterTitle = link.text().trim();

            // Try to get the full title including any text after the link
            const fullLiText = $li.text().trim();
            if (fullLiText.includes(':') || fullLiText.includes('–') || fullLiText.includes('-')) {
              const titleMatch = fullLiText.match(/Chapter\s+\d+(?:\.\d+)?[:\s–-]+(.+)/i);
              if (titleMatch) {
                const chapterNum = link.text().match(/\d+(?:\.\d+)?/)?.[0] ?? '';
                chapterTitle = `Chapter ${chapterNum}: ${titleMatch[1]?.trim().replace(/^["']|["']$/g, '') ?? ''}`;
              }
            }

            const chapterUrl = link.attr('href');

            const chapterMatch = chapterTitle.match(/(\d+(?:\.\d+)?)/);
            const volumeChapters = volumeData['chapters'];
            const chapterNumber = chapterMatch ? chapterMatch[1] : (Array.isArray(volumeChapters) ? volumeChapters.length + 1 : 1);

            // Use .some() instead of .find() for boolean check
            const chapterExists = Array.isArray(volumeChapters) && volumeChapters.some((c: unknown) => {
              if (!isRecord(c)) return false;
              return getUnknownProperty(c, 'number') === chapterNumber;
            });

            if (!chapterExists) {
              (volumeData['chapters'] as unknown[]).push({
                number: chapterNumber,
                title: chapterTitle,
                url: chapterUrl,
                volume: volumeNumber
              });

              (data['chapters'] as unknown[]).push({
                number: chapterNumber,
                title: chapterTitle,
                url: chapterUrl,
                volume: volumeNumber
              });
            }
          }
        });

        // Extract ISBN if present
        const isbnMatch = $tab.text().match(/ISBN[:\s]*([\d-]+)/i);
        if (isbnMatch) {
          volumeData['isbn'] = isbnMatch[1];
        }

        // Extract release dates
        const dateMatch = $tab.text().match(/(\w+\s+\d{1,2},?\s+\d{4})/);
        if (dateMatch) {
          volumeData['releaseDate'] = dateMatch[1];
        }

        (data['volumes'] as unknown[]).push(volumeData);
      }
      });
    });
  }

  // If no tabber found, try alternative structures
  if (Array.isArray(data['volumes']) && data['volumes'].length === 0) {
    // Look for volume sections
    $('h2, h3').each((_: number, heading: unknown) => {
      const $heading = $(heading as AnyNode);
      const headingText = $heading.text();

      const volumeMatch = headingText.match(/Volume\s*(\d+)/i);
      if (volumeMatch?.[1]) {
        const volumeNumber = parseInt(volumeMatch[1]);
        const volumeData: Record<string, unknown> = {
          number: volumeNumber,
          title: headingText.trim(),
          chapters: []
        };

        // Get content after this heading until next heading
        let $current = $heading.next();
        while ($current.length && !$current.is('h2, h3')) {
          // Look for chapter links
          const links = $current.find('a[href*="Chapter"]');
          links.each((_: number, link: unknown) => {
            const $link = $(link as AnyNode);
            const chapterTitle = $link.text().trim();
            const chapterUrl = $link.attr('href');

            const chapterMatch = chapterTitle.match(/(\d+(?:\.\d+)?)/);
            const volumeChapters = volumeData['chapters'];
            const chapterNumber = chapterMatch ? chapterMatch[1] : (Array.isArray(volumeChapters) ? volumeChapters.length + 1 : 1);

            (volumeData['chapters'] as unknown[]).push({
              number: chapterNumber,
              title: chapterTitle,
              url: chapterUrl,
              volume: volumeNumber
            });
          });

          $current = $current.next();
        }

        const volumeChapters = volumeData['chapters'];
        if (Array.isArray(volumeChapters) && volumeChapters.length > 0) {
          processVolumeData(data, volumeData);
        }
      }
    });
  }

  // Extract gallery images (same as in extractFromTables)
  const galleryImages: unknown[] = [];
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

        log.info(`[GALLERY] Extracted image from tabs method: ${captionText || $img.attr('alt') || 'No caption'}`);

        galleryImages.push({
          url: cleanUrl,
          caption: captionText,
          alt: $img.attr('alt') ?? '',
          type: captionText.includes('Issue') ? 'magazine_cover' :
                captionText.includes('Volume') ? 'volume_cover' : 'gallery'
        });
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

        log.info(`[GALLERY] Extracted direct image from tabs: ${alt || 'No alt'}`);

        galleryImages.push({
          url: cleanUrl,
          caption: alt,
          alt: alt,
          type: alt.includes('Issue') ? 'magazine_cover' :
                alt.includes('Volume') ? 'volume_cover' : 'gallery'
        });
      }
    });
  }

  if (galleryImages.length > 0) {
    log.info(`[GALLERY] Total gallery images extracted from tabs: ${galleryImages.length}`);
    data['gallery'] = galleryImages;
  }

  return Promise.resolve(data);
}

// ============================================================================
// Volume Data Extraction
// ============================================================================

/**
 * Extract volume data from content section
 */
export function extractVolumeDataFromContent(
  $: CheerioAPI,
  $content: Cheerio<AnyNode>,
  volumeNumber: number,
  title: string
): Record<string, unknown> {
  const volumeData: Record<string, unknown> = {
    number: volumeNumber,
    title: title || `Volume ${volumeNumber}`,
    chapters: []
  };

  // Look for volume cover image
  const coverImg = $content.find('img').first();
  if (coverImg.length) {
    volumeData['coverImage'] = extractImageUrl(coverImg);
  }

  // Extract chapters from tables
  const tables = $content.find('table');
  tables.each((_: number, table: unknown) => {
    const $table = $(table as AnyNode);
    const rows = $table.find('tr');

    rows.each((rowIndex, row) => {
      if (rowIndex === 0) return; // Skip header

      const $row = $(row);

      // Look for chapter links in any cell
      const chapterLinks = $row.find('a[href*="Chapter"], a[href*="chapter"]');
      chapterLinks.each((_: number, link: unknown) => {
        const $link = $(link as AnyNode);
        const chapterTitle = $link.text().trim();
        const chapterUrl = $link.attr('href');

        // Extract chapter number
        const chapterMatch = chapterTitle.match(/(\d+(?:\.\d+)?)/);
        const volumeChapters = volumeData['chapters'];
        const chapterNumber = chapterMatch ? chapterMatch[1] : (Array.isArray(volumeChapters) ? volumeChapters.length : 0);

        // Avoid duplicates - use .some() instead of .find() for boolean check
        const chapterExists = Array.isArray(volumeChapters) && volumeChapters.some((c: unknown) => {
          if (!isRecord(c)) return false;
          return getUnknownProperty(c, 'number') === chapterNumber;
        });

        if (!chapterExists) {
          (volumeData['chapters'] as unknown[]).push({
            number: chapterNumber,
            title: chapterTitle,
            url: chapterUrl,
            volume: volumeNumber
          });
        }
      });
    });
  });

  // Also look for chapter lists outside tables
  const chapterLinks = $content.find('a[href*="Chapter"], a[href*="chapter"]');
  chapterLinks.each((_: number, link: unknown) => {
    const $link = $(link as AnyNode);
    const chapterTitle = $link.text().trim();
    const chapterUrl = $link.attr('href');

    const chapterMatch = chapterTitle.match(/(\d+(?:\.\d+)?)/);
    const volumeChapters = volumeData['chapters'];
    const chapterNumber = chapterMatch ? chapterMatch[1] : (Array.isArray(volumeChapters) ? volumeChapters.length : 0);

    // Avoid duplicates - use .some() instead of .find() for boolean check
    const chapterExists = Array.isArray(volumeChapters) && volumeChapters.some((c: unknown) => {
      if (!isRecord(c)) return false;
      return getUnknownProperty(c, 'number') === chapterNumber;
    });

    if (!chapterExists) {
      (volumeData['chapters'] as unknown[]).push({
        number: chapterNumber,
        title: chapterTitle,
        url: chapterUrl,
        volume: volumeNumber
      });
    }
  });

  // Extract ISBN if present
  const isbnMatch = $content.text().match(/ISBN[:\s]*([\d-]+)/i);
  if (isbnMatch) {
    volumeData['isbn'] = isbnMatch[1];
  }

  // Extract release dates
  const dateMatch = $content.text().match(/(\w+\s+\d{1,2},?\s+\d{4})/);
  if (dateMatch) {
    volumeData['releaseDate'] = dateMatch[1];
  }

  const chapters = volumeData["chapters"];
  if (Array.isArray(chapters) && chapters.length > 0) {
    return volumeData;
  }
  return {};
}
