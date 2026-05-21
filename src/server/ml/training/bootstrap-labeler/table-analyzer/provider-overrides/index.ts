/**
 * Table Analyzer Provider Overrides Registry
 *
 * Maps source types to their specific table analysis overrides.
 * Providers without overrides use global logic.
 */

import type { LinearizationResult } from '@/server/ml/features/dom-linearizer';

import { WIKIPEDIA_TABLE_OVERRIDES } from './wikipedia-overrides';

import type { TableAnalyzerOverrides } from './types';

// ============================================================================
// Source Type Alias
// ============================================================================

/** Source types from LinearizationResult */
export type SourceType = LinearizationResult['sourceType'];

// ============================================================================
// Override Registry
// ============================================================================

/**
 * Registry mapping source types to their table analyzer overrides.
 * Only sources with custom logic are registered.
 */
const OVERRIDES_REGISTRY: Partial<Record<SourceType, TableAnalyzerOverrides>> = {
  wikipedia: WIKIPEDIA_TABLE_OVERRIDES,
  // fandom: undefined (uses global logic)
  // comicvine: undefined (uses global logic)
  // anilist: undefined (uses global logic)
  // unknown: undefined (uses global logic)
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Get table analyzer overrides for a specific source type.
 *
 * @param sourceType - The source type (wikipedia, fandom, etc.)
 * @returns Provider overrides or undefined if using global logic
 */
export function getTableAnalyzerOverrides(
  sourceType: SourceType
): TableAnalyzerOverrides | undefined {
  return OVERRIDES_REGISTRY[sourceType];
}

/**
 * Check if a source type has custom table analyzer overrides.
 *
 * @param sourceType - The source type to check
 * @returns True if provider has custom overrides
 */
export function hasTableAnalyzerOverrides(sourceType: SourceType): boolean {
  return sourceType in OVERRIDES_REGISTRY;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  TableAnalyzerOverrides,
  GroupTokensByTableFn,
  ExtractTableHeadersFn,
  ClassifyColumnFn,
  ClassifyColumnByHeaderFn,
  ColumnHeaderPatterns,
} from './types';
