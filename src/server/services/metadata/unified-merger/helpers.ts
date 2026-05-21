/**
 * Unified Metadata Merger - Helper Utilities
 *
 * Utility functions for metadata merging operations. Provides helpers for
 * building field selections from merged metadata results.
 *
 * Extracted from: unified-merger.ts (lines 34-42)
 */

// ============================================================================
// Imports
// ============================================================================

import type { MetadataFieldSelection, PartialUnifiedMetadata } from './types';

// ============================================================================
// Selection Utilities
// ============================================================================

/**
 * Build field selections from merged result
 *
 * Creates a mapping of fields to their source providers based on the
 * merge operation results. Tracks which provider was the primary source
 * for the merged metadata.
 *
 * @param merged - The merged metadata result
 * @param sources - Array of source metadata used in merge
 * @returns Field to provider mapping indicating the primary source
 *
 * @example
 * const merged = { title: 'Example', primarySource: 'anilist' };
 * const sources = [
 *   { title: 'Example', primarySource: 'anilist' },
 *   { title: 'Example Alt', primarySource: 'comicvine' }
 * ];
 * const selections = buildSelections(merged, sources);
 * // Result: { primary: 'anilist' }
 */
export function buildSelections(
  merged: PartialUnifiedMetadata,
  sources: PartialUnifiedMetadata[]
): MetadataFieldSelection {
  const selections: MetadataFieldSelection = {};

  if (sources.length > 0) {
    const firstSource = sources[0];
    if (firstSource) {
      selections['primary'] = firstSource.primarySource ?? 'unknown';
    }
  }

  return selections;
}
