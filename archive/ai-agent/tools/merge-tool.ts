/**
 * Merge Tool (Main Export)
 *
 * Re-exports the merge tool from the organized submodules.
 * Maintains backward compatibility with existing imports.
 */

export { mergeTool } from './merge-tool/merge-tool';

// Re-export types for convenience
export type { MergeToolParams, ProviderChapter } from './merge-tool/merge-tool-types';
export { validateParams } from './merge-tool/merge-tool-param-validators';
export { executeMerge } from './merge-tool/merge-tool-executors';
export {
  validateMergeType,
  validateMangaId,
  validateAvailableProviders,
  validateSelectedProviders,
  validateUserPreferences,
  validateProviderChapters,
  validateForceRefresh,
} from './merge-tool/merge-tool-validators';
export {
  calculateChaptersByVolume,
  countTitlesWithMetadata,
  countUniqueVolumes,
} from './merge-tool/merge-tool-helpers';
export {
  validateIntelligentMergeParams,
  validateSelectedMergeParams,
  validateChaptersMergeParams,
} from './merge-tool/merge-tool-param-validators';