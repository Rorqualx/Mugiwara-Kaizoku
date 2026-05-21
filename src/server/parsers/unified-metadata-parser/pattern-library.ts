/**
 * Pattern Library
 *
 * Regex patterns for matching volume numbers, chapter numbers,
 * and publication status from text content.
 *
 * Extracted from: UnifiedMetadataParser.ts (lines 58-107)
 */

import type { ExtractedMetadata } from './types';

/**
 * Library of regex patterns for extracting metadata from text.
 * Provides static methods for matching volume numbers, chapter numbers,
 * and determining publication status.
 */
export class PatternLibrary {
  /**
   * Patterns for matching volume numbers in various formats
   * Supports: "Volume 1", "Vol. 1", "Tome 1", "第1巻"
   */
  static readonly VOLUME_PATTERNS: readonly RegExp[] = [
    /Volume\s+(\d+\.?\d*)/i,
    /Vol\.?\s*(\d+)/i,
    /Tome\s+(\d+)/i,
    /第(\d+)巻/,
  ];

  /**
   * Patterns for matching chapter numbers in various formats
   * Supports: "Chapter 1", "Ch. 1", "Episode 1", "第1話"
   */
  static readonly CHAPTER_PATTERNS: readonly RegExp[] = [
    /Chapter\s+(\d+\.?\d*)/i,
    /Ch\.?\s*(\d+)/i,
    /Episode\s+(\d+)/i,
    /第(\d+)話/,
  ];

  /**
   * Patterns for detecting publication status
   */
  static readonly STATUS_PATTERNS = {
    ongoing: /ongoing|current|serializ|active|present/i,
    completed: /complete|finish|end|conclude/i,
    hiatus: /hiatus|suspend|pause/i,
    cancelled: /cancel|discontinue|axe/i,
  } as const;

  /**
   * Extract volume number from text
   * @param text - Text to search for volume number
   * @returns Parsed volume number or null if not found
   */
  static matchVolume(text: string): number | null {
    for (const pattern of this.VOLUME_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Extract chapter number from text
   * @param text - Text to search for chapter number
   * @returns Chapter number string or null if not found
   */
  static matchChapter(text: string): string | null {
    for (const pattern of this.CHAPTER_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  /**
   * Determine publication status from text
   * @param text - Text to analyze for status indicators
   * @returns Status value, defaults to 'ONGOING' if no match
   */
  static determineStatus(text: string): ExtractedMetadata['status'] {
    const normalized = text.toLowerCase();
    if (this.STATUS_PATTERNS.completed.test(normalized)) return 'COMPLETED';
    if (this.STATUS_PATTERNS.hiatus.test(normalized)) return 'HIATUS';
    if (this.STATUS_PATTERNS.cancelled.test(normalized)) return 'CANCELLED';
    if (this.STATUS_PATTERNS.ongoing.test(normalized)) return 'ONGOING';
    return 'ONGOING'; // Default
  }
}
