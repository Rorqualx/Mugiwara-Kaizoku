/**
 * Prowlarr Search Result Validator
 *
 * Handles validation and transformation of Prowlarr search results.
 * Simple passthrough validator with provider branding.
 *
 * Extracted from: SearchResultValidator.ts (lines 1280-1295)
 */

import { MetadataProvider } from '@prisma/client';

import type { SearchResult } from '@/types/search.types';



/**
 * Prowlarr Search Result Validator
 *
 * Provides validation and transformation methods for Prowlarr search results.
 * Prowlarr acts as a passthrough validator with minimal transformation.
 */
export class ProwlarrValidator {
  /**
   * Create Prowlarr-specific search result
   *
   * Transforms a base search result into a Prowlarr-branded result.
   * Prowlarr results are simple passthrough with provider field set.
   *
   * @param baseResult - Base search result entity
   * @param _rawData - Raw API data (unused for Prowlarr passthrough)
   * @returns Prowlarr search result with provider set
   */
  public static createResult(
    baseResult: SearchResult,
    _rawData: Record<string, unknown>
  ): SearchResult {
    return {
      ...baseResult,
      provider: MetadataProvider.PROWLARR
    };
  }
}
