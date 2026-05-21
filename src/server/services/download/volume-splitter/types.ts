/**
 * Volume Splitter Type Definitions
 *
 * Core types for volume splitting operations including chapter detection,
 * metadata validation, and result structures.
 *
 * Extracted from: volumeSplitter.ts (lines 31-85)
 *
 * @module server/services/download/volume-splitter
 */

/**
 * Metadata for validating chapter boundaries
 */
export interface ChapterMetadata {
  chapterNumber: number;
  expectedPageCount?: number;
  title?: string;
}

/**
 * Volume metadata for validation
 */
export interface VolumeMetadata {
  volumeNumber: number;
  totalPages?: number;
  chapters: ChapterMetadata[];
}

/**
 * Detected chapter boundary within a volume
 */
export interface ChapterBoundary {
  chapterNumber: number;
  startIndex: number;
  endIndex: number;
  pageCount: number;
  images: ImageEntry[];
  confidence: number; // 0-1 score based on metadata matching
  matchedMetadata?: ChapterMetadata;
}

/**
 * Image entry with metadata
 */
export interface ImageEntry {
  filename: string;
  index: number;
  buffer: Buffer;
  detectedChapter?: number;
}

/**
 * Result of confidence calculation
 */
export interface ConfidenceResult {
  confidence: number;
  warnings: string[];
}

/**
 * Options for volume splitting operation
 */
export interface SplitOptions {
  /** Minimum confidence threshold for chapter detection (0-1) */
  minConfidence?: number;
  /** Whether to force chapter creation even with low confidence */
  forceSplit?: boolean;
  /** Custom chapter naming pattern */
  chapterNamePattern?: string;
}

/**
 * Result of volume splitting operation
 */
export interface VolumeSplitResult {
  operationId: string;
  volumePath: string;
  volumeName: string;
  totalImages: number;
  detectedChapters: ChapterBoundary[];
  createdFiles: string[];
  method: 'filename' | 'sequential' | 'fallback';
  averageConfidence: number;
  warnings: string[];
  metadata?: VolumeMetadata;
}