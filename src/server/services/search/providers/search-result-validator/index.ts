/**
 * Search Result Validator - Main Aggregator
 *
 * Aggregates provider-specific validators into unified validation class.
 * Routes validation to appropriate provider validator based on MetadataProvider type.
 *
 * Architecture:
 * - utils.ts - Shared utilities (11 exports)
 * - anilist-validator.ts - AniList validation (397 lines)
 * - comicvine-validator.ts - ComicVine validation (448 lines)
 * - fandom-validator.ts - Fandom validation (506 lines)
 * - prowlarr-validator.ts - Prowlarr validation (39 lines)
 *
 * Original file: SearchResultValidator.ts (1325 lines)
 * Refactored: 6 modules, max 506 lines each (~62% reduction per module)
 *
 * Benefits:
 * - Maintainability: Each module is focused and readable
 * - Organization: Logical grouping by provider
 * - Type Safety: Shared utilities prevent duplication
 * - Zero Breaking Changes: Backward compatible API
 * - Performance: Identical runtime behavior
 * - Testability: Modules can be tested independently
 */


import { MetadataProvider } from '@prisma/client';

import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';


// Import utilities and validators
import { AniListValidator } from './anilist-validator';
import { ComicVineValidator } from './comicvine-validator';
import { FandomValidator } from './fandom-validator';
import { MangaDexValidator } from './mangadex-validator';
import { ProwlarrValidator } from './prowlarr-validator';
import { isSearchResult, createBaseResult } from './utils';

/**
 * Main Search Result Validator
 *
 * Validates and transforms raw search results from metadata providers
 * into standardized SearchResult objects.
 *
 * Usage:
 * ```typescript
 * const result = SearchResultValidator.validateAndTransform(rawData, MetadataProvider.ANILIST);
 * const results = SearchResultValidator.processResults(rawArray, MetadataProvider.COMICVINE);
 * ```
 */
export class SearchResultValidator {
  /**
   * Type guard to check if a value is a valid search result
   *
   * @param value - Value to check
   * @returns Boolean indicating if the value is a valid search result
   */
  static isSearchResult = isSearchResult;

  /**
   * Validate and transform a raw result to a SearchResult
   *
   * Routes to the appropriate provider-specific validator based on providerType.
   *
   * @param rawResult - Raw result from API
   * @param providerType - Provider type for the result
   * @returns Validated SearchResult or null if invalid
   */
  static validateAndTransform(
    rawResult: unknown,
    providerType: MetadataProvider
  ): SearchResult | null {
    try {
      if (!rawResult || typeof rawResult !== 'object') {
        return null;
      }

      const obj = rawResult as Record<string, unknown>;

      // Create base result using shared utility
      const baseResult = createBaseResult(obj, providerType);

      // Route to provider-specific validator
      switch (providerType) {
        case MetadataProvider.ANILIST:
          return AniListValidator.createResult(baseResult, obj);

        case MetadataProvider.COMICVINE:
          return ComicVineValidator.createResult(baseResult, obj);

        case MetadataProvider.FANDOM:
          return FandomValidator.createResult(baseResult, obj);

        case MetadataProvider.PROWLARR:
          return ProwlarrValidator.createResult(baseResult, obj);

        case MetadataProvider.MANGADEX:
          return MangaDexValidator.createResult(baseResult, obj);

        default:
          // Unknown provider - return base result
          return baseResult;
      }
    } catch (error: unknown) {
      logger.error(
        `Error validating search result for provider ${providerType}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * Process an array of raw results and convert to validated SearchResults
   *
   * Filters out invalid results and logs validation failures.
   *
   * @param results - Array of raw results from API
   * @param providerType - Provider type for the results
   * @returns Array of validated search results
   */
  static processResults(
    results: unknown[],
    providerType: MetadataProvider
  ): SearchResult[] {
    if (!Array.isArray(results)) {
      logger.warn(
        `Invalid search results for provider ${providerType}: not an array`
      );
      return [];
    }

    logger.info(
      `[SearchResultValidator] Processing ${results.length} results for provider ${providerType}`
    );

    const validated = results.map((result, index) => {
      const validatedResult = this.validateAndTransform(result, providerType);
      if (!validatedResult) {
        logger.warn(
          `[SearchResultValidator] Result ${index} failed validation for provider ${providerType}:`,
          result
        );
      }
      return validatedResult;
    });

    const filtered = validated.filter(
      (result): result is SearchResult => result !== null
    );

    logger.info(
      `[SearchResultValidator] Validated ${filtered.length} out of ${results.length} results for provider ${providerType}`
    );

    return filtered;
  }
}

// ============================================================================
// Re-export utilities for backward compatibility
// ============================================================================

export { isSearchResult, createBaseResult } from './utils';
export {
  cleanHtmlDescription,
  extractCoverField,
  extractDescriptionField,
  extractAlternativeTitles,
  extractScore,
  extractChapters,
  extractVolumes,
  extractTitle,
  extractId
} from './utils';
