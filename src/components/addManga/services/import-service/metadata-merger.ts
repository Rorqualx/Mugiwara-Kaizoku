/**
 * Metadata Merger Module
 *
 * Handles merging metadata from multiple provider sources with
 * intelligent prioritization and array deduplication.
 *
 * Extracted from: importService.ts (lines 334-366)
 */

import { isRecord } from './utils';

/**
 * Merge metadata from multiple sources
 *
 * @param sources - Record of provider metadata
 * @param primaryProvider - Primary provider to use as base
 * @returns Merged metadata with deduplicated arrays
 */
export function mergeMetadata(
  sources: Record<string, unknown>,
  primaryProvider: string
): Record<string, unknown> {
  let merged: Record<string, unknown> = {};

  // Start with primary provider
  const primary = sources[primaryProvider];
  if (primary && isRecord(primary)) {
    merged = { ...merged, ...primary };
  }

  // Merge other sources, prioritizing non-empty values
  Object.entries(sources).forEach(([provider, metadata]) => {
    if (provider !== primaryProvider && metadata && isRecord(metadata)) {
      Object.entries(metadata).forEach(([key, value]) => {
        // Only override if current value is empty
        if (value && !merged[key]) {
          merged[key] = value;
        }
        // Special handling for arrays - merge them
        if (Array.isArray(value) && Array.isArray(merged[key])) {
          const mergedArray = [...(merged[key] as unknown[]), ...(value as unknown[])];
          merged[key] = Array.from(new Set(mergedArray));
        }
      });
    }
  });

  return merged;
}
