/**
 * Chapter Creator Submodule Index
 *
 * Re-exports types and functions from chapter-creator submodules.
 *
 * @module server/services/library/scanner/chapter-creator
 */

// Types
export type {
  ChapterMappingForImport,
  ParsedFileInfo,
  LinkFilesResult,
  ChapterInfo,
  ChapterUpdate,
  ChapterCreate
} from './types';

// User Mapping Matcher
export {
  isVolumeMappingOnly,
  matchByUserChapterNumber,
  linkVolumeFileByChapterRange,
  linkVolumeFileByVolumeNumber,
  findChaptersByNumberRange,
  processFileWithUserMapping
} from './user-mapping-matcher';

export type { ChapterForMatching } from './user-mapping-matcher';

// Auto Matcher (filename-based)
export {
  parseFileInfo,
  matchFileToChapter,
  linkVolumeFileToChapters,
  buildChapterMaps,
  processFileForLinking,
  tryLinkVolumeToCompletedChapters
} from './auto-matcher';

export type { ChapterMaps } from './auto-matcher';

// Page Count Validator
export {
  calculateChapterBoundaries,
  validateVolumePageCount,
  handlePageCountMismatch
} from './page-count-validator';

export type {
  ChapterForValidation,
  PageCountValidationResult,
  ChapterBoundary
} from './page-count-validator';

// Chapter File Service
export {
  upsertChapterFile,
  upsertChapterFilesBatch,
  switchActiveChapterFile,
  storePageBoundaries,
  resolveAndStoreVolumeBoundaries
} from './chapter-file-service';

export type {
  ChapterFileSourceType,
  ChapterFileInput
} from './chapter-file-service';
