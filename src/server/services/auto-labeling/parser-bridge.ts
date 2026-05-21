/**
 * Parser Bridge
 *
 * Re-exports from the parser-bridge submodules.
 * See parser-bridge/index.ts for the main implementation.
 *
 * @module auto-labeling/parser-bridge
 */

export {
  extractWithParser,
  normalizeEntityValue,
  normalizeStatusValue,
  mergeExtractions,
  mergeSourceSpecificEntities,
  staticAnalysisToLabels,
  enhanceWithStaticAnalysis,
  extractFromWikipedia,
  isWikipediaUrl,
  extractFromComicVineHtml,
  isComicVineUrl,
  DEFAULT_OPTIONS,
} from './parser-bridge/index';

export type {
  ParserExtractionOptions,
  ParserExtractionResult,
} from './parser-bridge/types';
