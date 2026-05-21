/**
 * Fandom Alternative Parser
 *
 * Alternative volume parsing for Fandom wiki pages with different structures.
 * Handles pages where each volume has its own table, extracting covers,
 * chapters, and metadata through multiple parsing strategies.
 *
 * Extracted from: fandomTableParser.ts (lines 865-1168)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import type { VolumeData } from './fandom-types';
import type { AnyNode } from 'domhandler';

/**
 * Internal type for parsed chapter data during processing
 */
interface ParsedChapter {
  number: number;
  title: string;
}

/**
 * Extract volume title from surrounding context
 */
function extractVolumeTitleFromContext(
  $: cheerio.CheerioAPI,
  $context: cheerio.Cheerio<AnyNode>,
  volumeNumber: number
): string {
  const volumeNumStr = volumeNumber.toString().padStart(2, '0');
  const volumeNumStrAlt = volumeNumber.toString();

  // Try to find title in bold/strong elements
  let title: string | undefined;
  $context.find('b, strong').each((_, el) => {
    if (title) return;
    const text = $(el).text().trim();
    if ((text.includes(volumeNumStr) || text.endsWith(` ${volumeNumStrAlt}`)) &&
        text.length > 5 && /[a-zA-Z]/.test(text)) {
      title = text;
    }
  });

  if (title) return title;

  // Try attr title from links
  const $link = $context.find('a').first();
  const linkTitle = $link.attr('title');
  if (linkTitle && linkTitle.length > 5 && /[a-zA-Z]/.test(linkTitle)) {
    return linkTitle;
  }

  // Try the link text itself
  const linkText = $link.text().trim();
  if (linkText && linkText.length > 5 &&
      (linkText.includes(volumeNumStr) || linkText.includes(volumeNumStrAlt)) &&
      /[a-zA-Z]/.test(linkText)) {
    return linkText;
  }

  return `Volume ${volumeNumber}`;
}

/**
 * Merge chapters preserving proper titles over generic ones
 */
function mergeChaptersWithProperTitles(
  existingChapters: ParsedChapter[],
  newChapters: ParsedChapter[]
): ParsedChapter[] {
  const chapterMap = new Map<number, ParsedChapter>();

  for (const ch of existingChapters) {
    chapterMap.set(ch.number, ch);
  }

  newChapters.forEach((ch: ParsedChapter) => {
    if (!chapterMap.has(ch.number) ||
        (ch.title && !ch.title.match(/^Chapter\s+\d+$/))) {
      chapterMap.set(ch.number, ch);
    }
  });

  return Array.from(chapterMap.values()).sort(
    (a: ParsedChapter, b: ParsedChapter) => a.number - b.number
  );
}

/**
 * Update or create volume entry in the volume map
 */
function updateVolumeMap(
  volumeMap: Map<number, VolumeData>,
  volumeNumber: number,
  chapters: ParsedChapter[],
  coverImage: string | undefined,
  title?: string
): void {
  if (!volumeMap.has(volumeNumber)) {
    const volume: VolumeData = {
      number: volumeNumber,
      title: title ?? `Volume ${volumeNumber}`,
      chapters
    };
    if (coverImage !== undefined) volume.coverImage = coverImage;
    volumeMap.set(volumeNumber, volume);
    return;
  }

  const existing = volumeMap.get(volumeNumber);
  if (existing === undefined) return;

  if (coverImage && !existing.coverImage) {
    existing.coverImage = coverImage;
  }

  // Merge chapters if we found more with proper titles
  if (chapters.length === 0) return;

  const existingChapters = existing.chapters as ParsedChapter[] | undefined;

  // If existing has no chapters or only has generic titles, replace
  const hasProperTitles = chapters.some(
    (ch: ParsedChapter) => ch.title && !ch.title.match(/^Chapter\s+\d+$/)
  );
  const existingHasProperTitles = existingChapters?.some(
    (ch: ParsedChapter) => ch.title && !ch.title.match(/^Chapter\s+\d+$/)
  );

  if (!existingChapters || existingChapters.length === 0 ||
      (hasProperTitles && !existingHasProperTitles)) {
    existing.chapters = chapters;
  } else if (hasProperTitles) {
    // Merge preserving proper titles
    existing.chapters = mergeChaptersWithProperTitles(existingChapters, chapters);
  }
}

/**
 * Parse volume tables using alternative methods for different page structures.
 * Uses multiple strategies to extract volume and chapter data.
 *
 * @param html - Raw HTML content from Fandom wiki page
 * @returns Array of parsed volume data
 */
export function parseVolumeTablesAlternative(html: string): VolumeData[] {
  const $ = cheerio.load(html);
  const volumeMap = new Map<number, VolumeData>();

  // Method 1: Look for volume links and extract from surrounding content
  // Only process links that are actual volume page links (not just mentions)
  $('a[href*="/wiki/Volume_"]').each((_, link) => {
    const $link = $(link);
    const text = $link.text().trim();

    // Match volume links like "(Volume 1)" or "Volume 1"
    const volumeMatch = text.match(/(?:\()?Volume\s+(\d+)(?:\))?/i);
    if (volumeMatch?.[1]) {
      const volumeNumber = parseInt(volumeMatch[1], 10);

      // Look for a nearby image (cover)
      const $parent = $link.closest('tr, div, td, li');
      const $img = $parent.find('img').first();
      let coverImage: string | undefined;

      if ($img.length > 0) {
        coverImage = $img.attr('data-src') ?? $img.attr('src');
        if (coverImage && !coverImage.startsWith('http')) {
          coverImage = `https:${coverImage}`;
        }
      }

      // Extract title from context
      const volumeTitle = extractVolumeTitleFromContext($, $parent, volumeNumber);

      // Create or update volume entry
      if (!volumeMap.has(volumeNumber)) {
        const volume: VolumeData = {
          number: volumeNumber,
          title: volumeTitle,
          chapters: []
        };
        if (coverImage !== undefined) volume.coverImage = coverImage;
        volumeMap.set(volumeNumber, volume);
      } else {
        const existingVolume = volumeMap.get(volumeNumber);
        if (existingVolume && coverImage && !existingVolume.coverImage) {
          existingVolume.coverImage = coverImage;
        }
      }
    }
  });

  // Method 2: Look for tables with volume information
  $('table').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text();

    // Skip navigation tables
    if ($table.hasClass('navbox') || $table.hasClass('infobox')) {
      return;
    }

    // Check if table contains volume data
    const volumeMatch = tableText.match(/Volume\s+(\d+)/i);
    if (volumeMatch?.[1]) {
      const volumeNumber = parseInt(volumeMatch[1], 10);

      // Extract cover image from table
      const $img = $table.find('img').first();
      let coverImage: string | undefined;

      if ($img.length > 0) {
        coverImage = $img.attr('data-src') ??
                    $img.attr('data-image-url') ??
                    $img.attr('src');

        if (coverImage) {
          // Remove any scaling parameters
          coverImage = coverImage.replace(/\/scale-to-width-down\/\d+/, '');
          // Ensure we use /revision/latest without parameters
          coverImage = coverImage.replace(/\/revision\/latest.*?(\?|$)/, '/revision/latest');

          // Ensure proper URL format
          if (!coverImage.startsWith('http')) {
            coverImage = coverImage.startsWith('//') ? `https:${coverImage}` : `https://${coverImage}`;
          }
        }
      }

      // Extract chapter information from table - look for actual chapter links with titles
      const chaptersMap = new Map<number, ParsedChapter>();

      // Look for chapter lists that are associated with this volume table
      // Fire Force wiki has chapters in <ul> lists within or near the table
      const $volumeSection = $table.closest('td').length ? $table.closest('td') : $table.parent();

      // First try to find chapters in lists within the volume section
      $volumeSection.find('ul li').each((_, listItem) => {
        const $li = $(listItem);
        const $link = $li.find('a[href*="/wiki/Chapter_"], a[title*="Chapter "]').first();

        if ($link.length) {
          const href = $link.attr('href');
          const titleAttr = $link.attr('title');
          const linkText = $link.text().trim();

          // Extract chapter number from various sources
          const liText = $li.text().trim();
          let chapterNumber: number | undefined;

          // Try to extract from list item text (e.g., "00. Shinra Kusakabe Joins the Force")
          const liMatch = liText.match(/^(\d+)\./);
          if (liMatch?.[1]) {
            chapterNumber = parseFloat(liMatch[1]);
          } else {
            // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
            const zeroMatch = href?.match(/Chapter_0+-(\d+)/i);
            if (zeroMatch?.[1]) {
              chapterNumber = parseFloat(`0.${zeroMatch[1]}`);
            } else {
              // Fallback to href or title
              const chapterMatch = href?.match(/Chapter_(\d+)/i) ?? titleAttr?.match(/Chapter\s+(\d+)/i);
              if (chapterMatch?.[1]) {
                chapterNumber = parseFloat(chapterMatch[1]);
              }
            }
          }

          if (chapterNumber !== undefined) {
            // Use the link text as the chapter title (this contains the actual title)
            let chapterTitle = linkText;

            // Fallback to generic title if needed
            if (!chapterTitle || chapterTitle.match(/^(Chapter\s+)?\d+$/)) {
              chapterTitle = `Chapter ${chapterNumber}`;
            }

            // Use map to avoid duplicates by chapter number
            if (!chaptersMap.has(chapterNumber)) {
              chaptersMap.set(chapterNumber, {
                number: chapterNumber,
                title: chapterTitle
              });
            }
          }
        }
      });

      // If no chapters found in lists, try direct links in the table
      if (chaptersMap.size === 0) {
        $table.find('a[href*="/wiki/Chapter_"], a[title*="Chapter "]').each((_, link) => {
          const $link = $(link);
          const href = $link.attr('href');
          const titleAttr = $link.attr('title');
          const linkText = $link.text().trim();

          let chapterNumber: number | undefined;

          // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
          const zeroMatch = href?.match(/Chapter_0+-(\d+)/i);
          if (zeroMatch?.[1]) {
            chapterNumber = parseFloat(`0.${zeroMatch[1]}`);
          } else {
            // Extract chapter number from href or title
            const chapterMatch = href?.match(/Chapter_(\d+)/i) ?? titleAttr?.match(/Chapter\s+(\d+)/i);
            if (chapterMatch?.[1]) {
              chapterNumber = parseFloat(chapterMatch[1]);
            }
          }

          if (chapterNumber !== undefined) {

            // Use the link text as the chapter title (this contains the actual title)
            // If link text is just a number or "Chapter X", try to get title from parent li
            let chapterTitle = linkText;
            if (!chapterTitle || chapterTitle.match(/^(Chapter\s+)?\d+$/)) {
              // Try to get the full text from parent li element
              const $parent = $link.closest('li');
              if ($parent.length) {
                const liText = $parent.text().trim();
                // Extract just the title part after the chapter number
                const titleMatch = liText.match(/\d+\.\s*(.+?)(?:\s*\(|$)/);
                if (titleMatch?.[1]) {
                  chapterTitle = titleMatch[1].trim();
                }
              }
            }

            // Fallback to generic title if still no proper title
            if (!chapterTitle || chapterTitle.match(/^(Chapter\s+)?\d+$/)) {
              chapterTitle = `Chapter ${chapterNumber}`;
            }

            // Use map to avoid duplicates by chapter number
            if (!chaptersMap.has(chapterNumber)) {
              chaptersMap.set(chapterNumber, {
                number: chapterNumber,
                title: chapterTitle
              });
            }
          }
        });
      }

      // Convert map to array with proper typing
      const chapters: ParsedChapter[] = Array.from(chaptersMap.values()).sort(
        (a: ParsedChapter, b: ParsedChapter) => a.number - b.number
      );

      // If no chapters found via links, fall back to text matching
      if (chapters.length === 0) {
        const chapterMatches = tableText.matchAll(/Chapter\s+(\d+(?:\.\d+)?)/gi);
        for (const match of chapterMatches) {
          if (match[1]) {
            chapters.push({
              number: parseFloat(match[1]),
              title: `Chapter ${match[1]}`
            });
          }
        }
      }

      // Extract title from table context
      const volumeTitle = extractVolumeTitleFromContext($, $table, volumeNumber);

      // Create or update volume entry
      updateVolumeMap(volumeMap, volumeNumber, chapters, coverImage, volumeTitle);
    }
  });

  // Method 3: Extract from collapsed navigation table if present
  $('.mw-collapsible table').each((_, table) => {
    const $table = $(table);
    $table.find('tr').each((_, row) => {
      const $row = $(row);
      const rowText = $row.text();

      // Look for rows like "Volume 1    0 • 1 • 2 • 3 • 4 • 5"
      const volumeMatch = rowText.match(/Volume\s+(\d+)/i);
      if (volumeMatch?.[1]) {
        const volumeNumber = parseInt(volumeMatch[1], 10);

        // Extract chapter numbers from the row
        const chapters: ParsedChapter[] = [];
        const chapterPart = rowText.replace(/Volume\s+\d+/i, '').trim();
        const chapterNumbers = chapterPart.match(/\d+(?:\.\d+)?/g);

        if (chapterNumbers) {
          chapterNumbers.forEach(num => {
            chapters.push({
              number: parseFloat(num),
              title: `Chapter ${num}`
            });
          });
        }

        // Extract title from row context
        const volumeTitle = extractVolumeTitleFromContext($, $row, volumeNumber);

        // Update volume with chapter information
        if (volumeMap.has(volumeNumber)) {
          const existing = volumeMap.get(volumeNumber);
          if (existing !== undefined) {
            const existingChapters = existing.chapters as ParsedChapter[] | undefined;
            if (chapters.length > 0 && (!existingChapters || existingChapters.length === 0)) {
              existing.chapters = chapters;
            }
          }
        } else {
          volumeMap.set(volumeNumber, {
            number: volumeNumber,
            title: volumeTitle,
            chapters
          });
        }
      }
    });
  });

  // Convert map to sorted array
  const volumes = Array.from(volumeMap.values()).sort((a, b) => a.number - b.number);

  logger.info(`Alternative parsing found ${volumes.length} volumes`);

  return volumes;
}
