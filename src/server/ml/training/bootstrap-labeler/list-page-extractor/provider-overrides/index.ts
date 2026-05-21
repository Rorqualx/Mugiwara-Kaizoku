/**
 * List Page Extractor Provider Overrides Registry
 *
 * Maps source types to their specific list page extraction overrides.
 * Providers without overrides use global logic.
 */

import type { LinearizationResult } from '@/server/ml/features/dom-linearizer';

import { WIKIPEDIA_LIST_PAGE_OVERRIDES } from './wikipedia-overrides';

import type { ListPageOverrides } from './types';

// ============================================================================
// Source Type Alias
// ============================================================================

/** Source types from LinearizationResult */
export type SourceType = LinearizationResult['sourceType'];

// ============================================================================
// Override Registry
// ============================================================================

/**
 * Registry mapping source types to their list page extraction overrides.
 * Only sources with custom logic are registered.
 */
const OVERRIDES_REGISTRY: Partial<Record<SourceType, ListPageOverrides>> = {
  wikipedia: WIKIPEDIA_LIST_PAGE_OVERRIDES,
  // fandom: undefined (uses global logic)
  // comicvine: undefined (uses global logic)
  // anilist: undefined (uses global logic)
  // unknown: undefined (uses global logic)
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Get list page extraction overrides for a specific source type.
 *
 * @param sourceType - The source type (wikipedia, fandom, etc.)
 * @returns Provider overrides or undefined if using global logic
 */
export function getListPageOverrides(
  sourceType: SourceType
): ListPageOverrides | undefined {
  return OVERRIDES_REGISTRY[sourceType];
}

/**
 * Check if a source type has custom list page extraction overrides.
 *
 * @param sourceType - The source type to check
 * @returns True if provider has custom overrides
 */
export function hasListPageOverrides(sourceType: SourceType): boolean {
  return sourceType in OVERRIDES_REGISTRY;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  ListPageOverrides,
  GroupTokensByRowFn,
  ParseRowFromXpathFn,
  ListPageColumnPatterns,
} from './types';
