/**
 * ComicVine Provider Submodule Index
 *
 * Re-exports optimization functions for use in ComicVineProvider.ts
 */

export {
  type ComicVineSearchOptions,
  type ComicVineSearchParams,
  normalizeQueryIfEnabled,
  calculateRelevanceScore,
  applyAllScoringOptimizations,
  rankResultsByRelevanceOptimized,
  searchWithVariants,
} from './search-optimizations';

export {
  needsThemeScraping,
  scrapeAndAssignThemesGenres,
} from './theme-scraping';
