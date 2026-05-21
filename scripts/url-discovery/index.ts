/**
 * URL Discovery Tool
 *
 * CLI tool for discovering Wikipedia, Fandom, and ComicVine URLs
 * for manga titles in the authoritative CSV.
 *
 * @module url-discovery
 */

// CSV utilities
export * from './csv/types';
export * from './csv/reader';
export * from './csv/writer';

// Provider wrappers
export { discoverWikipedia } from './discover-wikipedia';
export type { WikipediaDiscoveryResult } from './discover-wikipedia';

export { discoverFandom } from './discover-fandom';
export type { FandomDiscoveryResult } from './discover-fandom';

export { discoverComicVine } from './discover-comicvine';
export type { ComicVineDiscoveryResult } from './discover-comicvine';

// Batch processing
export { processInBatches } from './batch-processor';
