/**
 * Content Classifier Module
 *
 * Smart content classification for downloaded manga files.
 * Provides utilities to analyze and classify downloaded content
 * for optimal import handling.
 *
 * @module content-classifier
 *
 * @example
 * ```typescript
 * import { classifyContent } from './content-classifier';
 *
 * // Classify any path (auto-detects file vs directory)
 * const result = await classifyContent('/path/to/download');
 *
 * // Check classification results
 * // result.contentType: 'VOLUME_PACK' | 'CHAPTER_PACK' | etc.
 * // result.recommendation.mode: 'PACK' | 'BULK' | etc.
 * // result.volumes: Detected volume info
 * // result.chapters: Detected chapter info
 * ```
 */

// Main classifier functions
export {
  classifyContent,
  classifyArchive,
  classifyDirectory,
} from './classifier';

// Pattern detection utilities
export {
  extractVolumeNumber,
  extractChapterNumber,
  extractTitle,
  extractGroup,
  extractLanguage,
  parseFilename,
  isLikelyVolume,
  detectFolderStructure,
  groupByVolume,
  groupByChapter,
} from './pattern-detector';

// Types
export type {
  ContentType,
  ArchiveStructure,
  FileClassification,
  VolumeInfo,
  ChapterInfo,
  ClassificationResult,
  ImportRecommendation,
  PatternMatch,
  ClassificationOptions,
} from './types';

export { DEFAULT_CLASSIFICATION_OPTIONS } from './types';
