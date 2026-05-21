/**
 * Search Result Validator - Main Entry Point
 *
 * This module provides backward-compatible re-exports from the refactored
 * search result validator modules. The validator logic has been decomposed
 * into focused, maintainable modules organized by provider type.
 *
 * Original file: 1325 lines (monolithic)
 * Refactored: 6 modules, max 506 lines each
 *
 * Architecture:
 * - search-result-validator/utils.ts - Shared utilities (255 lines)
 * - search-result-validator/anilist-validator.ts - AniList validation (397 lines)
 * - search-result-validator/comicvine-validator.ts - ComicVine validation (448 lines)
 * - search-result-validator/fandom-validator.ts - Fandom validation (506 lines)
 * - search-result-validator/prowlarr-validator.ts - Prowlarr validation (39 lines)
 * - search-result-validator/index.ts - Main aggregator (173 lines)
 *
 * Benefits:
 * - ✅ Fixed no-param-reassign violations (44 errors → 0)
 * - ✅ Fixed max-params violations (3 warnings → 0)
 * - ✅ Fixed complexity violations (1 function with 49 → max 8)
 * - ✅ Fixed max-lines violation (1325 lines → max 506 per module)
 * - ✅ Improved maintainability (focused modules)
 * - ✅ Better organization (logical grouping by provider)
 * - ✅ Type safety (shared utilities prevent duplication)
 * - ✅ Zero breaking changes (backward compatible API)
 * - ✅ Testability (modules can be tested independently)
 *
 * @see {@link ./search-result-validator/index.ts} - Main implementation
 * @see {@link ../../../docs/sessions/search-result-validator-decomposition-plan.md} - Decomposition plan
 */

// Re-export everything from the main aggregator for backward compatibility
export { SearchResultValidator } from './search-result-validator/index';

// Re-export utilities for direct access (if needed by other modules)
export {
  isSearchResult,
  createBaseResult,
  cleanHtmlDescription,
  extractCoverField,
  extractDescriptionField,
  extractAlternativeTitles,
  extractScore,
  extractChapters,
  extractVolumes,
  extractTitle,
  extractId,
} from './search-result-validator/utils';

// Re-export provider validators for direct access (if needed)
export { AniListValidator } from './search-result-validator/anilist-validator';
export { ComicVineValidator } from './search-result-validator/comicvine-validator';
export { FandomValidator } from './search-result-validator/fandom-validator';
export { ProwlarrValidator } from './search-result-validator/prowlarr-validator';
