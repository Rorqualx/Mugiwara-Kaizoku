/**
 * Wikipedia Provider Module
 *
 * Exports Wikipedia-specific metadata extraction functions.
 * Handles fetching and processing metadata from Wikipedia search results.
 */

export {
  extractRedirectTitles,
  extractAlternativeTitles,
  extractDescriptionTitle,
  collectAlternativeTitles,
  getWikipediaUrl,
  getMetadataId,
  getSourceId,
  getDescription,
  getCoverImage,
  normalizeToStringArray,
  getRawData,
  calculateChapterCount,
  getVolumeData,
  formatDate,
  logIncomingData,
  logEnhancedResponse,
  buildEnhancedMetadata
} from './helpers';

export { fetchWikipediaWithHtmlFallback } from './html-fallback';
