/**
 * Pattern Library - Main Aggregator
 *
 * Centralized pattern matching library that delegates to specialized modules.
 *
 * This class provides the main entry point for pattern matching operations,
 * delegating to specialized modules for pattern registration and matching logic.
 *
 * @module PatternLibrary
 */

import { mapToMangaStatus } from '@/utils/status-mapper';

import { registerCorePatterns } from './core-patterns';
import { registerLanguagePatterns } from './language-patterns';
import {
  matchPrimaryPatterns,
  matchContextualPatterns,
  matchSpecialPatterns
} from './pattern-matcher';
import { registerSpecialPatterns } from './special-patterns';
import { cleanText } from './text-utils';

import type { PatternMatch, PatternCollection, MatchOptions } from './types';

// Re-export types for backward compatibility
export type { PatternMatch, PatternCollection, MatchOptions } from './types';

/**
 * Main pattern library class that orchestrates pattern matching operations.
 *
 * Delegates to specialized modules for:
 * - Pattern registration (core, language, special)
 * - Pattern matching (primary, contextual, special)
 * - Text processing utilities
 *
 * @example
 * ```typescript
 * const library = new PatternLibrary();
 * const match = library.match('Volume 5', 'volume');
 * if (match) {
 *   console.log(`Found ${match.type}: ${match.value}`);
 * }
 * ```
 */
export class PatternLibrary {
  private patterns: Map<string, PatternCollection> = new Map();
  private customPatterns: Map<string, PatternCollection> = new Map();

  constructor() {
    // Register all patterns using extracted modules
    registerCorePatterns(this.patterns);
    registerLanguagePatterns(this.patterns);
    registerSpecialPatterns(this.patterns);
  }

  /**
   * Match a pattern in text
   *
   * Attempts to match text against a specific pattern type, using primary,
   * contextual, and special patterns in that order of preference.
   *
   * Complexity: Reduced from 37 to <10 via delegation to matcher modules.
   *
   * @param text - Text to search for patterns
   * @param patternType - Type of pattern to match (e.g., 'volume', 'chapter')
   * @param options - Matching options (clean, checkContext, includeSpecial)
   * @returns PatternMatch if found, null otherwise
   *
   * @example
   * ```typescript
   * const match = library.match('Chapter 42', 'chapter', { clean: true });
   * // Returns { type: 'chapter', value: '42', confidence: 1.0, pattern: '...' }
   * ```
   */
  match(text: string, patternType: string, options?: MatchOptions): PatternMatch | null {
    const collection = this.patterns.get(patternType) ?? this.customPatterns.get(patternType);
    if (!collection) return null;

    const processedText = options?.clean ? cleanText(text) : text;

    // Delegate to specialized matcher functions (nullish coalescing chain)
    // This reduces complexity from 37 to <10 by delegating logic to pure functions
    return (
      matchPrimaryPatterns(processedText, collection, patternType, options) ??
      matchContextualPatterns(processedText, collection, patternType, options) ??
      (options?.includeSpecial ? matchSpecialPatterns(processedText, collection, patternType) : null)
    );
  }

  /**
   * Match all patterns of a type
   *
   * Finds all occurrences of a pattern type in the text, rather than just
   * the first match. Useful for extracting multiple chapters, volumes, etc.
   *
   * @param text - Text to search for patterns
   * @param patternType - Type of pattern to match
   * @param options - Matching options
   * @returns Array of all matches found
   *
   * @example
   * ```typescript
   * const matches = library.matchAll('Vol. 1, Vol. 2, Vol. 3', 'volume');
   * // Returns [{ value: '1', ... }, { value: '2', ... }, { value: '3', ... }]
   * ```
   */
  matchAll(text: string, patternType: string, options?: MatchOptions): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const collection = this.patterns.get(patternType) ?? this.customPatterns.get(patternType);
    if (!collection) return matches;

    const processedText = options?.clean ? cleanText(text) : text;

    // Collect all matches from primary and special patterns
    const allPatterns = [
      ...(collection.primary ?? []),
      ...(collection.special ?? [])
    ];

    for (const pattern of allPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags + 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(processedText)) !== null) {
        const value = match[1] ?? match[0];

        // Skip if negative pattern matches
        if (collection.negative?.some(neg => neg.test(match ? match[0] : ''))) {
          continue;
        }

        matches.push({
          type: patternType,
          value,
          confidence: 1.0,
          pattern: pattern.source
        });
      }
    }

    return matches;
  }

  /**
   * Add custom pattern at runtime
   *
   * Allows dynamic registration of new pattern types without modifying
   * the core library. Useful for provider-specific patterns.
   *
   * @param type - Pattern type identifier
   * @param collection - Pattern collection containing patterns and validators
   *
   * @example
   * ```typescript
   * library.addCustomPattern('custom', {
   *   primary: [/Custom\s+(\d+)/i],
   *   validators: [{ validate: (v) => parseInt(v) > 0 }]
   * });
   * ```
   */
  addCustomPattern(type: string, collection: PatternCollection): void {
    this.customPatterns.set(type, collection);
  }

  /**
   * Get all pattern types
   *
   * Returns list of all registered pattern types, including both
   * built-in patterns and custom patterns added at runtime.
   *
   * @returns Array of pattern type identifiers
   *
   * @example
   * ```typescript
   * const types = library.getPatternTypes();
   * // Returns ['volume', 'chapter', 'status', 'isbn', ...]
   * ```
   */
  getPatternTypes(): string[] {
    return [
      ...Array.from(this.patterns.keys()),
      ...Array.from(this.customPatterns.keys())
    ];
  }

  /**
   * Determine status from text
   *
   * Extracts publication status from text and maps it to a standard
   * MangaStatus enum value. Handles multiple languages and formats.
   *
   * FIXED: Eliminated duplicate mapToMangaStatus() calls (lines 579, 585).
   * Now calls mapToMangaStatus() once and returns the mapped value.
   *
   * @param text - Text containing status information
   * @returns Standard status value or null if not found
   *
   * @example
   * ```typescript
   * const status = library.determineStatus('Status: Ongoing');
   * // Returns 'ONGOING'
   *
   * const status2 = library.determineStatus('Completed in 2020');
   * // Returns 'COMPLETED'
   * ```
   */
  determineStatus(text: string): 'ONGOING' | 'COMPLETED' | 'HIATUS' | 'CANCELLED' | null {
    const statusMatch = this.match(text, 'status');
    if (!statusMatch) return null;

    const value = String(statusMatch.value).toLowerCase();

    // Call mapToMangaStatus ONCE and use the result
    // This fixes the duplicate calls on lines 579 and 585
    const mappedStatus = mapToMangaStatus(value);

    // Only return the specific subset of statuses this method supports
    if (mappedStatus === 'ONGOING' || mappedStatus === 'COMPLETED' ||
        mappedStatus === 'HIATUS' || mappedStatus === 'CANCELLED') {
      return mappedStatus;
    }

    // Fallback to keyword matching only if mapping fails
    if (value.includes('complete') || value.includes('finish') || value.includes('end')) {
      return 'COMPLETED';
    }
    if (value.includes('cancel') || value.includes('discontinue') || value.includes('axe')) {
      return 'CANCELLED';
    }

    return null;
  }
}
