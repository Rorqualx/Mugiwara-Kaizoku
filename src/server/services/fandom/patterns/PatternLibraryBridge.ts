/**
 * Pattern Library Bridge for Fandom Services
 *
 * Provides a simplified interface to PatternLibrary for Fandom services,
 * bridging the gap between hardcoded Fandom patterns and the centralized
 * pattern matching system.
 *
 * @module PatternLibraryBridge
 */

import { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';
import type { PatternMatch } from '@/server/parsers/patterns/types';

/**
 * Result of extracting a volume number
 */
export interface VolumeExtractionResult {
  volumeNumber: number;
  raw: string;
  confidence: number;
}

/**
 * Result of extracting a chapter number
 */
export interface ChapterExtractionResult {
  chapterNumber: number;
  raw: string;
  confidence: number;
}

/**
 * Result of extracting a date
 */
export interface DateExtractionResult {
  date: string;
  raw: string;
  confidence: number;
}

/**
 * Result of extracting an ISBN
 */
export interface ISBNExtractionResult {
  isbn: string;
  raw: string;
  confidence: number;
}

/**
 * Publication status types
 */
export type PublicationStatus = 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | null;

/**
 * Bridge class that wraps PatternLibrary for Fandom-specific use cases.
 *
 * Provides simplified extraction methods that return Fandom-friendly results
 * while leveraging the centralized pattern matching system.
 *
 * @example
 * ```typescript
 * const bridge = new PatternLibraryBridge();
 *
 * // Extract volume number
 * const volume = bridge.extractVolumeNumber('Volume 5');
 * if (volume) {
 *   console.log(volume.volumeNumber); // 5
 * }
 *
 * // Extract status
 * const status = bridge.extractStatus('Status: Ongoing');
 * console.log(status); // 'ONGOING'
 * ```
 */
export class PatternLibraryBridge {
  private patternLibrary: PatternLibrary;

  constructor() {
    this.patternLibrary = new PatternLibrary();
  }

  /**
   * Extract volume number from text
   *
   * @param text - Text containing volume information
   * @returns Extraction result or null if not found
   */
  extractVolumeNumber(text: string): VolumeExtractionResult | null {
    const match = this.patternLibrary.match(text, 'volume', { clean: true });
    if (!match) return null;

    const volumeNumber = this.parseNumber(match.value);
    if (volumeNumber === null) return null;

    return {
      volumeNumber,
      raw: String(match.value),
      confidence: match.confidence
    };
  }

  /**
   * Extract all volume numbers from text
   *
   * @param text - Text containing multiple volume references
   * @returns Array of extraction results
   */
  extractAllVolumeNumbers(text: string): VolumeExtractionResult[] {
    const matches = this.patternLibrary.matchAll(text, 'volume', { clean: true });
    return matches
      .map(match => {
        const volumeNumber = this.parseNumber(match.value);
        if (volumeNumber === null) return null;
        return {
          volumeNumber,
          raw: String(match.value),
          confidence: match.confidence
        };
      })
      .filter((result): result is VolumeExtractionResult => result !== null);
  }

  /**
   * Extract chapter number from text
   *
   * @param text - Text containing chapter information
   * @returns Extraction result or null if not found
   */
  extractChapterNumber(text: string): ChapterExtractionResult | null {
    const match = this.patternLibrary.match(text, 'chapter', { clean: true });
    if (!match) return null;

    const chapterNumber = this.parseNumber(match.value);
    if (chapterNumber === null) return null;

    return {
      chapterNumber,
      raw: String(match.value),
      confidence: match.confidence
    };
  }

  /**
   * Extract all chapter numbers from text
   *
   * @param text - Text containing multiple chapter references
   * @returns Array of extraction results
   */
  extractAllChapterNumbers(text: string): ChapterExtractionResult[] {
    const matches = this.patternLibrary.matchAll(text, 'chapter', { clean: true });
    return matches
      .map(match => {
        const chapterNumber = this.parseNumber(match.value);
        if (chapterNumber === null) return null;
        return {
          chapterNumber,
          raw: String(match.value),
          confidence: match.confidence
        };
      })
      .filter((result): result is ChapterExtractionResult => result !== null);
  }

  /**
   * Extract publication status from text
   *
   * Uses PatternLibrary's determineStatus which handles multiple languages
   * and status variations.
   *
   * @param text - Text containing status information
   * @returns Normalized status or null if not found
   */
  extractStatus(text: string): PublicationStatus {
    return this.patternLibrary.determineStatus(text);
  }

  /**
   * Extract date from text
   *
   * Handles multiple date formats including ISO, US, European, and text-based.
   *
   * @param text - Text containing date information
   * @returns Extraction result or null if not found
   */
  extractDate(text: string): DateExtractionResult | null {
    const match = this.patternLibrary.match(text, 'date', {
      clean: true,
      checkContext: true
    });
    if (!match) return null;

    return {
      date: String(match.value),
      raw: String(match.value),
      confidence: match.confidence
    };
  }

  /**
   * Extract all dates from text
   *
   * @param text - Text containing multiple date references
   * @returns Array of extraction results
   */
  extractAllDates(text: string): DateExtractionResult[] {
    const matches = this.patternLibrary.matchAll(text, 'date', { clean: true });
    return matches.map(match => ({
      date: String(match.value),
      raw: String(match.value),
      confidence: match.confidence
    }));
  }

  /**
   * Extract ISBN from text
   *
   * Handles both ISBN-10 and ISBN-13 formats with or without hyphens.
   *
   * @param text - Text containing ISBN
   * @returns Extraction result or null if not found
   */
  extractISBN(text: string): ISBNExtractionResult | null {
    const match = this.patternLibrary.match(text, 'isbn', { clean: true });
    if (!match) return null;

    return {
      isbn: String(match.value),
      raw: String(match.value),
      confidence: match.confidence
    };
  }

  /**
   * Extract all ISBNs from text
   *
   * @param text - Text containing multiple ISBNs
   * @returns Array of extraction results
   */
  extractAllISBNs(text: string): ISBNExtractionResult[] {
    const matches = this.patternLibrary.matchAll(text, 'isbn', { clean: true });
    return matches.map(match => ({
      isbn: String(match.value),
      raw: String(match.value),
      confidence: match.confidence
    }));
  }

  /**
   * Extract genres from text
   *
   * Recognizes common manga genres and demographics.
   *
   * @param text - Text containing genre information
   * @returns Array of extracted genres
   */
  extractGenres(text: string): string[] {
    const matches = this.patternLibrary.matchAll(text, 'genre', { clean: true });
    return matches.map(match => String(match.value));
  }

  /**
   * Match any pattern type from PatternLibrary
   *
   * Provides direct access to PatternLibrary.match() for advanced use cases.
   *
   * @param text - Text to match against
   * @param patternType - Type of pattern to match
   * @returns PatternMatch or null
   */
  match(text: string, patternType: string): PatternMatch | null {
    return this.patternLibrary.match(text, patternType, { clean: true });
  }

  /**
   * Match all occurrences of a pattern type
   *
   * Provides direct access to PatternLibrary.matchAll() for advanced use cases.
   *
   * @param text - Text to match against
   * @param patternType - Type of pattern to match
   * @returns Array of PatternMatch
   */
  matchAll(text: string, patternType: string): PatternMatch[] {
    return this.patternLibrary.matchAll(text, patternType, { clean: true });
  }

  /**
   * Get all available pattern types
   *
   * @returns Array of pattern type names
   */
  getPatternTypes(): string[] {
    return this.patternLibrary.getPatternTypes();
  }

  /**
   * Parse a value as a number (int or float)
   */
  private parseNumber(value: string | number): number | null {
    if (typeof value === 'number') return value;

    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
}

/**
 * Singleton instance for convenience
 *
 * Use this when you don't need a custom PatternLibraryBridge instance.
 */
export const patternLibraryBridge = new PatternLibraryBridge();
