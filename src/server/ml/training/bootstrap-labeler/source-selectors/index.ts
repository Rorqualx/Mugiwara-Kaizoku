/**
 * Source-Specific CSS Selectors for Metadata Extraction
 *
 * Re-exports from shared source-knowledge layer.
 * Kept for backward compatibility with existing imports.
 */

export type { SourceSelectors, SourceType } from '@/server/shared/source-knowledge/selectors';

export {
  FANDOM_SELECTORS,
  COMICVINE_SELECTORS,
  WIKIPEDIA_SELECTORS,
  ANILIST_SELECTORS,
  GENERIC_SELECTORS,
  getSelectorsForSource,
  getSelectorsWithFallback,
  matchSelector,
  matchFirstSelector,
  matchAllSelectors,
  extractTextFromSelectors,
  extractAllTextFromSelectors,
} from '@/server/shared/source-knowledge/selectors';

export { detectSourceType } from '@/server/shared/source-knowledge/source-detection';
