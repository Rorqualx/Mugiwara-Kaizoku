/**
 * Metadata Operations Module
 *
 * Handles metadata extraction from search results and merging from multiple providers.
 * This module focuses on combining metadata from various sources with proper type safety.
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';

import {
  logComicVineMetadata,
  buildProviderMetadata
} from '../helpers/metadataExtractionHelpers';

/**
 * Extract basic metadata from a search result
 *
 * Attempts to build a ProviderMetadata object from a search result, checking both
 * the root level and nested metadata object for fields. Includes ComicVine-specific
 * logging for debugging.
 *
 * @param result - The search result object containing metadata fields
 * @returns Complete ProviderMetadata object with all extracted fields
 */
export function extractBasicMetadata(result: Record<string, unknown>): ProviderMetadata {
  // Check both root level and metadata object for fields
  const metadata = (result['metadata'] ?? {}) as Record<string, unknown>;

  // Debug logging for ComicVine
  logComicVineMetadata(result, metadata);

  return buildProviderMetadata(result, metadata);
}

/**
 * Merge metadata from multiple sources into a single object
 *
 * Creates a merged metadata object by prioritizing the primary provider's data
 * and filling gaps with non-empty values from secondary sources. Preserves
 * type safety and maintains data integrity across different provider formats.
 *
 * @param sources - Map of provider names to their metadata objects
 * @param primaryProvider - The key of the primary provider to use as base
 * @returns Merged metadata object with primary as base and gaps filled from others
 */
export function mergeMetadata(
  sources: Record<string, ProviderMetadata>,
  primaryProvider: string
): Partial<ProviderMetadata> {
  let merged: Partial<ProviderMetadata> = {};
  const primary = sources[primaryProvider];

  // Start with primary provider's metadata as base
  if (primary) {
    merged = { ...merged, ...primary };
  }

  // Merge additional sources, prioritizing non-empty values
  Object.entries(sources).forEach(([provider, metadata]) => {
    if (provider !== primaryProvider) {
      Object.entries(metadata).forEach(([key, value]) => {
        const mergedRecord = merged as Record<string, unknown>;
        // Only fill gaps - don't override primary values
        if (value && !mergedRecord[key]) {
          mergedRecord[key] = value;
        }
      });
    }
  });

  return merged;
}
