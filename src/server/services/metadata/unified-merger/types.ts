/**
 * Unified Metadata Merger - Type Definitions
 *
 * Shared type definitions and interfaces used across all metadata merger modules.
 * Defines the structure for merge configuration, conflict tracking, and result formatting.
 *
 * Extracted from: unified-merger.ts (lines 17-85)
 */

// ============================================================================
// Imports
// ============================================================================

import type {
  UnifiedMangaMetadata,
  PartialUnifiedMetadata,
  TagInfo,
  MetadataQuality,
  CoverImages
} from '@/types/search.types';

// ============================================================================
// Merge Result Types
// ============================================================================

/**
 * Maps fields to their selected provider source
 *
 * Tracks which provider was selected for each field in the merged metadata.
 * Used for auditing and debugging the merge process.
 *
 * @example
 * {
 *   "title": "anilist",
 *   "description": "comicvine",
 *   "coverImage": "anilist"
 * }
 */
export interface MetadataFieldSelection {
  [field: string]: string; // field -> provider mapping
}

/**
 * Tracks conflicts when multiple providers have different values for the same field
 *
 * Records all competing values from different providers when there's a conflict.
 * Used to enable manual conflict resolution or to provide warnings.
 *
 * @example
 * {
 *   field: "chapterCount",
 *   values: [
 *     { provider: "anilist", value: 120 },
 *     { provider: "comicvine", value: 118 }
 *   ]
 * }
 */
export interface MetadataMergeConflict {
  /** The field name that has conflicting values */
  field: string;
  /** Array of conflicting values from different providers */
  values: {
    /** Provider that supplied this value */
    provider: string;
    /** The actual value from this provider */
    value: unknown;
  }[];
}

/**
 * Complete result of a metadata merge operation
 *
 * Contains the merged metadata along with conflict information and
 * field selection details for transparency and debugging.
 */
export interface MetadataMergeResult {
  /** The merged metadata object */
  metadata: UnifiedMangaMetadata;
  /** List of fields that had conflicting values */
  conflicts: MetadataMergeConflict[];
  /** Map of which provider was selected for each field */
  selections: MetadataFieldSelection;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Provider priority configuration with optional field-specific overrides
 *
 * Defines the priority level for a metadata provider, with the ability
 * to override priorities for specific fields.
 *
 * @example
 * {
 *   provider: "anilist",
 *   priority: 100,
 *   fieldOverrides: {
 *     "coverImage": 90  // Lower priority for cover images
 *   }
 * }
 */
export interface ProviderPriority {
  /** Provider identifier (e.g., 'anilist', 'comicvine') */
  provider: string;
  /** Default priority level (higher = preferred) */
  priority: number;
  /** Optional field-specific priority overrides */
  fieldOverrides?: Record<string, number>;
}

/**
 * Merge configuration controlling how metadata from multiple sources is combined
 *
 * Defines the complete strategy for merging metadata from multiple providers,
 * including priority rules, conflict resolution strategy, and array handling.
 *
 * @example
 * {
 *   priorities: [
 *     { provider: "anilist", priority: 100 },
 *     { provider: "comicvine", priority: 90 }
 *   ],
 *   conflictResolution: "highest_priority",
 *   mergeArrays: true,
 *   deduplicateArrays: true,
 *   preferNonNull: true
 * }
 */
export interface MergeConfig {
  /** Ordered list of provider priorities */
  priorities: ProviderPriority[];
  /** Strategy for resolving conflicts between providers */
  conflictResolution: 'highest_priority' | 'most_complete' | 'newest' | 'manual';
  /** Whether to merge array fields or replace with highest priority */
  mergeArrays: boolean;
  /** Whether to remove duplicate entries from merged arrays */
  deduplicateArrays: boolean;
  /** Prefer non-null values even from lower priority providers */
  preferNonNull: boolean;
}

// ============================================================================
// Re-exports for Convenience
// ============================================================================

// Re-export core types from search.types.ts for convenience
export type {
  UnifiedMangaMetadata,
  PartialUnifiedMetadata,
  TagInfo,
  MetadataQuality,
  CoverImages
};
