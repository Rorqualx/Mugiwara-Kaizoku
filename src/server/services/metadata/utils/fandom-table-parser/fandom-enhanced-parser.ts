/**
 * Fandom Enhanced Parser
 *
 * Enhanced volume parsing that combines adaptive parsing with gallery extraction
 * and chapter distribution. Provides the most comprehensive metadata extraction.
 *
 * Extracted from: fandomTableParser.ts (lines 1170-1396)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { VolumeData, ChapterData } from './fandom-types';

/**
 * Enhanced volume parsing with chapter distribution
 *
 * Uses adaptive parser to get both volumes and chapters, then enhances
 * volumes with chapter data and gallery images.
 *
 * @param html - The HTML content to parse
 * @param parsePageAdaptiveFn - Function to parse page adaptively (passed to avoid circular imports)
 * @returns Array of enhanced volume data
 */
export function parseVolumeTablesEnhanced(
  html: string,
  parsePageAdaptiveFn: (html: string) => { volumes: VolumeData[], chapters: ChapterData[] }
): unknown[] {
  // Use adaptive parser to get both volumes and chapters
  const { volumes, chapters } = parsePageAdaptiveFn(html);

  // If no volumes found, return empty array
  if (volumes.length === 0) {
    logger.info('No volumes found with adaptive parsing');
    return [];
  }

  logger.info(`Adaptive parser found ${volumes.length} volumes and ${chapters.length} chapters`);

  // Log max chapter number found
  const maxChapter = chapters.reduce((max, ch) => Math.max(max, ch.number), 0);
  logger.info(`[parseVolumeTablesEnhanced] Max chapter number from adaptive parser: ${maxChapter}`);

  // Log chapters in 290-310 range for debugging
  const highChapters = chapters.filter(ch => ch.number >= 290 && ch.number <= 310);
  logger.info(`[parseVolumeTablesEnhanced] Chapters 290-310:`, JSON.stringify(highChapters.map(ch => ({ num: ch.number, title: ch.title }))));

  // Enhance volumes with chapter data if available
  // Create new array with enhanced volumes to avoid param reassignment
  const volumesWithChapters: VolumeData[] = chapters.length > 0
    ? volumes.map(volume => {
        if (!volume.chapters || volume.chapters.length === 0) {
          // Find chapters that belong to this volume
          const volumeChapters = chapters.filter(ch => ch.volume === volume.number);
          return { ...volume, chapters: volumeChapters };
        }
        return volume;
      })
    : volumes;

  // Additional enhancement with gallery extraction
  try {
    const $ = cheerio.load(html);

    // Extract all gallery images
    const galleryImages: { url: string; caption: string; type: string }[] = [];

    $('.wikia-gallery-item, .gallerybox, .gallery .thumb').each((_, item) => {
      const $item = $(item);
      const $img = $item.find('img').first();
      const $caption = $item.find('.lightbox-caption, .gallerytext, .thumbcaption');

      let imageUrl = $img.attr('data-src') ??
                   $img.attr('data-image-url') ??
                   $img.attr('src');

      if (imageUrl) {
        // Clean up URL: remove scaling params and normalize format
        imageUrl = imageUrl.replace(/\/scale-to-width-down\/\d+/, '');
        imageUrl = imageUrl.replace(/\/revision\/latest.*?(\?|$)/, '/revision/latest');
        if (!imageUrl.startsWith('http')) {
          imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://${imageUrl}`;
        }
      }

      if (imageUrl) {
        const caption = $caption.text().trim();
        let type = 'gallery';

        if (caption.toLowerCase().includes('volume')) {
          type = 'volume_cover';
        } else if (caption.toLowerCase().includes('chapter')) {
          type = 'chapter_cover';
        } else if (caption.toLowerCase().includes('character')) {
          type = 'character_art';
        }

        galleryImages.push({ url: imageUrl, caption, type });
      }
    });

    // Parse chapters from volume sections
    const enhancedVolumes = volumesWithChapters.map(volume => {
      // Check if this volume already has chapters with proper titles
      const existingChapters = volume.chapters ?? [];
      const hasProperTitles = existingChapters.some((ch: unknown) => {
        const chapter = ch as Record<string, unknown>;
        return chapter["title"] && !(chapter["title"] as string).match(/^Chapter\s+\d+$/);
      });

      // Always try to find chapters from navigation table - we'll use whichever has more
      const volumeChapters: unknown[] = [];
      let navTableChapters: unknown[] = [];

      // Try navigation table parsing regardless of existing chapters
      {

        // Look for the collapsed navigation table that has proper chapter listings per volume
        // Include .navbox, .wikitable for Fire Force style wikis
        const $navTable = $('table.mw-collapsible.mw-collapsed, table.navbox, .navbox, table.wikitable');
        if (volume.number === 34) {
          logger.info(`[parseVolumeTablesEnhanced] Volume 34: Looking for nav table, found ${$navTable.length} tables`);
        }
        if ($navTable.length) {
          if (volume.number === 34) {
            logger.info(`[parseVolumeTablesEnhanced] Found ${$navTable.length} nav tables, checking rows...`);
          }
          // Find rows in the navigation table
          $navTable.find('tr').each((_, row) => {
            const $row = $(row);
            const $volumeCell = $row.find('td').first();
            const volumeText = $volumeCell.text().trim();

            // Log rows that contain "34" for debugging
            if (volume.number === 34 && volumeText.includes('34')) {
              logger.info(`[parseVolumeTablesEnhanced] Found row with '34': "${volumeText.substring(0, 100)}"`);
            }

            // Check if this row is for the current volume
            const volumeMatch = volumeText.match(/Volume\s+(\d+)/i);
            if (volume.number === 34 && volumeMatch?.[1] && parseInt(volumeMatch[1], 10) === 34) {
              const $chapterCellDebug = $row.find('td').eq(1);
              const chapterLinksDebug = $chapterCellDebug.find('a[href*="/wiki/Chapter_"], a[title*="Chapter "]').length;
              // Also check for links directly in the row (not just in td.eq(1))
              const allChapterLinksInRow = $row.find('a[href*="/wiki/Chapter_"]').length;
              logger.info(`[parseVolumeTablesEnhanced] Volume 34 row found in nav table`);
              logger.info(`[parseVolumeTablesEnhanced] Volume 34 - chapter links in td.eq(1): ${chapterLinksDebug}, all in row: ${allChapterLinksInRow}`);
              logger.info(`[parseVolumeTablesEnhanced] Volume 34 row text: ${$row.text().substring(0, 300)}`);
              // Log td count
              logger.info(`[parseVolumeTablesEnhanced] Volume 34 row td count: ${$row.find('td').length}`);
            }
            if (volumeMatch?.[1] && parseInt(volumeMatch[1], 10) === volume.number) {
              // Get the chapter links - try second cell first, then fall back to entire row
              const $chapterCell = $row.find('td').eq(1);
              let chapterLinks = $chapterCell.find('a[href*="/wiki/Chapter_"]');

              // If no links found in second cell, search the entire row
              if (chapterLinks.length === 0) {
                chapterLinks = $row.find('a[href*="/wiki/Chapter_"]');
              }

              // Extract chapter links
              chapterLinks.each((_, link) => {
                const $link = $(link);
                const href = $link.attr('href');
                const titleAttr = $link.attr('title');
                const linkText = $link.text().trim();

                // Extract chapter number
                let chapterNumber: string | undefined;

                // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
                const zeroMatch = href?.match(/Chapter_0+-(\d+)/i);
                if (zeroMatch?.[1]) {
                  chapterNumber = `0.${zeroMatch[1]}`;
                } else {
                  const chapterMatch = linkText.match(/^(\d+)$/) ?? href?.match(/Chapter_(\d+)/i) ?? titleAttr?.match(/Chapter\s+(\d+)/i);
                  if (chapterMatch?.[1]) {
                    chapterNumber = chapterMatch[1];
                  }
                }

                if (chapterNumber) {

                  // Get chapter title, removing "Chapter X:" prefix if present
                  const chapterTitle = titleAttr ?? '';
                  const titleWithoutPrefix = chapterTitle.replace(/^Chapter\s+\d+:?\s*/, '').trim();
                  const finalTitle = titleWithoutPrefix || `Chapter ${chapterNumber}`;

                  // Build full URL
                  let chapterUrl = href;
                  if (chapterUrl && !chapterUrl.startsWith('http')) {
                    const baseMatch = html.match(/https?:\/\/[^/]+\.fandom\.com/);
                    if (baseMatch) {
                      chapterUrl = baseMatch[0] + chapterUrl;
                    }
                  }

                  volumeChapters.push({
                    chapterNumber: chapterNumber,
                    title: finalTitle,
                    url: chapterUrl
                  });
                }
              });

              // Fallback: If no links found, try to extract chapter numbers from row text
              if (volumeChapters.length === 0) {
                const rowText = $row.text();
                const chapterPart = rowText.replace(/Volume\s+\d+/i, '').trim();
                // Match numbers that are likely chapter numbers (avoid matching years like 2022)
                const chapterNumbers = chapterPart.match(/\b(\d{1,3})\b/g);

                if (chapterNumbers) {
                  const uniqueNums = [...new Set(chapterNumbers)];
                  uniqueNums.forEach(num => {
                    const chapterNum = parseInt(num, 10);
                    // Filter out unlikely chapter numbers (too high)
                    if (chapterNum <= 1000) {
                      volumeChapters.push({
                        chapterNumber: num,
                        title: `Chapter ${num}`,
                        url: undefined
                      });
                    }
                  });

                  if (volume.number === 34) {
                    logger.info(`[parseVolumeTablesEnhanced] Volume 34 - extracted ${volumeChapters.length} chapters from text`);
                  }
                }
              }
            }
          });
        }

        // Store nav table chapters
        navTableChapters = [...volumeChapters];
      } // Close navigation table parsing block

      // Fallback: Look for chapters in volume-specific sections (non-navigation tables)
      if (volumeChapters.length === 0) {
        // Look for volume sections and extract chapter links
        $('h2, h3, h4').each((_, heading) => {
          const $heading = $(heading);
          const headingText = $heading.text().trim();

          // Check if this heading is for the current volume
          const volumeMatch = headingText.match(/Volume\s+(\d+)/i);
          if (volumeMatch?.[1] && parseInt(volumeMatch[1], 10) === volume.number) {
            // Find the next section that contains chapter links
            let $current = $heading.next();

            while ($current.length > 0 && !$current.is('h2, h3, h4')) {
              // Skip navigation tables
              if (!$current.hasClass('mw-collapsible')) {
                // Look for chapter links within lists or tables
                $current.find('a[href*="/wiki/Chapter_"], a[title*="Chapter "]').each((_, link) => {
                  const $link = $(link);
                  const href = $link.attr('href');
                  const titleAttr = $link.attr('title');
                  const linkText = $link.text().trim();

                  // Extract chapter number from href or title attribute
                  let chapterNumber: string | undefined;

                  // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
                  const zeroMatch = href?.match(/Chapter_0+-(\d+)/i);
                  if (zeroMatch?.[1]) {
                    chapterNumber = `0.${zeroMatch[1]}`;
                  } else {
                    const chapterMatch = href?.match(/Chapter_(\d+)/i) ?? titleAttr?.match(/Chapter\s+(\d+)/i);
                    if (chapterMatch?.[1]) {
                      chapterNumber = chapterMatch[1];
                    }
                  }

                  if (chapterNumber) {

                    // Determine the chapter title
                    let chapterTitle = linkText;
                    if (!chapterTitle || chapterTitle.match(/^Chapter\s+\d+$/i)) {
                      chapterTitle = `Chapter ${chapterNumber}`;
                    }

                    // Build full URL
                    let chapterUrl = href;
                    if (chapterUrl && !chapterUrl.startsWith('http')) {
                      const baseMatch = html.match(/https?:\/\/[^/]+\.fandom\.com/);
                      if (baseMatch) {
                        chapterUrl = baseMatch[0] + chapterUrl;
                      }
                    }

                    // Avoid duplicates
                    if (!volumeChapters.some((ch: unknown) => {
                      const chapter = ch as Record<string, unknown>;
                      return chapter["chapterNumber"] === chapterNumber;
                    })) {
                      volumeChapters.push({
                        chapterNumber: chapterNumber,
                        title: chapterTitle,
                        url: chapterUrl
                      });
                    }
                  }
                });
              }

              $current = $current.next();
            }
          }
        });
      }

      // Sort chapters by number
      volumeChapters.sort((a: unknown, b: unknown) => {
        const chapterA = a as Record<string, unknown>;
        const chapterB = b as Record<string, unknown>;
        return parseInt(chapterA["chapterNumber"] as string) - parseInt(chapterB["chapterNumber"] as string);
      });

      // Choose the best chapter source - prefer the one with more chapters
      // Compare: existingChapters (from gallery), navTableChapters (from navbox), volumeChapters (fallback section)
      let finalChapters = volumeChapters;

      if (volume.number === 34) {
        logger.info(`[parseVolumeTablesEnhanced] Volume 34 chapter sources: existing=${existingChapters.length}, navTable=${navTableChapters.length}, fallback=${volumeChapters.length}`);
      }

      // Use existing chapters if they have more AND have proper titles
      if (existingChapters.length > finalChapters.length && hasProperTitles) {
        finalChapters = existingChapters;
      }

      // Use nav table chapters if they have more
      if (navTableChapters.length > finalChapters.length) {
        finalChapters = navTableChapters;
      }

      // Debug: Log Volume 34 final chapter assignment
      if (volume.number === 34) {
        logger.info(`[parseVolumeTablesEnhanced] Volume 34 final chapter count: ${finalChapters.length}`);
        if (finalChapters.length > 0) {
          logger.info(`[parseVolumeTablesEnhanced] Volume 34 chapters: ${JSON.stringify(finalChapters.slice(0, 3))}...`);
        }
      }

      return {
        ...volume,
        volumeNumber: volume.number,
        chapters: finalChapters,
        chapterCount: finalChapters.length,
        galleryImages: galleryImages
          .filter(img => img.caption.includes(`Volume ${volume.number}`))
          .map(img => img.url)
      };
    });

    // Log chapter distribution summary
    const volumeChapterCounts = enhancedVolumes.map((v: unknown) => {
      const vol = v as Record<string, unknown>;
      const chs = vol['chapters'] as unknown[] | undefined;
      return { vol: vol['volumeNumber'], chapters: chs?.length ?? 0 };
    });
    const totalChsAssigned = volumeChapterCounts.reduce((sum, v) => sum + v.chapters, 0);
    logger.info(`[parseVolumeTablesEnhanced] Chapter distribution: total assigned=${totalChsAssigned}`);
    // Log volumes with 0 chapters or volumes 30-34
    const problemVolumes = volumeChapterCounts.filter(v => v.chapters === 0 || (v.vol as number) >= 30);
    logger.info(`[parseVolumeTablesEnhanced] Volumes 30+ or with 0 chapters: ${JSON.stringify(problemVolumes)}`);

    logger.info(`Enhanced ${enhancedVolumes.length} volumes with chapter information`);
    return enhancedVolumes;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error enhancing volume tables:', errorMessage);
    return volumesWithChapters;
  }
}
