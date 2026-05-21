/**
 * Filename Matching Module
 *
 * Exports unified filename matching functionality for
 * matching files to volumes across all providers.
 *
 * @module server/services/matching
 */

// Types
export type {
  FilenameMatchRequest,
  FilenameMatchResult,
  MatchedVolume,
  ScoreBreakdown,
  FilenameMatcherOptions,
  ScoringWeights,
  SupportedProvider,
  VolumeForMatching,
  ChapterForMatching,
  BatchMatchResult,
  BatchProgressCallback,
} from './types';

// Base utilities
export {
  normalizeTitle,
  levenshteinDistance,
  calculateTitleScore,
  calculateJaccardSimilarity,
  calculateYearScore,
  calculateVolumeScore,
  calculateChapterScore,
  extractVolumeNumber,
  extractChapterNumber,
  extractYearFromFilename,
  extractTitleFromFilename,
  parseFilename,
  calculateConfidence,
  getVolumeNumber,
  getVolumeTitle,
  getVolumeTitles,
  parseChapterRange,
  extractYearFromVolume,
  buildMatchResult,
  sleep,
  groupFilesByTitle,
} from './base-filename-matcher';

// Unified matcher
export {
  UnifiedFilenameMatcher,
  getUnifiedFilenameMatcher,
  matchFilesToVolumes,
  parseFile,
} from './unified-filename-matcher';

export type {
  UnifiedMatcherOptions,
  MatchContext,
} from './unified-filename-matcher';
