/**
 * VolumesChaptersStep Utilities - Barrel Export
 *
 * Re-exports all utility functions from submodules.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/utils
 */

// Metadata extraction
export {
  extractFandomMetadata,
  extractComicVineMetadata,
  extractWikipediaMetadata,
  extractMangaDexMetadata,
} from './metadata-extraction';

// Volume data extraction
export type { SimpleScrapingProgress } from './volume-data';
export {
  extractVolumeCount,
  extractTotalChapters,
  isScrapingChapters,
  extractScrapingProgress,
  hasExistingVolumes,
} from './volume-data';

// URL extraction
export {
  extractFandomUrl,
  extractComicVineUrl,
  extractWikipediaUrl,
} from './url-extraction';

// Source options
export { getSourceOptions } from './source-options';
