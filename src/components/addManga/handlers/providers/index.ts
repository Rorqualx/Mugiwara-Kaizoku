/**
 * Provider URL Parsers
 *
 * Re-exports all provider-specific URL parsing modules.
 *
 * @module providers
 */

export { detectProviderFromUrl } from './provider-detector';
export { parseFandomUrl, transformFandomVolumes } from './fandom-url-parser';
export type { ParseFandomUrlOptions } from './fandom-url-parser';
export { parseWikipediaUrl, parseWikipediaUrlFallback, processWikipediaData } from './wikipedia-url-parser';
export { parseComicVineUrl, extractComicVineVolumeId } from './comicvine-url-parser';
export { scrapeComicVineChaptersInBackground } from './comicvine-chapter-scraper';
