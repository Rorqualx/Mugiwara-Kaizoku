/**
 * Filename Matcher Types
 *
 * Shared type definitions for the filename matching system
 * used across ComicVine, Fandom, and Wikipedia providers.
 *
 * @module server/services/matching/types
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Parsed filename data for matching
 */
export interface FilenameMatchRequest {
  /** Original filename for reference */
  filename: string;
  /** Parsed title from filename */
  title: string;
  /** Optional volume number extracted from filename */
  volume?: number | undefined;
  /** Optional chapter number extracted from filename */
  chapter?: number | undefined;
  /** Optional year (publication year) extracted from filename */
  year?: number | undefined;
  /** Optional group/publisher tag from filename */
  group?: string | undefined;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Match result for a single file
 */
export interface FilenameMatchResult {
  /** Original request */
  file: FilenameMatchRequest;
  /** Matching volumes sorted by confidence */
  matches: MatchedVolume[];
  /** Best match if confidence >= threshold */
  bestMatch?: MatchedVolume | undefined;
  /** Overall confidence score (0-1) */
  confidence: number;
}

/**
 * A matched volume with scoring details
 */
export interface MatchedVolume {
  /** Volume number */
  volumeNumber: number;
  /** Volume title (if available) */
  title?: string | undefined;
  /** Match confidence score (0-1) */
  confidence: number;
  /** Breakdown of how the score was calculated */
  scoreBreakdown: ScoreBreakdown;
  /** Optional file path if matched to a specific file */
  filePath?: string | undefined;
}

/**
 * Breakdown of match score components
 */
export interface ScoreBreakdown {
  /** Title similarity score (0-1) */
  titleMatch: number;
  /** Volume number match score (0-1) */
  volumeMatch: number;
  /** Chapter number match score (0-1), optional */
  chapterMatch?: number | undefined;
  /** Year match score (0-1), optional */
  yearMatch?: number | undefined;
  /** ISBN match score (0-1), optional for Wikipedia */
  isbnMatch?: number | undefined;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for filename matchers
 */
export interface FilenameMatcherOptions {
  /** Minimum confidence threshold for auto-match (default: 0.85) */
  autoMatchThreshold?: number | undefined;
  /** Maximum results per search (default: 10) */
  maxResultsPerSearch?: number | undefined;
  /** Delay between searches in ms for rate limiting (default: 0) */
  searchDelayMs?: number | undefined;
}

/**
 * Weight configuration for scoring algorithms
 */
export interface ScoringWeights {
  /** Weight for title matching (0-1) */
  title: number;
  /** Weight for volume number matching (0-1) */
  volume: number;
  /** Weight for chapter matching (0-1) */
  chapter?: number | undefined;
  /** Weight for year matching (0-1) */
  year?: number | undefined;
  /** Weight for ISBN matching (0-1) */
  isbn?: number | undefined;
}

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Supported providers for filename matching
 */
export type SupportedProvider = 'comicvine' | 'fandom' | 'wikipedia';

/**
 * Volume data structure used for matching
 * Compatible with universalImportWizard.types.ts Volume interface
 */
export interface VolumeForMatching {
  /** Volume number */
  volumeNumber?: number | undefined;
  /** Alternative volume number field */
  number?: number | undefined;
  /** Volume title */
  title?: string | undefined;
  /** Alternative title fields */
  name?: string | undefined;
  /** English title (Wikipedia) */
  englishTitle?: string | undefined;
  /** Japanese title (Wikipedia) */
  japaneseTitle?: string | undefined;
  /** Alternative titles array */
  alternativeTitles?: string[] | undefined;
  /** Chapter range string, e.g., "1-10" (Wikipedia) */
  chapterRange?: string | undefined;
  /** ISBN identifier */
  isbn?: string | undefined;
  /** Publication year */
  year?: number | undefined;
  /** Release date string */
  releaseDate?: string | undefined;
}

/**
 * Chapter data structure used for matching
 */
export interface ChapterForMatching {
  /** Chapter number */
  number?: number | string | undefined;
  /** Alternative chapter number field */
  chapterNumber?: number | undefined;
  /** Chapter title */
  title?: string | undefined;
  /** Alternative titles */
  alternativeTitles?: string[] | undefined;
  /** Associated volume number */
  volume?: number | undefined;
  /** Release date */
  releaseDate?: string | undefined;
}

// ============================================================================
// Batch Processing Types
// ============================================================================

/**
 * Result of batch matching operation
 */
export interface BatchMatchResult {
  /** Results for each file */
  results: FilenameMatchResult[];
  /** Number of successful auto-matches */
  autoMatchedCount: number;
  /** Number of files with matches but below threshold */
  partialMatchCount: number;
  /** Number of files with no matches */
  unmatchedCount: number;
  /** Total processing time in ms */
  processingTimeMs: number;
}

/**
 * Progress callback for batch operations
 */
export type BatchProgressCallback = (progress: {
  current: number;
  total: number;
  currentFile: string;
}) => void;
