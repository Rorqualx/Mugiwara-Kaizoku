/**
 * Metadata Fandom Fetch Router
 *
 * This module provides tRPC procedures for fetching enhanced metadata from Fandom wikis.
 * It handles:
 * - Cover image extraction (multiple fallback strategies)
 * - Description extraction via extractFullDescription utility
 * - Alternative titles extraction
 * - Genre parsing from infobox
 * - Author/writer parsing
 * - Status extraction
 * - Cheerio-based HTML parsing
 *
 * Extracted from main metadata router for better modularity.
 *
 * @deprecated Import from '@/server/trpc/routers/metadata/fandom-fetch' instead
 */

// Re-export everything from the decomposed module
export { metadataFandomFetchRouter } from './fandom-fetch';
export type { FandomMetadata } from './fandom-fetch';
