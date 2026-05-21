/**
 * Metadata Fandom Enhanced Router
 *
 * Re-exports the modularized fandom-enhanced router.
 * Original implementation decomposed into:
 * - page-fetcher.ts: HTTP fetching and HTML processing
 * - volume-parser.ts: Volume table parsing and deduplication
 * - chapter-details-fetcher.ts: Batch chapter details fetching
 * - response-formatter.ts: Format volume/chapter response
 * - index.ts: Main router orchestrating helper modules
 */

export { metadataFandomEnhancedRouter } from './fandom-enhanced';
