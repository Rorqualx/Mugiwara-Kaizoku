/**
 * Chapter Range Pattern Parser
 *
 * Parses chapters from Wikipedia HTML content when chapters are listed as ranges.
 * Pattern: "Chapter: 1-10", "Chapter: 11-20"
 *
 * Used by: Kaiju No. 8 and similar manga with range-based chapter listings
 */

import { DEFAULT_PARSER_CONFIG, getVolumeIdPattern } from '@/server/services/wikipedia/parser-config';
import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';

// Use configurable values
const { patterns: patternConfig } = DEFAULT_PARSER_CONFIG;

/**
 * Parse chapters from HTML content with chapter range pattern
 *
 * Handles chapter ranges like "Chapter: 1-10", "Chapter: 11-20".
 * Generates individual chapter entries for each chapter in the range.
 *
 * @param html - HTML content containing chapter ranges
 * @returns Array of parsed chapters
 */
export function parseChapterRangePattern(html: string): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];

  const chapterRangePattern = /Chapter:\s*(\d+)[–-](\d+)/gi;
  const rangeMatches = [...html.matchAll(chapterRangePattern)];

  if (rangeMatches.length === 0) {
    return chapters;
  }

  logger.info(`[WIKIPEDIA] Found ${rangeMatches.length} chapter ranges (chapter range pattern)`);

  // Find volume markers using configurable pattern
  const volumeIdPattern = getVolumeIdPattern(patternConfig.volumeIdPrefix);
  const volumeMarkers = [...html.matchAll(volumeIdPattern)];

  rangeMatches.forEach((match, index) => {
    const start = match[1];
    const end = match[2];

    if (start && end) {
      const startChapter = parseInt(start, 10);
      const endChapter = parseInt(end, 10);
      const volMarker = index < volumeMarkers.length ? volumeMarkers[index] : null;
      const volNum = volMarker?.[1];
      const volumeNumber = volNum ? parseInt(volNum, 10) : index + 1;

      // Generate chapters for this range
      for (let i = startChapter; i <= endChapter; i++) {
        chapters.push({
          number: i,
          title: `Chapter ${i}`,
          volumeNumber
        });
      }
    }
  });

  logger.info(`[WIKIPEDIA] Generated ${chapters.length} chapters from ranges`);
  return chapters;
}

/**
 * Detect if HTML contains chapter range pattern
 *
 * @param html - HTML content to check
 * @returns True if chapter range pattern is found
 */
export function isChapterRangePattern(html: string): boolean {
  const chapterRangePattern = /Chapter:\s*(\d+)[–-](\d+)/gi;
  const rangeMatches = [...html.matchAll(chapterRangePattern)];
  return rangeMatches.length > 0;
}

