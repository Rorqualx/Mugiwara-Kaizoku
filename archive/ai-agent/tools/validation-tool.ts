/**
 * Validation Tool (Main Export)
 *
 * Re-exports the validation tool from the organized submodules.
 * Maintains backward compatibility with existing imports.
 */

export { validationTool } from './validation-tool/validation-tool';

// Re-export types and functions for convenience
export type { ValidationToolParams } from './validation-tool/validation-tool-types';
export { validateParams } from './validation-tool/validation-params-validator';
export { executeValidation } from './validation-tool/validation-executor';
export {
  validateProviderMatch,
  isValidChapterTitle,
  fixOffByOneChapterVolumeMap,
  findMissingChapters,
  checkVolumeConsistency,
  validateAndFixChapterVolumeMap,
  checkUnlinkedChapters,
  checkOverlappingRanges,
  validateDataQuality,
} from './validation-tool/validation-helpers';
export {
  validateProviderMatchData,
  validateChapterTitleData,
  validateVolumeMapData,
  validateDataQualityData,
} from './validation-tool/validation-data-handlers';