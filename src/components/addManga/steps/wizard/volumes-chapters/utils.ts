/**
 * VolumesChaptersStep Utilities
 *
 * This file re-exports all utility functions from submodules.
 * The implementation has been split into smaller focused modules:
 * - metadata-extraction.ts - Provider metadata extraction
 * - volume-data.ts - Volume/chapter data extraction
 * - url-extraction.ts - URL extraction from metadata
 * - source-options.ts - Source dropdown options
 *
 * @module components/addManga/steps/wizard/volumes-chapters/utils
 */

// Re-export everything from the utils barrel
export type { SimpleScrapingProgress } from './utils/volume-data';

export {
  // Metadata extraction
  extractFandomMetadata,
  extractComicVineMetadata,
  extractWikipediaMetadata,
  extractMangaDexMetadata,
  // Volume data extraction
  extractVolumeCount,
  extractTotalChapters,
  isScrapingChapters,
  extractScrapingProgress,
  hasExistingVolumes,
  // URL extraction
  extractFandomUrl,
  extractComicVineUrl,
  extractWikipediaUrl,
  // Source options
  getSourceOptions,
} from './utils/index';
