/**
 * Shared Source Knowledge
 *
 * Centralized source knowledge layer for manga/anime metadata extraction.
 * Both the ML bootstrap-labeler and app parser bridge import from here.
 *
 * @module shared/source-knowledge
 */

// Core types
export type { SourceType } from './types';

// Source detection
export { detectSourceType, isWikipediaUrl, isComicVineUrl, isFandomUrl } from './source-detection';

// Normalizers
export {
  normalizeStatusValue,
  normalizeDateValue,
  normalizeEntityValue,
  normalizeFormat,
} from './normalizers';

// Selectors
export type { SourceSelectors } from './selectors';
export {
  getSelectorsForSource,
  getSelectorsWithFallback,
  FANDOM_SELECTORS,
  COMICVINE_SELECTORS,
  WIKIPEDIA_SELECTORS,
  ANILIST_SELECTORS,
  GENERIC_SELECTORS,
  matchSelector,
  matchFirstSelector,
  matchAllSelectors,
  extractTextFromSelectors,
  extractAllTextFromSelectors,
} from './selectors';

// Field patterns
export type { FieldPatternMap, DataSourceMap, LabelMap } from './field-patterns';
export {
  FANDOM_LABEL_PATTERNS,
  FANDOM_DATA_SOURCE_MAP,
  FANDOM_LABEL_MAP,
  FANDOM_AUTHOR_KEYS,
  FANDOM_ARTIST_KEYS,
  FANDOM_PUBLISHER_KEYS,
  FANDOM_MAGAZINE_KEYS,
  COMICVINE_LABEL_PATTERNS,
  COMICVINE_WRITER_LABELS,
  COMICVINE_ARTIST_LABELS,
  WIKIPEDIA_LABEL_PATTERNS,
} from './field-patterns';

// Validation
export {
  UNIVERSAL_BLACKLIST,
  TYPE_SPECIFIC_BLACKLISTS,
  isValidEntityContent,
} from './validation';
