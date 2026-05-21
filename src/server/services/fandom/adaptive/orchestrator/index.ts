/**
 * Orchestrator Submodules
 *
 * Re-exports all helper functions for the adaptive parser orchestrator.
 *
 * @module orchestrator
 */

export {
  buildChapterEntry,
  buildMangaData,
  buildVolumeEntry,
  createFailureResult,
  extractChaptersFromVolumes,
  mergeChapterTitlesFromNumberedList,
  mergeMetadataIntoMangaData,
} from './data-builders';

export type { StandardParsedData } from './data-builders';

export {
  convertAlternatingRowToStandard,
  convertArcBasedToStandard,
  convertBulletedToStandard,
  convertCategoryPageToStandard,
  convertCollapsibleTableToStandard,
  convertNumberedRowToStandard,
  convertPerVolumeChaptersToStandard,
  convertPlainTableToStandard,
} from './result-converters';
