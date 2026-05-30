// @file-size-justified: Cohesive type definitions for 4-stage import pipeline - splitting types across files reduces discoverability
/**
 * Import Pipeline Types
 *
 * Type definitions for the 4-stage pipeline-based file import system.
 * Uses combined detect+match stage for progressive matching.
 *
 * @module components/library/import-pipeline/types
 */

import type { ProviderMatch } from '@/types/domain/enrichment-result-types';
import type { ExtendedMangaSearchResult } from '@/types/search.types';

// ============================================================================
// Pipeline Stage Types
// ============================================================================

/**
 * Pipeline stages in order
 */
export type PipelineStage =
  | 'select'        // Stage 1: Select source directory and library
  | 'detect_match'  // Stage 2: Combined scan + progressive metadata matching
  | 'review'        // Stage 3: Review before import
  | 'import'        // Stage 4: Execute import
  | 'complete';     // Done - show summary

/**
 * Stage index for Mantine Stepper (0-based)
 */
export const STAGE_INDEX: Record<PipelineStage, number> = {
  select: 0,
  detect_match: 1,
  review: 2,
  import: 3,
  complete: 3, // Same as import (shows completion state)
} as const;

// ============================================================================
// Combined Detect + Match Types
// ============================================================================

/**
 * Combined progress state for detect+match stage
 */
export interface DetectMatchProgress {
  // Scan progress
  scanCurrent: number;
  scanTotal: number;
  scanStatus: string;
  isScanComplete: boolean;

  // Match progress
  matchCurrent: number;
  matchTotal: number;
  matchQueue: number;      // Items waiting to be matched
  isMatchComplete: boolean;
}

/**
 * Default detect+match progress state
 */
export const DEFAULT_DETECT_MATCH_PROGRESS: DetectMatchProgress = {
  scanCurrent: 0,
  scanTotal: 0,
  scanStatus: 'Ready to scan',
  isScanComplete: false,
  matchCurrent: 0,
  matchTotal: 0,
  matchQueue: 0,
  isMatchComplete: false,
};

/**
 * Combined stats for detect+match stage
 */
export interface DetectMatchStats {
  discovered: number;
  matched: number;
  highConfidence: number;
  lowConfidence: number;
  noMatch: number;
  errors: number;
  duplicates: number;
}

/**
 * Calculate detect+match stats from matched items
 */
export function calculateDetectMatchStats(
  items: MatchedMangaItem[],
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): DetectMatchStats {
  return items.reduce(
    (acc, item) => {
      const isHighConfidence = item.confidence >= thresholds.high;
      const isLowConfidence = item.confidence >= thresholds.low && item.confidence < thresholds.high;

      return {
        discovered: acc.discovered + 1,
        matched: acc.matched + (item.status === 'matched' || item.status === 'manual' ? 1 : 0),
        highConfidence: acc.highConfidence + (item.selectedMatch && isHighConfidence ? 1 : 0),
        lowConfidence: acc.lowConfidence + (item.selectedMatch && isLowConfidence ? 1 : 0),
        noMatch: acc.noMatch + (item.status === 'no_match' ? 1 : 0),
        errors: acc.errors + (item.status === 'error' ? 1 : 0),
        duplicates: acc.duplicates + (item.isDuplicate ? 1 : 0),
      };
    },
    { discovered: 0, matched: 0, highConfidence: 0, lowConfidence: 0, noMatch: 0, errors: 0, duplicates: 0 }
  );
}

// ============================================================================
// Scanned Item Types
// ============================================================================

/**
 * Individual file info from scan
 */
export interface ScannedFileInfo {
  /** File name */
  name: string;
  /** Full file path */
  path: string;
  /** File size in bytes */
  size: number;
  /** Parsed chapter number (if detected) */
  chapterNumber?: number;
  /** Parsed volume number (if detected) */
  volumeNumber?: number;
  /** File extension (cbz, cbr, pdf, etc.) */
  extension: string;
}

/**
 * A manga directory/group detected during scanning
 */
export interface ScannedMangaItem {
  /** Unique identifier (path-based hash) */
  id: string;
  /** Full path to the manga directory */
  path: string;
  /** Title parsed from directory name */
  parsedTitle: string;
  /** Clean title for searching */
  cleanTitle: string;
  /** Number of chapter files found */
  fileCount: number;
  /** Total size of all files in bytes */
  fileSize: number;
  /** Whether this manga already exists in library */
  isDuplicate: boolean;
  /** Existing manga ID if duplicate */
  duplicateOfId?: number;
  /** Existing manga title if duplicate */
  duplicateOfTitle?: string;
  /** Cover image URL of existing manga (for duplicates) */
  duplicateCoverImage?: string;
  /** Similarity score from duplicate detection (0-1) */
  duplicateScore?: number;
  /** Publication year extracted from folder name (e.g., "Monster (1995)" → 1995) */
  year?: number;
  /** Any parsing errors */
  error?: string;
  /** List of individual files found */
  files?: ScannedFileInfo[];
  /** Source paths merged into this row (set when scanner emits multiple sibling
   * folders that resolve to the same library manga or the same parsed title).
   * Always contains at least one entry — the row's own `path`. */
  mergedPaths?: string[];
  /** Convenience: mergedPaths.length. Rendered as "Files from N folders". */
  mergedCount?: number;
  /** True when the scanner couldn't derive a real title from filenames or the
   * directory name (e.g. folder contains only `Volume 01.cbz` … `Volume 20.cbz`
   * with no series prefix). The wizard surfaces these as needing manual title
   * entry and refuses to auto-import them. */
  requiresManualTitle?: boolean;
}

// ============================================================================
// Metadata Matching Types
// ============================================================================

/**
 * Match status for a single import item
 */
export type MatchStatus =
  | 'pending'        // Not yet processed
  | 'matching'       // Currently searching
  | 'matched'        // Auto-matched with high confidence (≥85%)
  | 'low_confidence' // Matched but below threshold (50-84%), needs review
  | 'no_match'       // No matches found
  | 'manual'         // User manually selected a match
  | 'unmatched'      // User explicitly removed match
  | 'skipped'        // User chose to skip metadata
  | 'error';         // Error during matching

/**
 * Confidence level thresholds
 */
export interface ConfidenceThresholds {
  /** High confidence - auto-accept (default: 0.85) */
  high: number;
  /** Medium confidence - suggested (default: 0.70) */
  medium: number;
  /** Low confidence - needs review (default: 0.50) */
  low: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  high: 0.90,
  medium: 0.70,
  low: 0.50,
} as const;

/**
 * Get confidence level from score
 */
export function getConfidenceLevel(
  confidence: number,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): 'high' | 'medium' | 'low' | 'very_low' {
  if (confidence >= thresholds.high) return 'high';
  if (confidence >= thresholds.medium) return 'medium';
  if (confidence >= thresholds.low) return 'low';
  return 'very_low';
}

/**
 * Get Mantine color for confidence level
 */
export function getConfidenceColor(
  confidence: number,
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): 'green' | 'yellow' | 'orange' | 'red' {
  const level = getConfidenceLevel(confidence, thresholds);
  switch (level) {
    case 'high':
      return 'green';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'orange';
    case 'very_low':
    default:
      return 'red';
  }
}

/**
 * A provider match with additional UI metadata
 */
export interface EnrichedProviderMatch extends ProviderMatch {
  /** Provider name (anilist, comicvine, fandom, wikipedia) */
  provider: string;
  /** Whether this is the primary/selected match */
  isPrimary?: boolean;
}

/**
 * A manga item with metadata matching information
 */
export interface MatchedMangaItem extends ScannedMangaItem {
  /** Current match status */
  status: MatchStatus;
  /** Selected match (if any) */
  selectedMatch: EnrichedProviderMatch | null;
  /** Confidence score of selected match (0-1) */
  confidence: number;
  /** All available matches from auto-matching */
  availableMatches: EnrichedProviderMatch[];
  /** Best match per provider (auto-selected from availableMatches) */
  providerMatches: Map<string, EnrichedProviderMatch>;
  /** Whether user is currently searching for alternatives */
  isSearching: boolean;
  /** Manual search results (if searching) */
  searchResults: ExtendedMangaSearchResult[];
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Timestamp of last update */
  lastUpdated: number;
  /** File-to-chapter mappings for import (volume/chapter assignments) */
  chapterMappings: Map<string, FileToChapterMapping>;
  /** For IN_LIBRARY rows: how many of the on-disk files would create new
   * chapter rows when imported (computed from a server-side comparison
   * against existing Chapter.chapterNumber/volume). undefined = not yet
   * computed. 0 = nothing to add (UI hides these by default). */
  newChapters?: number;
}

/**
 * Filter options for the match stage
 */
export type MatchFilter =
  | 'all'
  | 'matched'
  | 'needs_review'
  | 'no_match'
  | 'unmatched';

/**
 * Batch action types for the match stage
 */
export type BatchMatchAction =
  | 'accept_high_confidence'   // Accept all matches ≥85%
  | 'accept_all_suggested'     // Accept all matches ≥70%
  | 'unmatch_low_confidence'   // Unmatch all <70%
  | 'unmatch_all'              // Clear all matches
  | 'retry_no_matches'         // Re-run matching for unmatched items
  | 'skip_unmatched';          // Skip all unmatched items

// ============================================================================
// Import Types
// ============================================================================

/** How files are handled during import */
export type FileMode = 'keep_in_place' | 'move' | 'copy';

/**
 * Import options for the review stage
 */
export interface ImportOptions {
  /** Create chapter entries from files */
  createChapters: boolean;
  /** Download cover images from providers */
  downloadCovers: boolean;
  /** How files are handled: keep_in_place (reference), move (relocate), copy (duplicate) */
  fileMode: FileMode;
  /** Set monitoring status after import */
  setMonitoring?: 'none' | 'daily' | 'weekly';
  /** When true, IN_LIBRARY rows whose on-disk content adds new chapters
   * (newChapters > 0) are auto-selected for import. The server's existing
   * `linkFilesToExistingChapters` path merges by chapter number; this Switch
   * just controls whether those rows are pre-ticked. */
  topUpExisting: boolean;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  createChapters: true,
  downloadCovers: true,
  fileMode: 'move',
  setMonitoring: 'none',
  topUpExisting: true,
} as const;

/**
 * Import status for a single item
 */
export type ImportStatus =
  | 'pending'    // Waiting to import
  | 'importing'  // Currently importing
  | 'success'    // Import successful
  | 'error';     // Import failed

/**
 * Import result for a single item
 */
export interface ImportResult {
  /** Item ID */
  itemId: string;
  /** Import status */
  status: ImportStatus;
  /** Created manga ID (if successful) */
  mangaId?: number;
  /** Created manga title */
  mangaTitle?: string;
  /** Error message (if failed) */
  error?: string;
  /** Number of chapters created */
  chaptersCreated?: number;
}

// ============================================================================
// Pipeline State Types
// ============================================================================

/**
 * Scan progress state
 */
export interface ScanProgress {
  /** Current item being processed */
  current: number;
  /** Total items to process */
  total: number;
  /** Status message */
  status: string;
  /** Current file/folder name */
  currentItem?: string;
  /** Whether scan is complete */
  isComplete: boolean;
  /** Whether scan was cancelled */
  isCancelled: boolean;
}

/**
 * Match progress state
 */
export interface MatchProgress {
  /** Current item being matched */
  current: number;
  /** Total items to match */
  total: number;
  /** Whether matching is in progress */
  isMatching: boolean;
}

/**
 * Import progress state
 */
export interface ImportProgress {
  /** Current item being imported */
  current: number;
  /** Total items to import */
  total: number;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Whether import was cancelled */
  isCancelled: boolean;
}

/**
 * Complete pipeline state
 */
export interface ImportPipelineState {
  // Current stage
  stage: PipelineStage;

  // Stage 1: Source selection
  selectedLibraryId: number | null;
  scanPath: string;

  // Stage 2: Combined Detect + Match (progressive matching)
  detectMatchProgress: DetectMatchProgress;
  scannedItems: ScannedMangaItem[];
  matchedItems: Map<string, MatchedMangaItem>;
  scanJobId: string | null;
  activeFilter: MatchFilter;
  confidenceThresholds: ConfidenceThresholds;
  isCancelled: boolean;

  // Stage 3: Review
  selectedForImport: Set<string>;
  importOptions: ImportOptions;

  // Stage 4: Import
  importProgress: ImportProgress;
  importResults: Map<string, ImportResult>;

  // Errors
  errors: PipelineError[];
}

/**
 * Pipeline error
 */
export interface PipelineError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stage where error occurred */
  stage: PipelineStage;
  /** Timestamp */
  timestamp: number;
  /** Associated item ID (if applicable) */
  itemId?: string;
}

// ============================================================================
// Pipeline Action Types
// ============================================================================

/**
 * Pipeline actions for the reducer
 */
export type PipelineAction =
  // Navigation
  | { type: 'GO_TO_STAGE'; stage: PipelineStage }
  | { type: 'NEXT_STAGE' }
  | { type: 'PREV_STAGE' }
  | { type: 'RESET' }

  // Stage 1: Source selection
  | { type: 'SET_LIBRARY'; libraryId: number }
  | { type: 'SET_SCAN_PATH'; path: string }

  // Stage 2: Combined Detect + Match (progressive matching)
  | { type: 'START_DETECT_MATCH'; jobId: string }
  | { type: 'UPDATE_DETECT_MATCH_PROGRESS'; progress: Partial<DetectMatchProgress> }
  | { type: 'ITEM_DISCOVERED'; item: ScannedMangaItem }
  | { type: 'SET_SCANNED_ITEMS'; items: ScannedMangaItem[] }
  | { type: 'ITEM_MATCH_STARTED'; itemId: string }
  | { type: 'ITEM_MATCH_COMPLETE'; itemId: string; match: EnrichedProviderMatch | null; availableMatches: EnrichedProviderMatch[] }
  | { type: 'SET_ITEM_MATCH'; itemId: string; match: EnrichedProviderMatch | null; availableMatches?: EnrichedProviderMatch[] }
  | { type: 'SET_ITEM_STATUS'; itemId: string; status: MatchStatus; error?: string }
  | { type: 'SET_MATCHED_ITEMS'; items: Map<string, MatchedMangaItem> }
  | { type: 'DETECT_MATCH_SCAN_COMPLETE' }
  | { type: 'DETECT_MATCH_COMPLETE' }
  | { type: 'CANCEL_DETECT_MATCH' }
  | { type: 'SET_MISSING_CHAPTERS_RESULTS'; results: Array<{ mangaId: number; newChapters: number }> }
  | { type: 'SET_ITEM_SEARCH_RESULTS'; itemId: string; availableMatches: EnrichedProviderMatch[] }
  | { type: 'SET_ACTIVE_FILTER'; filter: MatchFilter }
  | { type: 'SET_CONFIDENCE_THRESHOLDS'; thresholds: ConfidenceThresholds }

  // Stage 3: Review
  | { type: 'SELECT_FOR_IMPORT'; itemId: string }
  | { type: 'DESELECT_FOR_IMPORT'; itemId: string }
  | { type: 'SELECT_ALL_FOR_IMPORT' }
  | { type: 'DESELECT_ALL_FOR_IMPORT' }
  | { type: 'SET_IMPORT_OPTIONS'; options: Partial<ImportOptions> }
  | { type: 'SET_ITEM_CHAPTER_MAPPINGS'; itemId: string; mappings: Map<string, FileToChapterMapping> }

  // Stage 4: Import
  | { type: 'START_IMPORT' }
  | { type: 'UPDATE_IMPORT_PROGRESS'; progress: Partial<ImportProgress> }
  | { type: 'SET_IMPORT_RESULT'; result: ImportResult }
  | { type: 'IMPORT_COMPLETE' }
  | { type: 'CANCEL_IMPORT' }

  // Errors
  | { type: 'ADD_ERROR'; error: PipelineError }
  | { type: 'CLEAR_ERRORS' };

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for stage components
 */
export interface StageProps {
  /** Go to next stage */
  onNext: () => void;
  /** Go to previous stage */
  onBack: () => void;
  /** Cancel and close pipeline */
  onCancel: () => void;
}

/**
 * Props for SelectSourceStage
 */
export interface SelectSourceStageProps extends StageProps {
  selectedLibraryId: number | null;
  scanPath: string;
  onLibraryChange: (libraryId: number) => void;
  onPathChange: (path: string) => void;
}

/**
 * Props for ScanDetectStage
 */
export interface ScanDetectStageProps extends StageProps {
  libraryId: number;
  scanPath: string;
  progress: ScanProgress;
  items: ScannedMangaItem[];
  onStartScan: () => void;
  onCancelScan: () => void;
}

/**
 * Props for MatchMetadataStage
 */
export interface MatchMetadataStageProps extends StageProps {
  items: MatchedMangaItem[];
  progress: MatchProgress;
  activeFilter: MatchFilter;
  thresholds: ConfidenceThresholds;
  onFilterChange: (filter: MatchFilter) => void;
  onItemMatchChange: (itemId: string, match: EnrichedProviderMatch | null) => void;
  onItemStatusChange: (itemId: string, status: MatchStatus) => void;
  onBatchAction: (action: BatchMatchAction) => void;
  onRetryMatching: (itemIds: string[]) => void;
}

/**
 * Props for ReviewStage
 */
export interface ReviewStageProps extends StageProps {
  items: MatchedMangaItem[];
  selectedIds: Set<string>;
  importOptions: ImportOptions;
  onSelectionChange: (itemId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOptionsChange: (options: Partial<ImportOptions>) => void;
}

/**
 * Props for ImportStage
 */
export interface ImportStageProps extends StageProps {
  items: MatchedMangaItem[];
  progress: ImportProgress;
  results: Map<string, ImportResult>;
  onStartImport: () => void;
  onCancelImport: () => void;
  onViewManga: (mangaId: number) => void;
  onImportMore: () => void;
}

// ============================================================================
// Stats Types
// ============================================================================

/**
 * Summary statistics for scan results
 */
export interface ScanStats {
  total: number;
  duplicates: number;
  errors: number;
  ready: number;
}

/**
 * Summary statistics for match results
 */
export interface MatchStats {
  total: number;
  matched: number;
  highConfidence: number;
  lowConfidence: number;
  noMatch: number;
  unmatched: number;
  skipped: number;
}

/**
 * Summary statistics for import results
 */
export interface ImportStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  chaptersCreated: number;
}

/**
 * Calculate scan stats from items
 */
export function calculateScanStats(items: ScannedMangaItem[]): ScanStats {
  return items.reduce(
    (acc, item) => ({
      total: acc.total + 1,
      duplicates: acc.duplicates + (item.isDuplicate ? 1 : 0),
      errors: acc.errors + (item.error ? 1 : 0),
      ready: acc.ready + (!item.isDuplicate && !item.error ? 1 : 0),
    }),
    { total: 0, duplicates: 0, errors: 0, ready: 0 }
  );
}

/**
 * Calculate match stats from items
 */
export function calculateMatchStats(
  items: MatchedMangaItem[],
  thresholds: ConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS
): MatchStats {
  return items.reduce(
    (acc, item) => {
      const isHighConfidence = item.confidence >= thresholds.high;
      const isLowConfidence = item.confidence >= thresholds.low && item.confidence < thresholds.high;

      return {
        total: acc.total + 1,
        matched: acc.matched + (item.status === 'matched' || item.status === 'manual' ? 1 : 0),
        highConfidence: acc.highConfidence + (item.selectedMatch && isHighConfidence ? 1 : 0),
        lowConfidence: acc.lowConfidence + (item.selectedMatch && isLowConfidence ? 1 : 0),
        noMatch: acc.noMatch + (item.status === 'no_match' ? 1 : 0),
        unmatched: acc.unmatched + (item.status === 'unmatched' ? 1 : 0),
        skipped: acc.skipped + (item.status === 'skipped' ? 1 : 0),
      };
    },
    { total: 0, matched: 0, highConfidence: 0, lowConfidence: 0, noMatch: 0, unmatched: 0, skipped: 0 }
  );
}

/**
 * Calculate import stats from results
 */
export function calculateImportStats(results: Map<string, ImportResult>): ImportStats {
  const stats = { total: 0, success: 0, failed: 0, pending: 0, chaptersCreated: 0 };

  results.forEach((result) => {
    stats.total++;
    switch (result.status) {
      case 'success':
        stats.success++;
        stats.chaptersCreated += result.chaptersCreated ?? 0;
        break;
      case 'error':
        stats.failed++;
        break;
      case 'pending':
      case 'importing':
        stats.pending++;
        break;
      default:
        break;
    }
  });

  return stats;
}

// ============================================================================
// File-to-Chapter Mapping Types
// ============================================================================

/**
 * Unified metadata chapter from any provider
 * Normalizes chapter data from ComicVine, Fandom, AniList, etc.
 */
export interface MetadataChapter {
  /** Unique identifier (provider-prefixed) */
  id: string;
  /** Provider source */
  provider: string;
  /** Chapter number (float for decimals like 10.5) */
  number: number;
  /** Volume number this chapter belongs to (optional) */
  volumeNumber?: number;
  /** Chapter title */
  title?: string;
  /** Cover image URL */
  coverImage?: string;
  /** Page count (if known) */
  pages?: number;
  /** Release/publish date */
  releaseDate?: string;
  /** Summary/description */
  summary?: string;
  /** Link to chapter page on wiki */
  url?: string;
}

/**
 * Unified metadata volume from any provider
 */
export interface MetadataVolume {
  /** Unique identifier (provider-prefixed) */
  id: string;
  /** Provider source */
  provider: string;
  /** Volume number */
  number: number;
  /** Volume title */
  title?: string;
  /** Volume cover image */
  coverImage?: string;
  /** Chapters contained in this volume */
  chapters: MetadataChapter[];
  /** Total chapter count */
  chapterCount: number;
}

// ============================================================================
// Metadata Source Tracking Types
// ============================================================================

/**
 * Source of extracted metadata chapters
 * - library: Chapters from existing library manga record
 * - provider: Chapters from external provider (ComicVine, Fandom, etc.)
 * - synthetic: Generated chapters from file count or volume/chapter counts
 */
export type MetadataSource = 'library' | 'provider' | 'synthetic';

/**
 * Result from extractMetadataFromProvider() with source tracking
 */
export interface ExtractedMetadataResult {
  /** Extracted volumes with chapters */
  volumes: MetadataVolume[];
  /** Flat list of all chapters */
  chapters: MetadataChapter[];
  /** Where this metadata came from */
  source: MetadataSource;
  /** Provider name ('anilist', 'fandom', 'comicvine', 'library', 'generated') */
  sourceProvider: string;
  /** Total chapter count */
  totalChapters: number;
  /** Total volume count */
  totalVolumes: number;
}

/**
 * Get display label for metadata source
 */
export function getMetadataSourceLabel(source: MetadataSource, provider: string, hasVolumes?: boolean): string {
  switch (source) {
    case 'library':
      return 'Library Chapters';
    case 'provider':
      return `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Data`;
    case 'synthetic':
      return hasVolumes ? 'Generated Volumes' : 'Generated Chapters';
    default:
      return 'Unknown Source';
  }
}

/**
 * Get Mantine color for metadata source badge
 */
export function getMetadataSourceColor(source: MetadataSource): string {
  switch (source) {
    case 'library':
      return 'teal';
    case 'provider':
      return 'violet';
    case 'synthetic':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Match status for a file-to-chapter mapping
 */
export type FileMatchStatus =
  | 'auto_matched'     // Automatically matched by algorithm
  | 'manual_matched'   // User manually linked
  | 'unmatched'        // No match yet
  | 'skipped'          // User explicitly skipped
  | 'duplicate';       // Same chapter#/volume# as another already-matched file

/**
 * A mapping between a scanned file and a metadata chapter
 */
export interface FileToChapterMapping {
  /** File path (unique identifier) */
  filePath: string;
  /** Reference to the scanned file */
  file: ScannedFileInfo;
  /** Matched metadata chapter (null if unmatched) */
  metadataChapter: MetadataChapter | null;
  /** Match status */
  status: FileMatchStatus;
  /** Confidence score (0-1) for auto-matches */
  confidence: number;
  /** Why this match was made */
  matchReason?: string;
  /** All chapters contained in this volume (for volume files only) */
  volumeChapters?: MetadataChapter[];
}

/**
 * Serializable version of FileToChapterMapping for sending to backend
 */
export interface ChapterMappingForImport {
  /** File path (used to match against destination files) */
  filePath: string;
  /** Chapter number from metadata */
  chapterNumber?: number;
  /** Volume number from metadata or file */
  volumeNumber?: number;
  /** Chapter title from metadata */
  title?: string;
  /** For volume files: first chapter number in the volume */
  chapterRangeStart?: number;
  /** For volume files: last chapter number in the volume */
  chapterRangeEnd?: number;
  /** Page count from metadata (for validation) */
  pageCount?: number;
  /** Cover image URL from metadata */
  coverImage?: string;
  /** Chapter description/summary from metadata */
  description?: string;
  /** Release date from metadata (ISO string) */
  releaseDate?: string;
  /** URL to chapter page on wiki/source */
  sourceUrl?: string;
}

/**
 * State for the file-to-chapter matching UI
 */
export interface ChapterMatchingState {
  /** All metadata volumes from provider */
  volumes: MetadataVolume[];
  /** All metadata chapters (flat list) */
  chapters: MetadataChapter[];
  /** All file-to-chapter mappings */
  mappings: Map<string, FileToChapterMapping>;
  /** Currently selected file for manual matching */
  selectedFilePath: string | null;
  /** Currently selected metadata chapter for manual matching */
  selectedChapterId: string | null;
  /** Whether auto-matching has been run */
  autoMatchingComplete: boolean;
  /** Match statistics */
  stats: ChapterMatchingStats;
}

/**
 * Statistics for chapter matching
 */
export interface ChapterMatchingStats {
  /** Total files to match */
  totalFiles: number;
  /** Files auto-matched */
  autoMatched: number;
  /** Files manually matched */
  manualMatched: number;
  /** Files still unmatched */
  unmatched: number;
  /** Files skipped */
  skipped: number;
  /** Files detected as duplicates of an already-matched file */
  duplicate: number;
  /** Total metadata chapters available */
  totalMetadataChapters: number;
  /** Metadata chapters that have a file mapped */
  mappedMetadataChapters: number;
}

/**
 * Actions for the chapter matching reducer
 */
export type ChapterMatchingAction =
  | { type: 'SET_METADATA'; volumes: MetadataVolume[]; chapters: MetadataChapter[] }
  | { type: 'SET_FILES'; files: ScannedFileInfo[] }
  | { type: 'AUTO_MATCH' }
  | { type: 'MANUAL_MATCH'; filePath: string; chapterId: string }
  | { type: 'UNMATCH_FILE'; filePath: string }
  | { type: 'SKIP_FILE'; filePath: string }
  | { type: 'SELECT_FILE'; filePath: string | null }
  | { type: 'SELECT_CHAPTER'; chapterId: string | null }
  | { type: 'RESET_MATCHES' }
  | { type: 'UPDATE_STATS' };

/**
 * Calculate chapter matching stats
 */
export function calculateChapterMatchingStats(
  mappings: Map<string, FileToChapterMapping>,
  chapters: MetadataChapter[]
): ChapterMatchingStats {
  const stats: ChapterMatchingStats = {
    totalFiles: mappings.size,
    autoMatched: 0,
    manualMatched: 0,
    unmatched: 0,
    skipped: 0,
    duplicate: 0,
    totalMetadataChapters: chapters.length,
    mappedMetadataChapters: 0,
  };

  const mappedChapterIds = new Set<string>();

  mappings.forEach((mapping) => {
    switch (mapping.status) {
      case 'auto_matched':
        stats.autoMatched++;
        // For volume matches, all chapters in the volume are mapped
        if (mapping.volumeChapters && mapping.volumeChapters.length > 0) {
          mapping.volumeChapters.forEach((ch) => mappedChapterIds.add(ch.id));
        } else if (mapping.metadataChapter) {
          mappedChapterIds.add(mapping.metadataChapter.id);
        }
        break;
      case 'manual_matched':
        stats.manualMatched++;
        // For volume matches, all chapters in the volume are mapped
        if (mapping.volumeChapters && mapping.volumeChapters.length > 0) {
          mapping.volumeChapters.forEach((ch) => mappedChapterIds.add(ch.id));
        } else if (mapping.metadataChapter) {
          mappedChapterIds.add(mapping.metadataChapter.id);
        }
        break;
      case 'unmatched':
        stats.unmatched++;
        break;
      case 'skipped':
        stats.skipped++;
        break;
      case 'duplicate':
        stats.duplicate++;
        break;
      default:
        // Future-proof: Handle any unknown status
        break;
    }
  });

  stats.mappedMetadataChapters = mappedChapterIds.size;

  return stats;
}

