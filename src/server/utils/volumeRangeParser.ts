/**
 * Volume Range Parser Utility
 *
 * Comprehensive parser for extracting volume ranges from manga release titles.
 * Handles various edge cases and format variations.
 */

import type { VolumeRange } from '@/types/pack-download-types';
import { logger } from '@/utils/logger';

/**
 * Parse volume range from release title
 *
 * Supports various formats:
 * - "v01-30", "v1-30", "v001-030"
 * - "vol 1-30", "Volume 1-30", "Volumes 1-30"
 * - "v01-v30", "v1 to v30", "v1 through v30"
 * - "[v01-30]", "(v01-30)", "{v01-30}"
 * - "Volume 1 - Volume 30"
 * - Japanese: "第01-04巻", "第1〜10巻", "第5巻"
 * - Single volumes: "v01", "v1", "vol 1", "Volume 1"
 *
 * For mixed-language titles where Japanese (第N-M巻) and English
 * (vol N-M) ranges disagree — common with raw releases like
 * "圧勝 第01-04巻 [Asshou vol 02-04]" where the bracketed English
 * label is a typo'd subtitle — the Japanese form is canonical and
 * is matched first.
 *
 * @param title - Release title to parse
 * @returns VolumeRange object or null if no valid range found
 */
export function parseVolumeRange(title: string): VolumeRange | null {
  if (!title || typeof title !== 'string') {
    return null;
  }

  // Normalize the title: remove brackets, trim whitespace
  const normalized = title
    .replace(/[[\](){}<>]/g, ' ') // Replace brackets with spaces
    .trim();

  logger.debug(`[VolumeRangeParser] Parsing title: "${title}"`);
  logger.debug(`[VolumeRangeParser] Normalized: "${normalized}"`);

  // Try each pattern in order of specificity
  const patterns = [
    // Pattern 0: Japanese kanji range
    // Examples: "第01-04巻", "第1〜10巻", "第 1 - 5 巻"
    // Canonical for Japanese raws — wins over a contradicting English subtitle.
    {
      regex: /第\s*(\d+)\s*[-–—~〜]\s*(\d+)\s*巻/,
      name: 'Japanese kanji range (第N-M巻)'
    },

    // Pattern 1: Explicit range with repeated "v" prefix
    // Examples: "v01-v30", "vol 1 - vol 30", "Volume 1 - Volume 30"
    {
      regex: /v(?:ol(?:ume)?s?\.?\s*)?(\d+)\s*[-–—~]\s*v(?:ol(?:ume)?s?\.?\s*)?(\d+)/i,
      name: 'Range with repeated prefix'
    },

    // Pattern 2: "to" or "through" connector
    // Examples: "v1 to v30", "Volume 1 through 30", "vol 1 thru 30"
    {
      regex: /v(?:ol(?:ume)?s?\.?\s*)?(\d+)\s+(?:to|through|thru|-)\s+v?(?:ol(?:ume)?s?\.?\s*)?(\d+)/i,
      name: 'Range with "to/through" connector'
    },

    // Pattern 3: Standard range with single prefix
    // Examples: "v01-30", "v1-30", "vol 1-30", "Volume 1-30", "Volumes 1-30"
    {
      regex: /v(?:ol(?:ume)?s?\.?\s*)?(\d+)\s*[-–—~]\s*(\d+)/i,
      name: 'Standard range with single prefix'
    },

    // Pattern 4: Range without prefix (risky, only if numbers are 1-3 digits)
    // Examples: "01-30", "1-30" (but avoid matching page numbers like "001-299")
    {
      regex: /\b(\d{1,3})\s*[-–—]\s*(\d{1,3})\b/,
      name: 'Range without prefix (number only)',
      validate: (start: number, end: number) => {
        // Only accept if it looks like volumes (1-999) and not page numbers
        return start >= 1 && end >= 1 && end <= 999 && (end - start) <= 100;
      }
    }
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);

    if (match?.[1] && match[2]) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);

      // Validate numbers
      if (isNaN(start) || isNaN(end)) {
        logger.debug(`[VolumeRangeParser] Pattern "${pattern.name}" matched but numbers are NaN`);
        continue;
      }

      // Ensure end >= start
      if (end < start) {
        logger.warn(`[VolumeRangeParser] Invalid range: end (${end}) < start (${start}) in "${title}"`);
        continue;
      }

      // Apply pattern-specific validation if exists
      if (pattern.validate && !pattern.validate(start, end)) {
        logger.debug(`[VolumeRangeParser] Pattern "${pattern.name}" validation failed for ${start}-${end}`);
        continue;
      }

      logger.info(`[VolumeRangeParser] Matched pattern "${pattern.name}": v${start}-v${end}`);

      return {
        start,
        end,
        isSingleVolume: false
      };
    }
  }

  // No range found - try single volume patterns
  const singlePatterns = [
    // Pattern 0: Japanese single
    // Examples: "第5巻", "第 12 巻"
    {
      regex: /第\s*(\d+)\s*巻/,
      name: 'Japanese kanji single (第N巻)'
    },

    // Pattern 1: With prefix
    // Examples: "v01", "v1", "vol 1", "Volume 1", "Volumes 1"
    {
      regex: /v(?:ol(?:ume)?s?\.?\s*)?(\d+)(?!\d)/i,
      name: 'Single volume with prefix'
    },

    // Pattern 2: Just a number (very risky - only use as last resort)
    {
      regex: /\b(\d{1,2})\b/,
      name: 'Single volume number only',
      validate: (vol: number) => {
        // Only accept if it's a reasonable volume number (1-99)
        return vol >= 1 && vol <= 99;
      }
    }
  ];

  for (const pattern of singlePatterns) {
    const match = normalized.match(pattern.regex);

    if (match?.[1]) {
      const vol = parseInt(match[1], 10);

      if (isNaN(vol)) {
        logger.debug(`[VolumeRangeParser] Pattern "${pattern.name}" matched but number is NaN`);
        continue;
      }

      // Apply pattern-specific validation if exists
      if (pattern.validate && !pattern.validate(vol)) {
        logger.debug(`[VolumeRangeParser] Pattern "${pattern.name}" validation failed for ${vol}`);
        continue;
      }

      // For "number only" pattern, skip if the title has actual volume keywords
      // This avoids false positives like "Chapter 1" being parsed as "Volume 1"
      if (pattern.name === 'Single volume number only' && /v(?:ol(?:ume)?s?)/i.test(normalized)) {
        logger.debug(`[VolumeRangeParser] Skipping "number only" pattern because volume keyword found`);
        continue;
      }

      logger.info(`[VolumeRangeParser] Matched pattern "${pattern.name}": v${vol}`);

      return {
        start: vol,
        end: vol,
        isSingleVolume: true
      };
    }
  }

  logger.debug(`[VolumeRangeParser] No volume range found in "${title}"`);
  return null;
}

/**
 * Check if a volume number is within a volume range
 *
 * @param volumeNumber - Volume number to check
 * @param range - Volume range to check against
 * @returns True if volume is within range
 */
export function isVolumeInRange(volumeNumber: number, range: VolumeRange): boolean {
  return volumeNumber >= range.start && volumeNumber <= range.end;
}

/**
 * Get all volume numbers covered by a range
 *
 * @param range - Volume range
 * @returns Array of volume numbers
 */
export function getVolumesFromRange(range: VolumeRange): number[] {
  const volumes: number[] = [];
  for (let vol = range.start; vol <= range.end; vol++) {
    volumes.push(vol);
  }
  return volumes;
}

/**
 * Check if two volume ranges overlap
 *
 * @param range1 - First volume range
 * @param range2 - Second volume range
 * @returns True if ranges overlap
 */
export function doRangesOverlap(range1: VolumeRange, range2: VolumeRange): boolean {
  // Check if either range starts within the other
  return (
    isVolumeInRange(range1.start, range2) ||
    isVolumeInRange(range1.end, range2) ||
    isVolumeInRange(range2.start, range1) ||
    isVolumeInRange(range2.end, range1)
  );
}

/**
 * Format a volume range as a human-readable string
 *
 * @param range - Volume range to format
 * @returns Formatted string (e.g., "v01-v30" or "v05")
 */
export function formatVolumeRange(range: VolumeRange): string {
  if (range.isSingleVolume) {
    return `v${range.start.toString().padStart(2, '0')}`;
  }
  return `v${range.start.toString().padStart(2, '0')}-v${range.end.toString().padStart(2, '0')}`;
}
