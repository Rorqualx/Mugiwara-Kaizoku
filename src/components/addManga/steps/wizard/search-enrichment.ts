/**
 * Search Result Enrichment Utilities
 *
 * Re-exports from the search-enrichment module.
 * This file exists for backward compatibility with existing imports.
 *
 * @see ./search-enrichment/index.ts for implementation
 */

export type { MediaGallery, EnrichmentContext, MetadataUpdateCallback } from './search-enrichment/types';

export {
  fetchFandomMetadataAsync,
  fetchFandomChapterCoversBackground,
  enrichFandomResult,
} from './search-enrichment/fandom-enrichment';

export { enrichAniListResult } from './search-enrichment/anilist-enrichment';

export { extractFandomUrl } from './search-enrichment/url-extraction';
