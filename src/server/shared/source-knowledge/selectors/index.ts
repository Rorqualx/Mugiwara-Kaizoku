/**
 * Source-Specific CSS Selectors for Metadata Extraction
 *
 * Different wiki/database sites have different HTML structures.
 * This module provides source-specific extraction strategies.
 *
 * @module shared/source-knowledge/selectors
 */

import { ANILIST_SELECTORS } from './anilist-selectors';
import { COMICVINE_SELECTORS } from './comicvine-selectors';
import { FANDOM_SELECTORS } from './fandom-selectors';
import { GENERIC_SELECTORS } from './generic-selectors';
import { WIKIPEDIA_SELECTORS } from './wikipedia-selectors';

import type { SourceSelectors } from './types';
import type { SourceType } from '../types';

export type { SourceSelectors, SourceType };

// Re-export individual selector sets
export { FANDOM_SELECTORS } from './fandom-selectors';
export { COMICVINE_SELECTORS } from './comicvine-selectors';
export { WIKIPEDIA_SELECTORS } from './wikipedia-selectors';
export { ANILIST_SELECTORS } from './anilist-selectors';
export { GENERIC_SELECTORS } from './generic-selectors';

// Export selector matcher utilities for :contains() support
export {
  matchSelector,
  matchFirstSelector,
  matchAllSelectors,
  extractTextFromSelectors,
  extractAllTextFromSelectors,
} from './selector-matcher';

/**
 * Map of source types to their selectors
 */
const SOURCE_SELECTORS: Record<SourceType, SourceSelectors> = {
  fandom: FANDOM_SELECTORS,
  wikipedia: WIKIPEDIA_SELECTORS,
  anilist: ANILIST_SELECTORS,
  comicvine: COMICVINE_SELECTORS,
  mangadex: GENERIC_SELECTORS, // TODO: Add MangaDex-specific selectors
  myanimelist: GENERIC_SELECTORS, // TODO: Add MAL-specific selectors
  unknown: GENERIC_SELECTORS,
};

/**
 * Get the appropriate selectors for a given source type
 *
 * @param source - The source type
 * @returns CSS selectors for that source
 */
export function getSelectorsForSource(source: SourceType): SourceSelectors {
  return SOURCE_SELECTORS[source];
}

/**
 * Get selectors with fallback to generic.
 * Tries source-specific first, then falls back to generic for missing fields.
 *
 * @param source - The source type
 * @returns Merged selectors with fallbacks
 */
export function getSelectorsWithFallback(source: SourceType): SourceSelectors {
  const sourceSelectors = SOURCE_SELECTORS[source];
  if (source === 'unknown') {
    return sourceSelectors;
  }

  // Merge source-specific with generic fallbacks
  const merged: SourceSelectors = { ...sourceSelectors };
  for (const key of Object.keys(GENERIC_SELECTORS) as Array<
    keyof SourceSelectors
  >) {
    // Append generic selectors after source-specific ones
    merged[key] = [...sourceSelectors[key], ...GENERIC_SELECTORS[key]];
  }
  return merged;
}
