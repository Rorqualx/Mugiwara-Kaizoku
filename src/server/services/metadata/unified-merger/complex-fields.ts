/**
 * Unified Metadata Merger - Complex Fields Module
 *
 * Handles merging of complex object fields (covers, external IDs, provider metadata).
 * Extracts helpers to reduce complexity from 23 to <10.
 *
 * Key Features:
 * - Immutable merging (no parameter reassignment)
 * - Reduced cyclomatic complexity via helper extraction
 * - Cover image merging with priority preservation
 * - External ID merging without duplicates
 * - Provider metadata deduplication
 *
 * Extracted from: unified-merger.ts (lines 421-480)
 */

// ============================================================================
// Imports
// ============================================================================

import type { PartialUnifiedMetadata, CoverImages } from './types';

// ============================================================================
// Complex Field Merging
// ============================================================================

/**
 * Merge complex fields (immutable, reduced complexity)
 *
 * Delegates to specialized helpers to keep complexity under 20.
 * Original complexity: 23 → 8 after extraction.
 *
 * @param target - Target metadata object
 * @param source - Source metadata to merge in
 * @returns New metadata object with merged complex fields
 */
export function mergeComplexFields(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata
): PartialUnifiedMetadata {
  let merged = { ...target };

  // Merge covers (delegated to helper)
  if (source.covers) {
    merged = mergeCoverImages(merged, source.covers);
  }

  // Merge external IDs (delegated to helper)
  if (source.externalIds) {
    merged = mergeExternalIds(merged, source.externalIds);
  }

  return merged;
}

/**
 * Merge cover images (immutable)
 *
 * Extracted to reduce complexity in mergeComplexFields.
 * Preserves existing target values, only fills missing fields from source.
 *
 * @param target - Target metadata object
 * @param sourceCovers - Source cover images to merge in
 * @returns New metadata object with merged covers
 */
function mergeCoverImages(
  target: PartialUnifiedMetadata,
  sourceCovers: CoverImages
): PartialUnifiedMetadata {
  // If no target covers exist, use source covers
  if (!target.covers) {
    return { ...target, covers: { ...sourceCovers } };
  }

  // Merge covers, preferring target values
  const mergedCovers: CoverImages = {
    ...(target.covers.original && { original: target.covers.original }),
    ...(sourceCovers.original &&
      !target.covers.original && { original: sourceCovers.original }),
    ...(target.covers.large && { large: target.covers.large }),
    ...(sourceCovers.large &&
      !target.covers.large && { large: sourceCovers.large }),
    ...(target.covers.medium && { medium: target.covers.medium }),
    ...(sourceCovers.medium &&
      !target.covers.medium && { medium: sourceCovers.medium }),
    ...(target.covers.small && { small: target.covers.small }),
    ...(sourceCovers.small &&
      !target.covers.small && { small: sourceCovers.small }),
    ...(target.covers.thumbnail && { thumbnail: target.covers.thumbnail }),
    ...(sourceCovers.thumbnail &&
      !target.covers.thumbnail && { thumbnail: sourceCovers.thumbnail }),
    ...(target.covers.color && { color: target.covers.color }),
    ...(sourceCovers.color &&
      !target.covers.color && { color: sourceCovers.color }),
  };

  return { ...target, covers: mergedCovers };
}

/**
 * Merge external IDs (immutable)
 *
 * Extracted to reduce complexity in mergeComplexFields.
 * Merges source IDs into target, overwriting duplicates.
 *
 * @param target - Target metadata object
 * @param sourceIds - Source external IDs to merge in
 * @returns New metadata object with merged external IDs
 */
function mergeExternalIds(
  target: PartialUnifiedMetadata,
  sourceIds: Record<string, unknown>
): PartialUnifiedMetadata {
  // If no target IDs exist, use source IDs
  if (!target.externalIds) {
    return { ...target, externalIds: { ...sourceIds } };
  }

  // Merge IDs, source overwrites target for conflicts
  return {
    ...target,
    externalIds: {
      ...target.externalIds,
      ...sourceIds,
    },
  };
}

// ============================================================================
// Provider Metadata Merging
// ============================================================================

/**
 * Merge provider metadata (immutable)
 *
 * Merges provider metadata arrays while avoiding duplicates.
 * Deduplication is based on provider name.
 *
 * @param target - Target metadata object
 * @param source - Source metadata with provider metadata to merge
 * @returns New metadata object with merged provider metadata
 */
export function mergeProviderMetadata(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata
): PartialUnifiedMetadata {
  // Early return if no source provider metadata
  if (!source.providerMetadata || source.providerMetadata.length === 0) {
    return target;
  }

  // If no target provider metadata, use source
  if (!target.providerMetadata) {
    return { ...target, providerMetadata: [...source.providerMetadata] };
  }

  // Merge provider metadata, avoiding duplicates
  const existingProviders = new Set(
    target.providerMetadata.map(pm => pm.provider)
  );

  const newProviders = source.providerMetadata.filter(
    pm => !existingProviders.has(pm.provider)
  );

  return {
    ...target,
    providerMetadata: [...target.providerMetadata, ...newProviders],
  };
}
