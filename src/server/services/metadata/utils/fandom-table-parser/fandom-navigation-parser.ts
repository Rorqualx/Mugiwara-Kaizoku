/**
 * Fandom Navigation Parser
 *
 * Parses volume and chapter information from Fandom wiki navigation tables
 * (collapsible nav tables with volume/chapter links)
 *
 * Extracted from: fandomTableParser.ts (lines 275-330)
 */

import * as cheerio from 'cheerio';

import { ChapterData, VolumeData } from './fandom-types';

/**
 * Parse navigation tables for basic volume/chapter info
 */
export function parseNavigationTables(html: string): VolumeData[] {
  const $ = cheerio.load(html);
  const volumes: VolumeData[] = [];

  $('.navbox, .mw-collapsible').each((_, table) => {
    const $table = $(table);
    $table.find('a[href*="/wiki/Volume_"]').each((_, link) => {
      const $link = $(link);
      const text = $link.text().trim();
      const volumeMatch = text.match(/Volume\s+(\d+)/i);
      if (volumeMatch?.[1]) {
        const volumeNumber = parseInt(volumeMatch[1], 10);
        volumes.push({
          number: volumeNumber,
          title: `Volume ${volumeNumber}`
        });
      }
    });
  });

  return volumes.sort((a, b) => a.number - b.number);
}

/**
 * Extract chapters from navigation tables
 */
export function extractChaptersFromNavigation(html: string): ChapterData[] {
  const $ = cheerio.load(html);
  const chapters: ChapterData[] = [];

  $('.navbox, .mw-collapsible').each((_, table) => {
    const $table = $(table);
    $table.find('a[href*="/wiki/Chapter_"]').each((_, link) => {
      const $link = $(link);
      const text = $link.text().trim();
      const href = $link.attr('href');

      let chapterNumber: number | undefined;

      // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
      const zeroMatch = href?.match(/Chapter_0+-(\d+)/i);
      if (zeroMatch?.[1]) {
        chapterNumber = parseFloat(`0.${zeroMatch[1]}`);
      } else {
        const chapterMatch = text.match(/Chapter\s+(\d+)/i) ?? href?.match(/Chapter_(\d+)/i);
        if (chapterMatch?.[1]) {
          chapterNumber = parseInt(chapterMatch[1], 10);
        }
      }

      if (chapterNumber !== undefined) {
        const chapter: ChapterData = {
          number: chapterNumber,
          title: text || `Chapter ${chapterNumber}`
        };
        const chapterUrl = href ? (href.startsWith('http') ? href : `https://fandom.com${href}`) : undefined;
        if (chapterUrl !== undefined) chapter.url = chapterUrl;
        chapters.push(chapter);
      }
    });
  });

  return chapters.sort((a, b) => a.number - b.number);
}
