/**
 * Types for List Page Relationship Extraction
 *
 * These types define the structure for extracting and storing
 * chapter-volume relationships from "Chapters and Volumes" list pages.
 * Optimized for ML training with explicit relationship ground truth.
 */

// ============================================================================
// Token Span Types (for BIO label verification)
// ============================================================================

export interface TokenSpanPosition {
  /** Starting token index (inclusive) */
  start: number;
  /** Ending token index (inclusive) */
  end: number;
}

// ============================================================================
// Volume Extraction Types
// ============================================================================

export interface VolumeExtraction {
  /** Volume sequence number in series (e.g., Vol. 4 → 4) */
  volumeNumber: number;
  /** Volume title if present (e.g., "The Sword of the Stranger") */
  title?: string;
  /** URL to volume detail page */
  url?: string;
  /** ISBN identifier */
  isbn?: string;
  /** Release date string */
  releaseDate?: string;
  /** Cover image URL */
  coverUrl?: string;
  /** First chapter in this volume */
  chapterStart?: number;
  /** Last chapter in this volume */
  chapterEnd?: number;

  /** Token positions for BIO label verification */
  tokenSpans: {
    /** Token position of volume number */
    number?: TokenSpanPosition;
    /** Token range of volume title */
    title?: TokenSpanPosition;
    /** Token position of volume URL */
    url?: TokenSpanPosition;
  };

  /** Table identifier (for multi-table pages) */
  tableId: string;
  /** Row number within the table */
  tableRow: number;
  /** Confidence score (0-1) */
  confidence: number;
}

// ============================================================================
// Chapter Extraction Types
// ============================================================================

/** Source of chapter-volume relationship determination */
export type RelationSourceType =
  | 'SAME_TABLE_ROW' // Chapter and volume in same row
  | 'VOLUME_SECTION' // Chapter under volume header
  | 'EXPLICIT_LABEL' // "Vol. X" text in chapter row
  | 'INFERRED'; // Derived from context

export interface ChapterExtraction {
  /** Chapter number (can be decimal for .5 chapters) */
  chapterNumber: number;
  /** Chapter title if present */
  title?: string;
  /** URL to chapter page */
  url?: string;
  /** Release date string */
  releaseDate?: string;

  /** EXPLICIT relationship - which volume this chapter belongs to */
  belongsToVolume?: number;
  /** How the relationship was determined */
  relationSource: RelationSourceType;

  /** Token positions for BIO label verification */
  tokenSpans: {
    /** Token position of chapter number */
    number?: TokenSpanPosition;
    /** Token range of chapter title */
    title?: TokenSpanPosition;
    /** Token position of chapter URL */
    url?: TokenSpanPosition;
  };

  /** Table identifier */
  tableId: string;
  /** Row number within the table */
  tableRow: number;
  /** Confidence score (0-1) */
  confidence: number;
}

// ============================================================================
// Relationship Types (for relation extraction training)
// ============================================================================

export interface ChapterVolumeRelation {
  /** Chapter number that belongs to the volume */
  chapterNumber: number;
  /** Volume number the chapter belongs to */
  volumeNumber: number;

  /** Token index where chapter number appears */
  chapterTokenIndex: number;
  /** Token index where volume number appears */
  volumeTokenIndex: number;

  /** How the relationship was determined */
  source: RelationSourceType;
  /** Confidence score (0-1) */
  confidence: number;
}

// ============================================================================
// List Page Extraction Result
// ============================================================================

export interface ListPageExtractionResult {
  /** All extracted volumes */
  volumes: VolumeExtraction[];
  /** All extracted chapters */
  chapters: ChapterExtraction[];
  /** Explicit chapter-volume relationship tuples */
  relations: ChapterVolumeRelation[];

  /** Statistics for validation */
  stats: {
    /** Number of tables processed */
    tableCount: number;
    /** Number of volumes extracted */
    volumeCount: number;
    /** Number of chapters extracted */
    chapterCount: number;
    /** Number of chapters with volume assignment */
    assignedChapterCount: number;
    /** Number of chapters without volume assignment */
    unassignedChapterCount: number;
  };
}

// ============================================================================
// Training Export Types
// ============================================================================

export interface ListPageTrainingRecord {
  /** Page identifier */
  pageId: string;
  /** Source URL */
  url: string;

  /** Token sequence with BIO labels (existing format) */
  tokens: Array<{
    text: string;
    label: string;
    tableRow: number | null;
  }>;

  /** Explicit relation tuples for relation extraction training */
  relations: Array<{
    type: 'CHAPTER_IN_VOLUME';
    head: {
      type: string;
      tokenStart: number;
      tokenEnd: number;
      text: string;
    };
    tail: {
      type: string;
      tokenStart: number;
      tokenEnd: number;
      text: string;
    };
    confidence: number;
  }>;

  /** Structured ground truth for validation */
  groundTruth: {
    volumes: Array<{
      number: number;
      title: string | null;
      isbn: string | null;
    }>;
    chapters: Array<{
      number: number;
      title: string | null;
      volumeNumber: number | null;
    }>;
  };
}

// ============================================================================
// Database Writer Types
// ============================================================================

export interface ListPageWriteResult {
  /** Created/updated ListPageRecord ID */
  listPageId: string;
  /** Number of volume records created */
  volumesCreated: number;
  /** Number of chapter records created */
  chaptersCreated: number;
  /** Number of relationships established */
  relationsCreated: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationIssueType =
  | 'DUPLICATE_CHAPTER'
  | 'DUPLICATE_VOLUME'
  | 'MISSING_VOLUME_ASSIGNMENT'
  | 'INVALID_CHAPTER_SEQUENCE'
  | 'OVERLAPPING_VOLUME_RANGES'
  | 'INVALID_ISBN_FORMAT';

export interface ValidationIssue {
  type: ValidationIssueType;
  message: string;
  /** Affected chapter or volume number */
  entityNumber?: number;
  /** Severity: error blocks commit, warning is informational */
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}
