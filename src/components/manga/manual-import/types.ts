/**
 * Manual Import Types
 *
 * Type definitions for the ManualImportModal component and its sub-modules.
 * These types support the chapter-first manual import workflow where users
 * assign downloaded files to existing chapters in the database.
 *
 * @module components/manga/manual-import/types
 */

// =============================================================================
// Core Entity Interfaces
// =============================================================================

/**
 * Chapter entity for manual import operations.
 * Represents a chapter from the database that can have a file assigned to it.
 */
export interface Chapter {
  /** Unique identifier for the chapter */
  id: number;
  /** Display title of the chapter */
  title: string;
  /** Chapter number (e.g., 1, 2, 3.5) - may be undefined for special chapters */
  chapterNumber?: number | undefined;
  /** Index position in the chapter list */
  index: number;
  /** Current download status (e.g., 'pending', 'downloaded', 'failed') */
  downloadStatus: string;
  /** Volume number this chapter belongs to - may be undefined if not categorized */
  volume?: number | undefined;
}

/**
 * Scanned file from the filesystem.
 * Represents a file discovered during directory scanning that can be assigned to chapters.
 */
export interface ScannedFile {
  /** File name with extension */
  name: string;
  /** Full absolute path to the file */
  path: string;
  /** File size in bytes */
  size: number;
  /** Last modification timestamp */
  modified: Date;
  /** File extension (e.g., 'cbz', 'pdf') */
  extension: string;
}

// =============================================================================
// Component Props Interfaces
// =============================================================================

/**
 * Props for the ManualImportModal component.
 * Contains all necessary data and callbacks for the modal operation.
 */
export interface ManualImportModalProps {
  /** Whether the modal is currently open */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Job ID associated with this import operation */
  jobId: string;
  /** Database ID of the manga being imported */
  mangaId: number;
  /** Display title of the manga */
  mangaTitle: string;
  /** List of chapters available for file assignment */
  chapters: Chapter[];
  /** Pre-filled directory path suggestion (e.g., from download job) */
  suggestedPath?: string | undefined;
  /** Full manga data object containing provider metadata for volume enrichment */
  mangaData?: unknown;
}

// =============================================================================
// Directory Browse Interfaces
// =============================================================================

/**
 * Directory entry from filesystem browse operation.
 * Used in the directory browser modal for navigation.
 */
export interface DirectoryEntry {
  /** Name of the directory/file */
  name: string;
  /** Full absolute path */
  path: string;
  /** Whether this entry is a directory (vs file) */
  isDirectory: boolean;
  /** Whether the entry is accessible (readable) by the current user */
  isAccessible: boolean;
}

/**
 * Result data from a directory browse operation.
 * Contains navigation info and list of entries.
 */
export interface BrowseResultData {
  /** Path to parent directory for navigation (undefined at root) */
  parent?: string;
  /** List of directory entries at the current path */
  entries: DirectoryEntry[];
}

// =============================================================================
// Import Operation Types
// =============================================================================

/**
 * Result of a single chapter import operation.
 * Tracks success/failure status for each imported chapter.
 */
export interface ImportResultItem {
  /** Chapter ID that was imported (may be undefined for batch operations) */
  chapterId?: number;
  /** Whether the import succeeded */
  success: boolean;
  /** Error message if the import failed */
  error?: string;
}

/**
 * Aggregated results from a manual import operation.
 * Summarizes the overall import operation with per-chapter details.
 */
export interface ImportResult {
  /** Whether the entire operation was successful (no failures) */
  success: boolean;
  /** Count of successfully imported files */
  filesImported: number;
  /** Count of failed imports */
  filesFailed: number;
  /** Per-chapter import results */
  results: ImportResultItem[];
}

// =============================================================================
// Type Aliases
// =============================================================================

/**
 * Mapping of chapter IDs to their assigned file paths.
 * Key: chapter ID, Value: absolute file path
 */
export type ChapterFileMapping = Record<number, string>;
