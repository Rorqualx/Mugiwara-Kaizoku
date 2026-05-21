/**
 * URL Discoverer Submodule Barrel
 *
 * Re-exports all functions for use by the main url-discoverer module.
 *
 * @module url-discoverer
 */

export {
  fetchHtmlContent,
  scorePageContent,
  scoreByExtraction,
  type ExtractionScore,
  type ExtractionScoringConfig,
} from './scoring';

export {
  discoverAllChapterVolumeUrls,
  discoverSupplementaryUrls,
  SUPPLEMENTARY_URL_PATTERNS,
  type MultiSourceDiscoveryResult,
} from './multi-source';

export {
  discoverNovelPageNames,
  type NovelAliasDiscoveryResult,
} from './novel-alias-discovery';
