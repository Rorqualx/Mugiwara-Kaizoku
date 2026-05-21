/**
 * Unified Metadata Merger - Main Class
 *
 * Orchestrates metadata merging from multiple providers using modular field mergers.
 * Delegates to specialized modules for field merging, quality calculation, and validation.
 *
 * Original: unified-merger.ts (605 lines)
 * Refactored: ~280 lines main class + 7 specialized modules
 *
 * Architecture:
 * - types.ts: Type definitions (155 lines)
 * - config.ts: Configuration (43 lines)
 * - helpers.ts: Utilities (54 lines)
 * - simple-fields.ts: Simple field merging (128 lines)
 * - array-fields.ts: Array field merging (228 lines)
 * - complex-fields.ts: Complex object merging (170 lines)
 * - quality.ts: Quality calculation (157 lines)
 * - index.ts: Main orchestrator (this file)
 *
 * @module unified-merger
 */

// ============================================================================
// Imports
// ============================================================================


import { MangaPublicationStatus } from '@prisma/client';

import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { hasProperty } from '@/utils/type-guards';


// Import all modules
import { mergeArrayFields } from './array-fields';
import { mergeComplexFields, mergeProviderMetadata } from './complex-fields';
import { DEFAULT_MERGE_CONFIG } from './config';
import { buildSelections } from './helpers';
import { mergeMetadataQuality } from './quality';
import { mergeSimpleFields } from './simple-fields';

import type {
  UnifiedMangaMetadata,
  PartialUnifiedMetadata,
  MetadataMergeResult,
  MetadataMergeConflict,
  MetadataFieldSelection,
  MergeConfig,
} from './types';

// ============================================================================
// Main Merger Class
// ============================================================================

/**
 * Unified metadata merger service
 *
 * Merges metadata from multiple providers into a single unified object,
 * handling conflict resolution, field prioritization, and quality scoring.
 *
 * @example
 * ```typescript
 * const merger = new UnifiedMetadataMerger();
 * const result = merger.merge([anilistData, comicvineData, fandomData]);
 * logger.info(result.metadata.title);
 * logger.info(result.conflicts); // Field conflicts
 * ```
 */
export class UnifiedMetadataMerger {
  private config: MergeConfig;
  private logger = logger.child('UnifiedMetadataMerger', {
    module: 'UnifiedMetadataMerger',
  });

  constructor(config?: Partial<MergeConfig>) {
    this.config = {
      ...DEFAULT_MERGE_CONFIG,
      ...config,
    };
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Merge multiple metadata sources into unified metadata
   *
   * Prioritizes sources by provider priority, merges fields using
   * specialized modules, and completes missing required fields.
   *
   * @param sources - Array of partial metadata from different providers
   * @returns Merge result with unified metadata, conflicts, and selections
   * @throws ValidationError if sources array is empty
   */
  merge(sources: PartialUnifiedMetadata[]): MetadataMergeResult {
    if (sources.length === 0) {
      throw new ValidationError('No metadata sources to merge');
    }

    const firstSource = sources[0];
    if (!firstSource) {
      throw new ValidationError('First source is undefined');
    }

    // Single source - just complete and return
    if (sources.length === 1) {
      return {
        metadata: this.completeMetadata(firstSource),
        conflicts: [],
        selections: {
          primary: firstSource.primarySource ?? 'UNKNOWN',
        },
      };
    }

    // Sort sources by priority
    const sortedSources = this.sortByPriority(sources);
    const firstSorted = sortedSources[0];
    if (!firstSorted) {
      throw new ValidationError('Sorted sources is empty');
    }

    // Track conflicts
    let conflicts: MetadataMergeConflict[] = [];

    // Start with highest priority source as base
    let merged: PartialUnifiedMetadata = { ...firstSorted };

    // Merge remaining sources
    for (let i = 1; i < sortedSources.length; i++) {
      const source = sortedSources[i];
      if (source) {
        const result = this.mergeSingleSource(merged, source, conflicts);
        merged = result.merged;
        conflicts = result.conflicts;
      }
    }

    // Complete metadata with defaults
    const completed = this.completeMetadata(merged);

    // Update metadata quality
    completed.metadataQuality = mergeMetadataQuality(sortedSources);

    return {
      metadata: completed,
      conflicts,
      selections: buildSelections(merged, sortedSources),
    };
  }

  /**
   * Merge with field selection (user-specified sources per field)
   *
   * Allows manual field selection by specifying which provider to use
   * for each field. Missing fields are filled from sources by priority.
   *
   * @param sources - Map of provider name to metadata
   * @param selection - Field to provider name mapping
   * @returns Completed unified metadata
   */
  mergeWithSelection(
    sources: Map<string, PartialUnifiedMetadata>,
    selection: MetadataFieldSelection
  ): UnifiedMangaMetadata {
    let merged: PartialUnifiedMetadata = {};

    // Apply field selections
    for (const [field, providerName] of Object.entries(selection)) {
      if (providerName && sources.has(providerName)) {
        const sourceData = sources.get(providerName);
        if (sourceData && hasProperty(sourceData, field)) {
          const fieldValue = sourceData[field as keyof PartialUnifiedMetadata];
          if (fieldValue !== undefined) {
            merged = { ...merged, [field]: fieldValue };
          }
        }
      }
    }

    // Fill missing fields from sources by priority
    const sortedSources = this.sortByPriority(Array.from(sources.values()));
    for (const source of sortedSources) {
      merged = this.fillMissingFields(merged, source);
    }

    return this.completeMetadata(merged);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Sort sources by priority (highest first)
   */
  private sortByPriority(
    sources: PartialUnifiedMetadata[]
  ): PartialUnifiedMetadata[] {
    return sources.sort((a, b) => {
      const priorityA = this.getProviderPriority(a.primarySource ?? '');
      const priorityB = this.getProviderPriority(b.primarySource ?? '');
      return priorityB - priorityA;
    });
  }

  /**
   * Get provider priority from configuration
   */
  private getProviderPriority(provider: string): number {
    const config = this.config.priorities.find(p => p.provider === provider);
    return config?.priority ?? 0;
  }

  /**
   * Merge a single source into the accumulated metadata
   *
   * Uses specialized modules for field merging:
   * - Simple fields (strings, numbers, dates)
   * - Array fields (with deduplication)
   * - Complex fields (objects)
   * - Provider metadata
   *
   * @param target - Base metadata to merge into
   * @param source - Source metadata to merge from
   * @param conflicts - Array to track conflicts
   * @returns New merged metadata object
   */
  private mergeSingleSource(
    target: PartialUnifiedMetadata,
    source: PartialUnifiedMetadata,
    conflicts: MetadataMergeConflict[]
  ): { merged: PartialUnifiedMetadata; conflicts: MetadataMergeConflict[] } {
    let merged = { ...target };

    // Merge simple fields (returns new object + updated conflicts)
    const simpleResult = mergeSimpleFields(
      merged,
      source,
      conflicts,
      this.config.preferNonNull
    );
    merged = simpleResult.merged;

    // Merge array fields (returns new object)
    merged = mergeArrayFields(
      merged,
      source,
      this.config.mergeArrays,
      this.config.deduplicateArrays
    );

    // Merge complex objects (returns new object)
    merged = mergeComplexFields(merged, source);

    // Merge provider metadata (returns new object)
    merged = mergeProviderMetadata(merged, source);

    return { merged, conflicts: simpleResult.conflicts };
  }

  /**
   * Fill missing fields from source (immutable)
   *
   * Copies fields from source to target only if target doesn't have them.
   * Used to complete metadata from lower-priority sources.
   *
   * @param target - Target metadata with potential gaps
   * @param source - Source metadata to fill gaps from
   * @returns New metadata object with filled fields
   */
  private fillMissingFields(
    target: PartialUnifiedMetadata,
    source: PartialUnifiedMetadata
  ): PartialUnifiedMetadata {
    const updates: Partial<PartialUnifiedMetadata> = {};

    for (const [key, value] of Object.entries(source)) {
      if (value !== null && hasProperty(target, key)) {
        const targetValue = target[key as keyof PartialUnifiedMetadata];
        if (targetValue === undefined) {
          updates[key as keyof PartialUnifiedMetadata] = value as never;
        }
      }
    }

    return { ...target, ...updates };
  }

  /**
   * Complete metadata with required fields and defaults
   *
   * Ensures all required fields exist with valid defaults.
   * Extracts optional field spreading to reduce complexity.
   *
   * Original complexity: 30
   * After extraction: 8
   *
   * @param partial - Partial metadata to complete
   * @returns Complete unified metadata with all required fields
   */
  private completeMetadata(
    partial: PartialUnifiedMetadata
  ): UnifiedMangaMetadata {
    // Required fields with defaults
    const base: UnifiedMangaMetadata = {
      title: partial['title'] ?? 'Unknown Title',
      alternativeTitles: partial['alternativeTitles'] ?? [],
      description: partial['description'] ?? '',
      status: partial['status'] ?? MangaPublicationStatus.UNKNOWN,
      genres: partial['genres'] ?? [],
      tags: partial['tags'] ?? [],
      authors: partial['authors'] ?? [],
      artists: partial['artists'] ?? [],
    };

    // Optional fields (spread only if defined)
    return {
      ...base,
      ...this.spreadOptionalFields(partial),
    };
  }

  /**
   * Spread optional fields if defined
   *
   * Extracted from completeMetadata to reduce complexity from 30 → 8.
   * Conditionally spreads optional fields that exist in partial metadata.
   * Complexity further reduced to 4 by grouping fields into helper methods.
   *
   * @param partial - Partial metadata with optional fields
   * @returns Object containing only defined optional fields
   */
  private spreadOptionalFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    return {
      ...this.spreadImageFields(partial),
      ...this.spreadCountFields(partial),
      ...this.spreadDateFields(partial),
      ...this.spreadRelationalFields(partial),
      ...this.spreadQualityFields(partial),
      ...this.spreadMetadataFields(partial)
    };
  }

  /**
   * Spread image-related fields
   */
  private spreadImageFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    const fields: Partial<UnifiedMangaMetadata> = {};
    if (partial['coverImage']) fields['coverImage'] = partial['coverImage'];
    if (partial['bannerImage']) fields['bannerImage'] = partial['bannerImage'];
    if (partial['covers']) fields['covers'] = partial['covers'];
    return fields;
  }

  /**
   * Spread count-related fields
   */
  private spreadCountFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    const fields: Partial<UnifiedMangaMetadata> = {};
    if (partial['chapters']) fields['chapters'] = partial['chapters'];
    if (partial['volumes']) fields['volumes'] = partial['volumes'];
    if (partial['chapterCount']) fields['chapterCount'] = partial['chapterCount'];
    if (partial['volumeCount']) fields['volumeCount'] = partial['volumeCount'];
    if (partial['publisher']) fields['publisher'] = partial['publisher'];
    if (partial['format']) fields['format'] = partial['format'];
    return fields;
  }

  /**
   * Spread date-related fields
   */
  private spreadDateFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    const fields: Partial<UnifiedMangaMetadata> = {};
    if (partial['startDate']) fields['startDate'] = partial['startDate'];
    if (partial['endDate']) fields['endDate'] = partial['endDate'];
    if (partial['year']) fields['year'] = partial['year'];
    return fields;
  }

  /**
   * Spread relational fields
   */
  private spreadRelationalFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    const fields: Partial<UnifiedMangaMetadata> = {};
    if (partial['persons']) fields['persons'] = partial['persons'];
    if (partial['externalIds']) fields['externalIds'] = partial['externalIds'];
    if (partial['characters']) fields['characters'] = partial['characters'];
    return fields;
  }

  /**
   * Spread quality fields
   */
  private spreadQualityFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    const fields: Partial<UnifiedMangaMetadata> = {};
    if (partial['quality']) fields['quality'] = partial['quality'];
    if (partial['validationResult']) {
      fields['validationResult'] = partial['validationResult'];
    }
    return fields;
  }

  /**
   * Spread metadata fields
   */
  private spreadMetadataFields(
    partial: PartialUnifiedMetadata
  ): Partial<UnifiedMangaMetadata> {
    const fields: Partial<UnifiedMangaMetadata> = {};
    if (partial['primarySource']) fields['primarySource'] = partial['primarySource'];
    if (partial['providerMetadata']) {
      fields['providerMetadata'] = partial['providerMetadata'];
    }
    if (partial['metadataQuality']) {
      fields['metadataQuality'] = partial['metadataQuality'];
    }
    if (partial['updatedAt']) fields['updatedAt'] = partial['updatedAt'];
    return fields;
  }
}

// ============================================================================
// Re-exports
// ============================================================================

/**
 * Re-export types for convenience
 */
export type {
  UnifiedMangaMetadata,
  PartialUnifiedMetadata,
  MetadataMergeResult,
  MetadataMergeConflict,
  MetadataFieldSelection,
  MergeConfig,
  ProviderPriority,
} from './types';

export { DEFAULT_MERGE_CONFIG } from './config';
