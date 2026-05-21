/**
 * Search Result Enrichment Utilities
 *
 * Handles background enrichment of search results with additional metadata
 * from providers that don't include full data in search results.
 *
 * @module search-enrichment
 */

// Types
export type { MediaGallery, EnrichmentContext, MetadataUpdateCallback } from './types';

// Fandom enrichment
export {
  fetchFandomMetadataAsync,
  fetchFandomChapterCoversBackground,
  enrichFandomResult,
} from './fandom-enrichment';

// AniList enrichment
export { enrichAniListResult } from './anilist-enrichment';

// URL extraction
export { extractFandomUrl } from './url-extraction';
