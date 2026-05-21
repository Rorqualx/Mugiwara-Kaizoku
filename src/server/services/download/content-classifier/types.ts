/**
 * Content Classifier Types
 *
 * Type definitions for the smart content classification system.
 * Used to detect and classify downloaded manga content structure.
 *
 * @module content-classifier/types
 */

/**
 * Content type classification
 * Describes the overall structure of downloaded content
 */
export type ContentType =
  | 'COMPLETE_SERIES'    // Multiple volumes with chapters organized
  | 'VOLUME_PACK'        // Single volume containing multiple chapters
  | 'CHAPTER_PACK'       // Multiple individual chapter files
  | 'SINGLE_CHAPTER'     // One chapter file (CBZ, ZIP, etc.)
  | 'FLAT_IMAGES'        // Loose images without structure
  | 'MIXED_CONTENT'      // Combination of different types
  | 'UNKNOWN';           // Could not determine structure

/**
 * Archive structure classification
 * Describes the internal organization of an archive
 */
export type ArchiveStructure =
  | 'VOLUME_FOLDERS'     // Contains Vol01/, Vol02/, etc.
  | 'CHAPTER_FOLDERS'    // Contains Ch01/, Ch02/, etc.
  | 'FLAT_FILES'         // All files at root level
  | 'NESTED_MIXED';      // Mix of folders and files

/**
 * File classification result
 */
export interface FileClassification {
  /** Original filename */
  filename: string;
  /** Full file path */
  filePath: string;
  /** File size in bytes */
  size: number;
  /** Whether this is an archive file */
  isArchive: boolean;
  /** Whether this is an image file */
  isImage: boolean;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Detected volume number (if any) */
  volumeNumber?: number | undefined;
  /** Detected chapter number (if any) */
  chapterNumber?: number | undefined;
  /** Detected series/manga title */
  detectedTitle?: string | undefined;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Volume detection result
 */
export interface VolumeInfo {
  /** Volume number */
  volumeNumber: number;
  /** Volume title (if detected) */
  title?: string | undefined;
  /** Files belonging to this volume */
  files: FileClassification[];
  /** Detected chapter count in this volume */
  estimatedChapters: number;
  /** Total size of volume files */
  totalSize: number;
}

/**
 * Chapter detection result
 */
export interface ChapterInfo {
  /** Chapter number (supports decimals like 10.5) */
  chapterNumber: number;
  /** Chapter title (if detected) */
  title?: string | undefined;
  /** Parent volume number (if any) */
  volumeNumber?: number | undefined;
  /** File path or archive entry path */
  filePath: string;
  /** Page count (if detectable) */
  pageCount?: number | undefined;
}

/**
 * Content classification result
 */
export interface ClassificationResult {
  /** Overall content type */
  contentType: ContentType;
  /** Archive structure (if applicable) */
  archiveStructure?: ArchiveStructure | undefined;
  /** Detected series/manga title */
  seriesTitle?: string | undefined;
  /** Detected volumes */
  volumes: VolumeInfo[];
  /** Detected chapters (not in volumes) */
  chapters: ChapterInfo[];
  /** All classified files */
  files: FileClassification[];
  /** Total file count */
  totalFiles: number;
  /** Total size in bytes */
  totalSize: number;
  /** Overall confidence score 0-1 */
  confidence: number;
  /** Classification method used */
  method: 'FILENAME_PATTERNS' | 'FOLDER_STRUCTURE' | 'SIZE_HEURISTICS' | 'COMBINED';
  /** Warnings during classification */
  warnings: string[];
  /** Recommended import action */
  recommendation: ImportRecommendation;
}

/**
 * Import recommendation based on classification
 */
export interface ImportRecommendation {
  /** Recommended import mode */
  mode: 'PACK' | 'BULK' | 'VOLUME_SPLIT' | 'MANUAL';
  /** Whether volume folders should be created */
  createVolumeFolders: boolean;
  /** Whether archive should be split into chapters */
  splitArchive: boolean;
  /** Human-readable description of recommendation */
  description: string;
  /** Confidence in recommendation 0-1 */
  confidence: number;
}

/**
 * Pattern match result from filename analysis
 */
export interface PatternMatch {
  /** Type of pattern matched */
  type: 'VOLUME' | 'CHAPTER' | 'TITLE' | 'GROUP' | 'LANGUAGE';
  /** Extracted value */
  value: string | number;
  /** Start position in string */
  startIndex: number;
  /** End position in string */
  endIndex: number;
  /** Pattern that matched */
  pattern: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Options for content classification
 */
export interface ClassificationOptions {
  /** Deep scan archives to analyze internal structure */
  deepScan?: boolean | undefined;
  /** Use file size heuristics */
  useSizeHeuristics?: boolean | undefined;
  /** Minimum confidence threshold */
  minConfidence?: number | undefined;
  /** Maximum files to scan (for performance) */
  maxFilesToScan?: number | undefined;
}

/**
 * Default classification options
 */
export const DEFAULT_CLASSIFICATION_OPTIONS: ClassificationOptions = {
  deepScan: true,
  useSizeHeuristics: true,
  minConfidence: 0.5,
  maxFilesToScan: 1000,
};
